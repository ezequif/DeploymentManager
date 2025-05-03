import { PalletWithLots } from '@shared/schema';
import { isLowPowerDevice, hasWebSocketSupport } from './deviceDetection';

// Type for WebSocket message handlers
export type MessageHandler = (message: any) => void;

// WebSocket events that components can subscribe to
export type WebSocketEvent = 'open' | 'close' | 'error' | 'message';

// Singleton WebSocket instance that persists across page navigations
let websocketInstance: WebSocket | null = null;
let clientId: string | null = null;
let reconnectAttempt = 0;
let reconnectTimeout: NodeJS.Timeout | null = null;
let lastMessageTime = 0;

// Store message handlers and event listeners
const messageHandlers: MessageHandler[] = [];
const eventListeners: Record<WebSocketEvent, Array<() => void>> = {
  open: [],
  close: [],
  error: [],
  message: []
};

// Function to create or get the singleton WebSocket instance
function getWebSocket(): WebSocket | null {
  // Return existing connection if valid
  if (websocketInstance && (websocketInstance.readyState === WebSocket.OPEN || 
      websocketInstance.readyState === WebSocket.CONNECTING)) {
    console.log("Using existing WebSocket connection with state:", 
      websocketInstance.readyState === WebSocket.OPEN ? "OPEN" : "CONNECTING");
    return websocketInstance;
  }
  
  // If we don't have WebSocket support, return null
  if (!hasWebSocketSupport()) {
    console.log("WebSocket not supported on this device");
    return null;
  }
  
  try {
    // Create a new WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    console.log("Creating new WebSocket connection to", wsUrl);
    
    websocketInstance = new WebSocket(wsUrl);
    
    // Set up event handlers for the global instance
    websocketInstance.onopen = () => {
      console.log("Global WebSocket connected");
      reconnectAttempt = 0;
      
      // Clear any pending reconnect timeouts
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      
      // Notify listeners
      eventListeners.open.forEach(listener => listener());
    };
    
    websocketInstance.onmessage = (event) => {
      lastMessageTime = Date.now();
      
      try {
        const message = JSON.parse(event.data);
        
        // Store client ID if it's in an init message
        if (message.type === 'init' && message.data.clientId) {
          clientId = message.data.clientId;
        }
        
        // Notify all message handlers
        messageHandlers.forEach(handler => {
          try {
            handler(message);
          } catch (error) {
            console.error("Error in message handler:", error);
          }
        });
        
        // Notify message event listeners
        eventListeners.message.forEach(listener => listener());
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };
    
    websocketInstance.onclose = (event) => {
      console.log("Global WebSocket closed with code:", event.code);
      
      // Notify listeners
      eventListeners.close.forEach(listener => listener());
      
      // Only try to reconnect for abnormal closures
      if (event.code !== 1000 && event.code !== 1001) {
        // Calculate reconnect delay with exponential backoff
        const maxDelay = isLowPowerDevice() ? 30000 : 10000;
        const delay = Math.min(maxDelay, 1000 * Math.pow(1.5, reconnectAttempt));
        
        console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempt + 1})`);
        
        // Schedule reconnection
        reconnectTimeout = setTimeout(() => {
          reconnectAttempt++;
          websocketInstance = null; // Clear the instance so we create a new one
          getWebSocket();
        }, delay);
      }
    };
    
    websocketInstance.onerror = (error) => {
      console.error("Global WebSocket error:", error);
      
      // Notify listeners
      eventListeners.error.forEach(listener => listener());
    };
    
    return websocketInstance;
  } catch (error) {
    console.error("Error creating WebSocket:", error);
    return null;
  }
}

// WebSocket Service API
const WebSocketService = {
  // Connect to WebSocket or get existing connection
  connect: (): WebSocket | null => {
    return getWebSocket();
  },
  
  // Send a message to the server
  sendMessage: (type: string, data: any = null): boolean => {
    const ws = getWebSocket();
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.error(`Cannot send message, WebSocket not connected (state: ${ws?.readyState})`);
      return false;
    }
    
    try {
      ws.send(JSON.stringify({ type, data }));
      return true;
    } catch (error) {
      console.error("Error sending message:", error);
      return false;
    }
  },
  
  // Request a full data sync
  requestSync: (): boolean => {
    return WebSocketService.sendMessage('requestSync');
  },
  
  // Add a message handler
  addMessageHandler: (handler: MessageHandler): void => {
    if (!messageHandlers.includes(handler)) {
      messageHandlers.push(handler);
    }
  },
  
  // Remove a message handler
  removeMessageHandler: (handler: MessageHandler): void => {
    const index = messageHandlers.indexOf(handler);
    if (index !== -1) {
      messageHandlers.splice(index, 1);
    }
  },
  
  // Add an event listener
  addEventListener: (event: WebSocketEvent, listener: () => void): void => {
    if (!eventListeners[event].includes(listener)) {
      eventListeners[event].push(listener);
    }
  },
  
  // Remove an event listener
  removeEventListener: (event: WebSocketEvent, listener: () => void): void => {
    const index = eventListeners[event].indexOf(listener);
    if (index !== -1) {
      eventListeners[event].splice(index, 1);
    }
  },
  
  // Get connection status
  getStatus: (): 'connecting' | 'open' | 'closing' | 'closed' | 'unsupported' => {
    if (!hasWebSocketSupport()) {
      return 'unsupported';
    }
    
    if (!websocketInstance) {
      return 'closed';
    }
    
    switch (websocketInstance.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'open';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'closed';
      default: return 'closed';
    }
  },
  
  // Get client ID
  getClientId: (): string | null => {
    return clientId;
  },
  
  // Check if the connection is healthy (connected within last 60 seconds)
  isHealthy: (): boolean => {
    if (WebSocketService.getStatus() !== 'open') {
      return false;
    }
    
    // Check if we've received a message in the last 60 seconds
    const MAX_IDLE_TIME = 60000; // 60 seconds
    return Date.now() - lastMessageTime < MAX_IDLE_TIME;
  },
  
  // Force reconnection
  reconnect: (): void => {
    if (websocketInstance) {
      websocketInstance.close();
    }
    
    websocketInstance = null;
    getWebSocket();
  }
};

export default WebSocketService;