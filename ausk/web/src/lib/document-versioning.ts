// Document Versioning System for Ausk

import { createHash } from 'crypto';
import { encryptionService } from './encryption';

export interface DocumentVersion {
  id: string;
  documentId: string;
  version: number;
  title: string;
  content: string;
  contentHash: string;
  size: number;
  mimeType: string;
  metadata: DocumentMetadata;
  changeType: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE';
  changeDescription?: string;
  createdBy: string;
  createdAt: Date;
  tags: string[];
  isActive: boolean;
  parentVersionId?: string;
  encryptedContent?: string;
  checksumVerified: boolean;
}

export interface DocumentMetadata {
  filename: string;
  author?: string;
  lastModifiedBy?: string;
  department?: string;
  classification?: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  retentionPeriod?: number; // days
  customFields: Record<string, any>;
  processingMetadata?: {
    chunks: number;
    wordCount: number;
    language?: string;
    extractedImages?: number;
  };
}

export interface VersionDiff {
  type: 'addition' | 'deletion' | 'modification';
  lineNumber: number;
  oldContent?: string;
  newContent?: string;
  context: string;
}

export interface DocumentHistory {
  documentId: string;
  versions: DocumentVersion[];
  totalVersions: number;
  resolvedCurrentVersion: number;
  createdAt: Date;
  lastModified: Date;
  isDeleted: boolean;
}

export interface VersioningPolicy {
  organizationId: string;
  maxVersions: number;
  retentionDays: number;
  autoArchive: boolean;
  requireChangeDescription: boolean;
  enableEncryption: boolean;
  compressionEnabled: boolean;
  versioningStrategy: 'ALL_CHANGES' | 'MAJOR_CHANGES' | 'MANUAL_ONLY';
  changeThreshold: number; // percentage of content that must change for auto-versioning
}

export class DocumentVersioningService {
  private versions: Map<string, DocumentVersion[]> = new Map(); // documentId -> versions
  private policies: Map<string, VersioningPolicy> = new Map(); // organizationId -> policy

  constructor() {
    this.initializeDefaultPolicies();
  }

  private initializeDefaultPolicies(): void {
    const defaultPolicy: VersioningPolicy = {
      organizationId: 'default',
      maxVersions: 50,
      retentionDays: 365,
      autoArchive: true,
      requireChangeDescription: false,
      enableEncryption: true,
      compressionEnabled: true,
      versioningStrategy: 'ALL_CHANGES',
      changeThreshold: 5.0
    };

    this.policies.set('default', defaultPolicy);
  }

  async createDocument(
    documentId: string,
    content: string,
    metadata: DocumentMetadata,
    createdBy: string,
    organizationId: string
  ): Promise<DocumentVersion> {
    const policy = this.getPolicy(organizationId);
    const contentHash = this.calculateContentHash(content);
    
    let encryptedContent: string | undefined;
    if (policy.enableEncryption) {
      const encrypted = await encryptionService.encrypt(content);
      encryptedContent = JSON.stringify(encrypted);
    }

    const version: DocumentVersion = {
      id: crypto.randomUUID(),
      documentId,
      version: 1,
      title: metadata.filename,
      content: policy.enableEncryption ? '' : content,
      contentHash,
      size: content.length,
      mimeType: this.detectMimeType(metadata.filename),
      metadata,
      changeType: 'CREATE',
      changeDescription: 'Initial document creation',
      createdBy,
      createdAt: new Date(),
      tags: [],
      isActive: true,
      encryptedContent,
      checksumVerified: true
    };

    this.addVersion(documentId, version);
    await this.enforceRetentionPolicy(documentId, organizationId);

    return version;
  }

  async updateDocument(
    documentId: string,
    newContent: string,
    metadata: Partial<DocumentMetadata>,
    updatedBy: string,
    organizationId: string,
    changeDescription?: string
  ): Promise<DocumentVersion> {
    const currentVersionPromise = this.getCurrentVersion(documentId);
    if (!currentVersionPromise) {
      throw new Error(`Document not found: ${documentId}`);
    }

    const policy = this.getPolicy(organizationId);
    
    // Resolve the current version
    const resolvedCurrentVersion = await currentVersionPromise;
    if (!resolvedCurrentVersion) {
      throw new Error('Current version not found');
    }
    
    // Check if update is significant enough to create new version
    if (policy.versioningStrategy === 'MAJOR_CHANGES') {
      const currentContent = await this.getDecryptedContent(resolvedCurrentVersion);
      const changePercentage = this.calculateChangePercentage(currentContent, newContent);
      
      if (changePercentage < policy.changeThreshold) {
        // Update in place without creating new version
        return this.updateVersionInPlace(resolvedCurrentVersion, newContent, metadata, updatedBy);
      }
    }

    const contentHash = this.calculateContentHash(newContent);
    
    let encryptedContent: string | undefined;
    if (policy.enableEncryption) {
      const encrypted = await encryptionService.encrypt(newContent);
      encryptedContent = JSON.stringify(encrypted);
    }

    const newVersion: DocumentVersion = {
      id: crypto.randomUUID(),
      documentId,
      version: resolvedCurrentVersion.version + 1,
      title: metadata.filename || resolvedCurrentVersion.title,
      content: policy.enableEncryption ? '' : newContent,
      contentHash,
      size: newContent.length,
      mimeType: this.detectMimeType(metadata.filename || resolvedCurrentVersion.metadata.filename),
      metadata: { ...resolvedCurrentVersion.metadata, ...metadata },
      changeType: 'UPDATE',
      changeDescription: changeDescription || 'Document updated',
      createdBy: updatedBy,
      createdAt: new Date(),
      tags: resolvedCurrentVersion.tags,
      isActive: true,
      parentVersionId: resolvedCurrentVersion.id,
      encryptedContent,
      checksumVerified: true
    };

    // Mark previous version as inactive
    resolvedCurrentVersion.isActive = false;

    this.addVersion(documentId, newVersion);
    await this.enforceRetentionPolicy(documentId, organizationId);

    return newVersion;
  }

