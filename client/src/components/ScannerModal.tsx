import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ScanLineIcon, QrCodeIcon, CameraIcon, KeyboardIcon, SwitchCameraIcon, AlertTriangle } from "lucide-react";
import Quagga from "@ericblade/quagga2";

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
    // Check if we're on mobile - important for camera selection
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
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
    
    // Only for debugging - log device info
    console.log("Device info:", {
      userAgent,
      isMobile: isMobileDevice,
      isTC70: isTC70Device,
      protocol: window.location.protocol,
      hostname: window.location.hostname,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height
    });
    
    // If it's a TC70, go straight to manual entry mode since it has a built-in scanner
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
    
    // Regular browser flow
    if (!manualEntry) {
      try {
        // First request camera permission
        navigator.mediaDevices.getUserMedia({ video: true })
          .then(stream => {
            // Stop the stream immediately, we just needed permission
            stream.getTracks().forEach(track => track.stop());
            
            // Now enumerate devices
            return navigator.mediaDevices.enumerateDevices();
          })
          .then(devices => {
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            setCameras(videoDevices);
            
            if (videoDevices.length > 0) {
              // For mobile devices, we want to strongly prefer the back camera
              // as it's much better for barcode scanning
              
              let selectedIndex = currentCameraIndex;
              let deviceId = '';
              
              // First, try direct back camera access if we're on mobile
              if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                console.log("Mobile device detected, attempting to use back camera directly");
                
                try {
                  // First look for obvious back cameras in the labels
                  const backCameraIndex = videoDevices.findIndex(device => 
                    device.label.toLowerCase().includes('back') || 
                    device.label.toLowerCase().includes('rear') ||
                    device.label.toLowerCase().includes('environment')
                  );
                  
                  if (backCameraIndex >= 0) {
                    console.log("Found back camera by label:", videoDevices[backCameraIndex].label);
                    selectedIndex = backCameraIndex;
                    deviceId = videoDevices[backCameraIndex].deviceId;
                  } 
                  // If no obvious back camera, and multiple cameras exist, try the second one
                  // (on most phones, the second camera is the back one)
                  else if (videoDevices.length > 1) {
                    console.log("No labeled back camera, trying second camera");
                    selectedIndex = 1; // Second camera (index 1)
                    deviceId = videoDevices[1].deviceId;
                  }
                  // Last resort, just use the first camera
                  else {
                    console.log("Falling back to first camera");
                    selectedIndex = 0;
                    deviceId = videoDevices[0].deviceId;
                  }
                } catch (err) {
                  console.warn("Error selecting optimal camera:", err);
                  // Fallback to first camera
                  selectedIndex = 0;
                  deviceId = videoDevices[0].deviceId;
                }
              } else {
                // For non-mobile, just use the current or first camera
                deviceId = videoDevices[currentCameraIndex < videoDevices.length ? currentCameraIndex : 0].deviceId;
              }
              
              // Update the current camera index for UI consistency
              setCurrentCameraIndex(selectedIndex);
              console.log(`Initializing scanner with camera: ${videoDevices[selectedIndex]?.label || 'default'}`);
              initScanner(deviceId);
            } else {
              console.warn("No video devices found");
              toast({
                title: "No cameras found",
                description: "Please use manual entry instead.",
                variant: "destructive"
              });
              setManualEntry(true);
            }
          })
          .catch(error => {
            // Log the complete error for debugging
            console.error("Error accessing cameras:", error);
            console.log("Error name:", error.name);
            console.log("Error message:", error.message);
            console.log("Protocol:", window.location.protocol);
            console.log("Domain:", window.location.hostname);
            
            // Create detailed error message based on the actual error
            let errorMessage = "Could not access your device's camera.";
            
            if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
              errorMessage = "Camera access was denied. Please check your browser permissions.";
            } else if (error.name === "NotFoundError") {
              errorMessage = "No camera found on this device.";
            } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
              errorMessage = "The camera is already in use by another application.";
            } else if (error.name === "OverconstrainedError") {
              errorMessage = "The camera does not meet the required constraints.";
            } else if (error.name === "SecurityError") {
              errorMessage = "This page needs HTTPS to access the camera. Try using manual entry.";
            } else if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
              errorMessage = "Camera access requires HTTPS. Try using manual entry.";
            }
            
            // Show toast with specific error message
            toast({
              title: "Camera access error",
              description: errorMessage,
              variant: "destructive"
            });
            
            setManualEntry(true);
          });
      } catch (error) {
        console.error("Exception in camera initialization:", error);
        
        // Check if we're running in Replit environment
        const isReplitEnv = window.location.hostname.includes('replit');
        
        toast({
          title: "Camera initialization failed",
          description: isReplitEnv 
            ? "Camera access isn't available in this environment. This feature works on actual device browsers."
            : "Please use manual entry instead.",
          variant: "destructive"
        });
        
        setManualEntry(true);
      }
    }
    
    return () => {
      Quagga.stop();
    };
  }, [currentCameraIndex, manualEntry]);

  // Initialize Quagga scanner using improved Quagga2 library
  const initScanner = (deviceId: string) => {
    if (scannerRef.current) {
      try {
        console.log("Initializing Quagga2 scanner with device ID:", deviceId);
        
        // Configure scanner with optimal settings for barcode scanning
        Quagga.init({
          inputStream: {
            name: "Live",
            type: "LiveStream",
            target: scannerRef.current,
            constraints: {
              width: { min: 640, ideal: 1280, max: 1920 },
              height: { min: 480, ideal: 720, max: 1080 },
              // Full 16:9 or 4:3 aspect ratios
              aspectRatio: { min: 1, max: 2 },
              facingMode: "environment",
              // Only use deviceId if it's provided and not empty
              ...(deviceId ? { deviceId } : {})
            },
            willReadFrequently: true,
            area: { // Only scan the center 80% of the viewport
              top: "10%",
              right: "10%",
              left: "10%",
              bottom: "10%",
            },
            singleChannel: false // Use color camera for better detection
          },
          decoder: {
            readers: [
              "code_128_reader",
              "ean_reader", 
              "ean_8_reader", 
              "code_39_reader", 
              "code_39_vin_reader", 
              "codabar_reader", 
              "upc_reader", 
              "upc_e_reader", 
              "i2of5_reader"
            ],
            multiple: false,
            debug: {
              drawBoundingBox: true,
              showFrequency: true,
              drawScanline: true,
              showPattern: true
            }
            // Frequency removed as it's not supported in this version
          },
          locate: true,
          locator: {
            patchSize: "medium",
            halfSample: true
          }
        }, function(err) {
          if (err) {
            console.error("Error initializing Quagga:", err);
            
            // Check if we're running in Replit environment
            const isReplitEnv = window.location.hostname.includes('replit');
            
            toast({
              title: "Scanner Error",
              description: isReplitEnv 
                ? "Camera scanner isn't available in the Replit environment. It will work when deployed to a real device."
                : "Could not initialize barcode scanner. Please use manual entry.",
              variant: "destructive"
            });
            
            setManualEntry(true);
            return;
          }
          
          console.log("Quagga initialized successfully");
          Quagga.start();
        });
      } catch (error) {
        console.error("Exception during Quagga initialization:", error);
        
        // Check if we're running in Replit environment
        const isReplitEnv = window.location.hostname.includes('replit');
        
        toast({
          title: "Scanner Error",
          description: isReplitEnv 
            ? "Camera scanner isn't available in this preview environment. This feature works on actual device browsers."
            : "Could not initialize barcode scanner. Please use manual entry.",
          variant: "destructive"
        });
        
        setManualEntry(true);
      }
      
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
        
        {/* Add camera error info if needed */}
        {!isTC70 && !manualEntry && (
          <div className="px-4 mb-2">
            <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-sm flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Camera access required</p>
                <p className="text-blue-600 text-xs mt-1">
                  Camera access requires:
                </p>
                <ul className="text-blue-600 text-xs list-disc ml-4 mt-1">
                  <li>Browser permission (check camera access in settings)</li>
                  <li>HTTPS connection (except on localhost)</li>
                  <li>If scanning fails, try manual entry</li>
                  {window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && (
                    <li className="text-red-600 font-medium">⚠️ Current connection is {window.location.protocol.replace(':', '')} - camera may not work</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}
        
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
                id="scannerRef"
                ref={scannerRef} 
                className="bg-gray-100 rounded-lg mb-4 relative w-full h-[300px]"
              >
                {/* Quagga will inject the camera view directly into this element */}
                
                {/* Targeting guides that float above the camera view */}
                <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                  <div className="w-3/4 h-1/2 border-2 border-primary rounded-lg flex items-center justify-center">
                    {!scanResult && (
                      <div className="text-gray-400 text-center bg-black/20 px-2 py-1 rounded">
                        Center the barcode in this box
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Corner markers to indicate scanning area */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-primary z-20"></div>
                <div className="absolute top-0 left-0 bottom-0 w-1 bg-primary z-20"></div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary z-20"></div>
                <div className="absolute top-0 right-0 bottom-0 w-1 bg-primary z-20"></div>
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
