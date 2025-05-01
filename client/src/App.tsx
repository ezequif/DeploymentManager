import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";

import { TooltipProvider } from "@/components/ui/tooltip";
import { useState, useEffect } from "react";
import NotFound from "@/pages/not-found";
import Layout from "./components/Layout";
import PalletList from "./pages/PalletList";
import History from "./pages/History";
import Settings from "./pages/Settings";
import ScanPalletModal from "./components/ScanPalletModal";

import { SimplifiedMobileUI } from "./components/SimplifiedUI";
import { isTC70, getBrowserInfo } from "./lib/deviceDetection";
import { UnitProvider } from "@/hooks/use-unit-settings";
import { ScannerProvider } from "@/lib/scannerContext";

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
  const [forceStandardUI, setForceStandardUI] = useState(false);
  const [isTC70Device, setIsTC70Device] = useState(false);
  
  useEffect(() => {
    // Check localStorage first to see if user has manually switched to standard UI
    const storedPreference = localStorage.getItem('useStandardUI');
    if (storedPreference === 'true') {
      setForceStandardUI(true);
    }
    
    // Check if this is a TC70 device when the app first loads,
    // or if the user has manually enabled TC70 mode via URL parameter
    let deviceCheck = isTC70();
    
    // Allow forcing TC70 mode via URL for testing
    if (window.location.search.includes('tc70=true') || window.location.search.includes('tc70=1')) {
      deviceCheck = true;
      console.log('TC70 mode forced via URL parameter');
    }
    
    // Allow forcing standard UI via URL for testing or escaping TC70 mode
    if (window.location.search.includes('standardUI=true')) {
      setForceStandardUI(true);
      localStorage.setItem('useStandardUI', 'true');
      console.log('Standard UI forced via URL parameter');
    }
    
    setIsTC70Device(deviceCheck);
    
    // Log device information for debugging
    console.log('Device detection:', { 
      userAgent: navigator.userAgent,
      dimensions: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      isTC70: deviceCheck,
      browserInfo: getBrowserInfo(),
    });
  }, []);
  
  // Function to switch UI modes (simplified <-> standard)
  const toggleUIMode = () => {
    setForceStandardUI(prev => {
      const newValue = !prev;
      localStorage.setItem('useStandardUI', newValue.toString());
      return newValue;
    });
  };
  
  // Create a global function to open the scan modal
  // @ts-ignore - Adding global property to window
  window.openScanPalletModal = () => setIsScanModalOpen(true);
  
  return (
    <QueryClientProvider client={queryClient}>
      <UnitProvider>
        <ScannerProvider>
          <TooltipProvider>
            {isTC70Device && !forceStandardUI ? (
              // Render the simplified UI specifically optimized for TC70 devices
              <div className="h-screen bg-white">
                <SimplifiedMobileUI onSwitchToStandardUI={toggleUIMode} />
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
        </ScannerProvider>
      </UnitProvider>
    </QueryClientProvider>
  );
}

export default App;
