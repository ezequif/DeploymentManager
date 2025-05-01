import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { WebSocketProvider } from "./lib/websocket";
import { Toaster } from "./components/ui/toaster";

createRoot(document.getElementById("root")!).render(
  <WebSocketProvider>
    <App />
    <Toaster />
  </WebSocketProvider>
);
