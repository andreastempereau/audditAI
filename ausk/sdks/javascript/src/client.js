/**
 * CrossAudit JavaScript SDK - Main Client
 */

import { 
  LLMResponse, 
  EvaluationResult, 
  PolicyViolation, 
  DocumentUpload, 
  AuditLog,
  APIError,
  ConfigurationError,
  AuthenticationError 
} from './models.js';

export class CrossAuditClient {
  /**
   * Create a new CrossAudit client instance.
   * 
   * @param {Object} options - Configuration options
   * @param {string} options.apiKey - Your CrossAudit API key
   * @param {string} [options.baseURL='https://api.crossaudit.ai'] - Base URL for the API
   * @param {number} [options.timeout=30000] - Request timeout in milliseconds
   * @param {number} [options.maxRetries=3] - Maximum retry attempts
   * @param {string} [options.organizationId] - Organization ID
   * @param {string} [options.userId] - User ID for audit tracking
   */
  constructor(options = {}) {
    if (!options.apiKey) {
      throw new ConfigurationError('API key is required');
    }

    this.apiKey = options.apiKey;
    this.baseURL = (options.baseURL || 'https://api.crossaudit.ai').replace(/\/$/, '');
    this.timeout = options.timeout || 30000;
    this.maxRetries = options.maxRetries || 3;
    this.organizationId = options.organizationId;
    this.userId = options.userId;

    // Default headers
    this.headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'crossaudit-js/1.0.0'
    };

