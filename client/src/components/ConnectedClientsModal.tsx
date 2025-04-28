import React, { useState, useEffect } from 'react';
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
  const { connected, userCount } = useWebSocket();
  const [clients, setClients] = useState<ConnectedClient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClients = async () => {
      setLoading(true);
      try {
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
    };

    if (isOpen) {
      fetchClients();
    }
  }, [isOpen, toast]);

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
              {clients.map((client) => (
                <div key={client.id} className="p-4 border rounded-lg bg-gray-50">
                  <div className="grid grid-cols-2 gap-y-1 text-sm">
                    <div className="font-medium text-gray-500">Client ID:</div>
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
              ))}
            </div>
          )}
          
          <div className="flex justify-end mt-4">
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