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
      console.log('Requesting full data sync from server...');
      // Tell the server to send us a full data refresh
      socket.send(JSON.stringify({ type: 'requestSync' }));
      toast({
        title: "Synchronizing Data",
        description: "Refreshing data from server..."
      });
    } else {
      console.log('Cannot sync - WebSocket not connected');
      toast({
        title: "Sync Failed",
        description: "Not connected to server. Try refreshing the page.",
        variant: "destructive"
      });
      
      // Also try to reload data via REST API as a fallback
      fetch('/api/pallets')
        .then(res => res.json())
        .then(data => {
          console.log('Fetched pallets via REST API:', data);
          setPallets(data);
          setLastSync(new Date());
          toast({
            title: "Data Refreshed",
            description: "Data has been updated from server."
          });
        })
        .catch(error => {
          console.error('Failed to fetch pallets:', error);
          toast({
            title: "Sync Failed",
            description: "Could not refresh data. Please try again.",
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
            setPallets(message.data.pallets);
            setUserCount(message.data.connectedUsers);
            setLastSync(new Date());
            
            // Only show a subtle notification for automatic syncs
            toast({
              title: "Data Auto-Synchronized",
              description: `${message.data.pallets.length} pallets loaded from server.`,
              duration: 3000, // Shorter duration for auto-sync notifications
            });
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