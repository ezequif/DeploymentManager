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
  const [fefoOverride, setFefoOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
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
      
      // Prepare transaction notes with FEFO override information if needed
      let transactionNotes = notes;
      if (fifoCheck?.hasOlderLots && fefoOverride) {
        const fefoInfo = `[FEFO OVERRIDE] Reason: ${overrideReason}`;
        transactionNotes = notes ? `${fefoInfo} | ${notes}` : fefoInfo;
      }
      
      return apiRequest("PATCH", `/api/lots/${lot.id}`, {
        quantity: newQuantity,
        transaction: {
          lotId: lot.id,
          transactionType: "pick",
          quantity: numQuantity,
          destination,
          notes: transactionNotes
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
            {/* FIFO/FEFO Warning - Improved UI */}
            {!isLoading && fifoCheck?.hasOlderLots && (
              <div className="mb-6 rounded-lg overflow-hidden border-2 border-amber-500 shadow-lg">
                {/* Warning Header */}
                <div className="bg-gradient-to-r from-amber-500 to-red-500 p-3 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white mr-2 flex-shrink-0 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <h3 className="text-white font-bold text-lg">FEFO Alert: Older Inventory Available</h3>
                </div>
                
                {/* Warning Content */}
                <div className="bg-white p-3">
                  <p className="text-gray-800 mb-3">
                    {fifoCheck.olderLots[0]?.pallet.id === pallet.id 
                      ? "There are lots in this pallet with earlier expiration dates. Please use these first:" 
                      : `Older lots of RM# ${pallet.rmNumber} should be used first (First Expired, First Out):`
                    }
                  </p>
                  
                  <div className="grid gap-2">
                    {fifoCheck.olderLots.slice(0, 3).map((item, index) => (
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
                          {item.lot.unit === 'LBS' ? 
                            `${item.lot.quantity.toFixed(1)} LBS` : 
                            `${(item.lot.quantity * 2.2046226218).toFixed(1)} LBS`
                          }
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {fifoCheck.olderLots.length > 3 && (
                    <div className="text-center mt-2 text-sm text-amber-800 font-medium">
                      +{fifoCheck.olderLots.length - 3} more location(s) with earlier expiry dates
                    </div>
                  )}
                  
                  <div className="mt-3 text-sm bg-red-50 p-2 rounded border border-red-200">
                    <p className="font-medium text-red-700">FEFO Picking Blocked:</p>
                    <p className="text-red-600">
                      To maintain inventory quality and reduce waste, picking this lot is blocked. 
                      Please use older inventory first or provide an override reason below.
                    </p>
                  </div>
                </div>
              </div>
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
              
              {/* FEFO Override Section */}
              {!isLoading && fifoCheck?.hasOlderLots && (
                <div className="mt-4 p-3 border border-red-300 rounded-md bg-red-50">
                  <div className="flex items-center mb-2">
                    <input
                      type="checkbox"
                      id="fefoOverride"
                      checked={fefoOverride}
                      onChange={(e) => setFefoOverride(e.target.checked)}
                      className="h-4 w-4 text-red-600 border-red-300 rounded focus:ring-red-500"
                    />
                    <label htmlFor="fefoOverride" className="ml-2 block text-sm font-medium text-red-700">
                      Override FEFO Warning (Manager Approval Required)
                    </label>
                  </div>
                  
                  {fefoOverride && (
                    <div className="mt-2">
                      <Label htmlFor="overrideReason" className="block text-sm font-medium text-red-700 mb-1">
                        Reason for Override (Required)
                      </Label>
                      <Textarea
                        id="overrideReason"
                        rows={2}
                        placeholder="Enter reason for FEFO override (Example: Special order requirement, Quality issue with older lot, etc.)"
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        className="border-red-300 focus:border-red-500 focus:ring-red-500"
                      />
                    </div>
                  )}
                </div>
              )}
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
              disabled={
                pickMutation.isPending || 
                quantity === '' || 
                (typeof quantity === 'number' && (quantity <= 0 || quantity > lot.quantity)) ||
                // Disable button if FEFO warning is active and no override, or if override is checked but no reason
                (fifoCheck?.hasOlderLots && !fefoOverride) || 
                (fifoCheck?.hasOlderLots && fefoOverride && !overrideReason.trim())
              }
              className="w-full sm:w-auto bg-secondary hover:bg-secondary/90"
            >
              {pickMutation.isPending ? "Processing..." : (fifoCheck?.hasOlderLots && fefoOverride) ? "Override and Pick" : "Confirm Pick"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
