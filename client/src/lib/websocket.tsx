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
};

const WebSocketContext = createContext<WebSocketContextType>({
  connected: false,
  pallets: [],
  userCount: 0,
  lastSync: new Date(),
  clientId: null,
  getConnectedClients: () => {},
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

  useEffect(() => {
    // Create WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setConnected(true);
      setLastSync(new Date());
      // Silently connect without a toast notification
    };

    ws.onclose = () => {
      setConnected(false);
      // Silently try to reconnect without a toast notification
      
      // Try to reconnect after 1 second
      setTimeout(() => {
        // Create new WebSocket connection
        const newWs = new WebSocket(wsUrl);
        newWs.onopen = ws.onopen;
        newWs.onclose = ws.onclose;
        newWs.onerror = ws.onerror;
        newWs.onmessage = ws.onmessage;
        setSocket(newWs);
      }, 1000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      // Silently handle error without a toast notification
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        setLastSync(new Date());
        
        switch (message.type) {
          case 'init':
            setPallets(message.data.pallets);
            setUserCount(message.data.connectedUsers);
            
            // Save client ID from server
            if (message.data.clientId) {
              console.log('My client ID:', message.data.clientId);
              setClientId(message.data.clientId);
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
  }, []);

  return (
    <WebSocketContext.Provider value={{ 
      connected, 
      pallets, 
      userCount, 
      lastSync, 
      clientId,
      getConnectedClients
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};