import { useWebSocket } from '@/lib/websocket';
import { cn } from '@/lib/utils';
import { Wifi, WifiOff, Clock, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

export function ConnectionStatus() {
  const { connected, connectionStatus, lastSync, pendingOperations } = useWebSocket();
  const [visible, setVisible] = useState(false);
  const [lastSyncFormatted, setLastSyncFormatted] = useState('');
  
  // Format the last sync time in a human-readable format (e.g., "2 minutes ago")
  useEffect(() => {
    const updateLastSyncTime = () => {
      try {
        setLastSyncFormatted(formatDistanceToNow(lastSync, { addSuffix: true }));
      } catch (e) {
        setLastSyncFormatted('unknown');
      }
    };
    
    // Update immediately
    updateLastSyncTime();
    
    // Set up interval to update the time display every minute
    const interval = setInterval(updateLastSyncTime, 60000);
    
    return () => clearInterval(interval);
  }, [lastSync]);
  
  // Show the status indicator when there are pending operations
  // or when we're not fully connected
  useEffect(() => {
    if (pendingOperations.length > 0 || connectionStatus !== 'online') {
      setVisible(true);
    } else {
      // Hide after a delay when we're back online and no pending operations
      const timer = setTimeout(() => {
        setVisible(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [connectionStatus, pendingOperations.length]);
  
  // Don't render anything if hidden (but keep the component mounted)
  if (!visible && connectionStatus === 'online') {
    return null;
  }
  
  return (
    <div 
      className={cn(
        "fixed bottom-16 right-4 z-50 p-2 rounded-full shadow-lg transition-all duration-300",
        // Colors based on connection status
        connectionStatus === 'online' ? 'bg-green-100 text-green-800 border border-green-300' :
        connectionStatus === 'limited' ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' :
        'bg-red-100 text-red-800 border border-red-300'
      )}
    >
      <div className="relative group">
        {/* Status icon */}
        {connectionStatus === 'online' ? (
          <Wifi className="h-6 w-6" />
        ) : connectionStatus === 'limited' ? (
          <AlertCircle className="h-6 w-6" />
        ) : (
          <WifiOff className="h-6 w-6" />
        )}
        
        {/* Tooltip with detailed status */}
        <div className="invisible group-hover:visible absolute bottom-full right-0 mb-2 w-64 p-3 bg-white rounded-lg shadow-lg border border-gray-200 text-sm z-50">
          <div className="font-medium mb-1">
            {connectionStatus === 'online' 
              ? 'Connected' 
              : connectionStatus === 'limited'
                ? 'Limited Connection'
                : 'Offline Mode'}
          </div>
          
          <div className="flex items-center mb-1 text-gray-600">
            <Clock className="h-4 w-4 mr-1 inline" />
            <span>Last sync: {lastSyncFormatted}</span>
          </div>
          
          {pendingOperations.length > 0 && (
            <div className="text-amber-700 mt-1">
              {pendingOperations.length} operation{pendingOperations.length !== 1 ? 's' : ''} pending sync
            </div>
          )}
          
          <div className="mt-2 text-xs text-gray-500">
            {connectionStatus === 'online' 
              ? 'All changes are saved and synced in real-time.'
              : connectionStatus === 'limited'
                ? 'Connected to server but real-time updates are disabled. Changes are still saved.'
                : 'Working offline. Changes will be synced when connection is restored.'}
          </div>
        </div>
      </div>
    </div>
  );
}