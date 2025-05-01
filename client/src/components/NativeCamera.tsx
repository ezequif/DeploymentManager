import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { CameraIcon, RotateCw, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const { toast } = useToast();

  // Initialize camera on component mount
  useEffect(() => {
    startCamera();
    
    // Cleanup function to stop camera when component unmounts
    return () => {
      stopCamera();
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

  // Start camera with the current selected camera
  const startCamera = async () => {
    try {
      // Stop any existing stream first
      stopCamera();
      
      // Get list of cameras first
      await getCameras();
      
      console.log("Starting camera with index:", currentCameraIndex);
      
      // Try to select back camera for mobile devices
      let constraints: MediaStreamConstraints = {
        video: { 
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };
      
      // If we have camera information and it's not the first time,
      // use the selected camera's deviceId
      if (availableCameras.length > 0 && currentCameraIndex < availableCameras.length) {
        const selectedCamera = availableCameras[currentCameraIndex];
        console.log("Selected camera:", selectedCamera.label);
        
        constraints = {
          video: { 
            deviceId: { exact: selectedCamera.deviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        };
      }
      
      // Get user media with constraints
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Set stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraStream(stream);
        setError(null);
        
        // Log which camera is being used
        if (stream.getVideoTracks().length > 0) {
          console.log("Using camera:", stream.getVideoTracks()[0].label);
        }
        
        toast({
          title: "Camera Ready",
          description: "Position barcode in frame and press capture"
        });
      }
    } catch (err) {
      console.error("Error starting camera:", err);
      setError("Camera access failed. Please ensure camera permissions are granted.");
      toast({
        title: "Camera Error",
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

  // Capture photo from camera
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
      
      // Get image data
      const imageData = canvas.toDataURL("image/jpeg");
      console.log("Image captured");
      
      // For now, we just prompt for manual entry
      // In a real implementation, we would process this image for barcode detection
      toast({
        title: "Image Captured",
        description: "Please enter barcode manually"
      });
    } catch (err) {
      console.error("Error capturing photo:", err);
      toast({
        title: "Capture Failed",
        description: "Could not take photo",
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
        {error && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4">
            <div className="bg-white p-4 rounded-lg max-w-xs">
              <h3 className="font-medium text-red-500 mb-2">Camera Error</h3>
              <p className="text-sm">{error}</p>
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