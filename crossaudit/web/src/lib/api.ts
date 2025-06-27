import ky, { HTTPError } from 'ky';
import { TokenManager } from './tokens';

// API Types
export interface User {
  id: string;
  email: string;
  name: string;
  pictureUrl?: string;
  mfaEnabled: boolean;
  firstTime: boolean;
  createdAt: string;
  organizations: UserOrganization[];
}

export interface UserOrganization {
  id: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
  tier: 'free' | 'pro' | 'enterprise';
}

export interface ChatMessage {
  id: string;
  content: string;
  userId: string;
  userName: string;
  createdAt: string;
  threadId?: string;
}

export interface ChatThread {
  id: string;
  name: string;
  lastMessage?: ChatMessage;
  updatedAt: string;
}

export interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface AuditLog {
  id: string;
  action: string;
  resource: string;
  userId: string;
  userName: string;
  details: Record<string, any>;
  timestamp: string;
}

export interface Organization {
  id: string;
  name: string;
  webhookUrl?: string;
  settings: Record<string, any>;
}

export interface ApiKey {
  id: string;
  provider: string;
  masked: string;
  createdAt: string;
}

// Data Room types
export interface DataRoomFile {
  id: string;
  name: string;
  size: number;
  type: string;
  sensitivity: 'public' | 'restricted' | 'confidential';
  owner: string;
  ownerId: string;
  encrypted: boolean;
  kmsKeyId?: string;
  expiry?: string;
  versions: number;
  lastModified: string;
  uploadedAt: string;
  url?: string;
  previewUrl?: string;
}

export interface FileVersion {
  id: string;
  version: number;
  fileId: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
  changeNote?: string;
  checksum: string;
}

export interface Fragment {
  id: string;
  text: string;
  content: string;
  fileId: string;
  fileName: string;
  version: number;
  paragraph: number;
  page: number;
  lineStart: number;
  lineEnd: number;
  sensitivity: 'public' | 'restricted' | 'confidential';
  confidence: 'high' | 'medium' | 'low';
  expiry?: string;
  embedding?: number[];
  score: number;
  context?: string;
  tags: string[];
  deprecated: boolean;
  lastModified: string;
}

export interface SearchResult {
  fragments: Fragment[];
  total: number;
  latencyMs: number;
  query: string;
}

export interface IndexHealth {
  lastRebalance: string;
  orphanCount: number;
  fragmentsTotal: number;
  isHealthy: boolean;
  pendingJobs: number;
}

export interface UploadProgress {
  fileId: string;
  filename: string;
  percent: number;
  stage: 'encrypting' | 'uploading' | 'processing' | 'indexing' | 'complete';
  error?: string;
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface RegisterResponse {
  userId: string;
  message: string;
}

export interface VerifyEmailRequest {
  code: string;
}

export interface VerifyEmailResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  code: string;
  newPassword: string;
}

export interface PasswordValidation {
  isValid: boolean;
  errors: string[];
  score: number; // 0-4 strength score
}

export interface MfaSetupResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface MfaVerifyRequest {
  code: string;
}

export interface SsoAuthRequest {
  provider: 'google' | 'microsoft' | 'github';
  code: string;
  state?: string;
}

export interface OnboardingData {
  organizationName: string;
  useCaseTags: string[];
  inviteEmails: string[];
}

// Create API client
const api = ky.create({
  prefixUrl: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000',
  timeout: 30000,
  retry: {
    limit: 2,
    methods: ['get'],
  },
  hooks: {
    beforeRequest: [
      (request) => {
        if (typeof window !== 'undefined') {
          const token = TokenManager.getAccessToken();
          if (token) {
            request.headers.set('Authorization', `Bearer ${token}`);
          }
        }
      },
    ],
    afterResponse: [
      async (request, options, response) => {
        if (response.status === 401) {
          // Try to refresh token
          try {
            const newToken = await TokenManager.refreshAccessToken();
            // Retry original request with new token
            request.headers.set('Authorization', `Bearer ${newToken}`);
            return ky(request);
          } catch {
            // Refresh failed, redirect to login
            if (typeof window !== 'undefined') {
              TokenManager.clearTokens();
              window.location.href = '/login';
            }
            throw new Error('Authentication failed');
          }
        }
        return response;
      },
    ],
  },
});

