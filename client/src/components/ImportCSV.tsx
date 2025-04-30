import { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from '@/lib/websocket';
import Papa from 'papaparse';
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Upload, FileWarning, Check, FileX, FileText, Info, AlertTriangle } from "lucide-react";

type ImportResult = {
  success: number;
  errors: number;
  message: string;
  details?: string[];
};

export function ImportCSV() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { syncData } = useWebSocket();
  
  const resetState = () => {
    setIsUploading(false);
    setProgress(0);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    setProgress(10);
    setResult(null);
    
    // Parse CSV file
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          setProgress(30);
          
          // Validate basic structure
          const data = results.data as Record<string, string>[];
          if (!data.length) {
            throw new Error('CSV file is empty or has invalid format');
          }
          
          // Determine the type of import based on headers
          const headers = Object.keys(data[0]);
          let importType = '';
          
          if (headers.includes('rmNumber') && headers.includes('location')) {
            if (headers.includes('lotNumber') && headers.includes('quantity')) {
              importType = 'existing_inventory';
            } else {
              importType = 'pallets';
            }
          } else if (headers.includes('palletId') && headers.includes('lotNumber')) {
            importType = 'lots';
          } else {
            throw new Error('Invalid CSV format. Could not determine import type from headers.');
          }
          
          setProgress(50);
          
          // Send data to server
          const response = await fetch('/api/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              data,
              importType 
            }),
          });
          
          setProgress(80);
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Import failed');
          }
          
          const resultData = await response.json();
          
          setProgress(100);
          setResult({
            success: resultData.insertedCount || 0,
            errors: resultData.errorCount || 0,
            message: resultData.message,
            details: resultData.details
          });
          
          // Refresh data
          syncData();
          
          toast({
            title: 'Import Successful',
            description: `Imported ${resultData.insertedCount} records successfully.`,
          });
        } catch (error: any) {
          setProgress(100);
          setResult({
            success: 0,
            errors: 1,
            message: error.message || 'An unexpected error occurred'
          });
          
          toast({
            title: 'Import Failed',
            description: error.message || 'An unexpected error occurred',
            variant: 'destructive',
          });
        } finally {
          // Keep the progress and result displayed, but allow new uploads
          setIsUploading(false);
        }
      },
      error: (error) => {
        setProgress(100);
        setResult({
          success: 0,
          errors: 1,
          message: `CSV parsing error: ${error.message}`
        });
        
        toast({
          title: 'CSV Parsing Error',
          description: error.message,
          variant: 'destructive',
        });
        
        setIsUploading(false);
      }
    });
  };
  
  const generateSampleCSV = (type: 'pallets' | 'lots' | 'existing_inventory') => {
    let sample = '';
    
    if (type === 'pallets') {
      sample = 'rmNumber,location\n155,Rack 1-A-1\n277,Rack 2-B-3\n';
    } else if (type === 'lots') {
      sample = 'palletId,lotNumber,quantity,unit,expirationDate\nPAL00001,LOT123,500,KGS,2025-12-31\nPAL00001,LOT456,250,KGS,2026-01-15\n';
    } else if (type === 'existing_inventory') {
      sample = 'rmNumber,location,lotNumber,quantity,unit,expirationDate\n155,Rack 1-A-1,LOT123,500,KGS,2025-12-31\n155,Rack 1-A-2,LOT456,250,KGS,2026-01-15\n277,Rack 2-B-3,LOT789,750,LBS,2025-06-30\n';
    }
    
    const blob = new Blob([sample], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  return (
    <div className="space-y-6">
      {result && (
        <Alert variant={result.success > 0 ? "default" : "destructive"}>
          <div className="flex items-start gap-3">
            {result.success > 0 ? (
              <Check className="h-5 w-5" />
            ) : (
              <FileWarning className="h-5 w-5" />
            )}
            <div className="space-y-1">
              <AlertTitle>
                {result.success > 0 
                  ? `Import Successful: ${result.success} records imported` 
                  : 'Import Failed'}
              </AlertTitle>
              <AlertDescription className="text-sm">
                {result.message}
                
                {result.details && result.details.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="font-medium">Details:</p>
                    <ul className="list-disc list-inside text-xs space-y-1">
                      {result.details.map((detail, index) => (
                        <li key={index}>{detail}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </AlertDescription>
            </div>
          </div>
          
          <div className="mt-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={resetState}
            >
              Reset
            </Button>
          </div>
        </Alert>
      )}
      
      <div className="border rounded-lg p-5">
        <div className="flex flex-col space-y-4">
          <h3 className="text-lg font-medium">Import Data</h3>
          
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Choose the right import format</AlertTitle>
            <AlertDescription className="text-sm">
              Download the appropriate template for your data type. For existing inventory in racks, 
              use the "Existing Inventory" template that includes both pallet and lot information in one file.
            </AlertDescription>
          </Alert>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
            <Button 
              variant="outline" 
              onClick={() => generateSampleCSV('pallets')}
              className="flex gap-2 items-center"
            >
              <FileText className="h-4 w-4" />
              Pallets Template
            </Button>
            <Button 
              variant="outline" 
              onClick={() => generateSampleCSV('lots')}
              className="flex gap-2 items-center"
            >
              <FileText className="h-4 w-4" />
              Lots Template
            </Button>
            <Button 
              variant="outline" 
              onClick={() => generateSampleCSV('existing_inventory')}
              className="flex gap-2 items-center text-primary"
            >
              <FileText className="h-4 w-4" />
              Existing Inventory Template
            </Button>
          </div>
          
          <div className="mt-4">
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleFileUpload}
              className="hidden"
              id="csv-upload"
              ref={fileInputRef}
              disabled={isUploading}
            />
            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => !isUploading && fileInputRef.current?.click()}>
              <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
              <p className="text-gray-600 font-medium mb-1">Click to upload CSV file</p>
              <p className="text-gray-500 text-sm">or drag and drop</p>
              
              {isUploading && (
                <div className="mt-4">
                  <Progress value={progress} className="h-2" />
                  <p className="text-sm text-gray-500 mt-1">Uploading and processing...</p>
                </div>
              )}
            </div>
          </div>
          
          <Alert className="mt-2 bg-yellow-50 text-yellow-800 border-yellow-200">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Important</AlertTitle>
            <AlertDescription className="text-sm">
              <ul className="list-disc list-inside space-y-1">
                <li>Make sure your CSV file has the correct headers matching the template</li>
                <li>For existing inventory, one row per lot will be created</li>
                <li>Duplicate pallet IDs will be skipped</li>
                <li>Date format should be YYYY-MM-DD</li>
              </ul>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}