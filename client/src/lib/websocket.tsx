import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from 'react';
import { PalletWithLots } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { isTC70, isLowPowerDevice, hasWebSocketSupport, getBrowserInfo } from './deviceDetection';
import WebSocketService, { MessageHandler } from './websocketService';

// Type for pending operations that will be stored when offline
export type PendingOperation = {
  id: string;
  endpoint: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  data: any;
  timestamp: number;
  retryCount: number;
};

type WebSocketContextType = {
  connected: boolean;
  pallets: PalletWithLots[];
  userCount: number;
  lastSync: Date;
  clientId: string | null;
  getConnectedClients: () => void;
  syncData: () => void; // Function to force data refresh
  isOnline: boolean; // Network connection status
  pendingOperations: PendingOperation[]; // Operations waiting to be processed
  connectionStatus: 'online' | 'offline' | 'limited'; // More detailed status
};

const WebSocketContext = createContext<WebSocketContextType>({
  connected: false,
  pallets: [],
  userCount: 0,
  lastSync: new Date(),
  clientId: null,
  getConnectedClients: () => {},
  syncData: () => {},
  isOnline: navigator.onLine,
  pendingOperations: [],
  connectionStatus: 'offline',
});

export const useWebSocket = () => useContext(WebSocketContext);

type WebSocketProviderProps = {
  children: ReactNode;
};

type PollingConnection = {
  pollInterval: NodeJS.Timeout;
  cleanup: () => void;
};

