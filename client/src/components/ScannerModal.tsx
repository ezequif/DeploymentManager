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

  // Device detection and configuration
  const [isAndroidTablet, setIsAndroidTablet] = useState(false);
  
  useEffect(() => {
    // Check device type
    const userAgent = navigator.userAgent;
    
    // TC70/Datawedge detection (handheld scanners)
    const isLikelyDatawedgeDevice = 
      userAgent.includes("Android") && 
      (userAgent.includes("TC") || 
      userAgent.includes("MC") || 
      userAgent.includes("ET"));
    
    // TC70 dimensions heuristic
    const hasTC70Dimensions = 
      window.screen.width <= 800 && 
      window.screen.height <= 800 &&
      window.screen.width >= 400;
    
    // Check specifically for Android tablet
    const isTablet = 
      /iPad/.test(userAgent) || 
      (/Android/.test(userAgent) && !/Mobile/.test(userAgent)) ||
      (window.innerWidth >= 600 && window.innerHeight >= 600);
    
    // Determine device type with final checks
    const isTC70Device = isLikelyDatawedgeDevice || hasTC70Dimensions;
    const isAndroid = /Android/.test(userAgent);
    const isAndroidTabletDevice = isAndroid && isTablet;
    
    setIsTC70(isTC70Device);
    setIsAndroidTablet(isAndroidTabletDevice);
    
    // Automatically set to manual entry for Android tablets
    if (isAndroidTabletDevice) {
      setManualEntry(true);
      toast({
        title: "Android Tablet Detected",
        description: "Manual entry mode activated for better compatibility."
      });
    }
    
    // Log device info for debugging
    console.log("Device detection:", {
      userAgent,
      isAndroid,
      isTablet,
      isTC70: isTC70Device,
      isAndroidTablet: isAndroidTabletDevice,
      protocol: window.location.protocol,
      hostname: window.location.hostname,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height
    });
    
    // For TC70 devices with built-in scanners, configure keyboard listener
    if (isTC70Device) {
      setManualEntry(true);
      
      // Listen for barcode scan events from hardware scanner
      // TC70 with DataWedge sends events as keyboard input
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
  }, [manualCode, onClose, onScan, toast]);

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
            {isAndroidTablet && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <h3 className="text-sm font-medium text-yellow-800">Android Tablet Detected</h3>
                <p className="text-xs text-yellow-700 mt-1">
                  Manual entry mode has been activated for better compatibility with your device.
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
                  <Button type="submit" disabled={!manualCode}>
                    Submit Code
                  </Button>
                  {(!isTC70 && !isAndroidTablet) && (
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