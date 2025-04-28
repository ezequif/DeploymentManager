import { PalletWithLots, Lot } from "@shared/schema";
import { useState } from "react";
import { formatDate, formatDateTime, formatQuantity, isExpiringSoon, isExpired } from "../lib/formatUtils";
import { printPalletLabel } from "../lib/barcodeUtils";
import { apiRequest } from "../lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import PickModal from "./PickModal";

interface PalletCardProps {
  pallet: PalletWithLots;
}

export default function PalletCard({ pallet }: PalletCardProps) {
  const [isEditingPallet, setIsEditingPallet] = useState(false);
  const [rmNumber, setRmNumber] = useState(pallet.rmNumber);
  const [location, setLocation] = useState(pallet.location);
  const [pickModal, setPickModal] = useState<{ isOpen: boolean; lot: Lot | null }>({
    isOpen: false,
    lot: null
  });
  const { toast } = useToast();
  
  // Sort lots by expiration date (ascending)
  const sortedLots = [...pallet.lots].sort((a, b) => {
    const dateA = new Date(a.expirationDate);
    const dateB = new Date(b.expirationDate);
    return dateA.getTime() - dateB.getTime();
  });
  
  // Update pallet mutation
  const updatePallet = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/pallets/${pallet.id}`, {
        rmNumber,
        location
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pallets'] });
      setIsEditingPallet(false);
      toast({
        title: "Pallet updated",
        description: `Pallet ${pallet.palletId} has been updated.`
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating pallet",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Add lot mutation
  const addLot = useMutation({
    mutationFn: async (newLot: { lotNumber: string; quantity: number; unit: string; expirationDate: string }) => {
      return apiRequest("POST", `/api/lots`, {
        palletId: pallet.id,
        ...newLot
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pallets'] });
      toast({
        title: "Lot added",
        description: `Lot has been added to pallet ${pallet.palletId}.`
      });
    },
    onError: (error) => {
      toast({
        title: "Error adding lot",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Handle print label
  const handlePrintLabel = () => {
    printPalletLabel(pallet.palletId, pallet.rmNumber, pallet.location);
  };
  
  // Handle pick lot
  const handlePickLot = (lot: Lot) => {
    setPickModal({
      isOpen: true,
      lot
    });
  };
  
  return (
    <>
      <div className="pallet-card bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Pallet Header */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row sm:justify-between sm:items-center">
          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4">
            <div className="flex items-center space-x-2">
              <span className="material-icons text-primary">inventory_2</span>
              <h3 className="font-bold text-lg text-primary">{pallet.palletId}</h3>
              <span className="bg-primary-light text-white text-xs px-2 py-1 rounded-full">Active</span>
            </div>
            {isEditingPallet ? (
              <div className="mt-2 sm:mt-0 flex items-center space-x-4">
                <div className="flex items-center space-x-1">
                  <span className="material-icons text-gray-500 text-sm">category</span>
                  <input
                    type="text"
                    value={rmNumber}
                    onChange={(e) => setRmNumber(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm w-24"
                  />
                </div>
                <div className="flex items-center space-x-1">
                  <span className="material-icons text-gray-500 text-sm">place</span>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm w-24"
                  />
                </div>
              </div>
            ) : (
              <div className="mt-2 sm:mt-0 flex items-center space-x-4">
                <div className="flex items-center space-x-1">
                  <span className="material-icons text-gray-500 text-sm">category</span>
                  <span className="text-gray-800">{pallet.rmNumber}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="material-icons text-gray-500 text-sm">place</span>
                  <span className="text-gray-800">{pallet.location}</span>
                </div>
              </div>
            )}
          </div>
          <div className="mt-3 sm:mt-0 flex items-center space-x-2">
            <span className="text-sm text-gray-600">Created: {formatDateTime(pallet.createdAt)}</span>
            {isEditingPallet ? (
              <div className="flex space-x-1">
                <button 
                  className="p-1 text-gray-600 hover:text-success rounded-full hover:bg-gray-100"
                  onClick={() => updatePallet.mutate()}
                  disabled={updatePallet.isPending}
                >
                  <span className="material-icons">check</span>
                </button>
                <button 
                  className="p-1 text-gray-600 hover:text-destructive rounded-full hover:bg-gray-100"
                  onClick={() => {
                    setRmNumber(pallet.rmNumber);
                    setLocation(pallet.location);
                    setIsEditingPallet(false);
                  }}
                >
                  <span className="material-icons">close</span>
                </button>
              </div>
            ) : (
              <div className="flex space-x-1">
                <button 
                  className="p-1 text-gray-600 hover:text-primary rounded-full hover:bg-gray-100" 
                  title="Print Label"
                  onClick={handlePrintLabel}
                >
                  <span className="material-icons">print</span>
                </button>
                <button 
                  className="p-1 text-gray-600 hover:text-primary rounded-full hover:bg-gray-100" 
                  title="Edit Pallet"
                  onClick={() => setIsEditingPallet(true)}
                >
                  <span className="material-icons">edit</span>
                </button>
                <button 
                  className="p-1 text-gray-600 hover:text-warning rounded-full hover:bg-gray-100" 
                  title="Actions"
                >
                  <span className="material-icons">more_vert</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Lots Table */}
        <div className="px-4 pt-2 pb-3">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lot Number</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiration</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedLots.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-sm text-gray-500 text-center">
                      No lots added to this pallet. Add a lot below.
                    </td>
                  </tr>
                ) : (
                  sortedLots.map((lot) => {
                    const isExpiringSoonFlag = isExpiringSoon(lot.expirationDate);
                    const isExpiredFlag = isExpired(lot.expirationDate);
                    
                    return (
                      <tr 
                        key={lot.id} 
                        className={isExpiredFlag ? "bg-red-50" : isExpiringSoonFlag ? "expiring-soon" : ""}
                      >
                        <td className="px-3 py-3 text-sm text-gray-900">{lot.lotNumber}</td>
                        <td className="px-3 py-3 text-sm font-bold text-gray-900">{formatQuantity(lot.quantity)}</td>
                        <td className="px-3 py-3 text-sm text-gray-900">{lot.unit}</td>
                        <td className="px-3 py-3 text-sm text-gray-900">
                          <div className="flex items-center">
                            {isExpiredFlag && (
                              <span className="material-icons text-destructive mr-1 text-sm">error</span>
                            )}
                            {isExpiringSoonFlag && !isExpiredFlag && (
                              <span className="material-icons text-warning mr-1 text-sm">warning</span>
                            )}
                            <span className={
                              isExpiredFlag 
                                ? "text-destructive font-medium" 
                                : isExpiringSoonFlag 
                                  ? "text-warning font-medium" 
                                  : ""
                            }>
                              {formatDate(lot.expirationDate)}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-900 text-right">
                          <button 
                            className="bg-secondary text-white py-1 px-3 rounded text-sm font-medium mr-2"
                            onClick={() => handlePickLot(lot)}
                          >
                            Pick
                          </button>
                          <button className="bg-white border border-gray-300 text-gray-700 py-1 px-3 rounded text-sm font-medium">
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex justify-end">
            <button 
              className="text-primary font-medium flex items-center text-sm hover:bg-gray-50 px-3 py-1 rounded"
              onClick={() => {
                // Sample implementation to add a lot
                // In a real app, this would open a modal
                const today = new Date();
                const futureDate = new Date();
                futureDate.setMonth(today.getMonth() + 6);
                
                const formattedDate = futureDate.toISOString().split('T')[0];
                
                addLot.mutate({
                  lotNumber: `L${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
                  quantity: 100,
                  unit: 'KGS',
                  expirationDate: formattedDate
                });
              }}
            >
              <span className="material-icons text-sm mr-1">add</span>
              Add Lot
            </button>
          </div>
        </div>
      </div>

      {pickModal.isOpen && pickModal.lot && (
        <PickModal 
          pallet={pallet} 
          lot={pickModal.lot} 
          onClose={() => setPickModal({ isOpen: false, lot: null })} 
        />
      )}
    </>
  );
}
