import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState } from "react";
import NotFound from "@/pages/not-found";
import Layout from "./components/Layout";
import PalletList from "./pages/PalletList";
import History from "./pages/History";
import Settings from "./pages/Settings";
import ScanPalletModal from "./components/ScanPalletModal";
import { WebSocketProvider } from "./lib/websocket";

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
  
  // Create a global function to open the scan modal
  window.openScanPalletModal = () => setIsScanModalOpen(true);
  
  return (
    <QueryClientProvider client={queryClient}>
      <WebSocketProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
          
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
