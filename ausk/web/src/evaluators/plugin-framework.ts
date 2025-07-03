// Custom Evaluator Plugin Framework for Ausk

export interface EvaluatorContext {
  request: {
    prompt: string;
    model: string;
    provider: string;
    userId: string;
    organizationId: string;
    metadata: Record<string, any>;
  };
  response: {
    content: string;
    model: string;
    tokens: number;
    metadata: Record<string, any>;
  };
  document?: {
    content: string;
    metadata: Record<string, any>;
  };
  environment: {
    organizationId: string;
    policies: string[];
    userRoles: string[];
    departmentId?: string;
  };
}

export interface EvaluatorResult {
  score: number; // 0-1, where 1 is good/safe, 0 is bad/unsafe
  violations: Violation[];
  metadata: Record<string, any>;
  confidence: number; // 0-1, how confident the evaluator is in the result
  processingTime: number; // milliseconds
  version: string; // evaluator version
}

export interface Violation {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  location?: {
    start: number;
    end: number;
    line?: number;
    column?: number;
  };
  suggestions?: string[];
  evidence?: string;
  confidence: number;
}

export interface EvaluatorConfig {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: 'safety' | 'compliance' | 'quality' | 'custom';
  enabled: boolean;
  priority: number; // 1-10, higher = runs earlier
  timeout: number; // milliseconds
  retries: number;
  parameters: Record<string, any>;
  dependencies: string[]; // other evaluator IDs this depends on
  triggers: EvaluatorTrigger[];
}

export interface EvaluatorTrigger {
  condition: string; // JS expression that evaluates to boolean
  description: string;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  repository?: string;
  license: string;
  keywords: string[];
  evaluators: EvaluatorConfig[];
  dependencies?: Record<string, string>;
  permissions: PluginPermission[];
  sandbox: SandboxConfig;
}

export interface PluginPermission {
  type: 'network' | 'filesystem' | 'environment' | 'api';
  resource: string;
  action: 'read' | 'write' | 'execute';
  description: string;
}

export interface SandboxConfig {
  memory: number; // MB
  timeout: number; // seconds
  networkAccess: boolean;
  allowedDomains?: string[];
  allowedAPIs?: string[];
  environmentVariables?: string[];
}

export abstract class BaseEvaluator {
  protected config: EvaluatorConfig;
  protected logger: PluginLogger;

  constructor(config: EvaluatorConfig) {
    this.config = config;
    this.logger = new PluginLogger(config.id);
  }

  abstract evaluate(context: EvaluatorContext): Promise<EvaluatorResult>;

  protected shouldEvaluate(context: EvaluatorContext): boolean {
    if (!this.config.enabled) return false;

    return this.config.triggers.every(trigger => {
      try {
        return this.evaluateCondition(trigger.condition, context);
      } catch (error) {
        this.logger.warn(`Trigger condition evaluation failed: ${error}`);
        return false;
      }
    });
  }

  private evaluateCondition(condition: string, context: EvaluatorContext): boolean {
    // Safe evaluation of trigger conditions
    // In production, use a proper expression evaluator like expr-eval
    try {
      const func = new Function('context', `return ${condition}`);
      return Boolean(func(context));
    } catch (error) {
      this.logger.error(`Condition evaluation error: ${error}`);
      return false;
    }
  }

  protected createViolation(
    type: string,
    severity: Violation['severity'],
    message: string,
    options: Partial<Violation> = {}
  ): Violation {
    return {
      type,
      severity,
      message,
      confidence: options.confidence || 1.0,
      ...options
    };
  }
}

export class PluginLogger {
  constructor(private evaluatorId: string) {}

  debug(message: string, metadata?: any): void {
    console.debug(`[${this.evaluatorId}] ${message}`, metadata);
  }

  info(message: string, metadata?: any): void {
    console.info(`[${this.evaluatorId}] ${message}`, metadata);
  }

  warn(message: string, metadata?: any): void {
    console.warn(`[${this.evaluatorId}] ${message}`, metadata);
  }

  error(message: string, error?: any): void {
    console.error(`[${this.evaluatorId}] ${message}`, error);
  }
}

export class PluginSandbox {
  private vm: any;
  private config: SandboxConfig;

  constructor(config: SandboxConfig) {
    this.config = config;
    this.initializeSandbox();
  }

