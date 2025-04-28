import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Quagga from "quagga";
import { useToast } from "@/hooks/use-toast";

interface ScannerModalProps {
  onClose: () => void;
}

export default function ScannerModal({ onClose }: ScannerModalProps) {
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [manualEntry, setManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const scannerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Initialize scanner and check for cameras
  useEffect(() => {
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Barcode Scanner</DialogTitle>
        </DialogHeader>
        
        {manualEntry ? (
          <div className="p-4">
            <form onSubmit={handleManualSubmit}>
              <div className="mb-4">
                <label htmlFor="manualCode" className="block text-sm font-medium text-gray-700 mb-1">Enter Code Manually</label>
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
              <div className="flex space-x-3">
                <Button 
                  type="button" 
                  variant="outline"
                  className="flex-1"
                  onClick={() => setManualEntry(false)}
                >
                  <span className="material-icons mr-1">camera_alt</span>
                  Use Camera
                </Button>
                <Button type="submit" className="flex-1">
                  <span className="material-icons mr-1">check</span>
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
            <div className="flex space-x-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={switchCamera}
                disabled={cameras.length <= 1}
              >
                <span className="material-icons mr-1">flip_camera_ios</span>
                Switch Camera
              </Button>
              <Button 
                className="flex-1"
                onClick={() => setManualEntry(true)}
              >
                <span className="material-icons mr-1">keyboard</span>
                Manual Entry
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
