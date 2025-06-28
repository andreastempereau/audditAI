import { createCipheriv, createDecipheriv, randomBytes, createHash, pbkdf2Sync, createHmac } from 'crypto';

export interface EncryptionKey {
  id: string;
  key: Buffer;
  algorithm: string;
  createdAt: Date;
  status: 'active' | 'rotating' | 'deprecated';
}

export interface EncryptedData {
  data: string; // Base64 encoded encrypted data
  keyId: string;
  algorithm: string;
  iv: string; // Base64 encoded initialization vector
  tag?: string; // Base64 encoded authentication tag (for AEAD)
  version: number;
}

export interface KeyRotationPolicy {
  rotationInterval: number; // days
  warningPeriod: number; // days before rotation
  retentionPeriod: number; // days to keep old keys
  automaticRotation: boolean;
}

export class EncryptionService {
  private keys: Map<string, EncryptionKey> = new Map();
  private activeKeyId: string | null = null;
  private algorithm = 'aes-256-gcm';
  private keyDerivationIterations = 100000;

  constructor(
    private masterPassword?: string,
    private rotationPolicy: KeyRotationPolicy = {
      rotationInterval: 90,
      warningPeriod: 7,
      retentionPeriod: 365,
      automaticRotation: true
    }
  ) {
    this.initializeDefaultKey();
    
    // Start automatic rotation timer if enabled
    if (this.rotationPolicy.automaticRotation) {
      setInterval(() => this.checkKeyRotation(), 24 * 60 * 60 * 1000); // Daily check
    }
  }

  private initializeDefaultKey(): void {
    if (!this.masterPassword) {
      this.masterPassword = process.env.ENCRYPTION_MASTER_KEY || this.generateSecurePassword();
    }

    const keyId = crypto.randomUUID();
    const key = this.deriveKey(this.masterPassword, keyId);
    
    const encryptionKey: EncryptionKey = {
      id: keyId,
      key,
      algorithm: this.algorithm,
      createdAt: new Date(),
      status: 'active'
    };

    this.keys.set(keyId, encryptionKey);
    this.activeKeyId = keyId;
  }

  private deriveKey(password: string, salt: string): Buffer {
    return pbkdf2Sync(password, salt, this.keyDerivationIterations, 32, 'sha256');
  }

  private generateSecurePassword(): string {
    return randomBytes(32).toString('base64');
  }

  async encrypt(data: string, keyId?: string): Promise<EncryptedData> {
    const useKeyId = keyId || this.activeKeyId;
    if (!useKeyId) {
      throw new Error('No encryption key available');
    }

    const encryptionKey = this.keys.get(useKeyId);
    if (!encryptionKey) {
      throw new Error(`Encryption key not found: ${useKeyId}`);
    }

    if (encryptionKey.status === 'deprecated') {
      throw new Error('Cannot encrypt with deprecated key');
    }

    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, encryptionKey.key, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const tag = (cipher as any).getAuthTag();

    return {
      data: encrypted,
      keyId: useKeyId,
      algorithm: this.algorithm,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      version: 1
    };
  }

