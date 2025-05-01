import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useToast } from "@/hooks/use-toast";

// Scanner context interface
type ScannerContextType = {
  // Scanner state
  isScanning: boolean;
  scanResult: string | null;
  scanMode: 'native' | 'tablet' | 'manual' | 'hardware';
  
  // Device info
  deviceInfo: {
    isTC70: boolean;
    isTablet: boolean;
    isMobile: boolean;
    supportsCamera: boolean;
  };
  
  // Scanner actions
  startScanning: (mode?: 'native' | 'tablet' | 'manual' | 'hardware') => void;
  stopScanning: () => void;
  setScanResult: (result: string | null) => void;
  
  // UI state
  showScannerModal: boolean;
  openScannerModal: () => void;
  closeScannerModal: () => void;
};

// Create context with default values
const ScannerContext = createContext<ScannerContextType | null>(null);

// Context provider component
export function ScannerProvider({ children }: { children: ReactNode }) {
  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<'native' | 'tablet' | 'manual' | 'hardware'>('native');
  const [showScannerModal, setShowScannerModal] = useState(false);
  
  // Device detection
  const [deviceInfo, setDeviceInfo] = useState({
    isTC70: false,
    isTablet: false,
    isMobile: false,
    supportsCamera: false,
  });
  
  const { toast } = useToast();
  
  // Detect device capabilities on mount
  useEffect(() => {
    detectDeviceCapabilities();
  }, []);
  
  // Device detection function
  const detectDeviceCapabilities = () => {
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
    
    // Check for tablet
    const isTabletDevice = 
      /iPad/.test(userAgent) || 
      (/Android/.test(userAgent) && !/Mobile/.test(userAgent)) ||
      (screenWidth >= 600 && screenHeight >= 600);
    
    // Detect mobile
    const isMobileDevice = 
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    
    // Check for camera support
    const supportsCamera = 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices;
    
    // Determine if device is TC70
    const isTC70Device = isLikelyDatawedgeDevice || hasTC70Dimensions;
    
    // Set device info
    setDeviceInfo({
      isTC70: isTC70Device,
      isTablet: isTabletDevice,
      isMobile: isMobileDevice,
      supportsCamera: supportsCamera
    });
    
    // Automatically set the best scanner mode for the device
    if (isTC70Device) {
      setScanMode('hardware');
    } else if (isTabletDevice && supportsCamera) {
      setScanMode('tablet');
    } else if (supportsCamera) {
      setScanMode('native');
    } else {
      setScanMode('manual');
    }
    
    // Log device detection info
    console.log("Device detection:", {
      userAgent,
      dimensions: { width: screenWidth, height: screenHeight },
      isTC70: isTC70Device,
      isTablet: isTabletDevice,
      isMobile: isMobileDevice,
      supportsCamera
    });
  };
  
  // Start scanning with specified mode or default for device
  const startScanning = (mode?: 'native' | 'tablet' | 'manual' | 'hardware') => {
    if (mode) {
      setScanMode(mode);
    }
    
    setIsScanning(true);
    
    toast({
      title: "Scanner Active",
      description: "Ready to scan barcodes"
    });
  };
  
  // Stop scanning
  const stopScanning = () => {
    setIsScanning(false);
  };
  
  // Open scanner modal
  const openScannerModal = () => {
    setShowScannerModal(true);
  };
  
  // Close scanner modal
  const closeScannerModal = () => {
    setShowScannerModal(false);
    stopScanning();
  };
  
  // Context value
  const contextValue: ScannerContextType = {
    isScanning,
    scanResult,
    scanMode,
    deviceInfo,
    startScanning,
    stopScanning,
    setScanResult,
    showScannerModal,
    openScannerModal,
    closeScannerModal
  };
  
  return (
    <ScannerContext.Provider value={contextValue}>
      {children}
    </ScannerContext.Provider>
  );
}

// Custom hook to use scanner context
export function useScanner() {
  const context = useContext(ScannerContext);
  
  if (!context) {
    throw new Error("useScanner must be used within a ScannerProvider");
  }
  
  return context;
}