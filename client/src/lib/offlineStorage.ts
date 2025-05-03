import { PendingOperation } from './websocket';
import { v4 as uuidv4 } from 'uuid';

// LocalStorage key for pending operations
const PENDING_OPERATIONS_KEY = 'warehouse_pending_operations';

/**
 * Store a pending operation when offline
 * @param endpoint The API endpoint
 * @param method The HTTP method
 * @param data The data to send
 * @returns The created pending operation
 */
export function storePendingOperation(
  endpoint: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  data: any
): PendingOperation {
  // Get existing operations
  const existingOperations = getPendingOperations();
  
  // Create new operation
  const newOperation: PendingOperation = {
    id: uuidv4(),
    endpoint,
    method,
    data,
    timestamp: Date.now(),
    retryCount: 0
  };
  
  // Add to existing operations
  const updatedOperations = [...existingOperations, newOperation];
  
  // Save back to localStorage
  localStorage.setItem(PENDING_OPERATIONS_KEY, JSON.stringify(updatedOperations));
  
  // Return the new operation
  return newOperation;
}

/**
 * Get all pending operations
 * @returns Array of pending operations
 */
export function getPendingOperations(): PendingOperation[] {
  try {
    const stored = localStorage.getItem(PENDING_OPERATIONS_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as PendingOperation[];
  } catch (e) {
    console.error('Error retrieving pending operations:', e);
    return [];
  }
}

/**
 * Update the list of pending operations
 * @param operations The new operations list
 */
export function setPendingOperations(operations: PendingOperation[]): void {
  localStorage.setItem(PENDING_OPERATIONS_KEY, JSON.stringify(operations));
}

/**
 * Remove a specific operation by ID
 * @param id The operation ID to remove
 */
export function removePendingOperation(id: string): void {
  const operations = getPendingOperations();
  const filtered = operations.filter(op => op.id !== id);
  setPendingOperations(filtered);
}

/**
 * Clear all pending operations
 */
export function clearPendingOperations(): void {
  localStorage.removeItem(PENDING_OPERATIONS_KEY);
}