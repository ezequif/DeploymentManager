import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, QrCode, RefreshCw } from "lucide-react";
import ScannerModal from "./ScannerModal";
import { convertWeight, formatWeightWithUnit, formatWeightForDisplay } from "@/lib/formatUtils";
import { useUnitSettings } from "@/hooks/use-unit-settings";

interface NewPalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Define schema for a single lot
const lotSchema = z.object({
  lotNumber: z.string().min(1, { message: "Lot number is required" }),
  quantity: z.number().positive({ message: "Quantity must be positive" }),
  unit: z.enum(["KGS", "LBS"], { message: "Unit must be KGS or LBS" }),
  expirationDate: z.string().min(1, { message: "Expiration date is required" }),
});

// Define schema for pallet with support for multiple initial lots
const formSchema = z.object({
  palletId: z.string().min(1, { message: "Pallet ID is required" }),
  rmNumber: z.string().min(1, { message: "RM# is required" }),
  location: z.string().min(1, { message: "Location is required" }),
  initialLots: z.array(lotSchema).optional(),
});

type FormValues = z.infer<typeof formSchema>;
type LotFormValues = z.infer<typeof lotSchema>;

export default function NewPalletModal({ isOpen, onClose }: NewPalletModalProps) {
  const [withInitialLots, setWithInitialLots] = useState(true);
  const { preferredUnit, autoConvert } = useUnitSettings();
  
  // Initialize lots with the preferred unit
  const [lots, setLots] = useState<LotFormValues[]>([{
    lotNumber: '',
    quantity: 0,
    unit: preferredUnit,
    expirationDate: new Date().toISOString().split('T')[0],
  }]);
  const [activeTab, setActiveTab] = useState("pallet-info");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanningForField, setScanningForField] = useState<{ index: number, field: 'lotNumber' | 'rmNumber' } | null>(null);
  const { toast } = useToast();
  
  // Fetch new pallet ID
  type PalletIdResponse = { palletId: string };
  const { data: palletIdData } = useQuery<PalletIdResponse>({
    queryKey: ['/api/pallets/generate-id'],
    enabled: isOpen,
  });
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      palletId: '',
      rmNumber: '',
      location: '',
      initialLots: [],
    },
  });
  
  // Update form with generated pallet ID when available
  if (palletIdData?.palletId && !form.getValues().palletId) {
    form.setValue('palletId', palletIdData.palletId);
  }
  
  // Add a new lot to the form
  const addLot = () => {
    const newLot: LotFormValues = {
      lotNumber: '',
      quantity: 0,
      unit: preferredUnit, // Use the user's preferred unit
      expirationDate: new Date().toISOString().split('T')[0],
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
  const updateLotField = (index: number, field: keyof LotFormValues, value: any) => {
    const updatedLots = [...lots];
    updatedLots[index] = { ...updatedLots[index], [field]: value };
    setLots(updatedLots);
  };
  
  // Handle scanner result
  const handleScanResult = (result: string) => {
    if (scanningForField) {
      if (scanningForField.field === 'rmNumber') {
        form.setValue('rmNumber', result);
      } else {
        updateLotField(scanningForField.index, 'lotNumber', result);
      }
    }
    setIsScannerOpen(false);
    setScanningForField(null);
  };
  
  const createPallet = useMutation({
    mutationFn: async (values: FormValues) => {
      // Create a new object to avoid modifying the original values
      const data = { ...values };
      
      // Add the lots into the request data
      if (withInitialLots && lots.length > 0) {
        // Filter out incomplete lots
        const validLots = lots.filter(lot => 
          lot.lotNumber && lot.quantity > 0 && lot.expirationDate
        );
        
        if (validLots.length > 0) {
          console.log("Adding valid lots to request:", validLots);
          data.initialLots = validLots;
        } else {
          console.log("No valid lots to add");
          delete data.initialLots;
        }
      } else {
        console.log("Not adding lots to request");
        delete data.initialLots;
      }
      
      console.log("Submitting pallet data:", data);
      return apiRequest("POST", "/api/pallets", data);
    },
    onSuccess: async (response) => {
      // Parse the response
      const data = await response.json();
      console.log("Pallet created successfully:", data);
      
      // Invalidate all queries related to pallets to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/pallets'] });
      
      // Force a direct refetch to ensure we get the latest data
      queryClient.refetchQueries({ queryKey: ['/api/pallets'] });
      
      toast({
        title: "Pallet created",
        description: `Pallet ${data.palletId} has been created successfully with ${data.lots.length} lot(s)`,
      });
      
      onClose();
      form.reset();
      setLots([{
        lotNumber: '',
        quantity: 0,
        unit: preferredUnit,
        expirationDate: new Date().toISOString().split('T')[0],
      }]);
      setActiveTab("pallet-info");
    },
    onError: (error) => {
      console.error("Error creating pallet:", error);
      toast({
        title: "Error creating pallet",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (values: FormValues) => {
    if (withInitialLots && activeTab === "initial-lots") {
      // Validate lots directly before submitting
      const validLots = lots.filter(lot => 
        lot.lotNumber && lot.quantity > 0 && lot.expirationDate
      );
      
      if (validLots.length === 0) {
        toast({
          title: "Missing lot information",
          description: "Please provide valid lot information or disable the 'Add initial lots' option",
          variant: "destructive"
        });
        return;
      }
      
      // Clone form values and add the lots
      const submitData = {
        ...values,
        initialLots: validLots
      };
      console.log("Submitting with lots:", submitData);
      createPallet.mutate(submitData);
    } else {
      // Submit without lots
      const submitData = { ...values };
      delete submitData.initialLots;
      console.log("Submitting without lots:", submitData);
      createPallet.mutate(submitData);
    }
  };
  
  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Create New Pallet</DialogTitle>
          </DialogHeader>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pallet-info">Pallet Info</TabsTrigger>
              <TabsTrigger value="initial-lots" disabled={!withInitialLots}>
                Initial Lots ({lots.length})
              </TabsTrigger>
            </TabsList>
            
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <TabsContent value="pallet-info" className="space-y-4 py-4">
                <div>
                  <Label className="block text-sm font-medium text-gray-700 mb-1">Pallet ID</Label>
                  <div className="flex">
                    <Input 
                      {...form.register("palletId")}
                      readOnly
                      className="bg-gray-100"
                    />
                    <span className="ml-2 text-gray-500 text-sm flex items-center">Auto-generated</span>
                  </div>
                  {form.formState.errors.palletId && (
                    <p className="text-destructive text-sm mt-1">{form.formState.errors.palletId.message}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="rmNumber" className="block text-sm font-medium text-gray-700 mb-1">RM Number</Label>
                  <div className="relative">
                    <Input 
                      id="rmNumber"
                      {...form.register("rmNumber")}
                      placeholder="Enter RM#"
                    />
                    <button 
                      type="button" 
                      className="absolute right-2 top-2 text-gray-500"
                      onClick={() => {
                        setScanningForField({ index: -1, field: 'rmNumber' });
                        setIsScannerOpen(true);
                      }}
                    >
                      <QrCode className="h-4 w-4" />
                    </button>
                  </div>
                  {form.formState.errors.rmNumber && (
                    <p className="text-destructive text-sm mt-1">{form.formState.errors.rmNumber.message}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">Warehouse Location</Label>
                  <Input 
                    id="location" 
                    {...form.register("location")}
                    placeholder="Example: A-123-4"
                  />
                  {form.formState.errors.location && (
                    <p className="text-destructive text-sm mt-1">{form.formState.errors.location.message}</p>
                  )}
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="withInitialLots"
                    checked={withInitialLots}
                    onChange={(e) => {
                      setWithInitialLots(e.target.checked);
                      if (!e.target.checked) {
                        setActiveTab("pallet-info");
                      }
                    }}
                    className="h-4 w-4 text-primary border-gray-300 rounded"
                  />
                  <label htmlFor="withInitialLots" className="ml-2 block text-sm text-gray-700">
                    Add initial lots
                  </label>
                </div>
                
                <div className="pt-4">
                  <Button
                    type="button"
                    onClick={() => withInitialLots ? setActiveTab("initial-lots") : form.handleSubmit(onSubmit)()}
                    className="w-full bg-primary"
                  >
                    {withInitialLots ? "Continue to Add Lots" : "Create Pallet"}
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="initial-lots" className="space-y-4 py-4">
                {lots.map((lot, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
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
                        <Label htmlFor={`lot-${index}-number`} className="block text-sm font-medium text-gray-700 mb-1">Lot Number</Label>
                        <div className="relative">
                          <Input 
                            id={`lot-${index}-number`}
                            value={lot.lotNumber}
                            onChange={(e) => updateLotField(index, 'lotNumber', e.target.value)}
                            placeholder="Enter lot number"
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
                          <Label htmlFor={`lot-${index}-quantity`} className="block text-sm font-medium text-gray-700 mb-1">Quantity</Label>
                          <div className="relative">
                            <Input 
                              id={`lot-${index}-quantity`}
                              type="number"
                              step="0.1"
                              placeholder="0.0"
                              value={lot.quantity || ''}
                              onChange={(e) => updateLotField(index, 'quantity', parseFloat(e.target.value))}
                            />
                            {lot.quantity > 0 && (
                              <div className="text-xs text-gray-500 mt-1">
                                ≈ {formatWeightWithUnit(
                                    convertWeight(lot.quantity, lot.unit, lot.unit === "KGS" ? "LBS" : "KGS"),
                                    lot.unit === "KGS" ? "LBS" : "KGS"
                                  )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <Label htmlFor={`lot-${index}-unit`} className="block text-sm font-medium text-gray-700 mb-1">Unit</Label>
                          <div className="relative">
                            <Select 
                              value={lot.unit}
                              onValueChange={(value: "KGS" | "LBS") => {
                                // When changing units, convert the quantity if it exists
                                if (lot.quantity > 0) {
                                  // Convert the quantity to the new unit
                                  const newQuantity = convertWeight(lot.quantity, lot.unit, value);
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
                            
                            {lot.quantity > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  // Switch units and convert the quantity
                                  const newUnit = lot.unit === "KGS" ? "LBS" : "KGS";
                                  const newQuantity = convertWeight(lot.quantity, lot.unit, newUnit);
                                  
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
                        <Label htmlFor={`lot-${index}-expiration`} className="block text-sm font-medium text-gray-700 mb-1">Expiration Date</Label>
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
                
                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setActiveTab("pallet-info")}
                    className="w-full sm:w-auto"
                  >
                    Back to Pallet Info
                  </Button>
                  <Button 
                    type="submit"
                    disabled={createPallet.isPending}
                    className="w-full sm:w-auto bg-primary"
                  >
                    {createPallet.isPending ? "Creating..." : "Create Pallet with Lots"}
                  </Button>
                </div>
              </TabsContent>
            </form>
          </Tabs>
        </DialogContent>
      </Dialog>
      
      {isScannerOpen && (
        <ScannerModal 
          onClose={() => setIsScannerOpen(false)} 
          onScan={handleScanResult} 
        />
      )}
    </>
  );
}