export const WebSocketProvider = ({ children }: WebSocketProviderProps) => {
  const [connected, setConnected] = useState(false);
  const [pallets, setPallets] = useState<PalletWithLots[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [lastSync, setLastSync] = useState(new Date());
  const [clientId, setClientId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingOperations, setPendingOperations] = useState<PendingOperation[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'limited'>(
    navigator.onLine ? 'limited' : 'offline'
  );
  
  // Track polling interval for TC70 and WebSocket-unsupported devices
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track last sync request time to prevent too frequent syncs
  const lastSyncRequestRef = useRef<number>(0);
  const MIN_SYNC_INTERVAL = 3000; // Minimum time between sync requests (3 seconds)
  
  const { toast } = useToast();
  
  // Function to request the list of connected clients
  const getConnectedClients = useCallback(() => {
    WebSocketService.sendMessage('getConnectedClients');
  }, []);
  
  // Function to request a full data sync from the server
  const syncData = useCallback(() => {
    // Implement debouncing to prevent too frequent sync requests
    const now = Date.now();
    if (now - lastSyncRequestRef.current < MIN_SYNC_INTERVAL) {
      console.log('Sync request debounced (too frequent)');
      return;
    }
    
    // Update the last sync request time
    lastSyncRequestRef.current = now;
    
    // Try WebSocket first
    if (WebSocketService.getStatus() === 'open') {
      WebSocketService.requestSync();
      return;
    }
    
    // Fall back to REST API if WebSocket is not available
    console.log('Cannot sync via WebSocket - using REST API fallback');
    
    // Get the auth token from localStorage
    const token = localStorage.getItem("auth_token");
    
    // Setup headers with auth token if it exists
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Cache-Control': 'no-cache, no-store'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    fetch(`${window.location.origin}/api/pallets`, {
      method: 'GET',
      headers: headers,
      credentials: 'include'
    })
      .then(res => {
        if (!res.ok) {
          throw new Error(`Server responded with status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          console.log(`Manual sync successful, received ${data.length} pallets`);
          setPallets(data);
          setLastSync(new Date());
          setConnected(true);
        } else {
          console.error('Invalid data format received:', data);
          if (data && typeof data === 'object') {
            setPallets(data.pallets || []);
          }
        }
      })
      .catch(error => {
        console.error('Failed to fetch pallets:', error);
        setConnected(false);
        toast({
          title: "Sync Failed",
          description: "Could not fetch data. Check your connection.",
          variant: "destructive"
        });
      });
  }, [toast]);
  
  // Update the connection status when connected or online state changes
  useEffect(() => {
    if (!isOnline) {
      setConnectionStatus('offline');
    } else if (connected) {
      setConnectionStatus('online');
      // Process any pending operations when connection is restored
      if (pendingOperations.length > 0) {
        processPendingOperations();
      }
    } else {
      setConnectionStatus('limited');
    }
  }, [isOnline, connected, pendingOperations]);
  
  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: "Back Online",
        description: "Your internet connection has been restored.",
      });
      syncData();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: "Offline Mode",
        description: "Working offline. Changes will sync when connection is restored.",
        variant: "destructive"
      });
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncData, toast]);
  
  // Process pending operations that were stored while offline
  const processPendingOperations = useCallback(() => {
    if (pendingOperations.length === 0 || !isOnline) return;
    
    // Clone the current pending operations
    const operations = [...pendingOperations];
    
    // Clear the pending operations first to prevent duplicates if processing fails
    setPendingOperations([]);
    
    // Show toast notification about syncing changes
    if (operations.length > 0) {
      toast({
        title: "Syncing Changes",
        description: `Processing ${operations.length} pending operations...`,
      });
    }
    
    // Process each operation in sequence
    // Get the auth token from localStorage
    const token = localStorage.getItem("auth_token");
    
    operations.forEach(op => {
      // Setup headers with auth token if it exists
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      fetch(op.endpoint, {
        method: op.method,
        headers: headers,
        credentials: 'include',
        body: JSON.stringify(op.data)
      })
      .catch(error => {
        console.error(`Failed to process pending operation:`, error, op);
        
        // If still online, retry with incremented retry count
        if (isOnline && op.retryCount < 3) {
          setPendingOperations(prev => [...prev, {
            ...op,
            retryCount: op.retryCount + 1,
            timestamp: Date.now()
          }]);
        }
      });
    });
    
    // After processing operations, force a full sync to ensure consistency
    syncData();
  }, [pendingOperations, isOnline, syncData, toast]);
  
  // Set up polling for TC70 devices or devices without WebSocket support
  const setupPolling = useCallback(() => {
    // Clear any existing polling interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    const pollData = (retryAttempt = 0) => {
      console.log(`Polling data (attempt: ${retryAttempt})`);
      
      // Get the auth token from localStorage
      const token = localStorage.getItem("auth_token");
      
      // Setup headers with auth token if it exists
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache, no-store'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      fetch(`${window.location.origin}/api/pallets`, {
        method: 'GET',
        headers: headers,
        credentials: 'include',
        cache: 'no-store' // Prevent caching issues
      })
        .then(res => {
          if (!res.ok) {
            throw new Error(`Server responded with status: ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          if (Array.isArray(data)) {
            console.log(`Poll successful, received ${data.length} pallets`);
            setPallets(data);
            setLastSync(new Date());
            setConnected(true);
          } else {
            console.error('Invalid data format received:', data);
            if (data && typeof data === 'object') {
              setPallets(data.pallets || []);
            }
          }
        })
        .catch(error => {
          console.error('Failed to poll data:', error);
          setConnected(false);
          
          // Retry with exponential backoff
          if (retryAttempt < 5) {
            const delay = Math.min(30000, 1000 * Math.pow(2, retryAttempt));
            console.log(`Will retry in ${delay}ms`);
            setTimeout(() => pollData(retryAttempt + 1), delay);
          }
        });
    };
    
    // Initial poll
    pollData();
    
    // Set up regular polling (every 15 seconds)
    pollingIntervalRef.current = setInterval(() => pollData(), 15000);
    
    // Return cleanup function
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);
  
  // Handle WebSocket messages
  const handleWebSocketMessage: MessageHandler = useCallback((message) => {
    try {
      switch (message.type) {
        case 'init':
          // Silent data loading - reduces console spam
          setPallets(message.data.pallets);
          setUserCount(message.data.connectedUsers);
          setLastSync(new Date());
          
          // Save client ID
          if (message.data.clientId) {
            setClientId(message.data.clientId);
          }
          
          // Show a toast if this is a data sync event (not the initial connection)
          if (connected) {
            toast({
              title: "Data Synchronized",
              description: `${message.data.pallets.length} pallets loaded from server.`,
            });
          }
          break;
          
        case 'userCount':
          // Update the number of connected users
          setUserCount(message.data);
          break;
          
        case 'palletCreated':
          // Add the new pallet to the state
          setPallets(prev => [...prev, message.data]);
          toast({
            title: "New Pallet Added",
            description: `Pallet ${message.data.palletId} has been added.`,
          });
          break;
          
        case 'palletUpdated':
          // Update the modified pallet in the state
          setPallets(prev => 
            prev.map(p => p.id === message.data.id ? message.data : p)
          );
          toast({
            title: "Pallet Updated",
            description: `Pallet ${message.data.palletId} has been updated.`,
          });
          break;
          
        case 'palletArchived':
          // Update the archived pallet in the state
          setPallets(prev => 
            prev.map(p => p.id === message.data.id ? message.data : p)
          );
          toast({
            title: "Pallet Archived",
            description: `Pallet ${message.data.palletId} has been archived.`,
          });
          break;
          
        case 'lotCreated':
          // Update the pallet that contains the new lot
          setPallets(prev => 
            prev.map(p => p.id === message.data.pallet.id ? message.data.pallet : p)
          );
          toast({
            title: "Lot Added",
            description: `Lot added to pallet ${message.data.pallet.palletId}.`,
          });
          break;
          
        case 'lotUpdated':
          setPallets(prev => 
            prev.map(p => p.id === message.data.pallet.id ? message.data.pallet : p)
          );
          break;
          
        case 'lotDeleted':
          setPallets(prev => 
            prev.map(p => p.id === message.data.pallet.id ? message.data.pallet : p)
          );
          toast({
            title: 'Lot Removed',
            description: `Lot has been removed.`,
          });
          break;
          
        case 'palletDeleted':
          setPallets(prev => prev.filter(p => p.id !== message.data.id));
          toast({
            title: 'Pallet Deleted',
            description: `Pallet ${message.data.palletId} has been permanently deleted.`,
            variant: 'destructive'
          });
          break;
          
        case 'transactionDeleted':
          // We don't store transactions in state, but toast a notification
          toast({
            title: 'Transaction Deleted',
            description: `Transaction has been removed from history.`,
          });
          break;
          
        case 'notification':
          toast({
            title: message.data.title,
            description: message.data.description,
          });
          break;

        case 'fullSync':
          // Handle automatic server-initiated data sync (every 60s)
          // Silent data sync - no console logging
          
          // Compare pallets to detect changes
          const currentPalletIds = new Set(pallets.map((p: PalletWithLots) => p.id));
          const newPalletIds = new Set(message.data.pallets.map((p: PalletWithLots) => p.id));
          
          // Check for new pallets
          const newPallets = message.data.pallets.filter((p: PalletWithLots) => !currentPalletIds.has(p.id));
          
          // Check for removed pallets (active ones, not archived)
          const removedPallets = pallets.filter((p: PalletWithLots) => 
            !newPalletIds.has(p.id) && p.status === 'active'
          );
          
          // Track lots that have changed quantities
          type LotUpdate = {
            palletId: string;
            lotNumber: string;
            oldQuantity: number;
            newQuantity: number;
          };
          
          const updatedLots: LotUpdate[] = [];
          
          // Check for updated pallets and lots within them
          message.data.pallets.forEach((newPallet: PalletWithLots) => {
            const oldPallet = pallets.find(p => p.id === newPallet.id);
            if (oldPallet && newPallet.lots.length > 0) {
              // Iterate through each lot in the new pallet
              newPallet.lots.forEach(newLot => {
                // Find the corresponding lot in the old pallet
                const oldLot = oldPallet.lots.find(l => l.id === newLot.id);
                if (oldLot && oldLot.quantity !== newLot.quantity) {
                  // The lot exists in both pallets but the quantity has changed
                  updatedLots.push({
                    palletId: newPallet.palletId,
                    lotNumber: newLot.lotNumber,
                    oldQuantity: oldLot.quantity,
                    newQuantity: newLot.quantity
                  });
                }
              });
            }
          });
          
          // Update state with new data
          setPallets(message.data.pallets);
          
          // Show notifications for important changes only to reduce notification noise
          if (newPallets.length > 0) {
            newPallets.forEach((pallet: PalletWithLots) => {
              toast({
                title: "New Pallet Added",
                description: `Pallet ${pallet.palletId} (${pallet.rmNumber}) was added at ${pallet.location}.`,
                duration: 5000,
              });
            });
          }
          
          if (removedPallets.length > 0) {
            removedPallets.forEach((pallet: PalletWithLots) => {
              toast({
                title: "Pallet Removed",
                description: `Pallet ${pallet.palletId} was removed.`,
                duration: 5000,
              });
            });
          }
          
          if (updatedLots.length > 0) {
            updatedLots.forEach((update: LotUpdate) => {
              toast({
                title: "Quantity Updated",
                description: `Lot ${update.lotNumber} on pallet ${update.palletId} changed from ${update.oldQuantity} to ${update.newQuantity}.`,
                duration: 5000,
              });
            });
          }
          
          // If no specific changes detected, don't show any notification
          // This reduces notification noise for routine background syncs
          break;
          
        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  }, [connected, pallets, toast]);
  
  // Set up main connection logic
  useEffect(() => {
    // Log device info on startup for debugging
    console.log('Device info:', getBrowserInfo());
    
    // For TC70 devices, use REST API polling instead of WebSockets
    if (isTC70()) {
      console.log('TC70 detected, using REST API polling instead of WebSockets');
      return setupPolling();
    }
    
    // For devices without WebSocket support, use REST API polling
    if (!hasWebSocketSupport()) {
      console.log('WebSockets not supported, falling back to REST API polling');
      return setupPolling();
    }
    
    // Add message handler for WebSocket messages
    WebSocketService.addMessageHandler(handleWebSocketMessage);
    
    // Handle WebSocket connection status changes
    const handleOpen = () => {
      setConnected(true);
      
      // Request initial data
      WebSocketService.requestSync();
      
      // Only show connection notification on non-low-power devices
      if (!isLowPowerDevice()) {
        toast({
          title: "Connection Established",
          description: "Real-time updates are now active.",
        });
      }
    };
    
    const handleClose = () => {
      setConnected(false);
      
      // Only show disconnection on non-low-power devices
      if (!isLowPowerDevice()) {
        toast({
          title: "Connection Lost",
          description: "Attempting to reconnect...",
          variant: "destructive"
        });
      }
    };
    
    const handleError = () => {
      // Only show error on non-low-power devices
      if (!isLowPowerDevice()) {
        toast({
          title: "Connection Error",
          description: "There was a problem with the real-time connection.",
          variant: "destructive"
        });
      }
    };
    
    // Add event listeners
    WebSocketService.addEventListener('open', handleOpen);
    WebSocketService.addEventListener('close', handleClose);
    WebSocketService.addEventListener('error', handleError);
    
    // Initialize connection
    WebSocketService.connect();
    
    // Set up a health check every 30 seconds
    const healthCheckInterval = setInterval(() => {
      if (!WebSocketService.isHealthy()) {
        console.log("WebSocket connection is stale, reconnecting...");
        WebSocketService.reconnect();
      }
    }, 30000);
    
    // Clean up
    return () => {
      WebSocketService.removeMessageHandler(handleWebSocketMessage);
      WebSocketService.removeEventListener('open', handleOpen);
      WebSocketService.removeEventListener('close', handleClose);
      WebSocketService.removeEventListener('error', handleError);
      clearInterval(healthCheckInterval);
    };
  }, [handleWebSocketMessage, isLowPowerDevice, setupPolling, toast]);
  
  // Update clientId from the service
  useEffect(() => {
    const clientIdFromService = WebSocketService.getClientId();
    if (clientIdFromService !== clientId) {
      setClientId(clientIdFromService);
    }
  }, [clientId]);
  
  // Update connection status from the service
  useEffect(() => {
    const updateConnectionStatus = () => {
      const status = WebSocketService.getStatus();
      setConnected(status === 'open');
    };
    
    // Update status whenever WebSocket events occur
    WebSocketService.addEventListener('open', updateConnectionStatus);
    WebSocketService.addEventListener('close', updateConnectionStatus);
    WebSocketService.addEventListener('error', updateConnectionStatus);
    
    // Initial update
    updateConnectionStatus();
    
    // Clean up
    return () => {
      WebSocketService.removeEventListener('open', updateConnectionStatus);
      WebSocketService.removeEventListener('close', updateConnectionStatus);
      WebSocketService.removeEventListener('error', updateConnectionStatus);
    };
  }, []);
  
  return (
    <WebSocketContext.Provider
      value={{
        connected,
        pallets,
        userCount,
        lastSync,
        clientId,
        getConnectedClients,
        syncData,
        isOnline,
        pendingOperations,
        connectionStatus
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};