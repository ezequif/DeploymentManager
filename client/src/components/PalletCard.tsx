import { PalletWithLots, Lot } from "@shared/schema";
import { useState, useEffect } from "react";
import { formatDate, formatDateTime, formatQuantity, isExpiringSoon, isExpired } from "../lib/formatUtils";
import { printPalletLabel } from "../lib/barcodeUtils";
import { apiRequest } from "../lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import PickModal from "./PickModal";
import AddLotModal from "./AddLotModal";
import { 
  PrinterIcon, EditIcon, MoreVerticalIcon, CheckIcon, XIcon,
  PackageIcon, MapPinIcon, AlertTriangleIcon, AlertCircleIcon, PlusIcon,
  ArchiveIcon
} from "lucide-react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  
  const [isAddLotModalOpen, setIsAddLotModalOpen] = useState(false);
  const [editingLot, setEditingLot] = useState<Lot | null>(null);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
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
  
  // Archive pallet mutation
  const archivePallet = useMutation({
    mutationFn: async (notes?: string) => {
      return apiRequest("POST", `/api/pallets/${pallet.id}/archive`, {
        notes: notes || `Pallet ${pallet.palletId} archived - empty pallet`
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pallets'] });
      toast({
        title: "Pallet archived",
        description: `Pallet ${pallet.palletId} has been archived.`
      });
    },
    onError: (error) => {
      toast({
        title: "Error archiving pallet",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Handle archive pallet
  const handleArchivePallet = () => {
    setIsArchiveDialogOpen(true);
  };
  
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
  
  // Detect if we're likely on a TC70 or similar device
  const [isTC70Device, setIsTC70Device] = useState(false);
  
  useEffect(() => {
    // Check if this might be a TC70/TC75 device (based on user agent or screen size)
    const userAgent = navigator.userAgent;
    const isLikelyDatawedgeDevice = 
      userAgent.includes("Android") && 
      (userAgent.includes("TC") || 
      userAgent.includes("MC") || 
      userAgent.includes("ET"));
    
    // Also consider screen dimensions as a TC70 heuristic
    const hasTC70Dimensions = 
      window.screen.width <= 800 && 
      window.screen.height <= 800 &&
      window.screen.width >= 400;
    
    setIsTC70Device(isLikelyDatawedgeDevice || hasTC70Dimensions);
  }, []);

  return (
    <>
      <div className="pallet-card bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Pallet Header */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row sm:justify-between sm:items-center">
          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4">
            <div className="flex items-center space-x-2">
              <PackageIcon className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-lg text-primary">{pallet.palletId}</h3>
              <span className="bg-primary-light text-white text-xs px-2 py-1 rounded-full">
                Active
              </span>
            </div>
            {isEditingPallet ? (
              <div className="mt-2 sm:mt-0 flex items-center space-x-4">
                <div className="flex items-center space-x-1">
                  <PackageIcon className="h-4 w-4 text-gray-500" />
                  <input
                    type="text"
                    value={rmNumber}
                    onChange={(e) => setRmNumber(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm w-24"
                  />
                </div>
                <div className="flex items-center space-x-1">
                  <MapPinIcon className="h-4 w-4 text-gray-500" />
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
                  <PackageIcon className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-800">{pallet.rmNumber}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <MapPinIcon className="h-4 w-4 text-gray-500" />
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
                  className="p-2 text-gray-600 hover:text-success rounded-full hover:bg-gray-100"
                  onClick={() => updatePallet.mutate()}
                  disabled={updatePallet.isPending}
                >
                  <CheckIcon className="h-5 w-5" />
                </button>
                <button 
                  className="p-2 text-gray-600 hover:text-destructive rounded-full hover:bg-gray-100"
                  onClick={() => {
                    setRmNumber(pallet.rmNumber);
                    setLocation(pallet.location);
                    setIsEditingPallet(false);
                  }}
                >
                  <XIcon className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="flex space-x-1">
                <button 
                  className="p-2 text-gray-600 hover:text-primary rounded-full hover:bg-gray-100" 
                  title="Print Label"
                  onClick={handlePrintLabel}
                >
                  <PrinterIcon className="h-5 w-5" />
                </button>
                <button 
                  className="p-2 text-gray-600 hover:text-primary rounded-full hover:bg-gray-100" 
                  title="Edit Pallet"
                  onClick={() => setIsEditingPallet(true)}
                >
                  <EditIcon className="h-5 w-5" />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button 
                      className="p-2 text-gray-600 hover:text-warning rounded-full hover:bg-gray-100" 
                      title="Actions"
                    >
                      <MoreVerticalIcon className="h-5 w-5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem 
                      className="cursor-pointer flex items-center"
                      onClick={handlePrintLabel}
                    >
                      <PrinterIcon className="h-4 w-4 mr-2" />
                      Print Label
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="cursor-pointer flex items-center text-amber-600"
                      onClick={() => handleArchivePallet()}
                    >
                      <ArchiveIcon className="h-4 w-4 mr-2" />
                      Archive Pallet
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>

        {/* Lots Table - Use a different UI for TC70 devices */}
        {isTC70Device ? (
          // TC70 optimized lot list - card-based for touch
          <div className="p-4 space-y-4">
            {sortedLots.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-lg border border-gray-200">
                <PackageIcon className="h-10 w-10 mx-auto text-gray-400 mb-2" />
                <p className="text-gray-500">No lots added to this pallet.</p>
                <button
                  className="mt-4 bg-primary text-white py-3 px-6 rounded-lg text-base font-medium inline-flex items-center"
                  onClick={() => {
                    setEditingLot(null);
                    setIsAddLotModalOpen(true);
                  }}
                >
                  <PlusIcon className="h-5 w-5 mr-2" />
                  Add First Lot
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-700">Lots ({sortedLots.length})</h3>
                  <button
                    className="bg-primary text-white py-2 px-4 rounded-lg text-sm font-medium inline-flex items-center"
                    onClick={() => {
                      setEditingLot(null);
                      setIsAddLotModalOpen(true);
                    }}
                  >
                    <PlusIcon className="h-4 w-4 mr-1" />
                    Add Lot
                  </button>
                </div>
                
                {sortedLots.map((lot) => {
                  const isExpiringSoonFlag = isExpiringSoon(lot.expirationDate);
                  const isExpiredFlag = isExpired(lot.expirationDate);
                  
                  return (
                    <div
                      key={lot.id}
                      className={`p-4 rounded-lg border ${
                        isExpiredFlag
                          ? "bg-red-50 border-red-200"
                          : isExpiringSoonFlag
                          ? "bg-amber-50 border-amber-200"
                          : "bg-white border-gray-200"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-medium">{lot.lotNumber}</div>
                        <div className="text-lg font-bold">
                          {formatQuantity(lot.quantity)} {lot.unit}
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center">
                          {isExpiredFlag ? (
                            <AlertCircleIcon className="h-4 w-4 text-destructive mr-1" />
                          ) : isExpiringSoonFlag ? (
                            <AlertTriangleIcon className="h-4 w-4 text-warning mr-1" />
                          ) : null}
                          <span
                            className={
                              isExpiredFlag
                                ? "text-destructive"
                                : isExpiringSoonFlag
                                ? "text-warning"
                                : "text-gray-600"
                            }
                          >
                            Expires: {formatDate(lot.expirationDate)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex space-x-2">
                        <button
                          className="flex-1 bg-secondary text-white py-3 px-4 rounded-lg font-medium text-base"
                          onClick={() => handlePickLot(lot)}
                        >
                          Pick
                        </button>
                        <button
                          className="flex-1 bg-white border border-gray-300 text-gray-700 py-3 px-4 rounded-lg font-medium text-base"
                          onClick={() => {
                            setEditingLot(lot);
                            setIsAddLotModalOpen(true);
                          }}
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        ) : (
          // Regular browser/tablet view - traditional table
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
                                <AlertCircleIcon className="h-4 w-4 text-destructive mr-1" />
                              )}
                              {isExpiringSoonFlag && !isExpiredFlag && (
                                <AlertTriangleIcon className="h-4 w-4 text-warning mr-1" />
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
                            <button 
                              className="bg-white border border-gray-300 text-gray-700 py-1 px-3 rounded text-sm font-medium"
                              onClick={() => {
                                setEditingLot(lot);
                                setIsAddLotModalOpen(true);
                              }}
                            >
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
                  setEditingLot(null); // Clear any previous editing lot
                  setIsAddLotModalOpen(true);
                }}
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Add Lot
              </button>
            </div>
          </div>
        )}
      </div>

      {pickModal.isOpen && pickModal.lot && (
        <PickModal 
          pallet={pallet} 
          lot={pickModal.lot} 
          onClose={() => setPickModal({ isOpen: false, lot: null })} 
        />
      )}
      
      {isAddLotModalOpen && (
        <AddLotModal
          pallet={pallet}
          isOpen={isAddLotModalOpen}
          onClose={() => {
            setIsAddLotModalOpen(false);
            setEditingLot(null);
          }}
          existingLot={editingLot}
        />
      )}
      
      {/* Archive Confirmation Dialog */}
      <AlertDialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Pallet</AlertDialogTitle>
            <AlertDialogDescription>
              {sortedLots.length === 0 ? (
                <p>Are you sure you want to archive this empty pallet? This will move it to the archived status.</p>
              ) : (
                <p className="text-red-600">
                  This pallet still has inventory. You cannot archive a pallet until all lots have been picked.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {sortedLots.length === 0 && (
              <AlertDialogAction 
                onClick={() => archivePallet.mutate('')}
                disabled={archivePallet.isPending}
                className="bg-amber-500 hover:bg-amber-600"
              >
                {archivePallet.isPending ? 'Archiving...' : 'Archive Pallet'}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
