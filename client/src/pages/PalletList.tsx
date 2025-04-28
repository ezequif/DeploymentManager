import { useState, useEffect, useMemo } from "react";
import { useWebSocket } from "../lib/websocket";
import PalletCard from "../components/PalletCard";
import NewPalletModal from "../components/NewPalletModal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { PalletWithLots } from "@shared/schema";

// Define the status types locally since there are import issues
type PalletStatus = "active" | "archived" | "damaged";
import { z } from "zod";

import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuRadioGroup, 
  DropdownMenuRadioItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  FilterIcon, 
  CheckIcon, 
  QrCode, 
  Search, 
  Plus, 
  WifiOff, 
  Package
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Add type assertion to handle the TypeScript error with status property
type PalletWithStatus = PalletWithLots & { status: PalletStatus };

export default function PalletList() {
  const { connected } = useWebSocket();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<PalletStatus | "all">("all");
  const [isNewPalletModalOpen, setIsNewPalletModalOpen] = useState(false);
  const { toast } = useToast();
  
  // Use React Query to fetch pallets
  const { data: apiPallets = [], isLoading } = useQuery<PalletWithStatus[]>({
    queryKey: ['/api/pallets'],
  });
  
  // Also use WebSocket pallets as a backup/realtime source
  const { pallets: wsOriginalPallets } = useWebSocket();
  
  // Cast the websocket pallets to include status property
  const wsPallets = wsOriginalPallets as PalletWithStatus[];
  
  // Function to open scan pallet modal
  const openScanPalletModal = () => {
    if (window.openScanPalletModal) {
      window.openScanPalletModal();
    }
  };
  
  // Combine both sources, preferring API pallets but using WebSocket as backup
  // Use useMemo instead of state to avoid infinite update loops
  const pallets = useMemo(() => {
    if (apiPallets.length > 0) {
      console.log("Using API pallets:", apiPallets);
      return apiPallets;
    } else if (wsPallets.length > 0) {
      console.log("Using WebSocket pallets:", wsPallets);
      return wsPallets;
    } else {
      console.log("No pallets available");
      return [];
    }
  }, [apiPallets, wsPallets]);
  
  // Cast pallets to the type with status property
  const typedPallets = pallets as PalletWithStatus[];
  
  // Filter pallets based on search term and status
  const filteredPallets = typedPallets.filter(pallet => {
    // Apply search term filter
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (
      pallet.palletId.toLowerCase().includes(searchLower) ||
      pallet.rmNumber.toLowerCase().includes(searchLower) ||
      pallet.location.toLowerCase().includes(searchLower) ||
      pallet.lots.some(lot => lot.lotNumber.toLowerCase().includes(searchLower))
    );
    
    // Apply status filter
    const matchesStatus = statusFilter === "all" || pallet.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });
  
  return (
    <>
      {/* Prominent Scan Pallet Button - Always at the top */}
      <div className="bg-primary bg-gradient-to-r from-primary to-primary-dark px-4 py-4 text-white">
        <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between">
          <div className="mb-4 sm:mb-0">
            <h1 className="text-xl font-bold">Warehouse Inventory</h1>
            <p className="text-primary-50">Scan a pallet to view complete lot information</p>
          </div>
          <Button 
            className="w-full sm:w-auto bg-white hover:bg-gray-100 text-primary flex items-center justify-center gap-2 py-6 px-6 text-lg font-semibold border-2 border-white shadow-lg"
            size="lg"
            variant="outline"
            onClick={openScanPalletModal}
          >
            <QrCode className="h-6 w-6" />
            SCAN PALLET
          </Button>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-white px-4 py-3 flex flex-col justify-between items-center space-y-3 shadow-sm">
        {/* Status Tabs - Full Width on Mobile */}
        <div className="w-full overflow-x-auto pb-2">
          <div className="flex rounded-md overflow-hidden border border-gray-200 min-w-max mx-auto">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-4 py-2 text-sm font-medium ${
                statusFilter === "all"
                  ? "bg-primary text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              All
              <Badge className="ml-2 bg-gray-200 text-gray-800">
                {pallets.length}
              </Badge>
            </button>
            <button
              onClick={() => setStatusFilter("active")}
              className={`px-4 py-2 text-sm font-medium ${
                statusFilter === "active"
                  ? "bg-primary text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Active
              <Badge className="ml-2 bg-primary-light">
                {typedPallets.filter(p => p.status === "active").length}
              </Badge>
            </button>
            <button
              onClick={() => setStatusFilter("archived")}
              className={`px-4 py-2 text-sm font-medium ${
                statusFilter === "archived"
                  ? "bg-amber-500 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Archived
              <Badge className="ml-2 bg-amber-500 text-white">
                {typedPallets.filter(p => p.status === "archived").length}
              </Badge>
            </button>
            <button
              onClick={() => setStatusFilter("damaged")}
              className={`px-4 py-2 text-sm font-medium ${
                statusFilter === "damaged"
                  ? "bg-red-500 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Damaged
              <Badge className="ml-2 bg-red-500 text-white">
                {typedPallets.filter(p => p.status === "damaged").length}
              </Badge>
            </button>
          </div>
        </div>
        
        {/* Search and Actions - Row on larger screens */}
        <div className="w-full flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0">
          <div className="w-full sm:max-w-md">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-5 w-5 text-gray-400" />
              </span>
              <Input
                type="text"
                placeholder="Search pallets, RM#, location..."
                className="w-full pl-10 pr-4 py-2"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Button 
              className="bg-primary hover:bg-primary-dark text-white flex items-center w-full sm:w-auto"
              onClick={() => setIsNewPalletModalOpen(true)}
            >
              <Plus className="h-5 w-5 mr-1" />
              New Pallet
            </Button>
          </div>
        </div>
      </div>

      {/* Pallet Listing */}
      <div className="mt-6 space-y-6">
        {!connected && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
            <div className="flex items-center">
              <WifiOff className="h-5 w-5 mr-2" />
              <span className="font-medium">Disconnected from server</span>
            </div>
            <p className="mt-1 text-sm">
              You are currently offline. Changes will not be saved until connection is restored.
            </p>
          </div>
        )}

        {isLoading && (
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-12 text-center">
            <div className="animate-pulse">
              <div className="h-12 bg-gray-200 rounded mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2 mx-auto mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-1/4 mx-auto"></div>
            </div>
            <p className="mt-4 text-gray-500">Loading pallets...</p>
          </div>
        )}
        
        {!isLoading && filteredPallets.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-12 text-center">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-800 mb-1">No pallets found</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm 
                ? `No pallets matching "${searchTerm}" were found.`
                : statusFilter !== "all"
                  ? `No ${statusFilter} pallets found. Try a different filter.`
                  : "You haven't created any pallets yet."}
            </p>
            {!searchTerm && statusFilter === "all" && (
              <Button 
                onClick={() => setIsNewPalletModalOpen(true)}
                className="inline-flex items-center"
              >
                <Plus className="h-5 w-5 mr-1" />
                Create First Pallet
              </Button>
            )}
          </div>
        ) : (
          !isLoading && filteredPallets.map(pallet => (
            <PalletCard key={pallet.id} pallet={pallet} />
          ))
        )}
      </div>
      
      {/* New Pallet Modal */}
      <NewPalletModal 
        isOpen={isNewPalletModalOpen} 
        onClose={() => setIsNewPalletModalOpen(false)}
      />
    </>
  );
}
