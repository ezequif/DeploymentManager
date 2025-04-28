import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PalletWithLots, Lot } from "@shared/schema";
import { formatDate } from "../lib/formatUtils";
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
  const [quantity, setQuantity] = useState(0);
  const [destination, setDestination] = useState("");
  const [notes, setNotes] = useState("");
  const { toast } = useToast();
  
  const pickMutation = useMutation({
    mutationFn: async () => {
      if (quantity <= 0) {
        throw new Error("Quantity must be greater than 0");
      }
      
      if (quantity > lot.quantity) {
        throw new Error("Cannot pick more than available quantity");
      }
      
      // Update lot quantity
      const newQuantity = lot.quantity - quantity;
      
      return apiRequest("PATCH", `/api/lots/${lot.id}`, {
        quantity: newQuantity,
        transaction: {
          lotId: lot.id,
          transactionType: "pick",
          quantity: quantity,
          destination,
          notes
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pallets'] });
      toast({
        title: "Lot picked",
        description: `Successfully picked ${quantity} ${lot.unit} from lot ${lot.lotNumber}`
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
                <div className="flex items-center">
                  <Input
                    id="pickQuantity"
                    type="number"
                    step="0.1"
                    placeholder="0.0"
                    min="0.1"
                    max={lot.quantity.toString()}
                    value={quantity || ''}
                    onChange={(e) => setQuantity(parseFloat(e.target.value))}
                    className="flex-1"
                  />
                  <span className="ml-2 text-gray-700 font-medium">{lot.unit}</span>
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
              disabled={pickMutation.isPending || quantity <= 0 || quantity > lot.quantity}
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
