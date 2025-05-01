import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from '@/lib/websocket';
import Papa from 'papaparse';
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FileDown, Check, FileWarning, FileText } from "lucide-react";
import { type PalletWithLots, type Lot } from "@shared/schema";

// Define utility functions to safely handle data for CSV export
function assertStatus(value: any): string {
  return value ? value.toString() : 'active';
}

function formatSafeDate(dateStr: string | Date): string {
  try {
    return new Date(dateStr).toISOString().split('T')[0];
  } catch (e) {
    return new Date().toISOString().split('T')[0]; // Fallback to today's date
  }
}

// Function to format data for CSV export
function formatDataForCSV(pallets: PalletWithLots[], exportType: 'pallets' | 'lots' | 'full_inventory'): any[] {
  switch (exportType) {
    case 'pallets':
      // Just pallet data
      return pallets.map(pallet => ({
        palletId: pallet.palletId,
        rmNumber: pallet.rmNumber,
        location: pallet.location,
        status: assertStatus((pallet as any).status),
        createdAt: formatSafeDate(pallet.createdAt),
      }));
    
    case 'lots':
      // Flatten to get all lots with their pallet IDs
      return pallets.flatMap(pallet => 
        pallet.lots.map(lot => ({
          palletId: pallet.palletId,
          lotNumber: lot.lotNumber,
          quantity: lot.quantity,
          unit: lot.unit,
          expirationDate: formatSafeDate(lot.expirationDate),
          createdAt: formatSafeDate(lot.createdAt),
        }))
      );
    
    case 'full_inventory':
      // Full inventory format (palletId,rmNumber,location,lotNumber,quantity,unit,expirationDate)
      return pallets.flatMap(pallet => 
        pallet.lots.map(lot => ({
          palletId: pallet.palletId,
          rmNumber: pallet.rmNumber,
          location: pallet.location,
          lotNumber: lot.lotNumber,
          quantity: lot.quantity,
          unit: lot.unit,
          expirationDate: formatSafeDate(lot.expirationDate),
        }))
      );
    
    default:
      return [];
  }
}

export function ExportCSV() {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { toast } = useToast();
  const { pallets } = useWebSocket();
  
  const handleExport = async (exportType: 'pallets' | 'lots' | 'full_inventory') => {
    try {
      setIsExporting(true);
      setProgress(10);
      setError(null);
      setSuccess(null);
      
      if (!pallets || pallets.length === 0) {
        throw new Error('No data available to export');
      }
      
      setProgress(30);
      
      // Format the data based on the export type
      const dataToExport = formatDataForCSV(pallets, exportType);
      
      if (dataToExport.length === 0) {
        throw new Error('No data available for the selected export type');
      }
      
      setProgress(50);
      
      // Convert to CSV
      const csv = Papa.unparse(dataToExport);
      
      setProgress(75);
      
      // Create and download the file
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Set appropriate filename based on export type
      const date = new Date().toISOString().split('T')[0];
      let filename = '';
      
      if (exportType === 'pallets') {
        filename = `pallets_export_${date}.csv`;
      } else if (exportType === 'lots') {
        filename = `lots_export_${date}.csv`;
      } else if (exportType === 'full_inventory') {
        filename = `inventory_export_${date}.csv`;
      }
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setProgress(100);
      
      // Set success message
      setSuccess(`Successfully exported ${dataToExport.length} records to ${filename}`);
      
      toast({
        title: 'Export Successful',
        description: `Exported ${dataToExport.length} records to ${filename}`,
        variant: 'default',
      });
      
    } catch (err: any) {
      setProgress(100);
      setError(err.message || 'An unexpected error occurred during export');
      
      toast({
        title: 'Export Failed',
        description: err.message || 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      // Keep error visible but allow new exports
      setTimeout(() => {
        setIsExporting(false);
      }, 1000);
      
      // Auto-hide success message after 5 seconds
      if (success) {
        setTimeout(() => {
          setSuccess(null);
        }, 5000);
      }
    }
  };
  
  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <div className="flex items-start gap-2 sm:gap-3">
            <FileWarning className="h-4 w-4 sm:h-5 sm:w-5 mt-0.5 flex-shrink-0" />
            <div className="space-y-0.5 sm:space-y-1">
              <AlertTitle className="text-sm sm:text-base">Export Failed</AlertTitle>
              <AlertDescription className="text-xs sm:text-sm">{error}</AlertDescription>
            </div>
          </div>
        </Alert>
      )}
      
      {success && (
        <Alert variant="default" className="bg-green-50 border-green-300">
          <div className="flex items-start gap-2 sm:gap-3">
            <Check className="h-4 w-4 sm:h-5 sm:w-5 mt-0.5 text-green-500 flex-shrink-0" />
            <div className="space-y-0.5 sm:space-y-1">
              <AlertTitle className="text-sm sm:text-base">Export Successful</AlertTitle>
              <AlertDescription className="text-xs sm:text-sm">{success}</AlertDescription>
            </div>
          </div>
        </Alert>
      )}
      
      {isExporting && (
        <Progress value={progress} className="h-2" />
      )}
      
      <div className="space-y-3 sm:space-y-4">
        <h3 className="text-base sm:text-lg font-medium">Export Data</h3>
        
        <Alert className="py-2 sm:py-4">
          <FileText className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <AlertTitle className="text-sm sm:text-base">Export Options</AlertTitle>
          <AlertDescription className="text-xs sm:text-sm">
            Choose the type of data you want to export. The exported CSV can be imported back into the system or used for reporting.
          </AlertDescription>
        </Alert>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mt-4">
          <Button 
            variant="outline" 
            onClick={() => handleExport('pallets')}
            disabled={isExporting}
            className="flex gap-1 sm:gap-2 items-center text-xs sm:text-sm h-9 py-1 px-2 sm:h-10 sm:px-3"
          >
            <FileDown className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="whitespace-nowrap">Export Pallets</span>
          </Button>
          
          <Button 
            variant="outline" 
            onClick={() => handleExport('lots')}
            disabled={isExporting}
            className="flex gap-1 sm:gap-2 items-center text-xs sm:text-sm h-9 py-1 px-2 sm:h-10 sm:px-3"
          >
            <FileDown className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="whitespace-nowrap">Export Lots</span>
          </Button>
          
          <Button 
            variant="outline"
            onClick={() => handleExport('full_inventory')}
            disabled={isExporting}
            className="flex gap-1 sm:gap-2 items-center text-xs sm:text-sm h-9 py-1 px-2 sm:h-10 sm:px-3 text-primary col-span-2 sm:col-span-1"
          >
            <FileDown className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="whitespace-nowrap">Export Full Inventory</span>
          </Button>
        </div>
        
        <p className="text-xs sm:text-sm text-gray-500 mt-2">
          <span className="hidden sm:inline">The "Full Inventory" export includes all data in import-ready format with the following columns:</span>
          <span className="sm:hidden">Full Inventory export columns:</span>
          <span className="font-mono text-xs block mt-1">palletId, rmNumber, location, lotNumber, quantity, unit, expirationDate</span>
        </p>
      </div>
    </div>
  );
}