  async getDocumentHistory(documentId: string): Promise<DocumentHistory> {
    const versions = this.versions.get(documentId) || [];
    
    if (versions.length === 0) {
      throw new Error(`Document not found: ${documentId}`);
    }

    const sortedVersions = versions.sort((a, b) => b.version - a.version);
    const resolvedCurrentVersion = versions.find(v => v.isActive);

    return {
      documentId,
      versions: sortedVersions,
      totalVersions: versions.length,
      resolvedCurrentVersion: resolvedCurrentVersion?.version || 0,
      createdAt: versions[versions.length - 1].createdAt,
      lastModified: sortedVersions[0].createdAt,
      isDeleted: sortedVersions[0].changeType === 'DELETE'
    };
  }

  async getVersion(documentId: string, version: number): Promise<DocumentVersion | null> {
    const versions = this.versions.get(documentId) || [];
    return versions.find(v => v.version === version) || null;
  }

  async getCurrentVersion(documentId: string): Promise<DocumentVersion | null> {
    const versions = this.versions.get(documentId) || [];
    return versions.find(v => v.isActive) || null;
  }

  async getVersionContent(documentId: string, version: number): Promise<string> {
    const versionDoc = await this.getVersion(documentId, version);
    if (!versionDoc) {
      throw new Error(`Version ${version} not found for document ${documentId}`);
    }

    return this.getDecryptedContent(versionDoc);
  }

  async restoreVersion(
    documentId: string,
    targetVersion: number,
    restoredBy: string,
    organizationId: string
  ): Promise<DocumentVersion> {
    const targetVersionDoc = await this.getVersion(documentId, targetVersion);
    if (!targetVersionDoc) {
      throw new Error(`Version ${targetVersion} not found for document ${documentId}`);
    }

    const content = await this.getDecryptedContent(targetVersionDoc);
    
    return this.updateDocument(
      documentId,
      content,
      targetVersionDoc.metadata,
      restoredBy,
      organizationId,
      `Restored from version ${targetVersion}`
    );
  }

  async deleteDocument(
    documentId: string,
    deletedBy: string,
    organizationId: string,
    permanent: boolean = false
  ): Promise<DocumentVersion> {
    if (permanent) {
      this.versions.delete(documentId);
      throw new Error('Document permanently deleted');
    }

    const currentVersionPromise = this.getCurrentVersion(documentId);
    if (!currentVersionPromise) {
      throw new Error(`Document not found: ${documentId}`);
    }

    const resolvedCurrentVersion = await currentVersionPromise;
    if (!resolvedCurrentVersion) {
      throw new Error('Current version not found');
    }

    const deleteVersion: DocumentVersion = {
      ...resolvedCurrentVersion,
      id: crypto.randomUUID(),
      version: resolvedCurrentVersion.version + 1,
      changeType: 'DELETE',
      changeDescription: 'Document deleted',
      createdBy: deletedBy,
      createdAt: new Date(),
      parentVersionId: resolvedCurrentVersion.id
    };

    resolvedCurrentVersion.isActive = false;
    this.addVersion(documentId, deleteVersion);

    return deleteVersion;
  }

  async compareVersions(
    documentId: string,
    version1: number,
    version2: number
  ): Promise<VersionDiff[]> {
    const [v1Doc, v2Doc] = await Promise.all([
      this.getVersion(documentId, version1),
      this.getVersion(documentId, version2)
    ]);

    if (!v1Doc || !v2Doc) {
      throw new Error('One or both versions not found');
    }

    const [content1, content2] = await Promise.all([
      this.getDecryptedContent(v1Doc),
      this.getDecryptedContent(v2Doc)
    ]);

    return this.generateDiff(content1, content2);
  }