  private initializeSandbox(): void {
    // In production, use a proper sandboxing solution like isolated-vm
    // For now, we'll use basic restrictions
    this.vm = {
      // Restricted global context
      console: {
        log: (...args: any[]) => console.log('[PLUGIN]', ...args),
        error: (...args: any[]) => console.error('[PLUGIN]', ...args),
        warn: (...args: any[]) => console.warn('[PLUGIN]', ...args),
        info: (...args: any[]) => console.info('[PLUGIN]', ...args)
      },
      setTimeout: this.config.networkAccess ? setTimeout : undefined,
      setInterval: this.config.networkAccess ? setInterval : undefined,
      fetch: this.config.networkAccess ? this.createRestrictedFetch() : undefined,
      // Add other safe APIs as needed
    };
  }

  private createRestrictedFetch(): typeof fetch {
    return async (url: string | Request | URL, options?: RequestInit) => {
      const urlString = url.toString();
      
      if (this.config.allowedDomains) {
        const hostname = new URL(urlString).hostname;
        if (!this.config.allowedDomains.includes(hostname)) {
          throw new Error(`Network access denied: ${hostname} not in allowed domains`);
        }
      }

      return fetch(url, {
        ...options,
        signal: AbortSignal.timeout(this.config.timeout * 1000)
      });
    };
  }

  async executeEvaluator(
    code: string,
    context: EvaluatorContext
  ): Promise<EvaluatorResult> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Evaluator execution timed out after ${this.config.timeout}s`));
      }, this.config.timeout * 1000);

      try {
        // Create evaluator function with restricted context
        const evaluatorFunc = new Function(
          'context',
          'sandbox',
          `
          ${code}
          return evaluate(context);
          `
        );

        const result = evaluatorFunc(context, this.vm);
        
        clearTimeout(timeout);
        
        if (result instanceof Promise) {
          result.then(resolve).catch(reject);
        } else {
          resolve(result);
        }
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }
}

export class EvaluatorPluginManager {
  private plugins: Map<string, PluginManifest> = new Map();
  private evaluators: Map<string, BaseEvaluator> = new Map();
  private sandboxes: Map<string, PluginSandbox> = new Map();

  async loadPlugin(manifest: PluginManifest, code: string): Promise<void> {
    // Validate manifest
    this.validateManifest(manifest);

    // Check permissions
    this.validatePermissions(manifest.permissions);

    // Create sandbox
    const sandbox = new PluginSandbox(manifest.sandbox);
    this.sandboxes.set(manifest.id, sandbox);

    // Store plugin
    this.plugins.set(manifest.id, manifest);

    // Load evaluators
    for (const evaluatorConfig of manifest.evaluators) {
      const evaluator = new CustomPluginEvaluator(evaluatorConfig, sandbox, code);
      this.evaluators.set(evaluatorConfig.id, evaluator);
    }

    console.log(`Plugin loaded: ${manifest.name} v${manifest.version}`);
  }

  async unloadPlugin(pluginId: string): Promise<void> {
    const manifest = this.plugins.get(pluginId);
    if (!manifest) return;

    // Remove evaluators
    for (const evaluatorConfig of manifest.evaluators) {
      this.evaluators.delete(evaluatorConfig.id);
    }

    // Remove sandbox
    this.sandboxes.delete(pluginId);

    // Remove plugin
    this.plugins.delete(pluginId);

    console.log(`Plugin unloaded: ${manifest.name}`);
  }

  getEvaluator(evaluatorId: string): BaseEvaluator | undefined {
    return this.evaluators.get(evaluatorId);
  }

  getAllEvaluators(): BaseEvaluator[] {
    return Array.from(this.evaluators.values());
  }

  getActiveEvaluators(): BaseEvaluator[] {
    return Array.from(this.evaluators.values())
      .filter(evaluator => evaluator['config'].enabled)
      .sort((a, b) => b['config'].priority - a['config'].priority);
  }

  getPluginInfo(pluginId: string): PluginManifest | undefined {
    return this.plugins.get(pluginId);
  }

  getAllPlugins(): PluginManifest[] {
    return Array.from(this.plugins.values());
  }

  private validateManifest(manifest: PluginManifest): void {
    const required = ['id', 'name', 'version', 'description', 'author', 'license'];
    for (const field of required) {
      if (!manifest[field as keyof PluginManifest]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (!Array.isArray(manifest.evaluators) || manifest.evaluators.length === 0) {
      throw new Error('Plugin must define at least one evaluator');
    }

    // Validate evaluator configs
    for (const evaluator of manifest.evaluators) {
      this.validateEvaluatorConfig(evaluator);
    }
  }

  private validateEvaluatorConfig(config: EvaluatorConfig): void {
    const required = ['id', 'name', 'version', 'description', 'category'];
    for (const field of required) {
      if (!config[field as keyof EvaluatorConfig]) {
        throw new Error(`Missing required evaluator field: ${field}`);
      }
    }

    if (config.priority < 1 || config.priority > 10) {
      throw new Error('Evaluator priority must be between 1 and 10');
    }

    if (config.timeout < 1000 || config.timeout > 30000) {
      throw new Error('Evaluator timeout must be between 1 and 30 seconds');
    }
  }

  private validatePermissions(permissions: PluginPermission[]): void {
    // In production, implement proper permission validation
    // For now, just log what permissions are requested
    console.log('Plugin requesting permissions:', permissions);
  }
}

class CustomPluginEvaluator extends BaseEvaluator {
  constructor(
    config: EvaluatorConfig,
    private sandbox: PluginSandbox,
    private code: string
  ) {
    super(config);
  }

  async evaluate(context: EvaluatorContext): Promise<EvaluatorResult> {
    if (!this.shouldEvaluate(context)) {
      return {
        score: 1.0,
        violations: [],
        metadata: { skipped: true, reason: 'Trigger conditions not met' },
        confidence: 1.0,
        processingTime: 0,
        version: this.config.version
      };
    }

    const startTime = Date.now();

    try {
      const result = await this.sandbox.executeEvaluator(this.code, context);
      
      return {
        ...result,
        processingTime: Date.now() - startTime,
        version: this.config.version
      };
    } catch (error) {
      this.logger.error('Evaluation failed', error);
      
      return {
        score: 0.5, // Neutral score on error
        violations: [{
          type: 'evaluation_error',
          severity: 'MEDIUM' as const,
          message: `Evaluator failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          confidence: 1.0
        }],
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
        confidence: 0.0,
        processingTime: Date.now() - startTime,
        version: this.config.version
      };
    }
  }
}

