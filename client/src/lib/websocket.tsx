import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { PalletWithLots } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';

type WebSocketContextType = {
  connected: boolean;
  pallets: PalletWithLots[];
  userCount: number;
  lastSync: Date;
  clientId: string | null;
  getConnectedClients: () => void;
  syncData: () => void; // New function to force data refresh
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
    // Create WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connection established');
      setConnected(true);
      setLastSync(new Date());
      
      // Show connection established notification
      toast({
        title: "Connection Established",
        description: "Real-time updates are now active.",
      });
    };

    ws.onclose = (event) => {
      console.log(`WebSocket connection closed: code=${event.code}, reason=${event.reason || 'No reason provided'}`);
      setConnected(false);
      
      // Show connection lost notification only if it wasn't a normal closure
      if (event.code !== 1000 && event.code !== 1001) {
        toast({
          title: "Connection Lost",
          description: "Attempting to reconnect...",
          variant: "destructive"
        });
      }
      
      // Try to reconnect after 1 second
      console.log('Attempting to reconnect in 1 second...');
      setTimeout(() => {
        console.log('Reconnecting to WebSocket...');
        // Create new WebSocket connection
        const newWs = new WebSocket(wsUrl);
        
        // Preserve event handlers but check if they exist first (in case of errors or early closure)
        if (ws) {
          newWs.onopen = ws.onopen;
          newWs.onclose = ws.onclose;
          newWs.onerror = ws.onerror;
          newWs.onmessage = ws.onmessage;
        }
        
        setSocket(newWs);
      }, 1000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      
      // Show error notification
      toast({
        title: "Connection Error",
        description: "There was a problem with the real-time connection. Some updates may be delayed.",
        variant: "destructive"
      });
      
      // Log additional context
      console.log('WebSocket readyState:', ws.readyState);
      console.log('Current connection status:', connected ? 'Connected' : 'Disconnected');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        setLastSync(new Date());
        
        switch (message.type) {
          case 'init':
            console.log('Using API pallets:', message.data.pallets);
            setPallets(message.data.pallets);
            setUserCount(message.data.connectedUsers);
            setLastSync(new Date());
            
            // Save client ID from server
            if (message.data.clientId) {
              console.log('My client ID:', message.data.clientId);
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
            console.log('Received automatic data sync from server:', message.data.timestamp);
            
            // Compare pallets to detect changes
            const currentPalletIds = new Set(pallets.map(p => p.id));
            const newPalletIds = new Set(message.data.pallets.map(p => p.id));
            
            // Check for new pallets
            const newPallets = message.data.pallets.filter(p => !currentPalletIds.has(p.id));
            
            // Check for removed pallets
            const removedPallets = pallets.filter(p => !newPalletIds.has(p.id));
            
            // Check for updated lots (quantity changes, etc.)
            const updatedLots = [];
            pallets.forEach(existingPallet => {
              const newPallet = message.data.pallets.find(p => p.id === existingPallet.id);
              if (newPallet) {
                // Check each lot for changes
                existingPallet.lots.forEach(existingLot => {
                  const newLot = newPallet.lots.find(l => l.id === existingLot.id);
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
              newPallets.forEach(pallet => {
                toast({
                  title: "New Pallet Added",
                  description: `Pallet ${pallet.palletId} (${pallet.rmNumber}) was added at ${pallet.location}.`,
                  duration: 5000,
                });
              });
            }
            
            if (removedPallets.length > 0) {
              removedPallets.forEach(pallet => {
                toast({
                  title: "Pallet Removed",
                  description: `Pallet ${pallet.palletId} was removed.`,
                  duration: 5000,
                });
              });
            }
            
            if (updatedLots.length > 0) {
              updatedLots.forEach(update => {
                toast({
                  title: "Quantity Updated",
                  description: `Lot ${update.lotNumber} on pallet ${update.palletId} changed from ${update.oldQuantity} to ${update.newQuantity}.`,
                  duration: 5000,
                });
              });
            }
            
            // If no specific changes detected, don't show any notification
            // This reduces notification noise for routine background syncs
            if (newPallets.length === 0 && removedPallets.length === 0 && updatedLots.length === 0) {
              // Silent sync - no toast notification
            }
            break;
            
          default:
            console.log('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    setSocket(ws);

    // Clean up the WebSocket connection
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
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