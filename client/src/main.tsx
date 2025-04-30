import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { WebSocketProvider } from "./lib/websocket";
import { UnitProvider } from "./hooks/use-unit-settings";

createRoot(document.getElementById("root")!).render(
  <WebSocketProvider>
    <UnitProvider>
      <App />
    </UnitProvider>
  </WebSocketProvider>
);