  async verifyIntegrity(documentId: string): Promise<{
    verified: boolean;
    corruptedVersions: number[];
    errors: string[];
  }> {
    const versions = this.versions.get(documentId) || [];
    const result = {
      verified: true,
      corruptedVersions: [] as number[],
      errors: [] as string[]
    };

    for (const version of versions) {
      try {
        const content = await this.getDecryptedContent(version);
        const calculatedHash = this.calculateContentHash(content);
        
        if (calculatedHash !== version.contentHash) {
          result.verified = false;
          result.corruptedVersions.push(version.version);
          result.errors.push(`Version ${version.version}: Content hash mismatch`);
        }
      } catch (error) {
        result.verified = false;
        result.corruptedVersions.push(version.version);
        result.errors.push(`Version ${version.version}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return result;
  }

  // Policy management
  async setVersioningPolicy(organizationId: string, policy: VersioningPolicy): Promise<void> {
    this.policies.set(organizationId, policy);
  }

  getPolicy(organizationId: string): VersioningPolicy {
    return this.policies.get(organizationId) || this.policies.get('default')!;
  }

  // Private helper methods
  private addVersion(documentId: string, version: DocumentVersion): void {
    if (!this.versions.has(documentId)) {
      this.versions.set(documentId, []);
    }
    this.versions.get(documentId)!.push(version);
  }

  private async enforceRetentionPolicy(documentId: string, organizationId: string): Promise<void> {
    const policy = this.getPolicy(organizationId);
    const versions = this.versions.get(documentId) || [];

    // Remove old versions if exceeding max count
    if (versions.length > policy.maxVersions) {
      const sortedVersions = versions.sort((a, b) => a.version - b.version);
      const toRemove = sortedVersions.slice(0, versions.length - policy.maxVersions);
      
      for (const version of toRemove) {
        const index = versions.indexOf(version);
        if (index > -1) {
          versions.splice(index, 1);
        }
      }
    }

    // Remove versions older than retention period
    const cutoffDate = new Date(Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000);
    const activeVersions = versions.filter(v => v.createdAt > cutoffDate || v.isActive);
    
    if (activeVersions.length !== versions.length) {
      this.versions.set(documentId, activeVersions);
    }
  }

  private async updateVersionInPlace(
    version: DocumentVersion,
    newContent: string,
    metadata: Partial<DocumentMetadata>,
    updatedBy: string
  ): Promise<DocumentVersion> {
    version.content = newContent;
    version.contentHash = this.calculateContentHash(newContent);
    version.size = newContent.length;
    version.metadata = { ...version.metadata, ...metadata };
    version.metadata.lastModifiedBy = updatedBy;
    version.createdAt = new Date();

    if (version.encryptedContent) {
      const encrypted = await encryptionService.encrypt(newContent);
      version.encryptedContent = JSON.stringify(encrypted);
    }

    return version;
  }

  private async getDecryptedContent(version: DocumentVersion): Promise<string> {
    if (version.encryptedContent) {
      try {
        const encryptedData = JSON.parse(version.encryptedContent);
        return await encryptionService.decrypt(encryptedData);
      } catch (error) {
        throw new Error('Failed to decrypt document content');
      }
    }
    return version.content;
  }

  private calculateContentHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  private calculateChangePercentage(oldContent: string, newContent: string): number {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const maxLines = Math.max(oldLines.length, newLines.length);
    
    let changedLines = 0;
    for (let i = 0; i < maxLines; i++) {
      if (oldLines[i] !== newLines[i]) {
        changedLines++;
      }
    }

    return (changedLines / maxLines) * 100;
  }

  private generateDiff(content1: string, content2: string): VersionDiff[] {
    const lines1 = content1.split('\n');
    const lines2 = content2.split('\n');
    const diffs: VersionDiff[] = [];

    // Simple line-by-line diff (in production, use a proper diff algorithm)
    const maxLines = Math.max(lines1.length, lines2.length);
    
    for (let i = 0; i < maxLines; i++) {
      const line1 = lines1[i];
      const line2 = lines2[i];

      if (line1 !== line2) {
        if (line1 === undefined) {
          diffs.push({
            type: 'addition',
            lineNumber: i + 1,
            newContent: line2,
            context: this.getContext(lines2, i)
          });
        } else if (line2 === undefined) {
          diffs.push({
            type: 'deletion',
            lineNumber: i + 1,
            oldContent: line1,
            context: this.getContext(lines1, i)
          });
        } else {
          diffs.push({
            type: 'modification',
            lineNumber: i + 1,
            oldContent: line1,
            newContent: line2,
            context: this.getContext(lines2, i)
          });
        }
      }
    }

    return diffs;
  }

  private getContext(lines: string[], index: number): string {
    const start = Math.max(0, index - 2);
    const end = Math.min(lines.length, index + 3);
    return lines.slice(start, end).join('\n');
  }

  private detectMimeType(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    
    const mimeTypes: Record<string, string> = {
      'txt': 'text/plain',
      'md': 'text/markdown',
      'pdf': 'application/pdf',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'doc': 'application/msword',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'xls': 'application/vnd.ms-excel',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'ppt': 'application/vnd.ms-powerpoint',
      'json': 'application/json',
      'csv': 'text/csv'
    };

    return mimeTypes[extension || ''] || 'application/octet-stream';
  }
}

// Singleton instance
export const documentVersioningService = new DocumentVersioningService();