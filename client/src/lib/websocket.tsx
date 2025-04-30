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
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [pallets, setPallets] = useState<PalletWithLots[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [lastSync, setLastSync] = useState(new Date());
  const [clientId, setClientId] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Function to request the list of connected clients
  const getConnectedClients = useCallback(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'getConnectedClients' }));
    }
  }, [socket]);
  
  // Function to request a full data sync from the server
  const syncData = useCallback(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      // Silent sync - Tell the server to send us a full data refresh without toast notifications
      socket.send(JSON.stringify({ type: 'requestSync' }));
    } else {
      console.log('Cannot sync - WebSocket not connected');
      
      // Also try to reload data via REST API as a fallback - silently
      fetch('/api/pallets')
        .then(res => res.json())
        .then(data => {
          setPallets(data);
          setLastSync(new Date());
        })
        .catch(error => {
          console.error('Failed to fetch pallets:', error);
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
      
      // Initial data load
      fetch('/api/pallets')
        .then(res => res.json())
        .then(data => {
          setPallets(data);
          setLastSync(new Date());
          setConnected(true); // Mark as connected even though we're not using WebSockets
        })
        .catch(error => {
          console.error('Failed initial data load for TC70:', error);
        });
      
      // Set up polling for TC70 devices (every 10 seconds)
      const pollingInterval = setInterval(() => {
        fetch('/api/pallets')
          .then(res => res.json())
          .then(data => {
            setPallets(data);
            setLastSync(new Date());
            setConnected(true);
          })
          .catch(error => {
            console.error('Failed to poll data for TC70:', error);
            setConnected(false);
          });
      }, 10000);
      
      // Clean up interval on unmount
      return () => clearInterval(pollingInterval);
    }
    
    // For regular devices, use WebSockets with fallback and optimizations
    // Create WebSocket connection with exponential backoff retry
    const createWebSocketConnection = (retryCount = 0) => {
      // Check if WebSockets are supported
      if (!hasWebSocketSupport()) {
        console.log('WebSockets not supported, falling back to REST API polling');
        
        // Initial data load
        fetch('/api/pallets')
          .then(res => res.json())
          .then(data => {
            setPallets(data);
            setLastSync(new Date());
            setConnected(true);
          })
          .catch(error => {
            console.error('Failed initial data load:', error);
          });
        
        // Return null to indicate we're not using WebSockets
        return null;
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
          
          // Only show error notification if we're still connected and a new error occurs
          // And not on TC70 or other low-power devices
          if (connected && !isLowPowerDevice()) {
            toast({
              title: "Connection Error",
              description: "There was a problem with the real-time connection. Some updates may be delayed.",
              variant: "destructive"
            });
          }
          
          // Log additional context
          console.log('WebSocket readyState:', ws.readyState);
          console.log('Current connection status:', connected ? 'Connected' : 'Disconnected');
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

    // Only add event handlers if WebSocket was created
    if (ws) {
      ws.onmessage = (event) => {
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

    // Clean up the WebSocket connection
    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
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
