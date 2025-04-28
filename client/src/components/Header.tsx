import { useState } from "react";
import { useWebSocket } from "../lib/websocket";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { SignalHigh, SignalLow, Users } from "lucide-react";
import ConnectedClientsModal from "./ConnectedClientsModal";

export default function Header() {
  const { connected, userCount } = useWebSocket();
  const [showClientsModal, setShowClientsModal] = useState(false);
  
  return (
    <header className="bg-primary text-white shadow-md">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <span className="material-icons text-3xl">inventory</span>
          <h1 className="text-xl font-bold">Warehouse Pallet System</h1>
        </div>
        <div className="flex items-center space-x-3">
          {/* Show "View Connections" button when more than 1 user */}
          {userCount > 1 && (
            <Button 
              variant="secondary" 
              size="sm"
              className="bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => setShowClientsModal(true)}
            >
              <Users className="h-4 w-4 mr-1" />
              <span>View {userCount} Connections</span>
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
                    <SignalHigh className="h-6 w-6 text-green-400" />
                  ) : (
                    <SignalLow className="h-6 w-6 text-red-400" />
                  )}
                  {userCount > 1 && (
                    <span className="ml-1 text-sm font-medium bg-primary-foreground text-primary px-1.5 py-0.5 rounded-full">
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
