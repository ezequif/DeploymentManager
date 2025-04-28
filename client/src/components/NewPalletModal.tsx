import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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

interface NewPalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const formSchema = z.object({
  palletId: z.string().min(1, { message: "Pallet ID is required" }),
  rmNumber: z.string().min(1, { message: "RM# is required" }),
  location: z.string().min(1, { message: "Location is required" }),
  initialLot: z.object({
    lotNumber: z.string().min(1, { message: "Lot number is required" }),
    quantity: z.number().positive({ message: "Quantity must be positive" }),
    unit: z.enum(["KGS", "LBS"], { message: "Unit must be KGS or LBS" }),
    expirationDate: z.string().min(1, { message: "Expiration date is required" }),
  }).optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function NewPalletModal({ isOpen, onClose }: NewPalletModalProps) {
  const [withInitialLot, setWithInitialLot] = useState(true);
  const { toast } = useToast();
  
  // Fetch new pallet ID
  const { data: palletIdData, isLoading: isLoadingPalletId } = useQuery({
    queryKey: ['/api/pallets/generate-id'],
    enabled: isOpen,
  });
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      palletId: '',
      rmNumber: '',
      location: '',
      initialLot: {
        lotNumber: '',
        quantity: 0,
        unit: 'KGS',
        expirationDate: new Date().toISOString().split('T')[0],
      },
    },
  });
  
  // Update form with generated pallet ID when available
  if (palletIdData && !form.getValues().palletId) {
    form.setValue('palletId', palletIdData.palletId);
  }
  
  const createPallet = useMutation({
    mutationFn: async (values: FormValues) => {
      let data = { ...values };
      if (!withInitialLot) {
        delete data.initialLot;
      }
      return apiRequest("POST", "/api/pallets", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pallets'] });
      toast({
        title: "Pallet created",
        description: "New pallet has been created successfully",
      });
      onClose();
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error creating pallet",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (values: FormValues) => {
    createPallet.mutate(values);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Create New Pallet</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-4 py-2">
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
                    // In a real app, this would open the scanner
                    toast({
                      title: "Scanner",
                      description: "This would open the barcode scanner in a real app",
                    });
                  }}
                >
                  <span className="material-icons">qr_code_scanner</span>
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
                id="withInitialLot"
                checked={withInitialLot}
                onChange={(e) => setWithInitialLot(e.target.checked)}
                className="h-4 w-4 text-primary border-gray-300 rounded"
              />
              <label htmlFor="withInitialLot" className="ml-2 block text-sm text-gray-700">
                Add initial lot
              </label>
            </div>
            
            {withInitialLot && (
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-medium text-gray-800">Initial Lot</h4>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="lotNumber" className="block text-sm font-medium text-gray-700 mb-1">Lot Number</Label>
                    <div className="relative">
                      <Input 
                        id="lotNumber" 
                        {...form.register("initialLot.lotNumber")}
                        placeholder="Enter lot number"
                      />
                      <button 
                        type="button" 
                        className="absolute right-2 top-2 text-gray-500"
                        onClick={() => {
                          // In a real app, this would open the scanner
                          toast({
                            title: "Scanner",
                            description: "This would open the barcode scanner in a real app",
                          });
                        }}
                      >
                        <span className="material-icons">qr_code_scanner</span>
                      </button>
                    </div>
                    {form.formState.errors.initialLot?.lotNumber && (
                      <p className="text-destructive text-sm mt-1">{form.formState.errors.initialLot.lotNumber.message}</p>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">Quantity</Label>
                      <Input 
                        id="quantity" 
                        type="number"
                        step="0.1"
                        placeholder="0.0"
                        {...form.register("initialLot.quantity", { valueAsNumber: true })}
                      />
                      {form.formState.errors.initialLot?.quantity && (
                        <p className="text-destructive text-sm mt-1">{form.formState.errors.initialLot.quantity.message}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="unit" className="block text-sm font-medium text-gray-700 mb-1">Unit</Label>
                      <Select 
                        defaultValue="KGS" 
                        onValueChange={(value) => form.setValue("initialLot.unit", value as "KGS" | "LBS")}
                      >
                        <SelectTrigger id="unit">
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="KGS">KGS</SelectItem>
                          <SelectItem value="LBS">LBS</SelectItem>
                        </SelectContent>
                      </Select>
                      {form.formState.errors.initialLot?.unit && (
                        <p className="text-destructive text-sm mt-1">{form.formState.errors.initialLot.unit.message}</p>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="expiration" className="block text-sm font-medium text-gray-700 mb-1">Expiration Date</Label>
                    <Input 
                      id="expiration" 
                      type="date"
                      {...form.register("initialLot.expirationDate")}
                    />
                    {form.formState.errors.initialLot?.expirationDate && (
                      <p className="text-destructive text-sm mt-1">{form.formState.errors.initialLot.expirationDate.message}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter className="mt-6 flex justify-end space-x-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={createPallet.isPending}
            >
              {createPallet.isPending ? "Creating..." : "Create Pallet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
