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
import { useUnitSettings } from "@/hooks/use-unit-settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, QrCode, RefreshCw } from "lucide-react";
import ScannerModal from "./ScannerModal";
import { convertWeight, formatWeightWithUnit } from "@/lib/formatUtils";

interface AddLotModalProps {
  pallet: PalletWithLots;
  isOpen: boolean;
  onClose: () => void;
  existingLot?: Lot | null; // Pass an existing lot for edit mode
}

// Define a lot structure for the multi-lot UI
interface LotFormData {
  lotNumber: string;
  quantity: number | null;
  unit: "KGS" | "LBS";
  expirationDate: string;
}

export default function AddLotModal({ pallet, isOpen, onClose, existingLot }: AddLotModalProps) {
  // Different UI modes
  const [isMultiLotMode, setIsMultiLotMode] = useState(!existingLot); // Enable multi-lot mode by default for adding (not editing)
  
  // Import the unit settings
  const { preferredUnit } = useUnitSettings();
  
  // For single lot edit mode
  const [lotNumber, setLotNumber] = useState(existingLot?.lotNumber || "");
  const [quantity, setQuantity] = useState<number | null>(existingLot?.quantity || null);
  const [unit, setUnit] = useState<"KGS" | "LBS">(
    (existingLot?.unit as "KGS" | "LBS") || preferredUnit
  );
  const [expirationDate, setExpirationDate] = useState<string>(
    existingLot?.expirationDate || new Date().toISOString().split("T")[0]
  );
  
  // For multi-lot mode
  const [lots, setLots] = useState<LotFormData[]>([
    {
      lotNumber: "",
      quantity: null,
      unit: preferredUnit,
      expirationDate: new Date().toISOString().split("T")[0]
    }
  ]);
  
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanningForField, setScanningForField] = useState<{ index: number, field: 'lotNumber' } | null>(null);
  
  const { toast } = useToast();

  // Add a new lot to the form
  const addLot = () => {
    const newLot: LotFormData = {
      lotNumber: "",
      quantity: null,
      unit: preferredUnit,
      expirationDate: new Date().toISOString().split("T")[0]
    };
    setLots([...lots, newLot]);
  };
  
  // Remove a lot from the form
  const removeLot = (index: number) => {
    const updatedLots = [...lots];
    updatedLots.splice(index, 1);
    setLots(updatedLots);
  };
  
  // Update a lot field value
  const updateLotField = (index: number, field: keyof LotFormData, value: any) => {
    const updatedLots = [...lots];
    updatedLots[index] = { ...updatedLots[index], [field]: value };
    setLots(updatedLots);
  };

  // Add single lot mutation 
  const addLotMutation = useMutation({
    mutationFn: async () => {
      if (!lotNumber || !quantity) {
        throw new Error("Please fill in all required fields");
      }

      return apiRequest("POST", "/api/lots", {
        palletId: pallet.id,
        lotNumber,
        quantity,
        unit,
        expirationDate: expirationDate,
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
      setUnit(preferredUnit);
      setExpirationDate(new Date().toISOString().split("T")[0]);
      setLots([{
        lotNumber: "",
        quantity: null,
        unit: preferredUnit,
        expirationDate: new Date().toISOString().split("T")[0]
      }]);
    },
    onError: (error) => {
      toast({
        title: "Error Adding Lot",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Add multiple lots mutation
  const addMultiLotsMutation = useMutation({
    mutationFn: async () => {
      // Filter out incomplete lots
      const validLots = lots.filter(lot => 
        lot.lotNumber && lot.quantity && lot.quantity > 0 && lot.expirationDate
      );
      
      if (validLots.length === 0) {
        throw new Error("Please add at least one valid lot with all required fields");
      }

      // Create an array of lots with pallet ID and transaction data
      const lotsToSubmit = validLots.map(lot => ({
        palletId: pallet.id,
        lotNumber: lot.lotNumber,
        quantity: lot.quantity,
        unit: lot.unit,
        expirationDate: lot.expirationDate,
        transaction: {
          lotId: 0, // Will be replaced by server
          transactionType: "add",
          quantity: lot.quantity,
          notes: `Added lot ${lot.lotNumber} (${lot.quantity} ${lot.unit}) to pallet ${pallet.palletId}`
        }
      }));

      return apiRequest("POST", "/api/lots", lotsToSubmit);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pallets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      
      // Data could be an array of lots or a single lot
      const lotsCount = Array.isArray(data) ? data.length : 1;
      
      toast({
        title: "Lots Added",
        description: `${lotsCount} lot(s) have been added to pallet ${pallet.palletId}.`,
      });
      onClose();
      
      // Reset form
      setLots([{
        lotNumber: "",
        quantity: null,
        unit: preferredUnit,
        expirationDate: new Date().toISOString().split("T")[0]
      }]);
    },
    onError: (error) => {
      toast({
        title: "Error Adding Lots",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Update lot mutation (for edit mode only)
  const updateLotMutation = useMutation({
    mutationFn: async () => {
      if (!existingLot || !lotNumber || !quantity) {
        throw new Error("Please fill in all required fields");
      }

      // Only record a transaction if the quantity has changed
      const hasQuantityChanged = existingLot.quantity !== quantity;

      return apiRequest("PATCH", `/api/lots/${existingLot.id}`, {
        lotNumber,
        quantity,
        unit,
        expirationDate: expirationDate,
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
    if (scanningForField) {
      // Multi-lot mode
      updateLotField(scanningForField.index, 'lotNumber', result);
    } else {
      // Single lot mode
      setLotNumber(result);
    }
    setIsScannerOpen(false);
    setScanningForField(null);
  };

  // Check if we can submit the form
  const canSubmitSingleLot = Boolean(lotNumber && quantity && quantity > 0);
  const canSubmitMultiLots = lots.some(lot => 
    lot.lotNumber && lot.quantity && lot.quantity > 0 && lot.expirationDate
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {existingLot ? "Edit Lot" : "Add Lots"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
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
            
            {/* Toggle for single/multi lot mode - only show if not in edit mode */}
            {!existingLot && (
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-medium">Mode:</span>
                <div className="flex border rounded overflow-hidden">
                  <button
                    className={`px-3 py-1 text-sm ${!isMultiLotMode ? 'bg-primary text-white' : 'bg-gray-100'}`}
                    onClick={() => setIsMultiLotMode(false)}
                  >
                    Single Lot
                  </button>
                  <button
                    className={`px-3 py-1 text-sm ${isMultiLotMode ? 'bg-primary text-white' : 'bg-gray-100'}`}
                    onClick={() => setIsMultiLotMode(true)}
                  >
                    Multiple Lots
                  </button>
                </div>
              </div>
            )}
            
            {/* Edit Mode or Single Lot Add Mode */}
            {(existingLot || !isMultiLotMode) && (
              <div className="space-y-4 mb-4">
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
                      <QrCode className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
                      Quantity*
                    </Label>
                    <div className="relative">
                      <Input
                        id="quantity"
                        type="number"
                        step="0.1"
                        placeholder="0.0"
                        value={quantity || ''}
                        onChange={(e) => setQuantity(parseFloat(e.target.value))}
                      />
                      {quantity && quantity > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          ≈ {formatWeightWithUnit(
                              convertWeight(Number(quantity), unit, unit === "KGS" ? "LBS" : "KGS"),
                              unit === "KGS" ? "LBS" : "KGS"
                            )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="unit" className="block text-sm font-medium text-gray-700 mb-1">
                      Unit
                    </Label>
                    <div className="relative">
                      <Select
                        value={unit}
                        onValueChange={(value: "KGS" | "LBS") => {
                          // When changing units, convert the quantity
                          if (quantity && quantity > 0) {
                            // Convert the quantity to the new unit
                            const newQuantity = convertWeight(Number(quantity), unit, value);
                            setQuantity(parseFloat(newQuantity.toFixed(1)));
                          }
                          setUnit(value);
                        }}
                      >
                        <SelectTrigger id="unit">
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="KGS">KGS</SelectItem>
                          <SelectItem value="LBS">LBS</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      {quantity && quantity > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            // Switch units and convert the quantity
                            const newUnit = unit === "KGS" ? "LBS" : "KGS";
                            // Ensure quantity is not null before conversion
                            if (quantity === null) return;
                            const newQuantity = convertWeight(Number(quantity), unit, newUnit);
                            setQuantity(parseFloat(newQuantity.toFixed(1)));
                            setUnit(newUnit);
                            
                            toast({
                              title: "Unit Converted",
                              description: `Converted ${quantity} ${unit} to ${formatWeightWithUnit(newQuantity, newUnit)}`
                            });
                          }}
                          className="absolute right-10 top-2 text-gray-500 hover:text-primary"
                          title="Convert units"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      )}
                    </div>
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
            )}
            
            {/* Multi-Lot Add Mode */}
            {isMultiLotMode && !existingLot && (
              <div className="space-y-4 mb-4">
                {lots.map((lot, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-2">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-medium text-gray-800">Lot #{index + 1}</h4>
                      {lots.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeLot(index)}
                          className="text-red-500 h-8 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor={`lot-${index}-number`} className="block text-sm font-medium text-gray-700 mb-1">
                          Lot Number*
                        </Label>
                        <div className="relative">
                          <Input 
                            id={`lot-${index}-number`}
                            value={lot.lotNumber}
                            onChange={(e) => updateLotField(index, 'lotNumber', e.target.value)}
                            placeholder="Enter lot number"
                            className="pr-10"
                          />
                          <button 
                            type="button" 
                            className="absolute right-2 top-2 text-gray-500"
                            onClick={() => {
                              setScanningForField({ index, field: 'lotNumber' });
                              setIsScannerOpen(true);
                            }}
                          >
                            <QrCode className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor={`lot-${index}-quantity`} className="block text-sm font-medium text-gray-700 mb-1">
                            Quantity*
                          </Label>
                          <div className="relative">
                            <Input 
                              id={`lot-${index}-quantity`}
                              type="number"
                              step="0.1"
                              placeholder="0.0"
                              value={lot.quantity || ''}
                              onChange={(e) => updateLotField(index, 'quantity', parseFloat(e.target.value))}
                            />
                            {lot.quantity && lot.quantity > 0 && (
                              <div className="text-xs text-gray-500 mt-1">
                                ≈ {formatWeightWithUnit(
                                    convertWeight(Number(lot.quantity), lot.unit, lot.unit === "KGS" ? "LBS" : "KGS"),
                                    lot.unit === "KGS" ? "LBS" : "KGS"
                                  )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <Label htmlFor={`lot-${index}-unit`} className="block text-sm font-medium text-gray-700 mb-1">
                            Unit
                          </Label>
                          <div className="relative">
                            <Select 
                              value={lot.unit}
                              onValueChange={(value: "KGS" | "LBS") => {
                                // When changing units, convert the quantity if it exists
                                if (lot.quantity && lot.quantity > 0) {
                                  // Convert the quantity to the new unit
                                  const newQuantity = convertWeight(Number(lot.quantity), lot.unit, value);
                                  updateLotField(index, 'quantity', parseFloat(newQuantity.toFixed(1)));
                                }
                                updateLotField(index, 'unit', value);
                              }}
                            >
                              <SelectTrigger id={`lot-${index}-unit`}>
                                <SelectValue placeholder="Select unit" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="KGS">KGS</SelectItem>
                                <SelectItem value="LBS">LBS</SelectItem>
                              </SelectContent>
                            </Select>

                            {lot.quantity && lot.quantity > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  // Switch units and convert the quantity
                                  const newUnit = lot.unit === "KGS" ? "LBS" : "KGS";
                                  // Ensure quantity is not null before conversion
                                  if (lot.quantity === null) return;
                                  const newQuantity = convertWeight(Number(lot.quantity), lot.unit, newUnit);
                                  
                                  updateLotField(index, 'quantity', parseFloat(newQuantity.toFixed(1)));
                                  updateLotField(index, 'unit', newUnit);
                                  
                                  toast({
                                    title: "Unit Converted",
                                    description: `Converted ${lot.quantity} ${lot.unit} to ${formatWeightWithUnit(newQuantity, newUnit)}`
                                  });
                                }}
                                className="absolute right-10 top-2 text-gray-500 hover:text-primary"
                                title="Convert units"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor={`lot-${index}-expiration`} className="block text-sm font-medium text-gray-700 mb-1">
                          Expiration Date*
                        </Label>
                        <Input 
                          id={`lot-${index}-expiration`}
                          type="date"
                          value={lot.expirationDate}
                          onChange={(e) => updateLotField(index, 'expirationDate', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={addLot}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Another Lot
                </Button>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={onClose}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              
              {/* Render different action buttons based on mode */}
              {existingLot ? (
                // Edit mode
                <Button 
                  onClick={() => updateLotMutation.mutate()}
                  disabled={updateLotMutation.isPending || !canSubmitSingleLot}
                  className="w-full sm:w-auto bg-secondary hover:bg-secondary/90"
                >
                  {updateLotMutation.isPending ? "Updating..." : "Update Lot"}
                </Button>
              ) : isMultiLotMode ? (
                // Multi-lot add mode
                <Button 
                  onClick={() => addMultiLotsMutation.mutate()}
                  disabled={addMultiLotsMutation.isPending || !canSubmitMultiLots}
                  className="w-full sm:w-auto bg-secondary hover:bg-secondary/90"
                >
                  {addMultiLotsMutation.isPending ? "Adding..." : `Add ${lots.filter(l => l.lotNumber && l.quantity && l.quantity > 0).length} Lot(s)`}
                </Button>
              ) : (
                // Single lot add mode
                <Button 
                  onClick={() => addLotMutation.mutate()}
                  disabled={addLotMutation.isPending || !canSubmitSingleLot}
                  className="w-full sm:w-auto bg-secondary hover:bg-secondary/90"
                >
                  {addLotMutation.isPending ? "Adding..." : "Add Lot"}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {isScannerOpen && (
        <ScannerModal 
          onClose={() => {
            setIsScannerOpen(false);
            setScanningForField(null);
          }} 
          onScan={handleScanResult} 
        />
      )}
    </>
  );
}