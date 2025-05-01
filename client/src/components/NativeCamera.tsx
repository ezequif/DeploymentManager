import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { CameraIcon, RotateCw, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Quagga from "@ericblade/quagga2";

interface NativeCameraProps {
  onCapture: (data: string) => void;
  onClose: () => void;
}

export default function NativeCamera({ onCapture, onClose }: NativeCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [error, setError] = useState<string>("");
  const [manualCode, setManualCode] = useState("");
  const { toast } = useToast();

  // Initialize camera on component mount
  useEffect(() => {
    startCamera();
    
    // Cleanup function to stop camera when component unmounts
    return () => {
      stopCamera();
      // Make sure to stop Quagga
      Quagga.stop();
    };
  }, []);

  // Get list of available cameras
  const getCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      setAvailableCameras(cameras);
      console.log("Available cameras:", cameras);
    } catch (err) {
      console.error("Error getting camera list:", err);
    }
  };

  // Start camera with Quagga barcode detection
  const startCamera = async () => {
    try {
      // Stop any existing stream and Quagga instance
      stopCamera();
      try {
        Quagga.stop();
      } catch (e) {
        // Ignore errors on stop
      }
      
      // Get list of cameras first
      await getCameras();
      
      console.log("Starting camera with index:", currentCameraIndex);
      
      // Configuration for device selection
      let deviceId = undefined;
      if (availableCameras.length > 0 && currentCameraIndex < availableCameras.length) {
        deviceId = availableCameras[currentCameraIndex].deviceId;
        console.log("Selected camera:", availableCameras[currentCameraIndex].label);
      }
      
      // Make sure video element exists
      const videoElement = videoRef.current;
      if (!videoElement) {
        throw new Error("Video element not found");
      }
      
      // Initialize Quagga with our configuration
      await Quagga.init({
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: videoElement,
          constraints: {
            facingMode: "environment",
            deviceId: deviceId ? { exact: deviceId } : undefined,
            width: { min: 640 },
            height: { min: 480 },
            aspectRatio: { min: 1, max: 2 }
          }
        },
        locator: {
          patchSize: "medium",
          halfSample: true
        },
        numOfWorkers: 2,
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
          ]
        },
        locate: true
      });
      
      // Start Quagga
      Quagga.start();
      console.log("Quagga started");
      
      // Use Quagga's stream directly
      try {
        if (Quagga.CameraAccess) {
          const track = Quagga.CameraAccess.getActiveTrack();
          if (track) {
            // Access the MediaStream directly - Quagga exposes this differently
            // than the TypeScript definitions suggest
            const stream = (track as any).getOriginalVideoTrack
              ? (track as any).getOriginalVideoTrack().getMediaStream()
              : new MediaStream([track]);
              
            setCameraStream(stream);
            setError("");
            
            toast({
              title: "Scanner Ready",
              description: "Position barcode in frame for automatic detection"
            });
          }
        }
      } catch (streamErr) {
        console.error("Could not access camera stream:", streamErr);
        // Just continue, we still have Quagga working
      }
      
      // Set up barcode detection handler
      Quagga.onDetected((result) => {
        if (result && result.codeResult && result.codeResult.code) {
          console.log("Barcode detected:", result.codeResult.code);
          // Only process if code is alphanumeric and reasonable length
          if (/^[a-zA-Z0-9\-\_]{5,20}$/.test(result.codeResult.code)) {
            // Stop scanning
            Quagga.stop();
            
            // Signal successful scan with haptic feedback if available
            if (navigator.vibrate) {
              navigator.vibrate(100);
            }
            
            // Notify success
            toast({
              title: "Barcode Detected",
              description: `${result.codeResult.code}`
            });
            
            // Return the barcode value
            onCapture(result.codeResult.code);
          }
        }
      });
    } catch (err) {
      console.error("Error initializing camera/Quagga:", err);
      setError("Camera access failed. Please ensure camera permissions are granted.");
      toast({
        title: "Scanner Error",
        description: "Could not access camera. Try manual entry.",
        variant: "destructive"
      });
    }
  };

  // Switch to next available camera
  const switchCamera = async () => {
    if (availableCameras.length <= 1) return;
    
    const nextIndex = (currentCameraIndex + 1) % availableCameras.length;
    setCurrentCameraIndex(nextIndex);
    
    // Stop current stream before starting new one
    stopCamera();
    
    // Short delay to ensure camera is fully stopped
    setTimeout(() => {
      startCamera();
    }, 300);
  };

  // Stop camera stream
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Capture photo and process with Quagga
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !cameraStream) {
      toast({
        title: "Cannot Capture Photo",
        description: "Camera is not ready",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Set canvas size to match video dimensions
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw current video frame to canvas
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Could not get canvas context");
      }
      
      // Draw video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Get image data for processing
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      console.log("Image captured for processing");
      
      // Notify user
      toast({
        title: "Processing Image",
        description: "Looking for barcodes..."
      });
      
      // Process the image using Quagga
      Quagga.decodeSingle({
        src: canvas.toDataURL(),
        numOfWorkers: 0,  // Use main thread
        inputStream: {
          size: Math.max(canvas.width, canvas.height)
        },
        decoder: {
          // Enable multiple barcode formats for better results
          readers: [
            "code_128_reader", 
            "ean_reader", 
            "ean_8_reader", 
            "code_39_reader", 
            "code_93_reader", 
            "upc_reader", 
            "upc_e_reader", 
            "i2of5_reader",
            "2of5_reader",
            "codabar_reader"
          ]
        },
        locate: true
      }, function(result) {
        if (result && result.codeResult && result.codeResult.code) {
          const code = result.codeResult.code;
          console.log("Barcode detected in image:", code);
          
          // Signal successful scan
          if (navigator.vibrate) {
            navigator.vibrate(100);
          }
          
          toast({
            title: "Barcode Found!",
            description: code
          });
          
          // Return the detected barcode
          onCapture(code);
        } else {
          console.log("No barcode detected in image");
          toast({
            title: "No Barcode Found",
            description: "Try again or enter manually",
            variant: "destructive"
          });
        }
      });
    } catch (err) {
      console.error("Error capturing/processing photo:", err);
      toast({
        title: "Processing Failed",
        description: "Could not process image",
        variant: "destructive"
      });
    }
  };

  // Handle manual barcode submission
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) {
      toast({
        title: "Empty Code",
        description: "Please enter a barcode",
        variant: "destructive"
      });
      return;
    }
    
    onCapture(manualCode);
  };

  return (
    <div className="flex flex-col w-full gap-4">
      {/* Camera preview */}
      <div className="relative aspect-video w-full bg-gray-900 rounded-lg overflow-hidden">
        {/* Video element */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        
        {/* Overlay targeting guides */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-2/3 h-1/2 border-2 border-primary rounded-lg">
            <div className="text-white text-center text-sm bg-black/30 rounded p-1">
              Position barcode here
            </div>
          </div>
        </div>
        
        {/* Error overlay */}
        {error && error.length > 0 && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4">
            <div className="bg-white p-4 rounded-lg max-w-xs">
              <h3 className="font-medium text-red-500 mb-2">Camera Error</h3>
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
      
      {/* Hidden canvas for processing */}
      <canvas ref={canvasRef} className="hidden"></canvas>
      
      {/* Control buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={capturePhoto}
          className="py-6 flex items-center justify-center space-x-2"
          disabled={!cameraStream}
        >
          <CameraIcon className="w-5 h-5 mr-2" />
          Capture Photo
        </Button>
        
        <Button
          onClick={switchCamera}
          variant="outline"
          className="py-6 flex items-center justify-center space-x-2"
          disabled={availableCameras.length <= 1}
        >
          <RefreshCw className="w-5 h-5 mr-2" />
          Switch Camera
        </Button>
      </div>
      
      {/* Manual entry */}
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
      
      {/* Cancel button */}
      <Button variant="ghost" onClick={onClose} className="mt-2">
        Cancel
      </Button>
    </div>
  );
}