import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface TabletScannerProps {
  onCapture: (barcode: string) => void;
  onClose: () => void;
}

export default function TabletScannerComponent({ onCapture, onClose }: TabletScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasStream, setHasStream] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const { toast } = useToast();

  // Initialize the camera stream when component mounts
  useEffect(() => {
    startCamera();
    
    // Clean up on unmount
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Start the camera with simplified constraints
  const startCamera = async () => {
    try {
      // Log device info
      console.log("Starting TabletScannerComponent camera", {
        userAgent: navigator.userAgent,
        protocol: window.location.protocol,
        hostname: window.location.hostname
      });
      
      // Most basic constraints possible
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setHasStream(true);
        setError(null);
        
        // Log which camera is being used
        const videoTrack = stream.getVideoTracks()[0];
        console.log("Camera started:", videoTrack.label);
        console.log("Camera settings:", videoTrack.getSettings());
        
        toast({
          title: "Camera Ready",
          description: "Position barcode in frame and tap capture button"
        });
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Could not access camera. Please check permissions or try manual entry.");
      toast({
        title: "Camera Error",
        description: "Could not access camera. Please use manual entry.",
        variant: "destructive"
      });
    }
  };

  // Take a photo from the video stream
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !hasStream) {
      toast({
        title: "Cannot Capture",
        description: "Camera not ready. Please try again.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw the current video frame to the canvas
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Could not get canvas context");
      }
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // For now, we'll use manual entry since we don't have barcode detection
      // In a real implementation, this is where you would process the image
      toast({
        title: "Photo Captured",
        description: "Please enter the barcode manually"
      });
      
      // Convert to data URL for debugging
      const imageData = canvas.toDataURL("image/jpeg");
      console.log("Image captured:", imageData.substring(0, 50) + "...");
    } catch (err) {
      console.error("Error capturing photo:", err);
      toast({
        title: "Capture Failed",
        description: "Could not take photo. Please try manual entry.",
        variant: "destructive"
      });
    }
  };

  // Handle manual code submission
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
    
    onCapture(manualCode);
    toast({
      title: "Code Accepted",
      description: `Barcode: ${manualCode}`
    });
  };

  return (
    <div className="flex flex-col w-full">
      {/* Camera view */}
      <div className="relative w-full h-[300px] bg-gray-100 rounded-lg overflow-hidden mb-4">
        <video 
          ref={videoRef}
          className="w-full h-full object-cover"
          autoPlay
          playsInline
          muted
        />
        
        {/* Overlay for targeting */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-2/3 h-1/3 border-2 border-primary rounded-lg">
            <div className="text-white text-center text-sm bg-black/30 rounded p-1">
              Position barcode here
            </div>
          </div>
        </div>
        
        {/* Corner markers */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-primary"></div>
        <div className="absolute top-0 left-0 bottom-0 w-1 bg-primary"></div>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary"></div>
        <div className="absolute top-0 right-0 bottom-0 w-1 bg-primary"></div>
        
        {/* Error message overlay */}
        {error && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4">
            <div className="bg-white p-4 rounded-lg max-w-xs">
              <h3 className="font-medium text-red-500 mb-2">Camera Error</h3>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Hidden canvas for image processing */}
      <canvas ref={canvasRef} className="hidden"></canvas>
      
      {/* Controls */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Button
          onClick={capturePhoto}
          className="w-full py-6 text-lg"
          disabled={!hasStream}
        >
          Capture Photo
        </Button>
        <Button
          onClick={onClose}
          variant="outline"
          className="w-full"
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