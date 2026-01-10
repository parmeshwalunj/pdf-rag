/**
 * Auth Helper
 * Provides a way to get Clerk token in client components
 */

'use client'

import { useAuth } from '@clerk/nextjs';
import { useEffect } from 'react';
import { api } from './api';

/**
 * Hook to initialize API client with auth token
 * Call this in your root component or layout
 */
export function useApiAuth() {
  const { getToken } = useAuth();

  useEffect(() => {
    // Set the token getter in API client
    api.setTokenGetter(async () => {
      try {
        return await getToken();
      } catch (error) {
        console.error('Failed to get token:', error);
        return null;
      }
    });
  }, [getToken]);
}
