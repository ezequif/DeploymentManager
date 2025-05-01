import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { PalletWithLots } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { isTC70, isLowPowerDevice, hasWebSocketSupport, getBrowserInfo } from './deviceDetection';

type WebSocketContextType = {
  connected: boolean;
  pallets: PalletWithLots[];
  userCount: number;
  lastSync: Date;
  clientId: string | null;
  getConnectedClients: () => void;
  syncData: () => void; // Function to force data refresh
};

const WebSocketContext = createContext<WebSocketContextType>({
  connected: false,
  pallets: [],
  userCount: 0,
  lastSync: new Date(),
  clientId: null,
  getConnectedClients: () => {},
  syncData: () => {},
});

export const useWebSocket = () => useContext(WebSocketContext);

type WebSocketProviderProps = {
  children: ReactNode;
};

export const WebSocketProvider = ({ children }: WebSocketProviderProps) => {
  // Define a type for our polling connection return object
  type PollingConnection = {
    pollInterval: NodeJS.Timeout;
    cleanup: () => void;
  };
  
  // Socket can be either a WebSocket or our polling connection object
  type WSConnection = WebSocket | PollingConnection | null;
  const [socket, setSocket] = useState<WSConnection>(null);
  const [connected, setConnected] = useState(false);
  const [pallets, setPallets] = useState<PalletWithLots[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [lastSync, setLastSync] = useState(new Date());
  const [clientId, setClientId] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Function to request the list of connected clients
  const getConnectedClients = useCallback(() => {
    if (socket && 'readyState' in socket && 'send' in socket) {
      const ws = socket as WebSocket;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'getConnectedClients' }));
      }
    }
  }, [socket]);
  
  // Function to request a full data sync from the server
  const syncData = useCallback(() => {
    let canUseWebSocket = false;
    
    // Check if we have a valid WebSocket connection
    if (socket && 'readyState' in socket && 'send' in socket) {
      const ws = socket as WebSocket;
      if (ws.readyState === WebSocket.OPEN) {
        try {
          // Silent sync - Tell the server to send us a full data refresh without toast notifications
          ws.send(JSON.stringify({ type: 'requestSync' }));
          canUseWebSocket = true;
        } catch (e) {
          console.error("Failed to send sync request via WebSocket:", e);
          canUseWebSocket = false;
        }
      }
    }
    
    // If we couldn't use WebSocket, fall back to REST API
    if (!canUseWebSocket) {
      console.log('Cannot sync via WebSocket - using REST API fallback');
      
      // Try to reload data via REST API as a fallback - silently
      const apiUrl = `${window.location.origin}/api/pallets`;
      console.log(`Fetching from: ${apiUrl}`);
      
      fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store'
        }
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
            // Still store if it's not an array but valid
            if (data && typeof data === 'object') {
              setPallets(data.pallets || []);
            }
          }
        })
        .catch(error => {
          console.error('Failed to fetch pallets:', error);
          setConnected(false);
          // Only show a toast on error
          toast({
            title: "Sync Failed",
            description: "Could not fetch data. Check your connection.",
            variant: "destructive"
          });
        });
    }
  }, [socket, toast]);

  useEffect(() => {
    // Log device info on startup for debugging
    console.log('Device info:', getBrowserInfo());
    
    // For TC70 devices, we use REST API polling instead of WebSockets
    if (isTC70()) {
      console.log('TC70 detected, using REST API polling instead of WebSockets');
      
      // Create a more robust polling mechanism with retry capability for TC70
      const pollData = (retryAttempt = 0) => {
        console.log(`Polling data for TC70 (attempt: ${retryAttempt})`);
        
        // Use a full absolute URL to avoid any path resolution issues
        const apiUrl = `${window.location.origin}/api/pallets`;
        console.log(`Fetching from: ${apiUrl}`);
        
        fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache, no-store'
          },
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
              console.log(`TC70 poll successful, received ${data.length} pallets`);
              setPallets(data);
              setLastSync(new Date());
              setConnected(true);
            } else {
              console.error('Invalid data format received:', data);
              // Still store if it's not an array but valid
              if (data && typeof data === 'object') {
                setPallets(data.pallets || []);
              }
            }
          })
          .catch(error => {
            console.error('Failed to poll data for TC70:', error);
            setConnected(false);
            
            // Implement exponential backoff for retries
            if (retryAttempt < 5) { // Limit to 5 retry attempts
              const delay = Math.min(30000, 1000 * Math.pow(2, retryAttempt));
              console.log(`Will retry in ${delay}ms`);
              setTimeout(() => pollData(retryAttempt + 1), delay);
            }
          });
      };
      
      // Initial data load
      pollData();
      
      // Set up polling for TC70 devices (every 15 seconds)
      const pollingInterval = setInterval(() => pollData(), 15000);
      
      // Clean up interval on unmount
      return () => clearInterval(pollingInterval);
    }
    
    // For regular devices, use WebSockets with fallback and optimizations
    // Create WebSocket connection with exponential backoff retry
    const createWebSocketConnection = (retryCount = 0) => {
      // Check if WebSockets are supported
      if (!hasWebSocketSupport()) {
        console.log('WebSockets not supported, falling back to REST API polling');
        
        // Use the same robust polling mechanism we use for TC70 devices
        const pollData = (retryAttempt = 0) => {
          console.log(`Polling data (WebSocket fallback) (attempt: ${retryAttempt})`);
          
          // Use a full absolute URL to avoid any path resolution issues
          const apiUrl = `${window.location.origin}/api/pallets`;
          console.log(`Fetching from: ${apiUrl}`);
          
          fetch(apiUrl, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Cache-Control': 'no-cache, no-store'
            }
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
        
        // Initial data load and set up polling
        pollData();
        
        // Polling interval that will run every 15 seconds
        const pollingInterval = setInterval(() => pollData(), 15000);
        
        // Create a cleanup function for the parent useEffect
        const cleanupPolling = () => {
          clearInterval(pollingInterval);
        };
        
        // Create an object to return the cleanup function that will
        // be called when the component unmounts
        const returnObj = {
          pollInterval: pollingInterval,
          cleanup: cleanupPolling
        };
        
        // Clean up the interval on component unmount
        // We'll handle the cleanup in the main useEffect return
        return returnObj;
      }
      
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      // Calculate the delay based on retry count, with a maximum of 10 seconds
      // For low-power devices, use a longer backoff to conserve battery
      const maxDelay = isLowPowerDevice() ? 30000 : 10000;
      const delay = Math.min(maxDelay, 1000 * Math.pow(1.5, retryCount));
      
      try {
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setConnected(true);
          setLastSync(new Date());
          
          // Only show connection notification on non-TC70 devices to reduce noise
          if (!connected && !isLowPowerDevice()) {
            toast({
              title: "Connection Established",
              description: "Real-time updates are now active.",
            });
          }
        };

        ws.onclose = (event) => {
          setConnected(false);
          
          // Show connection lost notification only if it wasn't a normal closure
          // and not on TC70 or other low-power devices
          if (event.code !== 1000 && event.code !== 1001 && !isLowPowerDevice()) {
            toast({
              title: "Connection Lost",
              description: "Attempting to reconnect...",
              variant: "destructive"
            });
          }
          
          // Try to reconnect with exponential backoff
          setTimeout(() => {
            createWebSocketConnection(retryCount + 1);
          }, delay);
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          
          // Force a fallback to REST API immediately when a WebSocket error occurs
          console.log("WebSocket error detected, falling back to REST API");
          setConnected(false);
          
          // Close the faulty connection
          try {
            ws.close();
          } catch (e) {
            console.error("Error closing WebSocket after error:", e);
          }
          
          // Perform an immediate REST API fallback call
          syncData();
          
          // Only show error notification if we're still connected and a new error occurs
          // And not on TC70 or other low-power devices
          if (connected && !isLowPowerDevice()) {
            toast({
              title: "Connection Error",
              description: "Switched to backup connection mode. Your data will still be available.",
              variant: "destructive"
            });
          }
          
          // Log additional context
          console.log('WebSocket readyState:', ws.readyState);
          console.log('Current connection status:', connected ? 'Connected' : 'Disconnected');
          console.log('Using REST API fallback');
        };
        
        setSocket(ws);
        return ws;
      } catch (e) {
        console.error('Error creating WebSocket connection:', e);
        
        // Try to reconnect with exponential backoff
        setTimeout(() => {
          createWebSocketConnection(retryCount + 1);
        }, delay);
        
        return null;
      }
    };
    
    // Initialize the WebSocket connection if not on TC70
    const ws = createWebSocketConnection();

    // Only add event handlers if WebSocket was created (not polling connection)
    if (ws && 'onmessage' in ws) {
      // This means we're dealing with an actual WebSocket instance
      (ws as WebSocket).onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          setLastSync(new Date());
          
          switch (message.type) {
            case 'init':
              // Silent data loading - reduces console spam
              setPallets(message.data.pallets);
              setUserCount(message.data.connectedUsers);
              setLastSync(new Date());
              
              // Save client ID from server (silently)
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
              
            case 'connectedClients':
              // We could manage this in state if needed in the future,
              // but for now we'll handle it in the ConnectedClientsModal
              console.log('Received connected clients:', message.data);
              break;
              
            case 'userCount':
              setUserCount(message.data);
              break;
              
            case 'palletCreated':
              console.log('Pallet created', message.data);
              setPallets(prev => {
                // Check if the pallet already exists in the array
                const exists = prev.some(p => p.id === message.data.id);
                if (exists) {
                  return prev.map(p => p.id === message.data.id ? message.data : p);
                } else {
                  return [...prev, message.data];
                }
              });
              toast({
                title: 'Pallet Created',
                description: `Pallet ${message.data.palletId} has been created.`,
              });
              break;
              
            case 'palletUpdated':
              setPallets(prev => 
                prev.map(p => p.id === message.data.id ? message.data : p)
              );
              toast({
                title: 'Pallet Updated',
                description: `Pallet ${message.data.palletId} has been updated.`,
              });
              break;
              
            case 'lotCreated':
              setPallets(prev => 
                prev.map(p => p.id === message.data.pallet.id ? message.data.pallet : p)
              );
              toast({
                title: 'Lot Added',
                description: `Lot ${message.data.lot.lotNumber} has been added.`,
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
              
              // Check for removed pallets
              const removedPallets = pallets.filter((p: PalletWithLots) => !newPalletIds.has(p.id));
              
              // Check for updated lots (quantity changes, etc.)
              type LotUpdate = {
                palletId: string;
                lotNumber: string;
                oldQuantity: number;
                newQuantity: number;
              };
              const updatedLots: LotUpdate[] = [];
              
              pallets.forEach((existingPallet: PalletWithLots) => {
                const newPallet = message.data.pallets.find((p: PalletWithLots) => p.id === existingPallet.id);
                if (newPallet) {
                  // Check each lot for changes
                  existingPallet.lots.forEach((existingLot) => {
                    // Use proper type for the lots
                    const newLot = newPallet.lots.find((l: any) => {
                      return l.id === existingLot.id;
                    });
                    if (newLot && newLot.quantity !== existingLot.quantity) {
                      updatedLots.push({
                        palletId: existingPallet.palletId,
                        lotNumber: existingLot.lotNumber,
                        oldQuantity: existingLot.quantity,
                        newQuantity: newLot.quantity
                      });
                    }
                  });
                }
              });
              
              // Update state with new data
              setPallets(message.data.pallets);
              setUserCount(message.data.connectedUsers || userCount);
              setLastSync(new Date());
              
              // Show notifications for detected changes
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
          console.error('Error parsing WebSocket message:', error);
        }
      };
    }

    // Clean up the WebSocket connection or polling interval
    return () => {
      if (ws) {
        // If it's a real WebSocket
        if ('readyState' in ws && 'close' in ws) {
          const webSocket = ws as WebSocket;
          if (webSocket.readyState === WebSocket.OPEN) {
            webSocket.close();
          }
        }
        // If it's our polling connection
        else if ('cleanup' in ws && typeof ws.cleanup === 'function') {
          const pollingConnection = ws as PollingConnection;
          pollingConnection.cleanup();
        }
      }
    };
  }, [toast, connected]);

  return (
    <WebSocketContext.Provider value={{ 
      connected, 
      pallets, 
      userCount, 
      lastSync, 
      clientId,
      getConnectedClients,
      syncData
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};
