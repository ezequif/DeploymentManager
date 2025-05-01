import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { PalletWithLots, Lot, Pallet } from "@shared/schema";
import { formatDate, formatQuantity, formatWeightForDisplay } from "../lib/formatUtils";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUnitSettings } from "@/hooks/use-unit-settings";

interface PickModalProps {
  pallet: PalletWithLots;
  lot: Lot;
  onClose: () => void;
}

export default function PickModal({ pallet, lot, onClose }: PickModalProps) {
  // Initialize with default quantity (full lot quantity)
  const [quantity, setQuantity] = useState<number | ''>(lot.quantity);
  const [destination, setDestination] = useState("");
  const [notes, setNotes] = useState("");
  const [fifoCheck, setFifoCheck] = useState<{ hasOlderLots: boolean, olderLots: Array<{pallet: Pallet, lot: Lot}> } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { preferredUnit, autoConvert } = useUnitSettings();
  
  // Fetch FIFO check data when component mounts and filter based on expiration date
  useEffect(() => {
    const fetchFifoCheck = async () => {
      try {
        setIsLoading(true);
        
        // First, check for older lots within the same pallet
        const currentLotDate = new Date(lot.expirationDate);
        const samePalletOlderLots: Array<{pallet: Pallet, lot: Lot}> = [];
        
        // Check other lots in the same pallet
        pallet.lots.forEach(otherLot => {
          if (otherLot.id !== lot.id && otherLot.quantity > 0) {
            const otherLotDate = new Date(otherLot.expirationDate);
            if (otherLotDate < currentLotDate) {
              samePalletOlderLots.push({
                pallet: pallet,
                lot: otherLot
              });
            }
          }
        });
        
        // If we found older lots within same pallet, no need to check other pallets
        if (samePalletOlderLots.length > 0) {
          setFifoCheck({
            hasOlderLots: true,
            olderLots: samePalletOlderLots
          });
          setIsLoading(false);
          return;
        }
        
        // If no older lots in same pallet, check other pallets
        const response = await apiRequest("GET", `/api/pallets/older-lots/${pallet.rmNumber}?excludePalletId=${pallet.palletId}`);
        const data = await response.json();
        console.log("FIFO check data:", data);
        
        // Filter lots that expire before the current lot (FEFO - First Expired, First Out)
        if (data.olderLots && data.olderLots.length > 0) {
          // Filter only lots that expire before the current lot
          const earlierExpiringLots = data.olderLots.filter((item: {pallet: Pallet, lot: Lot}) => {
            const itemExpDate = new Date(item.lot.expirationDate);
            return itemExpDate < currentLotDate; // Only include lots that expire sooner
          });
          
          setFifoCheck({
            hasOlderLots: earlierExpiringLots.length > 0,
            olderLots: earlierExpiringLots
          });
        } else {
          setFifoCheck(data);
        }
      } catch (error) {
        console.error("Error checking for older lots:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchFifoCheck();
  }, [pallet.rmNumber, pallet.palletId, lot.expirationDate, pallet.lots]);
  
  const pickMutation = useMutation({
    mutationFn: async () => {
      // Convert empty string to 0 for validation
      const numQuantity = typeof quantity === 'string' ? 0 : quantity;
      
      if (numQuantity <= 0) {
        throw new Error("Quantity must be greater than 0");
      }
      
      if (numQuantity > lot.quantity) {
        throw new Error("Cannot pick more than available quantity");
      }
      
      // Update lot quantity
      const newQuantity = lot.quantity - numQuantity;
      
      return apiRequest("PATCH", `/api/lots/${lot.id}`, {
        quantity: newQuantity,
        transaction: {
          lotId: lot.id,
          transactionType: "pick",
          quantity: numQuantity,
          destination,
          notes
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pallets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      const numQuantity = typeof quantity === 'string' ? 0 : quantity;
      const displayQuantity = numQuantity.toFixed(1);
      toast({
        title: "Lot picked",
        description: `Successfully picked ${displayQuantity} LBS from lot ${lot.lotNumber}`
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error picking lot",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Pick From Lot</DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          <div className="mb-4">
            {/* FIFO Check Alert */}
            {!isLoading && fifoCheck?.hasOlderLots && (
              <Alert variant="destructive" className="mb-4 border-2 border-red-500 fifo-warning text-red-800 shadow-lg">
                <div className="flex items-start">
                  <span className="material-icons text-red-600 mr-2 mt-0.5 text-2xl animate-pulse">warning</span>
                  <div>
                    <AlertTitle className="text-red-800 font-extrabold text-xl">⚠️ FIFO/FEFO WARNING ⚠️</AlertTitle>
                    <AlertDescription className="text-red-700 font-semibold">
                      <p className="mb-2 text-base">
                        {fifoCheck.olderLots[0]?.pallet.id === pallet.id 
                          ? "There are other lots in this pallet" 
                          : "Lots of RM# " + pallet.rmNumber
                        } with earlier expiration dates exist. Follow FEFO (First Expired, First Out):
                      </p>
                      <ul className="list-disc ml-5 space-y-1">
                        {fifoCheck.olderLots.slice(0, 3).map((item, index) => (
                          <li key={index} className="font-bold">
                            <span className="font-extrabold">{item.pallet.location}</span>: Lot {item.lot.lotNumber} - {
                              item.lot.unit === 'LBS' ? 
                                `${item.lot.quantity.toFixed(1)} LBS` : 
                                `${(item.lot.quantity * 2.2046226218).toFixed(1)} LBS`
                            }
                          </li>
                        ))}
                        {fifoCheck.olderLots.length > 3 && (
                          <li className="text-red-600">
                            <span className="font-extrabold">
                              +{fifoCheck.olderLots.length - 3} more location(s)
                            </span>
                          </li>
                        )}
                      </ul>
                    </AlertDescription>
                  </div>
                </div>
              </Alert>
            )}
            
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
              <div className="grid grid-cols-2 gap-y-2">
                <div className="text-sm text-gray-500">Pallet ID:</div>
                <div className="text-sm font-medium text-gray-900">{pallet.palletId}</div>
                <div className="text-sm text-gray-500">RM Number:</div>
                <div className="text-sm font-medium text-gray-900">{pallet.rmNumber}</div>
                <div className="text-sm text-gray-500">Lot Number:</div>
                <div className="text-sm font-medium text-gray-900">{lot.lotNumber}</div>
                <div className="text-sm text-gray-500">Available:</div>
                <div className="text-sm font-medium text-gray-900">
                  {lot.unit === 'LBS' ? 
                    `${lot.quantity.toFixed(1)} LBS` : 
                    `${(lot.quantity * 2.2046226218).toFixed(1)} LBS`}
                </div>
                <div className="text-sm text-gray-500">Expiration:</div>
                <div className="text-sm font-medium text-gray-900">{formatDate(lot.expirationDate)}</div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="pickQuantity" className="block text-sm font-medium text-gray-700 mb-1">Pick Quantity</Label>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center flex-1">
                    <Input
                      id="pickQuantity"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      min="0.1"
                      max={lot.quantity.toString()}
                      value={quantity || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setQuantity(val === '' ? '' : parseFloat(val));
                      }}
                      className="flex-1"
                    />
                    <span className="ml-2 text-gray-700 font-medium">
                      LBS
                    </span>
                  </div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setQuantity(lot.quantity)}
                    className="whitespace-nowrap"
                  >
                    Pick All
                  </Button>
                </div>
              </div>
              
              <div>
                <Label htmlFor="destination" className="block text-sm font-medium text-gray-700 mb-1">Destination</Label>
                <Input
                  id="destination"
                  placeholder="Enter destination"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="pickNotes" className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</Label>
                <Textarea
                  id="pickNotes"
                  rows={2}
                  placeholder="Add notes here..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => pickMutation.mutate()}
              disabled={pickMutation.isPending || quantity === '' || (typeof quantity === 'number' && (quantity <= 0 || quantity > lot.quantity))}
              className="w-full sm:w-auto bg-secondary hover:bg-secondary/90"
            >
              {pickMutation.isPending ? "Processing..." : "Confirm Pick"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
