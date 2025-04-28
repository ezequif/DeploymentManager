import { useWebSocket } from "../lib/websocket";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SignalHigh, SignalLow } from "lucide-react";

export default function Header() {
  const { connected, userCount } = useWebSocket();
  
  return (
    <header className="bg-primary text-white shadow-md">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <span className="material-icons text-3xl">inventory</span>
          <h1 className="text-xl font-bold">Warehouse Pallet System</h1>
        </div>
        <div className="flex items-center">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center cursor-help">
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
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </header>
  );
}