// API endpoints
export const endpoints = {
  // Auth
  register: (data: RegisterRequest) =>
    api.post('api/auth/register', { json: data }).json<RegisterResponse>(),
  
  verifyEmail: (data: VerifyEmailRequest) =>
    api.post('api/auth/verify-email', { json: data }).json<VerifyEmailResponse>(),
  
  login: (data: LoginRequest) =>
    api.post('api/auth/login', { json: data }).json<LoginResponse>(),
  
  refresh: (data: RefreshTokenRequest) =>
    api.post('api/auth/refresh', { json: data }).json<RefreshResponse>(),
  
  logout: (data: RefreshTokenRequest) =>
    api.post('api/auth/logout', { json: data }).json(),
  
  forgotPassword: (data: ForgotPasswordRequest) =>
    api.post('api/auth/forgot-password', { json: data }).json(),
  
  resetPassword: (data: ResetPasswordRequest) =>
    api.post('api/auth/reset-password', { json: data }).json(),
  
  validatePassword: (password: string) =>
    api.post('api/auth/validate-password', { json: { password } }).json<PasswordValidation>(),
  
  setupMfa: () =>
    api.post('api/auth/mfa/setup').json<MfaSetupResponse>(),
  
  verifyMfa: (data: MfaVerifyRequest) =>
    api.post('api/auth/mfa/verify', { json: data }).json(),
  
  ssoAuth: (provider: string, data: SsoAuthRequest) =>
    api.post(`api/auth/sso/${provider}`, { json: data }).json<LoginResponse>(),
  
  me: () =>
    api.get('api/users/me').json<User>(),
  
  completeOnboarding: (data: OnboardingData) =>
    api.post('api/auth/onboarding', { json: data }).json(),

  // Chat
  getThreads: () =>
    api.get('api/chat/threads').json<ChatThread[]>(),
  
  getMessages: (threadId?: string) =>
    api.get(`api/chat${threadId ? `/${threadId}` : ''}`).json<ChatMessage[]>(),
  
  sendMessage: (data: { content: string; threadId?: string }) =>
    api.post('api/chat', { json: data }).json<ChatMessage>(),

  // Files
  getFiles: () =>
    api.get('api/files').json<FileItem[]>(),
  
  uploadFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('api/upload', { body: formData }).json<FileItem>();
  },
  
  deleteFile: (id: string) =>
    api.delete(`api/files/${id}`),
  
  getFile: (id: string) =>
    api.get(`api/docs/${id}`),

  // Audit Logs
  getLogs: () =>
    api.get('api/logs').json<AuditLog[]>(),
  
  getLog: (id: string) =>
    api.get(`api/logs/${id}`).json<AuditLog>(),

  // Members
  getMembers: () =>
    api.get('api/org/members').json<User[]>(),
  
  inviteMember: (data: { email: string; role: 'admin' | 'member' }) =>
    api.post('api/org/invites', { json: data }).json<{ success: boolean }>(),
  
  updateMember: (id: string, data: { role: 'admin' | 'member' }) =>
    api.patch(`api/org/members/${id}`, { json: data }).json<User>(),

  // Organization
  getOrganization: () =>
    api.get('api/org').json<Organization>(),
  
  updateOrganization: (data: Partial<Organization>) =>
    api.put('api/org', { json: data }).json<Organization>(),
  
  // API Keys
  getApiKeys: () =>
    api.get('api/org/keys').json<ApiKey[]>(),
  
  createApiKey: (data: { provider: string; apiKey: string }) =>
    api.post('api/org/keys', { json: data }).json<ApiKey>(),
  
  deleteApiKey: (id: string) =>
    api.delete(`api/org/keys/${id}`),

  // Billing
  createBillingSession: () =>
    api.post('api/org/billing-session').json<{ url: string }>(),

  // Data Room - Files
  getDataRoomFiles: (params?: {
    page?: number;
    perPage?: number;
    sortBy?: string;
    sensitivity?: string;
    owner?: string;
    search?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) searchParams.set(key, String(value));
      });
    }
    return api.get(`api/files?${searchParams}`).json<{
      files: DataRoomFile[];
      total: number;
    }>();
  },

  getDataRoomFile: (id: string) =>
    api.get(`api/files/${id}`).json<DataRoomFile>(),

  uploadDataRoomFile: (file: File, options?: {
    sensitivity?: string;
    expiry?: string;
    encrypted?: boolean;
  }) => {
    const formData = new FormData();
    formData.append('file', file);
    if (options?.sensitivity) formData.append('sensitivity', options.sensitivity);
    if (options?.expiry) formData.append('expiry', options.expiry);
    if (options?.encrypted) formData.append('encrypted', 'true');
    return api.post('api/files', { body: formData }).json<{ fileId: string }>();
  },

  updateDataRoomFile: (id: string, data: {
    sensitivity?: string;
    expiry?: string;
  }) =>
    api.patch(`api/files/${id}`, { json: data }).json<{ ok: boolean }>(),

  deleteDataRoomFile: (id: string) =>
    api.delete(`api/files/${id}`),

  // Data Room - Versions
  getFileVersions: (fileId: string) =>
    api.get(`api/files/${fileId}/versions`).json<{ versions: FileVersion[] }>(),

  getVersionDiff: (fileId: string, versionA: number, versionB: number) =>
    api.get(`api/files/${fileId}/version/${versionA}/diff/${versionB}`).text(),

  revertToVersion: (fileId: string, version: number) =>
    api.put(`api/files/${fileId}/version/${version}/revert`).json<{ ok: boolean }>(),

  // Data Room - Fragments
  searchFragments: (query: {
    text: string;
    filters?: {
      sensitivity?: string;
      fileId?: string;
      expired?: boolean;
      deprecated?: boolean;
    };
    limit?: number;
    offset?: number;
  }) =>
    api.post('api/fragments/search', { json: query }).json<SearchResult>(),

  updateFragment: (id: string, data: {
    action: 'deprecate' | 'edit';
    newText?: string;
  }) =>
    api.patch(`api/fragments/${id}`, { json: data }).json<Fragment>(),

  getFragment: (id: string) =>
    api.get(`api/fragments/${id}`).json<Fragment>(),

  // Data Room - Index Health
  getIndexHealth: () =>
    api.get('api/index/health').json<IndexHealth>(),

  triggerRebalance: () =>
    api.post('api/index/rebalance').json<{ jobId: string }>(),
};

// Error handler
export const handleApiError = (error: unknown) => {
  if (error instanceof HTTPError) {
    return error.response.json().then(
      (data: any) => data.message || 'An error occurred',
      () => 'Network error'
    );
  }
  return Promise.resolve('An unexpected error occurred');
};