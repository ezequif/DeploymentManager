import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { KeyboardIcon, Smartphone, Scan, TabletSmartphone } from "lucide-react";
import NativeCamera from "./NativeCamera";
import TabletScannerComponent from "./TabletScannerComponent";

interface ScannerModalProps {
  onClose: () => void;
  onScan?: (result: string) => void;
}

export default function ScannerModal({ onClose, onScan }: ScannerModalProps) {
  const [manualEntry, setManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [scanMode, setScanMode] = useState<"manual" | "native" | "tablet">("native");
  const [deviceInfo, setDeviceInfo] = useState({
    isTC70: false,
    isAndroidTablet: false,
    isMobile: false
  });
  const { toast } = useToast();

  // Device detection on component mount
  useEffect(() => {
    // Get device details
    const userAgent = navigator.userAgent;
    const screenWidth = window.innerWidth || window.screen.width;
    const screenHeight = window.innerHeight || window.screen.height;
    
    // TC70/Datawedge detection (handheld scanners)
    const isLikelyDatawedgeDevice = 
      userAgent.includes("Android") && 
      (userAgent.includes("TC") || 
      userAgent.includes("MC") || 
      userAgent.includes("ET"));
    
    // TC70 dimensions heuristic
    const hasTC70Dimensions = 
      screenWidth <= 800 && 
      screenHeight <= 800 &&
      screenWidth >= 400;
    
    // Check for Android tablet
    const isTablet = 
      /iPad/.test(userAgent) || 
      (/Android/.test(userAgent) && !/Mobile/.test(userAgent)) ||
      (screenWidth >= 600 && screenHeight >= 600);
    
    // Detect mobile
    const isMobileDevice = 
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    
    // Determine device type
    const isTC70Device = isLikelyDatawedgeDevice || hasTC70Dimensions;
    const isAndroid = /Android/.test(userAgent);
    const isAndroidTabletDevice = isAndroid && isTablet;
    
    // Save device info
    setDeviceInfo({
      isTC70: isTC70Device,
      isAndroidTablet: isAndroidTabletDevice,
      isMobile: isMobileDevice
    });
    
    // Log device info for debugging
    console.log("Device detection:", {
      userAgent,
      isAndroid,
      isTablet,
      isTC70: isTC70Device,
      isAndroidTablet: isAndroidTabletDevice,
      isMobile: isMobileDevice,
      protocol: window.location.protocol,
      hostname: window.location.hostname,
      screenWidth: screenWidth,
      screenHeight: screenHeight
    });
    
    // Choose appropriate default scanning mode
    if (isTC70Device) {
      // TC70 devices use keyboard scanner through DataWedge
      setScanMode("manual");
      
      // Set up keyboard listener for TC70 hardware scanner
      const handleDataWedgeScan = (e: KeyboardEvent) => {
        // DataWedge sends keystrokes and ends with Enter
        if (e.key === "Enter" && manualCode) {
          if (onScan) {
            onScan(manualCode);
          }
          onClose();
        }
      };
      
      document.addEventListener("keydown", handleDataWedgeScan);
      return () => {
        document.removeEventListener("keydown", handleDataWedgeScan);
      };
    } else if (isAndroidTabletDevice) {
      // Android tablets work better with simplified Quagga scanner
      setScanMode("tablet");
    } else {
      // All other devices use native camera
      setScanMode("native");
    }
  }, [manualCode, onClose, onScan]);

  // Handle manual barcode submission
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

  // Handle successful scan from any scanner component
  const handleScan = (code: string) => {
    console.log("Scan received:", code);
    if (onScan) {
      onScan(code);
    }
    onClose();
  };

  // Render the appropriate scanner UI based on mode
  const renderScannerContent = () => {
    switch (scanMode) {
      case "manual":
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
                  <Button type="submit" disabled={!manualCode}>
                    Submit Code
                  </Button>
                  
                  {!deviceInfo.isTC70 && (
                    <div className="pt-4 border-t mt-2">
                      <h3 className="text-sm font-medium mb-2">Try a different scanner:</h3>
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setScanMode("native")}
                          className="text-xs"
                          size="sm"
                        >
                          <Smartphone className="h-3 w-3 mr-1" />
                          Native Camera
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setScanMode("tablet")}
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
        
      case "tablet":
        return (
          <div>
            <TabletScannerComponent
              onCapture={handleScan}
              onClose={onClose}
            />
            
            <div className="px-4 pb-4 pt-2">
              <Button 
                className="w-full"
                onClick={() => setScanMode("manual")}
                variant="outline"
              >
                <KeyboardIcon className="h-4 w-4 mr-2" />
                Manual Entry
              </Button>
            </div>
          </div>
        );
        
      case "native":
      default:
        return (
          <div>
            <NativeCamera
              onCapture={handleScan}
              onClose={onClose}
            />
            
            <div className="px-4 pb-4 pt-2">
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  className="w-full"
                  onClick={() => setScanMode("manual")}
                  variant="outline"
                >
                  <KeyboardIcon className="h-4 w-4 mr-2" />
                  Manual Entry
                </Button>
                <Button 
                  className="w-full"
                  onClick={() => setScanMode("tablet")}
                  variant="outline"
                >
                  <Scan className="h-4 w-4 mr-2" />
                  Tablet Scanner
                </Button>
              </div>
            </div>
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
          <DialogTitle>Scan Barcode</DialogTitle>
        </DialogHeader>
        
        {renderScannerContent()}
      </DialogContent>
    </Dialog>
  );
}