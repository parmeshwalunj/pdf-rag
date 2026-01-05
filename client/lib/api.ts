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

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
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

    const response = await fetch(`${this.baseUrl}/upload/pdf`, {
      method: 'POST',
      body: formData,
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
   */
  async chat(message: string): Promise<ChatResponse> {
    return this.request<ChatResponse>(
      `/chat?message=${encodeURIComponent(message)}`
    );
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

