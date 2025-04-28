import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { PalletWithLots, Lot, Pallet } from "@shared/schema";
import { formatDate, formatQuantity } from "../lib/formatUtils";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  
  // Fetch FIFO check data when component mounts
  useEffect(() => {
    const fetchFifoCheck = async () => {
      try {
        setIsLoading(true);
        // Check if there are older lots with the same RM number for FIFO checking
        const response = await apiRequest("GET", `/api/fifo-check/${pallet.rmNumber}?excludePalletId=${pallet.palletId}`);
        const data = await response.json();
        setFifoCheck(data);
      } catch (error) {
        console.error("Error checking for older lots:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchFifoCheck();
  }, [pallet.rmNumber, pallet.palletId]);
  
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
      toast({
        title: "Lot picked",
        description: `Successfully picked ${numQuantity} ${lot.unit} from lot ${lot.lotNumber}`
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
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
              <div className="grid grid-cols-2 gap-y-2">
                <div className="text-sm text-gray-500">Pallet ID:</div>
                <div className="text-sm font-medium text-gray-900">{pallet.palletId}</div>
                <div className="text-sm text-gray-500">RM Number:</div>
                <div className="text-sm font-medium text-gray-900">{pallet.rmNumber}</div>
                <div className="text-sm text-gray-500">Lot Number:</div>
                <div className="text-sm font-medium text-gray-900">{lot.lotNumber}</div>
                <div className="text-sm text-gray-500">Available:</div>
                <div className="text-sm font-medium text-gray-900">{lot.quantity} {lot.unit}</div>
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
                    <span className="ml-2 text-gray-700 font-medium">{lot.unit}</span>
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
