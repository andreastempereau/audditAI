/**
 * CrossAudit JavaScript SDK
 * 
 * AI Governance Gateway Client for JavaScript/Node.js applications.
 */

export { CrossAuditClient } from './client.js';
export { AsyncCrossAuditClient } from './async-client.js';
export {
  LLMRequest,
  LLMResponse,
  EvaluationResult,
  PolicyViolation,
  DocumentUpload,
  AuditLog,
  APIError,
  ConfigurationError,
  AuthenticationError
} from './models.js';

export const VERSION = '1.0.0';