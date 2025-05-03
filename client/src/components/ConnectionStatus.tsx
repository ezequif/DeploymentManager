import React, { useState, useEffect } from 'react';
import { useWebSocket } from '@/lib/websocket';
import { Wifi, WifiOff, RadioTower, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';

export function ConnectionStatus() {
  const { connected, lastSync, syncData, userCount } = useWebSocket();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showFullDetails, setShowFullDetails] = useState(false);
  
  // Track online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  const getStatusColor = () => {
    if (!isOnline) return 'bg-red-500'; // Device offline
    if (connected) return 'bg-green-500'; // Connected via WebSocket
    return 'bg-yellow-500'; // Online but WebSocket disconnected
  };
  
  const getIcon = () => {
    if (!isOnline) return <WifiOff className="h-4 w-4" />;
    if (connected) return <RadioTower className="h-4 w-4" />;
    return <Wifi className="h-4 w-4" />;
  };
  
  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (connected) return 'Connected';
    return 'Limited';
  };
  
  const getTooltipText = () => {
    if (!isOnline) return 'No internet connection. Data changes will be queued until reconnected.';
    if (connected) return `Connected with real-time updates. ${userCount} active user(s).`;
    return 'Limited connectivity. Using fallback mode.';
  };
  
  const syncTimeDistance = formatDistanceToNow(lastSync, { addSuffix: true });
  
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
      {showFullDetails && (
        <div className="mb-2 rounded-lg bg-background border p-3 shadow-lg">
          <div className="flex flex-col space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Status:</span> 
              <span className="font-medium">{getStatusText()}</span>
            </div>
            <div className="flex justify-between">
              <span>Last Update:</span> 
              <span className="font-medium">{syncTimeDistance}</span>
            </div>
            <div className="flex justify-between">
              <span>Connected Users:</span> 
              <span className="font-medium">{userCount}</span>
            </div>
            <Button size="sm" onClick={() => syncData()} className="mt-2">
              Force Sync
            </Button>
          </div>
        </div>
      )}
      
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-10 w-10 rounded-full p-0 shadow-md relative border-2"
              onClick={() => setShowFullDetails(!showFullDetails)}
            >
              <div className={`absolute top-0 right-0 h-3 w-3 rounded-full ${getStatusColor()}`} />
              {getIcon()}
              <span className="sr-only">Toggle connection details</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>{getTooltipText()}</p>
            <p className="text-xs">Last update: {syncTimeDistance}</p>
            <p className="text-xs">Click for more details</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}