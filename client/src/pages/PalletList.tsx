import { useState } from "react";
import { useWebSocket } from "../lib/websocket";
import PalletCard from "../components/PalletCard";
import NewPalletModal from "../components/NewPalletModal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function PalletList() {
  const { pallets, connected } = useWebSocket();
  const [searchTerm, setSearchTerm] = useState("");
  const [isNewPalletModalOpen, setIsNewPalletModalOpen] = useState(false);
  const { toast } = useToast();
  
  // Filter pallets based on search term
  const filteredPallets = pallets.filter(pallet => {
    const searchLower = searchTerm.toLowerCase();
    return (
      pallet.palletId.toLowerCase().includes(searchLower) ||
      pallet.rmNumber.toLowerCase().includes(searchLower) ||
      pallet.location.toLowerCase().includes(searchLower) ||
      pallet.lots.some(lot => lot.lotNumber.toLowerCase().includes(searchLower))
    );
  });
  
  return (
    <>
      {/* Action Bar */}
      <div className="bg-white px-4 py-3 flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0 shadow-sm">
        <div className="w-full sm:max-w-md">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
              <span className="material-icons text-gray-400">search</span>
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
        <div className="flex space-x-3">
          <div className="relative">
            <Button
              variant="outline"
              className="flex items-center"
              onClick={() => toast({ title: "Filter", description: "Filter functionality would be implemented here" })}
            >
              <span className="material-icons mr-1">filter_list</span>
              Filter
            </Button>
          </div>
          <Button 
            className="bg-primary hover:bg-primary-dark text-white flex items-center"
            onClick={() => setIsNewPalletModalOpen(true)}
          >
            <span className="material-icons mr-1">add</span>
            New Pallet
          </Button>
        </div>
      </div>

      {/* Pallet Listing */}
      <div className="mt-6 space-y-6">
        {!connected && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
            <div className="flex items-center">
              <span className="material-icons mr-2">wifi_off</span>
              <span className="font-medium">Disconnected from server</span>
            </div>
            <p className="mt-1 text-sm">
              You are currently offline. Changes will not be saved until connection is restored.
            </p>
          </div>
        )}
        
        {filteredPallets.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-12 text-center">
            <span className="material-icons text-gray-400 text-5xl mb-3">inventory</span>
            <h3 className="text-lg font-medium text-gray-800 mb-1">No pallets found</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm ? 
                `No pallets matching "${searchTerm}" were found.` : 
                "You haven't created any pallets yet."}
            </p>
            {!searchTerm && (
              <Button 
                onClick={() => setIsNewPalletModalOpen(true)}
                className="inline-flex items-center"
              >
                <span className="material-icons mr-1">add</span>
                Create First Pallet
              </Button>
            )}
          </div>
        ) : (
          filteredPallets.map(pallet => (
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
