import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { PalletWithLots } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';

type WebSocketContextType = {
  connected: boolean;
  pallets: PalletWithLots[];
  userCount: number;
  lastSync: Date;
};

const WebSocketContext = createContext<WebSocketContextType>({
  connected: false,
  pallets: [],
  userCount: 0,
  lastSync: new Date(),
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
  const { toast } = useToast();

  useEffect(() => {
    // Create WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setConnected(true);
      setLastSync(new Date());
      toast({
        title: 'Connected to server',
        description: 'Real-time updates are now enabled.',
      });
    };

    ws.onclose = () => {
      setConnected(false);
      toast({
        title: 'Disconnected from server',
        description: 'Trying to reconnect...',
        variant: 'destructive',
      });
      
      // Try to reconnect after 3 seconds
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      toast({
        title: 'Connection error',
        description: 'Could not connect to the server.',
        variant: 'destructive',
      });
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        setLastSync(new Date());
        
        switch (message.type) {
          case 'init':
            setPallets(message.data.pallets);
            setUserCount(message.data.connectedUsers);
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
    <WebSocketContext.Provider value={{ connected, pallets, userCount, lastSync }}>
      {children}
    </WebSocketContext.Provider>
  );
};