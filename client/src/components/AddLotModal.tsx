import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PalletWithLots, Lot } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ScannerModal from "./ScannerModal";

interface AddLotModalProps {
  pallet: PalletWithLots;
  isOpen: boolean;
  onClose: () => void;
  existingLot?: Lot | null; // Pass an existing lot for edit mode
}

export default function AddLotModal({ pallet, isOpen, onClose, existingLot }: AddLotModalProps) {
  // When existingLot is provided, pre-fill form with lot values
  const [lotNumber, setLotNumber] = useState(existingLot?.lotNumber || "");
  const [quantity, setQuantity] = useState<number | null>(existingLot?.quantity || null);
  const [unit, setUnit] = useState<"KGS" | "LBS">(
    (existingLot?.unit as "KGS" | "LBS") || "KGS"
  );
  const [expirationDate, setExpirationDate] = useState<string>(
    existingLot?.expirationDate || new Date().toISOString().split("T")[0]
  );
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  
  const { toast } = useToast();

  // Helper to preserve the date exactly as entered by the user
  const normalizeDate = (dateString: string): string => {
    // This ensures that dates entered by the user are preserved exactly as typed,
    // preventing timezone offset issues
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;
    
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const day = parseInt(parts[2]);
    
    return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  };

  // Add lot mutation
  const addLotMutation = useMutation({
    mutationFn: async () => {
      if (!lotNumber || !quantity) {
        throw new Error("Please fill in all required fields");
      }

      // Normalize date to prevent timezone issues
      const normalizedDate = normalizeDate(expirationDate);
      console.log("Original date:", expirationDate, "Normalized date:", normalizedDate);

      return apiRequest("POST", "/api/lots", {
        palletId: pallet.id,
        lotNumber,
        quantity,
        unit,
        expirationDate: normalizedDate,
        transaction: {
          lotId: 0, // This will be replaced with the actual lot ID on the server
          transactionType: "add",
          quantity: quantity,
          notes: `Added lot ${lotNumber} (${quantity} ${unit}) to pallet ${pallet.palletId}`
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pallets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({
        title: "Lot Added",
        description: `Lot ${lotNumber} has been added to pallet ${pallet.palletId}.`,
      });
      onClose();
      
      // Reset form
      setLotNumber("");
      setQuantity(null);
      setUnit("KGS");
      setExpirationDate(new Date().toISOString().split("T")[0]);
    },
    onError: (error) => {
      toast({
        title: "Error Adding Lot",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Update lot mutation
  const updateLotMutation = useMutation({
    mutationFn: async () => {
      if (!existingLot || !lotNumber || !quantity) {
        throw new Error("Please fill in all required fields");
      }

      // Only record a transaction if the quantity has changed
      const hasQuantityChanged = existingLot.quantity !== quantity;
      
      // Normalize date to prevent timezone issues
      const normalizedDate = normalizeDate(expirationDate);
      console.log("Original date:", expirationDate, "Normalized date:", normalizedDate);

      return apiRequest("PATCH", `/api/lots/${existingLot.id}`, {
        lotNumber,
        quantity,
        unit,
        expirationDate: normalizedDate,
        transaction: hasQuantityChanged ? {
          lotId: existingLot.id,
          transactionType: "edit",
          quantity: quantity - existingLot.quantity, // Could be negative (decrease) or positive (increase)
          notes: `Edited lot ${lotNumber} quantity from ${existingLot.quantity} to ${quantity} ${unit}`
        } : undefined
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pallets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({
        title: "Lot Updated",
        description: `Lot ${lotNumber} has been updated successfully.`,
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error Updating Lot",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle scanner results
  const handleScanResult = (result: string) => {
    setLotNumber(result);
    setIsScannerOpen(false);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {existingLot ? "Edit Lot" : "Add New Lot"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <div className="mb-4">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
                <div className="grid grid-cols-2 gap-y-2">
                  <div className="text-sm text-gray-500">Pallet ID:</div>
                  <div className="text-sm font-medium text-gray-900">{pallet.palletId}</div>
                  <div className="text-sm text-gray-500">RM Number:</div>
                  <div className="text-sm font-medium text-gray-900">{pallet.rmNumber}</div>
                  <div className="text-sm text-gray-500">Location:</div>
                  <div className="text-sm font-medium text-gray-900">{pallet.location}</div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="lotNumber" className="block text-sm font-medium text-gray-700 mb-1">
                    Lot Number*
                  </Label>
                  <div className="relative">
                    <Input
                      id="lotNumber"
                      value={lotNumber}
                      onChange={(e) => setLotNumber(e.target.value)}
                      placeholder="Enter lot number"
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
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
                      Quantity*
                    </Label>
                    <Input
                      id="quantity"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      value={quantity || ''}
                      onChange={(e) => setQuantity(parseFloat(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="unit" className="block text-sm font-medium text-gray-700 mb-1">
                      Unit
                    </Label>
                    <Select
                      value={unit}
                      onValueChange={(value) => setUnit(value as "KGS" | "LBS")}
                    >
                      <SelectTrigger id="unit">
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="KGS">KGS</SelectItem>
                        <SelectItem value="LBS">LBS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="expirationDate" className="block text-sm font-medium text-gray-700 mb-1">
                    Expiration Date*
                  </Label>
                  <Input
                    id="expirationDate"
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
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
                onClick={() => existingLot ? updateLotMutation.mutate() : addLotMutation.mutate()}
                disabled={(existingLot ? updateLotMutation.isPending : addLotMutation.isPending) || !lotNumber || !quantity}
                className="w-full sm:w-auto bg-secondary hover:bg-secondary/90"
              >
                {existingLot 
                  ? (updateLotMutation.isPending ? "Updating..." : "Update Lot") 
                  : (addLotMutation.isPending ? "Adding..." : "Add Lot")
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {isScannerOpen && <ScannerModal onClose={() => setIsScannerOpen(false)} onScan={handleScanResult} />}
    </>
  );
}