import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { WebSocketProvider } from "./lib/websocket";
import { ScannerProvider } from "./lib/scannerContext";
import { Toaster } from "./components/ui/toaster";
import { UnitProvider } from "./hooks/use-unit-settings";
import { PowerSavingProvider } from "./hooks/use-power-saving";

createRoot(document.getElementById("root")!).render(
  <PowerSavingProvider>
    <WebSocketProvider>
      <UnitProvider>
        <ScannerProvider>
          <App />
          <Toaster />
        </ScannerProvider>
      </UnitProvider>
    </WebSocketProvider>
  </PowerSavingProvider>
);
