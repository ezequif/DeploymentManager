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
import PickModal from "./PickModal";
import { printPalletLabel } from "@/lib/barcodeUtils";
import { formatDate, formatDateTime, formatQuantity, isExpired, isExpiringSoon } from "@/lib/formatUtils";
import { PalletWithLots, Lot, Pallet } from "@shared/schema";
import { 
  Search, 
  QrCode, 
  AlertTriangle, 
  AlertCircle,
  Package2, 
  Printer, 
  Calendar, 
  ShoppingCart
} from "lucide-react";

interface ScanPalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ScanPalletModal({ isOpen, onClose }: ScanPalletModalProps) {
  const [palletId, setPalletId] = useState<string>("");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const { toast } = useToast();
  const [scanned, setScanned] = useState(false);
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);

  // Define the extended type including FIFO check results
  type PalletWithFIFOCheck = PalletWithLots & {
    status: string;
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
    // Disable caching to always show fresh data when scanning
    staleTime: 0,
    gcTime: 0,
  });

  // Handle scanner results
  const handleScanResult = (result: string) => {
    setPalletId(result);
    setIsScannerOpen(false);
    setScanned(true);
    // Force refetch to ensure latest data
    setTimeout(() => refetch(), 100);
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
    // Force refetch to ensure latest data
    setTimeout(() => refetch(), 100);
  };

  // Reset form when closing
  const handleClose = () => {
    setPalletId("");
    setScanned(false);
    onClose();
  };
  
  // Handle picking lots
  const handlePickLot = (lot: Lot) => {
    if (pallet) {
      setSelectedLot(lot);
    }
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
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    value={palletId}
                    onChange={(e) => setPalletId(e.target.value)}
                    placeholder="Enter pallet ID (e.g., PAL00001)"
                    className="pl-10 pr-12 py-6 text-lg"
                    inputMode="search"
                    autoCapitalize="characters"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                    onFocus={(e) => {
                      // On mobile, scroll input into view when keyboard opens
                      setTimeout(() => {
                        e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }, 300);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSearch();
                        // On mobile, blur the input to hide keyboard after search
                        e.currentTarget.blur();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(true)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-primary bg-primary-50 p-2 rounded-full hover:bg-primary-100"
                  >
                    <QrCode className="h-5 w-5" />
                  </button>
                </div>
                <Button 
                  onClick={handleSearch} 
                  className="bg-primary hover:bg-primary-dark text-white py-6 px-8"
                  size="lg"
                >
                  <Search className="h-5 w-5 mr-2" />
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
                      <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                      <p className="text-red-700">{(error as Error).message}</p>
                    </div>
                  </div>
                )}

                {pallet && (
                  <>
                    {/* FIFO Check Alert - Only show if this pallet's lots expire after other lots */}
                    {(() => {
                      // Check if there are FIFO lots to evaluate
                      if (pallet.fifoCheck?.hasOlderLots && pallet.lots.length > 0) {
                        // Find the earliest expiring lot in this pallet
                        const currentLot = pallet.lots.reduce((earliest, lot) => {
                          const currentDate = new Date(earliest.expirationDate);
                          const lotDate = new Date(lot.expirationDate);
                          return lotDate < currentDate ? lot : earliest;
                        }, pallet.lots[0]);
                        
                        const currentLotDate = new Date(currentLot.expirationDate);
                        
                        // Filter only lots that expire before the current lot (FEFO)
                        const earlierExpiringLots = pallet.fifoCheck.olderLots.filter((item: any) => {
                          const itemExpDate = new Date(item.lot.expirationDate);
                          return itemExpDate < currentLotDate; // Only show lots that expire sooner
                        });
                        
                        // Only show warning if there are lots with earlier expiration dates
                        if (earlierExpiringLots.length > 0) {
                          return (
                            <div className="mb-4 rounded-lg overflow-hidden border-2 border-amber-500 shadow-lg">
                              {/* Warning Header */}
                              <div className="bg-gradient-to-r from-amber-500 to-red-500 p-2 flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white mr-2 flex-shrink-0 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <h3 className="text-white font-bold text-lg">FEFO Alert: Older Inventory Available</h3>
                              </div>
                              
                              {/* Warning Content */}
                              <div className="bg-white p-3">
                                <p className="text-gray-800 mb-3">
                                  Older lots of RM# <span className="font-medium">{pallet.rmNumber}</span> should be used first (First Expired, First Out):
                                </p>
                                
                                <div className="grid gap-2">
                                  {earlierExpiringLots.slice(0, 3).map((item: any, index: number) => (
                                    <div key={index} className="bg-amber-50 p-2 rounded border border-amber-200 flex justify-between items-center">
                                      <div className="flex items-center">
                                        <div className="bg-amber-100 text-amber-800 font-bold px-2 py-1 rounded mr-2">
                                          {formatDate(item.lot.expirationDate)}
                                        </div>
                                        <div>
                                          <div className="font-medium">{item.pallet.location}</div>
                                          <div className="text-sm text-gray-600">Lot {item.lot.lotNumber}</div>
                                        </div>
                                      </div>
                                      <div className="text-right font-bold">
                                        {formatQuantity(item.lot.quantity)} {item.lot.unit}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                
                                {earlierExpiringLots.length > 3 && (
                                  <div className="text-center mt-2 text-sm text-amber-800 font-medium">
                                    +{earlierExpiringLots.length - 3} more location(s) with earlier expiry dates
                                  </div>
                                )}
                                
                                <div className="mt-3 text-sm bg-gray-50 p-2 rounded border border-gray-200">
                                  <p className="font-medium text-gray-700">Recommendation:</p>
                                  <p className="text-gray-600">
                                    To avoid waste, consume materials with the earliest expiration dates first.
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        }
                      }
                      return null; // If no earlier-expiring lots, don't show the warning
                    })()}
                    
                    <div className="border border-gray-200 rounded-md overflow-hidden shadow-sm mb-4">
                      {/* Enhanced Pallet Header */}
                      <div className="bg-gradient-to-r from-primary-50 to-gray-50 p-4 border-b border-gray-200">
                        <div className="flex flex-wrap justify-between items-center">
                          <div className="flex items-center space-x-2 mb-2 sm:mb-0">
                            <Package2 className="h-6 w-6 text-primary" />
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
                            <Printer className="h-4 w-4 mr-1" />
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
                                      <Calendar className="h-4 w-4 text-gray-500 mr-1" />
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
                                    
                                    {/* Add pick button for non-empty lots */}
                                    {!isEmpty && (
                                      <Button 
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => handlePickLot(lot)}
                                        className="ml-2"
                                      >
                                        <ShoppingCart className="h-3 w-3 mr-1" />
                                        Pick
                                      </Button>
                                    )}
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
      
      {/* Add PickModal for lot picking functionality */}
      {selectedLot && pallet && (
        <PickModal 
          pallet={pallet} 
          lot={selectedLot} 
          onClose={() => {
            setSelectedLot(null);
            refetch(); // Refresh data after picking
          }} 
        />
      )}
    </>
  );
}