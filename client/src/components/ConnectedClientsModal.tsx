import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useWebSocket } from '@/lib/websocket';
import { formatElapsedTime } from '@/lib/formatUtils';
import { RefreshCw } from 'lucide-react';

interface ConnectedClientsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ConnectedClient = {
  id: string;
  ipAddress: string;
  connectedAt: Date;
  userAgent: string;
  connectedFor: string;
};

export default function ConnectedClientsModal({ isOpen, onClose }: ConnectedClientsModalProps) {
  const { toast } = useToast();
  const { connected, userCount, getConnectedClients, clientId } = useWebSocket();
  const [clients, setClients] = useState<ConnectedClient[]>([]);
  const [loading, setLoading] = useState(true);

  // Function to fetch connected clients
  const fetchClients = useCallback(async () => {
    setLoading(true);
    
    try {
      // Use the REST API endpoint for simplicity and reliability
      const response = await fetch('/api/connected-clients');
      
      if (!response.ok) {
        throw new Error(`Error fetching clients: ${response.status}`);
      }
      
      const data = await response.json();
      setClients(data);
    } catch (error) {
      console.error('Error fetching connected clients:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch connected clients',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Fetch clients when the modal opens
  useEffect(() => {
    if (isOpen) {
      fetchClients();
    }
  }, [isOpen, fetchClients]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Connected Users</DialogTitle>
          <DialogDescription>
            Currently {userCount} users connected to the system.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          {loading ? (
            <div className="flex justify-center p-4">
              <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : clients.length === 0 ? (
            <div className="text-center p-4 text-gray-500">
              No clients connected
            </div>
          ) : (
            <div className="space-y-4">
              {clients.map((client) => {
                const isCurrentUser = client.id === clientId;
                return (
                  <div 
                    key={client.id} 
                    className={`p-4 border rounded-lg ${isCurrentUser ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'}`}
                  >
                    <div className="grid grid-cols-2 gap-y-1 text-sm">
                      <div className="font-medium text-gray-500 flex items-center gap-1">
                        Client ID:
                        {isCurrentUser && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full">
                            You
                          </span>
                        )}
                      </div>
                      <div>{client.id}</div>
                      
                      <div className="font-medium text-gray-500">IP Address:</div>
                      <div>{client.ipAddress}</div>
                      
                      <div className="font-medium text-gray-500">Connected At:</div>
                      <div>{formatDate(client.connectedAt.toString())}</div>
                      
                      <div className="font-medium text-gray-500">Duration:</div>
                      <div>{client.connectedFor}</div>
                      
                      <div className="font-medium text-gray-500">User Agent:</div>
                      <div className="truncate">{client.userAgent}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          <div className="flex justify-between items-center mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchClients}
              disabled={loading}
              className="gap-1"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            
            <Button 
              variant="default" 
              onClick={() => onClose()}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}