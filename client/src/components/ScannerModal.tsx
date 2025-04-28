import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Quagga from "quagga";
import { useToast } from "@/hooks/use-toast";
import { ScanLineIcon, QrCodeIcon, CameraIcon, KeyboardIcon, SwitchCameraIcon } from "lucide-react";

interface ScannerModalProps {
  onClose: () => void;
  onScan?: (result: string) => void;
}

export default function ScannerModal({ onClose, onScan }: ScannerModalProps) {
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [manualEntry, setManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [isTC70, setIsTC70] = useState(false);
  const scannerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Initialize scanner and check for cameras
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
    
    setIsTC70(isLikelyDatawedgeDevice || hasTC70Dimensions);
    
    // If it's a TC70, go straight to manual entry mode since it has a built-in scanner
    if (isLikelyDatawedgeDevice || hasTC70Dimensions) {
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
    
    // Regular browser flow
    if (!manualEntry) {
      navigator.mediaDevices.enumerateDevices()
        .then(devices => {
          const videoDevices = devices.filter(device => device.kind === 'videoinput');
          setCameras(videoDevices);
          
          if (videoDevices.length > 0) {
            initScanner(videoDevices[currentCameraIndex].deviceId);
          } else {
            toast({
              title: "No cameras found",
              description: "Please use manual entry instead.",
              variant: "destructive"
            });
            setManualEntry(true);
          }
        })
        .catch(error => {
          console.error("Error accessing cameras:", error);
          toast({
            title: "Camera access error",
            description: "Could not access cameras. Please use manual entry.",
            variant: "destructive"
          });
          setManualEntry(true);
        });
    }
    
    return () => {
      Quagga.stop();
    };
  }, [currentCameraIndex, manualEntry]);

  // Initialize Quagga scanner
  const initScanner = (deviceId: string) => {
    if (scannerRef.current) {
      Quagga.init({
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: scannerRef.current,
          constraints: {
            deviceId,
            width: 480,
            height: 320,
            facingMode: "environment"
          },
        },
        decoder: {
          readers: ["code_128_reader", "ean_reader", "ean_8_reader", "code_39_reader", "code_39_vin_reader", "codabar_reader", "upc_reader", "upc_e_reader", "i2of5_reader"],
          multiple: false
        },
        locate: true
      }, function(err) {
        if (err) {
          console.error("Error initializing Quagga:", err);
          toast({
            title: "Scanner Error",
            description: "Could not initialize barcode scanner. Please use manual entry.",
            variant: "destructive"
          });
          setManualEntry(true);
          return;
        }
        
        Quagga.start();
      });
      
      Quagga.onDetected((result) => {
        if (result.codeResult && result.codeResult.code) {
          const code = result.codeResult.code;
          setScanResult(code);
          
          // Play success sound
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
          const gainNode = audioContext.createGain();
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.1);
          
          // Pause for a moment to show result, then close
          setTimeout(() => {
            toast({
              title: "Code Scanned",
              description: `Scanned code: ${code}`
            });
            
            // Call the onScan callback if provided
            if (onScan) {
              onScan(code);
            }
            
            onClose();
          }, 1500);
        }
      });
    }
  };

  // Switch camera
  const switchCamera = () => {
    Quagga.stop();
    setCurrentCameraIndex((prev) => (prev + 1) % cameras.length);
  };
  
  // Handle manual entry submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      toast({
        title: "Code Entered",
        description: `Entered code: ${manualCode}`
      });
      
      // Call the onScan callback if provided
      if (onScan) {
        onScan(manualCode);
      }
      
      onClose();
    } else {
      toast({
        title: "Invalid Code",
        description: "Please enter a valid code",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            {isTC70 ? <QrCodeIcon className="h-6 w-6" /> : <ScanLineIcon className="h-6 w-6" />}
            <span>{isTC70 ? "TC70 Scanner" : "Barcode Scanner"}</span>
          </DialogTitle>
        </DialogHeader>
        
        {isTC70 ? (
          // TC70-optimized UI with larger touch targets
          <div className="p-4">
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <QrCodeIcon className="h-8 w-8 text-blue-500" />
                <div>
                  <h3 className="font-medium text-blue-800">Hardware Scanner</h3>
                  <p className="text-sm text-blue-600">
                    Press the side scan button on your device or enter code below
                  </p>
                </div>
              </div>
            </div>
            
            <form onSubmit={handleManualSubmit}>
              <div className="mb-4">
                <label htmlFor="manualCode" className="block text-base font-medium text-gray-700 mb-2">
                  Barcode Value
                </label>
                <input
                  id="manualCode"
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="Scan or type barcode"
                  autoFocus
                />
              </div>
              <Button 
                type="submit" 
                className="w-full h-14 text-lg bg-secondary hover:bg-secondary/90"
                disabled={!manualCode.trim()}
              >
                Submit
              </Button>
            </form>
          </div>
        ) : (
          // Regular browser view - camera or manual entry options
          manualEntry ? (
            <div className="p-4">
              <form onSubmit={handleManualSubmit}>
                <div className="mb-4">
                  <label htmlFor="manualCode" className="block text-sm font-medium text-gray-700 mb-1">
                    Enter Code Manually
                  </label>
                  <input
                    id="manualCode"
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="Enter barcode value"
                    autoFocus
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button 
                    type="button" 
                    variant="outline"
                    className="w-full"
                    onClick={() => setManualEntry(false)}
                  >
                    <CameraIcon className="h-4 w-4 mr-2" />
                    Use Camera
                  </Button>
                  <Button type="submit" className="w-full" disabled={!manualCode.trim()}>
                    Submit
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            <div className="p-4">
              <div 
                ref={scannerRef} 
                className="bg-gray-100 rounded-lg h-64 flex items-center justify-center mb-4 relative overflow-hidden"
              >
                <div className="w-full h-full">
                  {/* Camera view is injected here by Quagga */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-3/4 h-1/2 border-2 border-primary rounded-lg flex items-center justify-center">
                      {!scanResult && (
                        <div className="text-gray-400">Center the barcode in the box</div>
                      )}
                    </div>
                  </div>
                  <div className="absolute top-0 left-0 right-0 h-1 bg-primary"></div>
                  <div className="absolute top-0 left-0 bottom-0 w-1 bg-primary"></div>
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary"></div>
                  <div className="absolute top-0 right-0 bottom-0 w-1 bg-primary"></div>
                </div>
              </div>
              <div className="text-center mb-4">
                <p className="text-gray-600 mb-2">Center the barcode in the box above</p>
                <div className="font-medium text-lg text-primary">
                  {scanResult ? scanResult : "Ready to scan"}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={switchCamera}
                  disabled={cameras.length <= 1}
                >
                  <SwitchCameraIcon className="h-4 w-4 mr-2" />
                  Switch Camera
                </Button>
                <Button 
                  className="w-full"
                  onClick={() => setManualEntry(true)}
                >
                  <KeyboardIcon className="h-4 w-4 mr-2" />
                  Manual Entry
                </Button>
              </div>
            </div>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
