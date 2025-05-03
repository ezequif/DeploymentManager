import { useWebSocket } from './websocket';
import { storePendingOperation } from './offlineStorage';

/**
 * Creates an offline-aware API request function
 * This will attempt to make the request normally, but if offline, 
 * will store the operation for later processing
 * 
 * @param endpoint The API endpoint 
 * @param method The HTTP method
 * @param data The request data
 * @param options Additional options
 */
export function createOfflineAwareRequest<T>(
  endpoint: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  data: any,
  options?: {
    offlineMessage?: string;
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
  }
) {
  const { isOnline } = useWebSocket();
  
  return async (): Promise<T | null> => {
    // If we're offline, store the operation for later
    if (!isOnline) {
      storePendingOperation(endpoint, method, data);
      
      if (options?.offlineMessage) {
        // Show toast notification if available
        console.log(options.offlineMessage || 'Operation stored for when you\'re back online');
      }
      
      return null;
    }
    
    // Otherwise, attempt the request normally
    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      
      const responseData = await response.json() as T;
      
      if (options?.onSuccess) {
        options.onSuccess(responseData);
      }
      
      return responseData;
    } catch (error) {
      console.error('Error making request:', error);
      
      // If the error is likely due to being offline, store the operation
      if (!navigator.onLine) {
        storePendingOperation(endpoint, method, data);
      }
      
      if (options?.onError && error instanceof Error) {
        options.onError(error);
      }
      
      throw error;
    }
  };
}

/**
 * Hook to create an offline-aware mutation function
 * Use this with tanstack-query mutations
 */
export function useOfflineAwareMutation<T>(
  endpoint: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  options?: {
    offlineMessage?: string;
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
  }
) {
  const { isOnline } = useWebSocket();
  
  return async (data: any): Promise<T | null> => {
    // If we're offline, store the operation for later
    if (!isOnline) {
      storePendingOperation(endpoint, method, data);
      
      if (options?.offlineMessage) {
        // Show toast notification if available
        console.log(options.offlineMessage || 'Operation stored for when you\'re back online');
      }
      
      return null;
    }
    
    // Otherwise, perform the request
    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      
      const responseData = await response.json() as T;
      
      if (options?.onSuccess) {
        options.onSuccess(responseData);
      }
      
      return responseData;
    } catch (error) {
      console.error('Error making request:', error);
      
      // If the error is likely due to being offline, store the operation
      if (!navigator.onLine) {
        storePendingOperation(endpoint, method, data);
      }
      
      if (options?.onError && error instanceof Error) {
        options.onError(error);
      }
      
      throw error;
    }
  };
}