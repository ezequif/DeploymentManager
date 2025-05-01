import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import Quagga from "@ericblade/quagga2";
import { CameraIcon, RotateCw } from "lucide-react";

interface TabletScannerProps {
  onCapture: (barcode: string) => void;
  onClose: () => void;
}

export default function TabletScannerComponent({ onCapture, onClose }: TabletScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scannerRef = useRef<HTMLDivElement>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string>("");
  const [manualCode, setManualCode] = useState("");
  const { toast } = useToast();

  // Initialize scanning when component mounts
  useEffect(() => {
    // Cleanup function to stop Quagga when component unmounts
    return () => {
      if (scanning) {
        Quagga.stop();
      }
    };
  }, [scanning]);

  // Start the Quagga scanner with simplified settings
  const startScanner = async () => {
    try {
      // Make sure the scanner container exists
      if (!scannerRef.current) {
        throw new Error("Scanner container not found");
      }

      // Log device info
      console.log("Starting Quagga in TabletScannerComponent", {
        userAgent: navigator.userAgent,
        protocol: window.location.protocol,
        hostname: window.location.hostname
      });
      
      // Stop if already scanning
      if (scanning) {
        Quagga.stop();
      }
      
      // Configure and initialize Quagga with simplified settings
      await Quagga.init({
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: scannerRef.current,
          constraints: {
            facingMode: "environment",
            width: { min: 450 },
            height: { min: 300 },
            aspectRatio: { min: 1, max: 2 }
          },
          area: { // Only scan middle 80% of the detection area
            top: "10%",
            right: "10%",
            left: "10%",
            bottom: "10%"
          }
        },
        locator: {
          patchSize: "medium",
          halfSample: true
        },
        numOfWorkers: navigator.hardwareConcurrency 
          ? Math.min(navigator.hardwareConcurrency - 1, 4) 
          : 1,
        frequency: 10,
        decoder: {
          readers: [
            "code_128_reader",
            "ean_reader",
            "ean_8_reader",
            "code_39_reader",
            "code_93_reader",
            "upc_reader",
            "upc_e_reader",
            "i2of5_reader"
          ],
          multiple: false
        },
        locate: true
      });
      
      // Start Quagga
      Quagga.start();
      setScanning(true);
      console.log("Quagga scanner started");
      
      toast({
        title: "Scanner Active",
        description: "Position barcode in view for scanning"
      });
      
      // Set up barcode detection handler
      Quagga.onDetected((result) => {
        if (result && result.codeResult && result.codeResult.code) {
          const code = result.codeResult.code;
          console.log("Barcode detected:", code);
          
          // Validate the barcode (simple length check)
          if (code.length >= 5 && code.length <= 30) {
            // Stop scanning
            Quagga.stop();
            setScanning(false);
            
            // Provide haptic feedback if available
            if (navigator.vibrate) {
              navigator.vibrate(100);
            }
            
            // Notify success
            toast({
              title: "Barcode Detected!",
              description: code
            });
            
            // Return the barcode
            onCapture(code);
          }
        }
      });
      
      // Add debug info to show processed images
      Quagga.onProcessed((result: any) => {
        // Safety check for Quagga canvas
        if (!result || !Quagga.canvas || !Quagga.canvas.ctx || !Quagga.canvas.dom) {
          return;
        }
        
        const drawingCtx = Quagga.canvas.ctx.overlay;
        const drawingCanvas = Quagga.canvas.dom.overlay;
        
        if (!drawingCtx || !drawingCanvas) {
          return;
        }
        
        // Get canvas dimensions
        const width = parseInt(drawingCanvas.getAttribute("width") || "0");
        const height = parseInt(drawingCanvas.getAttribute("height") || "0");
        
        // Clear the canvas
        drawingCtx.clearRect(0, 0, width, height);
        
        try {
          // Draw potential barcode boxes (green)
          if (result.boxes && Array.isArray(result.boxes)) {
            // Use any to bypass TypeScript strictness for Quagga types
            (result.boxes as any[]).forEach((box: any) => {
              if (Array.isArray(box) && box.length >= 4) {
                drawingCtx.strokeStyle = "rgba(0, 255, 0, 0.5)";
                drawingCtx.lineWidth = 2;
                
                // Draw the box using coordinates
                try {
                  const x = Number(box[0]);
                  const y = Number(box[1]);
                  const w = Number(box[2]) - Number(box[0]);
                  const h = Number(box[3]) - Number(box[1]);
                  
                  if (!isNaN(x) && !isNaN(y) && !isNaN(w) && !isNaN(h)) {
                    drawingCtx.strokeRect(x, y, w, h);
                  }
                } catch (e) {
                  // Ignore drawing errors
                }
              }
            });
          }
          
          // Draw the found barcode box (blue)
          if (result.box) {
            drawingCtx.strokeStyle = "rgba(0, 0, 255, 0.8)";
            drawingCtx.lineWidth = 3;
            
            // Try to handle all possible formats of result.box
            if (Array.isArray(result.box)) {
              try {
                const x = Number(result.box[0]);
                const y = Number(result.box[1]);
                const w = Number(result.box[2]) - Number(result.box[0]);
                const h = Number(result.box[3]) - Number(result.box[1]);
                
                if (!isNaN(x) && !isNaN(y) && !isNaN(w) && !isNaN(h)) {
                  drawingCtx.strokeRect(x, y, w, h);
                }
              } catch (e) {
                // Ignore drawing errors
              }
            } else {
              // Handle object format if present
              try {
                const box = result.box as any;
                if (box.x !== undefined && box.y !== undefined && 
                    box.width !== undefined && box.height !== undefined) {
                  
                  drawingCtx.strokeRect(box.x, box.y, box.width, box.height);
                }
              } catch (e) {
                // Ignore drawing errors
              }
            }
          }
          
          // Display the found code
          if (result.codeResult && result.codeResult.code) {
            drawingCtx.font = "18px Arial";
            drawingCtx.fillStyle = "rgba(0, 255, 0, 0.8)";
            drawingCtx.fillText(String(result.codeResult.code), 10, 25);
          }
        } catch (e) {
          // Catch any unexpected errors in drawing code
          console.error("Error in Quagga drawing:", e);
        }
      });
      
    } catch (err) {
      console.error("Error starting Quagga scanner:", err);
      setError("Could not start barcode scanner. Please check permissions.");
      setScanning(false);
      
      toast({
        title: "Scanner Error",
        description: "Could not start barcode scanner. Please use manual entry.",
        variant: "destructive"
      });
    }
  };

  // Handle manual barcode submission
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) {
      toast({
        title: "Invalid Code",
        description: "Please enter a valid barcode value",
        variant: "destructive"
      });
      return;
    }
    
    // Return the manually entered barcode
    onCapture(manualCode);
  };

  return (
    <div className="flex flex-col w-full">
      {/* Scanner view */}
      <div className="relative w-full h-[350px] bg-gray-900 rounded-lg overflow-hidden mb-4">
        <div 
          ref={scannerRef} 
          className="absolute inset-0 w-full h-full"
        >
          {/* Quagga will inject video here */}
          {!scanning && (
            <div className="flex items-center justify-center h-full bg-gray-800 text-gray-300">
              <div className="text-center p-4">
                <CameraIcon className="mx-auto h-12 w-12 mb-2" />
                <p>Press Start Scanner to begin</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Targeting guide */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-2/3 h-1/2 border-2 border-primary/50 border-dashed rounded-lg">
            <div className="text-white text-center text-sm bg-black/30 rounded p-1">
              Position barcode here
            </div>
          </div>
        </div>
        
        {/* Error message overlay */}
        {error && error.length > 0 && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4">
            <div className="bg-white p-4 rounded-lg max-w-xs">
              <h3 className="font-medium text-red-500 mb-2">Scanner Error</h3>
              <p className="text-sm">{error}</p>
              <Button
                onClick={() => setError("")}
                className="mt-2 w-full"
                variant="outline"
                size="sm"
              >
                Dismiss
              </Button>
            </div>
          </div>
        )}
      </div>
      
      {/* Controls */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Button
          onClick={scanning ? () => {
            Quagga.stop();
            setScanning(false);
          } : startScanner}
          className="w-full py-6 text-lg"
          variant={scanning ? "destructive" : "default"}
        >
          {scanning ? "Stop Scanner" : "Start Scanner"}
        </Button>
        <Button
          onClick={onClose}
          variant="outline"
          className="w-full py-6"
        >
          Cancel
        </Button>
      </div>
      
      {/* Manual entry form */}
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <h3 className="font-medium mb-2">Manual Entry</h3>
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            className="flex-1 border border-gray-300 rounded px-3 py-2"
            placeholder="Enter barcode"
          />
          <Button type="submit" disabled={!manualCode.trim()}>
            Submit
          </Button>
        </form>
      </div>
    </div>
  );
}