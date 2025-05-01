import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { KeyboardIcon, Smartphone, Scan, TabletSmartphone } from "lucide-react";
import { useScanner } from "@/lib/scannerContext";
import NativeCamera from "./NativeCamera";
import TabletScannerComponent from "./TabletScannerComponent";

interface UnifiedScannerModalProps {
  onScan: (code: string) => void;
  onClose: () => void;
  title?: string;
}

export default function UnifiedScannerModal({ 
  onScan, 
  onClose,
  title = "Scan Barcode" 
}: UnifiedScannerModalProps) {
  // Get scanner context
  const { 
    scanMode, 
    deviceInfo, 
    setScanResult,
    startScanning,
    stopScanning
  } = useScanner();
  
  // Local state for manual entry
  const [manualCode, setManualCode] = useState("");
  // Local state for displaying different scanner views
  const [activeView, setActiveView] = useState<'native' | 'tablet' | 'manual'>(
    deviceInfo.isTC70 ? 'manual' : 
    deviceInfo.isTablet ? 'tablet' : 'native'
  );
  
  // Handle scan completion
  const handleScanComplete = (code: string) => {
    // Set the result in context
    setScanResult(code);
    // Call the provided callback
    onScan(code);
    // Close the modal
    onClose();
  };
  
  // Handle manual barcode submission
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    
    handleScanComplete(manualCode);
  };
  
  // Handle TC70 hardware scanner via keyboard
  useEffect(() => {
    if (deviceInfo.isTC70 && activeView === 'manual') {
      const handleKeyDown = (e: KeyboardEvent) => {
        // DataWedge typically ends scan with Enter key
        if (e.key === 'Enter' && manualCode) {
          handleScanComplete(manualCode);
        } else if (e.key !== 'Enter' && e.key !== 'Shift' && e.key !== 'Control' && e.key !== 'Alt') {
          // Append the character to build up the scanned code
          setManualCode((prev: string) => prev + e.key);
        }
      };
      
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [deviceInfo.isTC70, activeView, manualCode, handleScanComplete]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);
  
  // Render different scanner UIs based on active view
  const renderScannerView = () => {
    switch (activeView) {
      case 'native':
        return (
          <div>
            <NativeCamera 
              onCapture={handleScanComplete}
              onClose={onClose}
            />
            
            <div className="px-4 pb-4 pt-2">
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  className="w-full"
                  onClick={() => setActiveView('manual')}
                  variant="outline"
                >
                  <KeyboardIcon className="h-4 w-4 mr-2" />
                  Manual Entry
                </Button>
                <Button 
                  className="w-full"
                  onClick={() => setActiveView('tablet')}
                  variant="outline"
                >
                  <Scan className="h-4 w-4 mr-2" />
                  Tablet Scanner
                </Button>
              </div>
            </div>
          </div>
        );
        
      case 'tablet':
        return (
          <div>
            <TabletScannerComponent
              onCapture={handleScanComplete}
              onClose={onClose}
            />
            
            <div className="px-4 pb-4 pt-2">
              <Button 
                className="w-full"
                onClick={() => setActiveView('manual')}
                variant="outline"
              >
                <KeyboardIcon className="h-4 w-4 mr-2" />
                Manual Entry
              </Button>
            </div>
          </div>
        );
        
      case 'manual':
      default:
        return (
          <div className="p-4">
            {deviceInfo.isTC70 && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <h3 className="text-sm font-medium text-blue-800">TC70 Device Detected</h3>
                <p className="text-xs text-blue-700 mt-1">
                  Use the hardware scanner button or enter the barcode manually below.
                </p>
              </div>
            )}
            
            <form onSubmit={handleManualSubmit}>
              <div className="space-y-4">
                <div className="grid w-full items-center gap-1.5">
                  <label htmlFor="barcode" className="text-sm font-medium leading-none">
                    Barcode
                  </label>
                  <input
                    type="text"
                    id="barcode"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Enter barcode value"
                    autoFocus
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Button type="submit" disabled={!manualCode.trim()}>
                    Submit Code
                  </Button>
                  
                  {!deviceInfo.isTC70 && deviceInfo.supportsCamera && (
                    <div className="pt-4 border-t mt-2">
                      <h3 className="text-sm font-medium mb-2">Try a different scanner:</h3>
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setActiveView('native')}
                          className="text-xs"
                          size="sm"
                        >
                          <Smartphone className="h-3 w-3 mr-1" />
                          Native Camera
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setActiveView('tablet')}
                          className="text-xs"
                          size="sm"
                        >
                          <TabletSmartphone className="h-3 w-3 mr-1" />
                          Tablet Scanner
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </form>
          </div>
        );
    }
  };
  
  return (
    <Dialog 
      open={true} 
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        {renderScannerView()}
      </DialogContent>
    </Dialog>
  );
}