  async decrypt(encryptedData: EncryptedData): Promise<string> {
    const encryptionKey = this.keys.get(encryptedData.keyId);
    if (!encryptionKey) {
      throw new Error(`Decryption key not found: ${encryptedData.keyId}`);
    }

    const iv = Buffer.from(encryptedData.iv, 'base64');
    const tag = encryptedData.tag ? Buffer.from(encryptedData.tag, 'base64') : undefined;
    
    const decipher = createDecipheriv(encryptedData.algorithm, encryptionKey.key, iv);
    
    if (tag && (decipher as any).setAuthTag) {
      (decipher as any).setAuthTag(tag);
    }

    let decrypted = decipher.update(encryptedData.data, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  async encryptDocument(content: Buffer, metadata: any): Promise<{
    encryptedContent: EncryptedData;
    encryptedMetadata: EncryptedData;
    contentHash: string;
  }> {
    const contentHash = createHash('sha256').update(content).digest('hex');
    
    const [encryptedContent, encryptedMetadata] = await Promise.all([
      this.encrypt(content.toString('base64')),
      this.encrypt(JSON.stringify(metadata))
    ]);

    return {
      encryptedContent,
      encryptedMetadata,
      contentHash
    };
  }

  async decryptDocument(encryptedContent: EncryptedData, encryptedMetadata: EncryptedData): Promise<{
    content: Buffer;
    metadata: any;
  }> {
    const [contentBase64, metadataJson] = await Promise.all([
      this.decrypt(encryptedContent),
      this.decrypt(encryptedMetadata)
    ]);

    return {
      content: Buffer.from(contentBase64, 'base64'),
      metadata: JSON.parse(metadataJson)
    };
  }

  // Key management
  async generateNewKey(): Promise<string> {
    const keyId = crypto.randomUUID();
    const key = this.deriveKey(this.masterPassword!, keyId);
    
    const encryptionKey: EncryptionKey = {
      id: keyId,
      key,
      algorithm: this.algorithm,
      createdAt: new Date(),
      status: 'active'
    };

    this.keys.set(keyId, encryptionKey);
    return keyId;
  }

  async rotateKey(): Promise<string> {
    // Mark current active key as rotating
    if (this.activeKeyId) {
      const currentKey = this.keys.get(this.activeKeyId);
      if (currentKey) {
        currentKey.status = 'rotating';
      }
    }

    // Generate new key
    const newKeyId = await this.generateNewKey();
    this.activeKeyId = newKeyId;

    console.log(`Key rotated: ${this.activeKeyId} -> ${newKeyId}`);
    return newKeyId;
  }

  async deprecateKey(keyId: string): Promise<void> {
    const key = this.keys.get(keyId);
    if (!key) {
      throw new Error(`Key not found: ${keyId}`);
    }

    key.status = 'deprecated';
    
    // If this was the active key, ensure we have another active key
    if (this.activeKeyId === keyId) {
      const activeKeys = Array.from(this.keys.values()).filter(k => k.status === 'active');
      if (activeKeys.length === 0) {
        // Generate a new key if no active keys remain
        this.activeKeyId = await this.generateNewKey();
      } else {
        this.activeKeyId = activeKeys[0].id;
      }
    }
  }

  async removeKey(keyId: string): Promise<void> {
    if (this.activeKeyId === keyId) {
      throw new Error('Cannot remove active key');
    }

    const key = this.keys.get(keyId);
    if (!key) {
      throw new Error(`Key not found: ${keyId}`);
    }

    // Only remove deprecated keys that are past retention period
    const retentionMs = this.rotationPolicy.retentionPeriod * 24 * 60 * 60 * 1000;
    const keyAge = Date.now() - key.createdAt.getTime();
    
    if (key.status !== 'deprecated' || keyAge < retentionMs) {
      throw new Error('Key cannot be removed yet');
    }

    this.keys.delete(keyId);
  }

  private async checkKeyRotation(): Promise<void> {
    if (!this.activeKeyId) return;

    const activeKey = this.keys.get(this.activeKeyId);
    if (!activeKey) return;

    const keyAge = Date.now() - activeKey.createdAt.getTime();
    const rotationInterval = this.rotationPolicy.rotationInterval * 24 * 60 * 60 * 1000;
    const warningPeriod = this.rotationPolicy.warningPeriod * 24 * 60 * 60 * 1000;

    if (keyAge >= rotationInterval) {
      console.log('Automatic key rotation triggered');
      await this.rotateKey();
    } else if (keyAge >= rotationInterval - warningPeriod) {
      const daysUntilRotation = Math.ceil((rotationInterval - keyAge) / (24 * 60 * 60 * 1000));
      console.warn(`Key rotation warning: ${daysUntilRotation} days until automatic rotation`);
    }

    // Clean up old deprecated keys
    for (const [keyId, key] of Array.from(this.keys.entries())) {
      if (key.status === 'deprecated') {
        try {
          await this.removeKey(keyId);
        } catch (error) {
          // Key not ready for removal yet
        }
      }
    }
  }

  // Utility methods
  getActiveKeyId(): string | null {
    return this.activeKeyId;
  }

  getKeyInfo(keyId: string): Omit<EncryptionKey, 'key'> | undefined {
    const key = this.keys.get(keyId);
    if (!key) return undefined;

    return {
      id: key.id,
      algorithm: key.algorithm,
      createdAt: key.createdAt,
      status: key.status
    };
  }

  getAllKeyInfo(): Omit<EncryptionKey, 'key'>[] {
    return Array.from(this.keys.values()).map(key => ({
      id: key.id,
      algorithm: key.algorithm,
      createdAt: key.createdAt,
      status: key.status
    }));
  }

  async verifyIntegrity(data: string, hash: string): Promise<boolean> {
    const calculatedHash = createHash('sha256').update(data).digest('hex');
    return calculatedHash === hash;
  }

  // Field-level encryption helpers
  async encryptField(value: string, fieldName: string): Promise<string> {
    const fieldData = await this.encrypt(value);
    return `enc:${Buffer.from(JSON.stringify(fieldData)).toString('base64')}`;
  }

  async decryptField(encryptedValue: string): Promise<string> {
    if (!encryptedValue.startsWith('enc:')) {
      return encryptedValue; // Not encrypted
    }

    const encodedData = encryptedValue.substring(4);
    const fieldData = JSON.parse(Buffer.from(encodedData, 'base64').toString('utf8'));
    return await this.decrypt(fieldData);
  }

  // Backup and restore
  async exportKeys(password: string): Promise<string> {
    const keyData = {
      keys: Array.from(this.keys.entries()).map(([id, key]) => ({
        id,
        algorithm: key.algorithm,
        createdAt: key.createdAt.toISOString(),
        status: key.status,
        encryptedKey: this.encrypt(key.key.toString('base64'))
      })),
      activeKeyId: this.activeKeyId,
      rotationPolicy: this.rotationPolicy
    };

    // Encrypt the entire key data with the provided password
    const backupKey = this.deriveKey(password, 'backup');
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, backupKey, iv);
    
    let encrypted = cipher.update(JSON.stringify(keyData), 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const tag = (cipher as any).getAuthTag();

    return JSON.stringify({
      data: encrypted,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      version: 1
    });
  }

  async importKeys(backupData: string, password: string): Promise<void> {
    const backup = JSON.parse(backupData);
    const backupKey = this.deriveKey(password, 'backup');
    
    const iv = Buffer.from(backup.iv, 'base64');
    const tag = Buffer.from(backup.tag, 'base64');
    
    const decipher = createDecipheriv(this.algorithm, backupKey, iv);
    (decipher as any).setAuthTag(tag);
    
    let decrypted = decipher.update(backup.data, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    const keyData = JSON.parse(decrypted);
    
    // Restore keys
    this.keys.clear();
    for (const keyInfo of keyData.keys) {
      const decryptedKeyData = await this.decrypt(keyInfo.encryptedKey);
      const key: EncryptionKey = {
        id: keyInfo.id,
        key: Buffer.from(decryptedKeyData, 'base64'),
        algorithm: keyInfo.algorithm,
        createdAt: new Date(keyInfo.createdAt),
        status: keyInfo.status
      };
      this.keys.set(keyInfo.id, key);
    }
    
    this.activeKeyId = keyData.activeKeyId;
    this.rotationPolicy = keyData.rotationPolicy;
  }
}

// Database field encryption decorator
export function encrypted(target: any, propertyKey: string) {
  const encryptionService = new EncryptionService();
  
  let value = target[propertyKey];

  const getter = () => {
    return encryptionService.decryptField(value);
  };

  const setter = async (newValue: string) => {
    value = await encryptionService.encryptField(newValue, propertyKey);
  };

  Object.defineProperty(target, propertyKey, {
    get: getter,
    set: setter,
    enumerable: true,
    configurable: true
  });
}

// Singleton instance
export const encryptionService = new EncryptionService();