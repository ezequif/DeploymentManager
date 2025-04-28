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
import { useToast } from "@/hooks/use-toast";
import ScannerModal from "./ScannerModal";
import { formatDate, formatDateTime, formatQuantity, isExpired, isExpiringSoon } from "@/lib/formatUtils";
import { PalletWithLots } from "@shared/schema";

interface ScanPalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ScanPalletModal({ isOpen, onClose }: ScanPalletModalProps) {
  const [palletId, setPalletId] = useState<string>("");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const { toast } = useToast();
  const [scanned, setScanned] = useState(false);

  // Query for pallet data
  const { data: pallet, isLoading, error, refetch } = useQuery<PalletWithLots>({
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
        <DialogContent className="sm:max-w-lg max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Scan Pallet</DialogTitle>
            <DialogDescription>
              Scan a pallet tag or enter a pallet ID to view its information
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="mb-4">
              <div className="flex space-x-2">
                <div className="relative flex-1">
                  <Input
                    value={palletId}
                    onChange={(e) => setPalletId(e.target.value)}
                    placeholder="Enter pallet ID (e.g., PAL00001)"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(true)}
                    className="absolute right-2 top-2 text-gray-500"
                  >
                    <span className="material-icons">qr_code_scanner</span>
                  </button>
                </div>
                <Button onClick={handleSearch}>Search</Button>
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
                  <div className="border border-gray-200 rounded-md overflow-hidden">
                    {/* Pallet Header */}
                    <div className="bg-gray-50 p-4 border-b border-gray-200">
                      <div className="flex flex-wrap justify-between items-center">
                        <div className="flex items-center space-x-2 mb-2 sm:mb-0">
                          <span className="material-icons text-primary">inventory_2</span>
                          <h3 className="font-bold text-lg text-primary">{pallet.palletId}</h3>
                          <Badge className="bg-primary-light">Active</Badge>
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
                      </div>
                    </div>
                    
                    {/* Lots Section */}
                    <div className="p-4">
                      <Label className="text-sm font-semibold mb-2 block">
                        Lots ({pallet.lots.length})
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
                            
                            return (
                              <div 
                                key={lot.id} 
                                className={`p-3 rounded-md border ${
                                  isExpiredFlag 
                                    ? "border-red-200 bg-red-50" 
                                    : isExpiringSoonFlag 
                                      ? "border-yellow-200 bg-yellow-50" 
                                      : "border-gray-200"
                                }`}
                              >
                                <div className="flex justify-between items-start">
                                  <div className="font-medium">{lot.lotNumber}</div>
                                  <div className="font-bold text-right">
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