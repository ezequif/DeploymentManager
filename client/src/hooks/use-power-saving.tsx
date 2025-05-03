import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { isLowPowerDevice, isTC70 } from '../lib/deviceDetection';

export type PowerSavingLevel = 'off' | 'low' | 'high';

type PowerSavingContextType = {
  powerSavingMode: PowerSavingLevel;
  setPowerSavingMode: (mode: PowerSavingLevel) => void;
  autoPowerSaving: boolean;
  setAutoPowerSaving: (enabled: boolean) => void;
};

const PowerSavingContext = createContext<PowerSavingContextType | undefined>(undefined);

export function PowerSavingProvider({ children }: { children: ReactNode }) {
  // Default power saving mode based on device detection
  const [powerSavingMode, setPowerSavingMode] = useState<PowerSavingLevel>(
    isTC70() ? 'high' : isLowPowerDevice() ? 'low' : 'off'
  );
  
  // Auto power saving - enables automatic mode changes based on battery level and network conditions
  const [autoPowerSaving, setAutoPowerSaving] = useState<boolean>(isLowPowerDevice());
  
  // Apply the power-saving mode to the document body as a data attribute
  useEffect(() => {
    document.body.dataset.powerSaving = powerSavingMode;
    
    // Add TC70-specific class if we're on a TC70 device
    if (isTC70()) {
      document.body.classList.add('tc70-mode');
    } else {
      document.body.classList.remove('tc70-mode');
    }
    
    // Apply additional optimizations for high power saving mode
    if (powerSavingMode === 'high') {
      // Reduce WebSocket polling frequency if supported
      if (window.WebSocketPollInterval) {
        window.WebSocketPollInterval = 10000; // 10 seconds
      }
      
      // Disable animations globally
      document.body.style.setProperty('--animation-duration', '0');
    } else if (powerSavingMode === 'low') {
      // Reduce WebSocket polling frequency slightly if supported
      if (window.WebSocketPollInterval) {
        window.WebSocketPollInterval = 5000; // 5 seconds
      }
      
      // Slow down animations
      document.body.style.setProperty('--animation-duration', '0.5');
    } else {
      // Normal mode
      if (window.WebSocketPollInterval) {
        window.WebSocketPollInterval = 3000; // 3 seconds
      }
      
      // Normal animations
      document.body.style.removeProperty('--animation-duration');
    }
  }, [powerSavingMode]);

  // Auto power saving mode - monitor battery level if available
  useEffect(() => {
    if (!autoPowerSaving) return;
    
    // Check if the Battery API is available
    if ('getBattery' in navigator) {
      const handleBatteryChange = (battery: any) => {
        if (battery.level <= 0.15) {
          // Below 15% battery - high power saving
          setPowerSavingMode('high');
        } else if (battery.level <= 0.30) {
          // Below 30% battery - low power saving
          setPowerSavingMode('low');
        } else if (powerSavingMode !== 'off') {
          // Above 30% battery - turn off power saving
          setPowerSavingMode('off');
        }
      };
      
      // Initial check and setup event listeners
      (navigator as any).getBattery().then((battery: any) => {
        handleBatteryChange(battery);
        
        battery.addEventListener('levelchange', () => {
          handleBatteryChange(battery);
        });
        
        // Also switch to high power saving mode when device is discharging
        battery.addEventListener('chargingchange', () => {
          if (!battery.charging && battery.level <= 0.30) {
            setPowerSavingMode(battery.level <= 0.15 ? 'high' : 'low');
          }
        });
      });
    }
    
    // Also listen for network changes
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      
      // Outer function scope variable to keep the handler available for cleanup
      let handleNetworkChange: (() => void) | undefined;
      
      const setupNetworkChangeListener = () => {
        handleNetworkChange = () => {
          // If on slow connection or save-data is enabled, use high power saving
          if (connection.saveData || 
              connection.effectiveType === 'slow-2g' || 
              connection.effectiveType === '2g') {
            setPowerSavingMode('high');
          } 
          // If on 3G, use low power saving
          else if (connection.effectiveType === '3g') {
            setPowerSavingMode('low');
          }
        };
        
        handleNetworkChange();
        connection.addEventListener('change', handleNetworkChange);
        
        // Return the cleanup function
        return () => {
          if (handleNetworkChange) {
            connection.removeEventListener('change', handleNetworkChange);
          }
        };
      };
      
      // Set up the listener and store its cleanup function
      const cleanupNetworkListener = setupNetworkChangeListener();
      
      // Add this to the main return cleanup
      return () => {
        cleanupNetworkListener();
        // ... other cleanup will be added here
      };
    }
    
    // Also detect if device is in low-power mode using the media query
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (prefersReducedMotion.matches) {
      setPowerSavingMode('high');
    }
    
    // Listen for changes to the prefers-reduced-motion media query
    const handleReducedMotionChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setPowerSavingMode('high');
      }
    };
    
    prefersReducedMotion.addEventListener('change', handleReducedMotionChange);
    
    return () => {
      prefersReducedMotion.removeEventListener('change', handleReducedMotionChange);
      // Connection cleanup is handled in the network change listener setup
    };
  }, [autoPowerSaving, powerSavingMode]);

  return (
    <PowerSavingContext.Provider
      value={{
        powerSavingMode,
        setPowerSavingMode,
        autoPowerSaving,
        setAutoPowerSaving
      }}
    >
      {children}
    </PowerSavingContext.Provider>
  );
}

// Helper hook to use the power saving context
export function usePowerSaving() {
  const context = useContext(PowerSavingContext);
  
  if (context === undefined) {
    throw new Error('usePowerSaving must be used within a PowerSavingProvider');
  }
  
  return context;
}

// Add WebSocketPollInterval to the Window interface
declare global {
  interface Window {
    WebSocketPollInterval?: number;
  }
}