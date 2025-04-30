import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState, useEffect } from "react";
import NotFound from "@/pages/not-found";
import Layout from "./components/Layout";
import PalletList from "./pages/PalletList";
import History from "./pages/History";
import Settings from "./pages/Settings";
import ScanPalletModal from "./components/ScanPalletModal";
import { WebSocketProvider } from "./lib/websocket";
import { SimplifiedMobileUI } from "./components/SimplifiedUI";
import { isTC70, getBrowserInfo } from "./lib/deviceDetection";

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={PalletList} />
        <Route path="/history" component={History} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isTC70Device, setIsTC70Device] = useState(false);
  
  useEffect(() => {
    // Check if this is a TC70 device when the app first loads,
    // or if the user has manually enabled TC70 mode via URL parameter
    let deviceCheck = isTC70();
    
    // Allow forcing TC70 mode via URL for testing
    if (window.location.search.includes('tc70=true') || window.location.search.includes('tc70=1')) {
      deviceCheck = true;
      console.log('TC70 mode forced via URL parameter');
    }
    
    setIsTC70Device(deviceCheck);
    
    // Log device information for debugging
    console.log('Device detection:', { 
      isTC70: deviceCheck,
      browserInfo: getBrowserInfo(),
      windowDimensions: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    });
  }, []);
  
  // Create a global function to open the scan modal
  window.openScanPalletModal = () => setIsScanModalOpen(true);
  
  return (
    <QueryClientProvider client={queryClient}>
      <WebSocketProvider>
        <TooltipProvider>
          <Toaster />
          
          {isTC70Device ? (
            // Render the simplified UI specifically optimized for TC70 devices
            <div className="h-screen bg-white">
              <SimplifiedMobileUI />
            </div>
          ) : (
            // Render standard UI for desktop and modern mobile devices
            <Router />
          )}
          
          {/* Scan Pallet Modal */}
          <ScanPalletModal
            isOpen={isScanModalOpen}
            onClose={() => setIsScanModalOpen(false)}
          />
        </TooltipProvider>
      </WebSocketProvider>
    </QueryClientProvider>
  );
}

export default App;
