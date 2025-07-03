import { RefreshResponse } from './api';

// Secure token management
export class TokenManager {
  private static readonly ACCESS_TOKEN_KEY = 'crossaudit_access_token';
  private static readonly REFRESH_TOKEN_KEY = 'crossaudit_refresh_token';
  private static refreshPromise: Promise<string> | null = null;

  static getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  static setAccessToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.ACCESS_TOKEN_KEY, token);
  }

  static getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  static setRefreshToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.REFRESH_TOKEN_KEY, token);
  }

  static clearTokens(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
  }

  static async refreshAccessToken(): Promise<string> {
    // Prevent multiple concurrent refresh requests
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    this.refreshPromise = this.performRefresh(refreshToken);
    
    try {
      const newToken = await this.refreshPromise;
      return newToken;
    } finally {
      this.refreshPromise = null;
    }
  }

  private static async performRefresh(refreshToken: string): Promise<string> {
    try {
      // Create a direct ky instance to avoid circular dependency
      const refreshApi = (await import('ky')).default.create({
        prefixUrl: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000',
        timeout: 10000,
      });
      
      const response = await refreshApi.post('api/auth/refresh', {
        json: { refreshToken }
      }).json<RefreshResponse>();
      
      this.setAccessToken(response.accessToken);
      this.setRefreshToken(response.refreshToken);
      return response.accessToken;
    } catch (error) {
      this.clearTokens();
      throw error;
    }
  }
}