    if (this.organizationId) {
      this.headers['X-Organization-ID'] = this.organizationId;
    }
    if (this.userId) {
      this.headers['X-User-ID'] = this.userId;
    }
  }

  /**
   * Make an HTTP request to the CrossAudit API.
   * 
   * @private
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {Object} [data] - Request body data
   * @param {Object} [params] - URL parameters
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} Response data
   */
  async _makeRequest(method, endpoint, data = null, params = null, options = {}) {
    const url = new URL(endpoint, this.baseURL);
    
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          url.searchParams.append(key, params[key]);
        }
      });
    }

    const requestOptions = {
      method,
      headers: { ...this.headers },
      signal: AbortSignal.timeout(this.timeout),
      ...options
    };

    if (data && method !== 'GET') {
      if (data instanceof FormData) {
        // Remove Content-Type for FormData (browser will set it with boundary)
        delete requestOptions.headers['Content-Type'];
        requestOptions.body = data;
      } else {
        requestOptions.body = JSON.stringify(data);
      }
    }

    let lastError;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url.toString(), requestOptions);
        
        if (response.status === 401) {
          throw new AuthenticationError('Invalid API key or unauthorized access');
        } else if (response.status === 403) {
          throw new AuthenticationError('Insufficient permissions');
        } else if (response.status >= 400) {
          let errorData;
          try {
            errorData = await response.json();
          } catch {
            errorData = { error: response.statusText };
          }
          
          throw new APIError(
            errorData.error || 'Unknown error',
            response.status,
            errorData
          );
        }

        return await response.json();
        
      } catch (error) {
        lastError = error;
        
        // Don't retry authentication or client errors
        if (error instanceof AuthenticationError || 
            (error instanceof APIError && error.statusCode < 500)) {
          throw error;
        }
        
        // Don't retry on last attempt
        if (attempt === this.maxRetries) {
          break;
        }
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError || new APIError('Request failed after retries');
  }

  /**
   * Send an LLM request through CrossAudit for evaluation and policy enforcement.
   * 
   * @param {Object} request - The LLM request
   * @param {string} request.prompt - The input prompt
   * @param {string} [request.model='gpt-3.5-turbo'] - The model to use
   * @param {string} [request.provider='openai'] - The provider
   * @param {number} [request.maxTokens] - Maximum tokens to generate
   * @param {number} [request.temperature=0.7] - Temperature setting
   * @param {Object} [request.metadata={}] - Additional metadata
   * @param {boolean} [stream=false] - Whether to stream the response
   * @returns {Promise<LLMResponse|ReadableStream>} Response or stream
   */
  async evaluateLLMRequest(request, stream = false) {
    const data = {
      prompt: request.prompt,
      model: request.model || 'gpt-3.5-turbo',
      provider: request.provider || 'openai',
      max_tokens: request.maxTokens,
      temperature: request.temperature || 0.7,
      metadata: request.metadata || {},
      stream
    };

    if (stream) {
      return this._streamRequest('/api/gateway/evaluate', data);
    } else {
      const responseData = await this._makeRequest('POST', '/api/gateway/evaluate', data);
      return LLMResponse.fromObject(responseData);
    }
  }

  /**
   * Handle streaming requests.
   * 
   * @private
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request data
   * @returns {ReadableStream} Streaming response
   */
  async _streamRequest(endpoint, data) {
    const url = new URL(endpoint, this.baseURL);
    
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { ...this.headers },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(this.timeout)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new APIError(errorData.error || 'Stream request failed', response.status);
    }

    return response.body;
  }

  /**
   * Upload a document for processing and context augmentation.
   * 
   * @param {File|Blob} file - The file to upload
   * @param {string} [filename] - Optional filename
   * @param {Object} [metadata={}] - Optional metadata
   * @returns {Promise<DocumentUpload>} Upload result
   */
  async uploadDocument(file, filename = null, metadata = {}) {
    const formData = new FormData();
    formData.append('file', file, filename || file.name);
    formData.append('metadata', JSON.stringify(metadata));

    const responseData = await this._makeRequest('POST', '/api/documents/process', formData);
    return DocumentUpload.fromObject(responseData);
  }

  /**
   * Retrieve audit logs for the organization.
   * 
   * @param {Object} [options={}] - Filter options
   * @param {string} [options.startDate] - Start date (ISO format)
   * @param {string} [options.endDate] - End date (ISO format)
   * @param {string} [options.userId] - Filter by user ID
   * @param {number} [options.limit=100] - Maximum results
   * @param {number} [options.offset=0] - Pagination offset
   * @returns {Promise<AuditLog[]>} Array of audit logs
   */
  async getAuditLogs(options = {}) {
    const params = {
      limit: options.limit || 100,
      offset: options.offset || 0
    };

    if (options.startDate) params.start_date = options.startDate;
    if (options.endDate) params.end_date = options.endDate;
    if (options.userId) params.user_id = options.userId;

    const responseData = await this._makeRequest('GET', '/api/audit/logs', null, params);
    return (responseData.logs || []).map(log => AuditLog.fromObject(log));
  }

  /**
   * Retrieve policy violations for the organization.
   * 
   * @param {Object} [options={}] - Filter options
   * @param {string} [options.startDate] - Start date (ISO format)
   * @param {string} [options.endDate] - End date (ISO format)
   * @param {string} [options.severity] - Filter by severity
   * @param {number} [options.limit=100] - Maximum results
   * @returns {Promise<PolicyViolation[]>} Array of violations
   */
  async getPolicyViolations(options = {}) {
    const params = { limit: options.limit || 100 };

    if (options.startDate) params.start_date = options.startDate;
    if (options.endDate) params.end_date = options.endDate;
    if (options.severity) params.severity = options.severity;

    const responseData = await this._makeRequest('GET', '/api/audit/violations', null, params);
    return (responseData.violations || []).map(v => PolicyViolation.fromObject(v));
  }

  /**
   * Get detailed evaluation result by ID.
   * 
   * @param {string} evaluationId - The evaluation ID
   * @returns {Promise<EvaluationResult>} Evaluation result
   */
  async getEvaluationResult(evaluationId) {
    const responseData = await this._makeRequest('GET', `/api/evaluations/${evaluationId}`);
    return EvaluationResult.fromObject(responseData);
  }

  /**
   * Test a prompt/response pair against current policies.
   * 
   * @param {string} prompt - The input prompt
   * @param {string} response - The AI response to test
   * @param {Object} [metadata={}] - Optional metadata
   * @returns {Promise<EvaluationResult>} Evaluation result
   */
  async testPolicy(prompt, response, metadata = {}) {
    const data = { prompt, response, metadata };
    const responseData = await this._makeRequest('POST', '/api/policies/test', data);
    return EvaluationResult.fromObject(responseData);
  }

  /**
   * Get organization-level metrics and analytics.
   * 
   * @returns {Promise<Object>} Metrics data
   */
  async getOrganizationMetrics() {
    return this._makeRequest('GET', '/api/analytics/metrics');
  }

  /**
   * Check the health status of the CrossAudit API.
   * 
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    return this._makeRequest('GET', '/api/health');
  }
}

export default CrossAuditClient;