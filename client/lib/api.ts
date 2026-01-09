/**
 * API Client Utility
 * Centralized API calls with error handling and type safety
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface UploadResponse {
  message: string;
}

export interface ChatResponse {
  result: string;
  docs?: Array<{
    pageContent?: string;
    metadata?: {
      loc?: {
        pageNumber?: number;
      };
      source?: string;
    };
  }>;
}

export interface ApiError {
  error: string;
}

class ApiClient {
  private baseUrl: string;
  private getToken: (() => Promise<string | null>) | null = null;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  /**
   * Set the token getter function (called from components with useAuth hook)
   */
  setTokenGetter(getTokenFn: () => Promise<string | null>) {
    this.getToken = getTokenFn;
  }

  /**
   * Get auth token from Clerk session
   */
  private async getAuthToken(): Promise<string | null> {
    if (this.getToken) {
      try {
        return await this.getToken();
      } catch (error) {
        console.error('Failed to get auth token:', error);
        return null;
      }
    }
    return null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    // Get auth token and add to headers
    const token = await this.getAuthToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorData: ApiError = await response.json().catch(() => ({
          error: `Server error: ${response.status}`,
        }));
        throw new Error(errorData.error || `Request failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error: Failed to connect to server');
    }
  }

  /**
   * Upload a PDF file
   */
  async uploadPDF(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('pdf', file);

    // Get auth token
    const token = await this.getAuthToken();
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}/upload/pdf`, {
      method: 'POST',
      body: formData,
      headers,
      // Don't set Content-Type header - browser will set it with boundary
    });

    if (!response.ok) {
      const errorData: ApiError = await response.json().catch(() => ({
        error: 'Upload failed',
      }));
      throw new Error(errorData.error || `Upload failed: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Send a chat message and get response
   * @param message - User's question
   * @param pdfIds - Array of PDF IDs to include in context (optional)
   */
  async chat(message: string, pdfIds?: string[]): Promise<ChatResponse> {
    const params = new URLSearchParams({
      message: message,
    });
    
    if (pdfIds && pdfIds.length > 0) {
      params.append('pdfIds', JSON.stringify(pdfIds));
    }
    
    return this.request<ChatResponse>(`/chat?${params.toString()}`);
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<{ status: string }> {
    return this.request<{ status: string }>('/');
  }
}

// Export singleton instance
export const api = new ApiClient();

// Export class for testing or custom instances
export default ApiClient;

