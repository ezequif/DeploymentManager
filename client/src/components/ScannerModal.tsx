import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { KeyboardIcon } from "lucide-react";
import NativeCamera from "./NativeCamera";

interface ScannerModalProps {
  onClose: () => void;
  onScan?: (result: string) => void;
}

export default function ScannerModal({ onClose, onScan }: ScannerModalProps) {
  const [manualEntry, setManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [isTC70, setIsTC70] = useState(false);
  const { toast } = useToast();

  // Check for TC70 device on mount
  useEffect(() => {
    // Check if this might be a TC70/TC75 device (based on user agent or screen size)
    const userAgent = navigator.userAgent;
    const isLikelyDatawedgeDevice = 
      userAgent.includes("Android") && 
      (userAgent.includes("TC") || 
      userAgent.includes("MC") || 
      userAgent.includes("ET"));
    
    // Also consider screen dimensions as a TC70 heuristic
    const hasTC70Dimensions = 
      window.screen.width <= 800 && 
      window.screen.height <= 800 &&
      window.screen.width >= 400;
    
    // Store these values for later use
    const isTC70Device = isLikelyDatawedgeDevice || hasTC70Dimensions;
    setIsTC70(isTC70Device);
    
    // Log device info for debugging
    console.log("Device info:", {
      userAgent,
      isTC70: isTC70Device,
      protocol: window.location.protocol,
      hostname: window.location.hostname,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height
    });
    
    // For TC70 devices with built-in scanners, use manual entry and keyboard listener
    if (isTC70Device) {
      setManualEntry(true);
      
      // Listen for barcode scan events from hardware scanner
      // TC70 with DataWedge often sends events as keyboard input
      const handleKeyDown = (e: KeyboardEvent) => {
        // DataWedge typically finishes with an Enter key
        if (e.key === "Enter" && manualCode) {
          if (onScan) {
            onScan(manualCode);
          }
          onClose();
        }
      };
      
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [manualCode, onClose, onScan]);

  // Handle manual code submission
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode) {
      toast({
        title: "No code entered",
        description: "Please enter a barcode value",
        variant: "destructive"
      });
      return;
    }
    
    if (onScan) {
      onScan(manualCode);
    }
    onClose();
  };

  // Handle successful scan
  const handleScan = (code: string) => {
    if (onScan) {
      onScan(code);
    }
    onClose();
  };

  return (
    <Dialog 
      open={true} 
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan Barcode</DialogTitle>
        </DialogHeader>
        
        {manualEntry ? (
          <div className="p-4">
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
                  <Button type="submit" disabled={!manualCode}>
                    Submit Code
                  </Button>
                  {!isTC70 && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setManualEntry(false)}
                    >
                      Use Camera Scanner
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </div>
        ) : (
          <div>
            {/* Native camera component for all devices */}
            <NativeCamera
              onCapture={handleScan}
              onClose={onClose}
            />
            
            <div className="p-4">
              <Button 
                className="w-full"
                onClick={() => setManualEntry(true)}
              >
                <KeyboardIcon className="h-4 w-4 mr-2" />
                Manual Entry
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}