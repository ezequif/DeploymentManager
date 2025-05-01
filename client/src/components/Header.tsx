import { useState } from "react";
import { useWebSocket } from "../lib/websocket";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { SignalHigh, SignalLow, Users, Package, RefreshCw } from "lucide-react";
import ConnectedClientsModal from "./ConnectedClientsModal";

export default function Header() {
  const { connected, userCount, syncData, lastSync } = useWebSocket();
  const [showClientsModal, setShowClientsModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Function to handle manual sync with animation
  const handleSyncClick = () => {
    setIsSyncing(true);
    syncData();
    // Reset animation after 2 seconds
    setTimeout(() => setIsSyncing(false), 2000);
  };
  
  return (
    <header className="bg-primary text-white shadow-md">
      <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3 flex justify-between items-center">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <Package className="h-6 w-6 sm:h-7 sm:w-7" />
          <h1 className="text-base sm:text-xl font-bold truncate">Warehouse Pallet System</h1>
        </div>
        <div className="flex items-center space-x-1 sm:space-x-3">
          {/* Sync Data Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-primary-foreground/20 px-2 h-8 sm:px-3"
                  onClick={handleSyncClick}
                  disabled={!connected}
                >
                  <RefreshCw 
                    className={`h-4 w-4 sm:h-5 sm:w-5 ${isSyncing ? 'animate-spin' : ''}`} 
                  />
                  <span className="text-xs sm:text-sm sr-only sm:not-sr-only sm:ml-1">Sync</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Refresh data from server</p>
                <p className="text-xs text-gray-400">
                  Last sync: {lastSync.toLocaleTimeString()}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {/* Show "View Connections" button when more than 1 user */}
          {userCount > 1 && (
            <Button 
              variant="secondary" 
              size="sm"
              className="bg-blue-600 text-white hover:bg-blue-700 text-xs sm:text-sm px-2 h-8 sm:px-3"
              onClick={() => setShowClientsModal(true)}
            >
              <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              <span className="hidden sm:inline">View</span> {userCount} <span className="hidden sm:inline">Connections</span>
            </Button>
          )}
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div 
                  className="flex items-center cursor-pointer" 
                  onClick={() => userCount > 1 && setShowClientsModal(true)}
                >
                  {connected ? (
                    <SignalHigh className="h-5 w-5 sm:h-6 sm:w-6 text-green-400" />
                  ) : (
                    <SignalLow className="h-5 w-5 sm:h-6 sm:w-6 text-red-400" />
                  )}
                  {userCount > 1 && (
                    <span className="ml-1 text-xs sm:text-sm font-medium bg-primary-foreground text-primary px-1 sm:px-1.5 py-0.5 rounded-full">
                      {userCount}
                    </span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{connected ? 'Connected to server' : 'Reconnecting...'}</p>
                {userCount > 1 && <p>{userCount} active connections</p>}
                {userCount > 1 && <p className="text-xs text-gray-400">Click to view details</p>}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Modal for connected clients */}
      {showClientsModal && (
        <ConnectedClientsModal 
          isOpen={showClientsModal} 
          onClose={() => setShowClientsModal(false)} 
        />
      )}
    </header>
  );
}
