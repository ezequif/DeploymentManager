import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import ScannerModal from "./ScannerModal";
import { printPalletLabel } from "@/lib/barcodeUtils";
import { formatDate, formatDateTime, formatQuantity, isExpired, isExpiringSoon } from "@/lib/formatUtils";
import { PalletWithLots, Lot, Pallet } from "@shared/schema";

interface ScanPalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ScanPalletModal({ isOpen, onClose }: ScanPalletModalProps) {
  const [palletId, setPalletId] = useState<string>("");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const { toast } = useToast();
  const [scanned, setScanned] = useState(false);

  // Define the extended type including FIFO check results
  type PalletWithFIFOCheck = PalletWithLots & {
    fifoCheck?: {
      hasOlderLots: boolean;
      olderLots: Array<{pallet: Pallet, lot: Lot}>;
    }
  };
  
  // Query for pallet data
  const { data: pallet, isLoading, error, refetch } = useQuery<PalletWithFIFOCheck>({
    queryKey: ["/api/pallets/by-id", palletId],
    queryFn: async () => {
      if (!palletId) return null;
      const response = await fetch(`/api/pallets/by-id/${encodeURIComponent(palletId)}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Pallet ${palletId} not found`);
        }
        throw new Error("Failed to fetch pallet data");
      }
      return response.json();
    },
    enabled: scanned && !!palletId,
    retry: false,
  });

  // Handle scanner results
  const handleScanResult = (result: string) => {
    setPalletId(result);
    setIsScannerOpen(false);
    setScanned(true);
  };

  // Handle manual search
  const handleSearch = () => {
    if (!palletId) {
      toast({
        title: "Error",
        description: "Please enter a pallet ID",
        variant: "destructive",
      });
      return;
    }
    setScanned(true);
  };

  // Reset form when closing
  const handleClose = () => {
    setPalletId("");
    setScanned(false);
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-3xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-primary">Scan Pallet</DialogTitle>
            <DialogDescription className="text-base">
              Scan a pallet tag or enter a pallet ID to view complete inventory information
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="mb-6">
              <div className="flex flex-col sm:flex-row sm:space-x-3 space-y-3 sm:space-y-0">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="material-icons text-gray-400">search</span>
                  </div>
                  <Input
                    value={palletId}
                    onChange={(e) => setPalletId(e.target.value)}
                    placeholder="Enter pallet ID (e.g., PAL00001)"
                    className="pl-10 pr-12 py-6 text-lg"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSearch();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(true)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-primary bg-primary-50 p-2 rounded-full hover:bg-primary-100"
                  >
                    <span className="material-icons">qr_code_scanner</span>
                  </button>
                </div>
                <Button 
                  onClick={handleSearch} 
                  className="bg-primary hover:bg-primary-dark text-white py-6 px-8"
                  size="lg"
                >
                  <span className="material-icons mr-2">search</span>
                  Find Pallet
                </Button>
              </div>
            </div>

            {scanned && (
              <div>
                {isLoading && (
                  <div className="flex justify-center items-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                    <div className="flex">
                      <span className="material-icons text-red-500 mr-2">error</span>
                      <p className="text-red-700">{(error as Error).message}</p>
                    </div>
                  </div>
                )}

                {pallet && (
                  <>
                    {/* FIFO Check Alert */}
                    {pallet.fifoCheck?.hasOlderLots && (
                      <Alert variant="destructive" className="mb-4 bg-amber-50 border-amber-200 text-amber-800">
                        <div className="flex items-start">
                          <span className="material-icons text-amber-500 mr-2 mt-0.5">warning</span>
                          <div>
                            <AlertTitle className="text-amber-800 font-bold">FIFO/FEFO Warning</AlertTitle>
                            <AlertDescription className="text-amber-700">
                              <p className="mb-2">Older lots of RM# {pallet.rmNumber} exist in other locations. Consider using those first:</p>
                              <ul className="list-disc ml-5 space-y-1">
                                {pallet.fifoCheck.olderLots.slice(0, 3).map((item, index) => (
                                  <li key={index}>
                                    <span className="font-semibold">{item.pallet.location}</span>: Lot {item.lot.lotNumber} - {formatQuantity(item.lot.quantity)} {item.lot.unit}
                                  </li>
                                ))}
                                {pallet.fifoCheck.olderLots.length > 3 && (
                                  <li className="text-amber-600">
                                    <span className="font-semibold">
                                      +{pallet.fifoCheck.olderLots.length - 3} more location(s)
                                    </span>
                                  </li>
                                )}
                              </ul>
                            </AlertDescription>
                          </div>
                        </div>
                      </Alert>
                    )}
                    
                    <div className="border border-gray-200 rounded-md overflow-hidden shadow-sm mb-4">
                      {/* Enhanced Pallet Header */}
                      <div className="bg-gradient-to-r from-primary-50 to-gray-50 p-4 border-b border-gray-200">
                        <div className="flex flex-wrap justify-between items-center">
                          <div className="flex items-center space-x-2 mb-2 sm:mb-0">
                            <span className="material-icons text-primary text-2xl">inventory_2</span>
                            <h3 className="font-bold text-xl text-primary">{pallet.palletId}</h3>
                            {pallet.status && (
                              <Badge className={
                                pallet.status === "active" ? "bg-primary-light" : 
                                pallet.status === "archived" ? "bg-amber-500 text-white" :
                                "bg-red-500 text-white"
                              }>
                                {pallet.status.charAt(0).toUpperCase() + pallet.status.slice(1)}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">
                            Created: {formatDateTime(pallet.createdAt)}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-y-2 mt-3">
                          <div className="text-sm text-gray-500">RM Number:</div>
                          <div className="text-sm font-medium text-gray-900">{pallet.rmNumber}</div>
                          <div className="text-sm text-gray-500">Location:</div>
                          <div className="text-sm font-medium text-gray-900">{pallet.location}</div>
                          <div className="text-sm text-gray-500">Total Lots:</div>
                          <div className="text-sm font-medium text-gray-900">{pallet.lots.length}</div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="mt-4 flex space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-primary border-primary hover:bg-primary-50"
                            onClick={() => printPalletLabel(pallet.palletId, pallet.rmNumber, pallet.location)}
                          >
                            <span className="material-icons text-sm mr-1">print</span>
                            Print Label
                          </Button>
                        </div>
                      </div>
                      
                      {/* Summary Stats */}
                      <div className="p-3 bg-gray-50 border-b border-gray-200">
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-white p-2 rounded border border-gray-200">
                            <div className="text-sm text-gray-500">Total Quantity</div>
                            <div className="font-bold text-primary">
                              {formatQuantity(pallet.lots.reduce((sum, lot) => sum + lot.quantity, 0))}
                            </div>
                          </div>
                          <div className="bg-white p-2 rounded border border-gray-200">
                            <div className="text-sm text-gray-500">Earliest Expiry</div>
                            <div className="font-bold text-gray-800">
                              {pallet.lots.length > 0 
                                ? formatDate(pallet.lots
                                    .filter(lot => lot.quantity > 0)
                                    .sort((a, b) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime())[0]?.expirationDate || new Date())
                                : "N/A"}
                            </div>
                          </div>
                          <div className="bg-white p-2 rounded border border-gray-200">
                            <div className="text-sm text-gray-500">Units</div>
                            <div className="font-bold text-gray-800">
                              {Array.from(new Set(pallet.lots.map(lot => lot.unit))).join(", ") || "N/A"}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Lots Section */}
                      <div className="p-4">
                        <Label className="text-sm font-semibold mb-2 block">
                          Lot Details
                        </Label>
                        
                        {pallet.lots.length === 0 ? (
                          <div className="text-center py-4 text-gray-500">
                            No lots available for this pallet
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {pallet.lots.map((lot) => {
                              const isExpiringSoonFlag = isExpiringSoon(lot.expirationDate);
                              const isExpiredFlag = isExpired(lot.expirationDate);
                              const isEmpty = lot.quantity <= 0;
                              
                              return (
                                <div 
                                  key={lot.id} 
                                  className={`p-3 rounded-md border ${
                                    isEmpty
                                      ? "border-gray-200 bg-gray-50 opacity-75"
                                      : isExpiredFlag 
                                        ? "border-red-200 bg-red-50" 
                                        : isExpiringSoonFlag 
                                          ? "border-yellow-200 bg-yellow-50" 
                                          : "border-gray-200 bg-white"
                                  }`}
                                >
                                  <div className="flex justify-between items-start">
                                    <div className="font-medium text-lg">{lot.lotNumber}</div>
                                    <div className="font-bold text-right text-lg">
                                      {formatQuantity(lot.quantity)} {lot.unit}
                                    </div>
                                  </div>
                                  
                                  <div className="flex justify-between items-center mt-1 text-sm">
                                    <div className="flex items-center">
                                      <span className="material-icons text-gray-500 text-sm mr-1">event</span>
                                      <div className={
                                        isExpiredFlag 
                                          ? "text-red-600" 
                                          : isExpiringSoonFlag 
                                            ? "text-yellow-600" 
                                            : "text-gray-600"
                                      }>
                                        Expires: {formatDate(lot.expirationDate)}
                                        {isExpiredFlag && (
                                          <span className="ml-1 text-red-600 font-semibold">(Expired)</span>
                                        )}
                                        {isExpiringSoonFlag && !isExpiredFlag && (
                                          <span className="ml-1 text-yellow-600 font-semibold">(Expiring Soon)</span>
                                        )}
                                        {isEmpty && (
                                          <span className="ml-1 text-gray-500 font-semibold">(Empty)</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {isScannerOpen && <ScannerModal onClose={() => setIsScannerOpen(false)} onScan={handleScanResult} />}
    </>
  );
}