// Built-in example plugins
export const EXAMPLE_EVALUATOR_MANIFEST: PluginManifest = {
  id: 'example-content-filter',
  name: 'Example Content Filter',
  version: '1.0.0',
  description: 'Example evaluator that filters inappropriate content',
  author: 'Ausk Team',
  license: 'MIT',
  keywords: ['content', 'filter', 'safety'],
  evaluators: [{
    id: 'example-profanity-filter',
    name: 'Profanity Filter',
    version: '1.0.0',
    description: 'Detects and flags profanity in responses',
    author: 'Ausk Team',
    category: 'safety',
    enabled: true,
    priority: 5,
    timeout: 5000,
    retries: 2,
    parameters: {
      strictMode: false,
      customWords: []
    },
    dependencies: [],
    triggers: [{
      condition: 'context.response.content.length > 0',
      description: 'Evaluate when response has content'
    }]
  }],
  permissions: [{
    type: 'api',
    resource: 'content-analysis',
    action: 'read',
    description: 'Access to content analysis APIs'
  }],
  sandbox: {
    memory: 50,
    timeout: 10,
    networkAccess: false,
    allowedDomains: [],
    allowedAPIs: []
  }
};

export const EXAMPLE_EVALUATOR_CODE = `
async function evaluate(context) {
  const content = context.response.content.toLowerCase();
  const profanityWords = ['bad', 'inappropriate', 'spam']; // Example words
  
  const violations = [];
  let score = 1.0;
  
  for (const word of profanityWords) {
    if (content.includes(word)) {
      violations.push({
        type: 'profanity',
        severity: 'MEDIUM',
        message: \`Detected potentially inappropriate content: "\${word}"\`,
        confidence: 0.8,
        suggestions: ['Consider rephrasing to be more professional']
      });
      score -= 0.3;
    }
  }
  
  return {
    score: Math.max(0, score),
    violations,
    metadata: {
      wordsChecked: profanityWords.length,
      contentLength: content.length
    },
    confidence: 0.9
  };
}
`;

// Singleton instance
export const pluginManager = new EvaluatorPluginManager();