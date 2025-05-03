import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { isLowPowerDevice } from '@/lib/deviceDetection';

// Define possible power saving levels
export type PowerSavingLevel = 'off' | 'low' | 'high';

// Context type definition
type PowerSavingContextType = {
  powerSavingMode: PowerSavingLevel;
  setPowerSavingMode: (mode: PowerSavingLevel) => void;
  setAutoPowerSaving: (enabled: boolean) => void;
  autoPowerSaving: boolean;
};

// Create the context with a default value
const PowerSavingContext = createContext<PowerSavingContextType>({
  powerSavingMode: 'off',
  setPowerSavingMode: () => {},
  setAutoPowerSaving: () => {},
  autoPowerSaving: false,
});

// Provider component that wraps the app
export function PowerSavingProvider({ children }: { children: ReactNode }) {
  // Default power saving mode based on device detection
  const [powerSavingMode, setPowerSavingMode] = useState<PowerSavingLevel>(
    isLowPowerDevice() ? 'low' : 'off'
  );
  const [autoPowerSaving, setAutoPowerSaving] = useState<boolean>(isLowPowerDevice());

  // Effects for listening to battery levels (if available) and adjusting power saving mode
  useEffect(() => {
    // Only run on browsers that support the Battery API
    if ('getBattery' in navigator) {
      const batteryManager = (navigator as any).getBattery();
      
      if (batteryManager && batteryManager.then) {
        batteryManager.then((battery: any) => {
          // Initial check
          checkBatteryLevel(battery);
          
          // Listen for battery level changes
          battery.addEventListener('levelchange', () => checkBatteryLevel(battery));
          
          // Listen for charging status changes
          battery.addEventListener('chargingchange', () => {
            if (battery.charging && powerSavingMode === 'high' && autoPowerSaving) {
              // If device is charging and in high power saving mode, reduce to low
              setPowerSavingMode('low');
            } else if (!battery.charging && battery.level < 0.2 && autoPowerSaving) {
              // If battery is below 20% and not charging, go to high power saving
              setPowerSavingMode('high');
            }
          });
        });
      }
    }
    
    // Apply power saving mode settings
    applyPowerSavingSettings();
  }, [powerSavingMode, autoPowerSaving]);
  
  // Function to check battery level and adjust power saving mode if needed
  const checkBatteryLevel = (battery: any) => {
    if (!autoPowerSaving) return;
    
    if (battery.level < 0.15 && !battery.charging) {
      // If battery is below 15% and not charging, enable high power saving
      setPowerSavingMode('high');
    } else if (battery.level < 0.3 && !battery.charging && powerSavingMode === 'off') {
      // If battery is below 30% and not charging, enable low power saving
      setPowerSavingMode('low');
    } else if (battery.level > 0.50 && battery.charging && powerSavingMode !== 'off') {
      // If battery is above 50% and charging, disable power saving
      setPowerSavingMode('off');
    }
  };
  
  // Apply power saving settings
  const applyPowerSavingSettings = () => {
    if (powerSavingMode === 'high') {
      // High power saving mode: 
      // - Disable transitions/animations
      // - Lower refresh rates
      // - Disable background operations
      document.documentElement.classList.add('power-saving-high');
      document.documentElement.classList.add('power-saving-low');
    } else if (powerSavingMode === 'low') {
      // Low power saving mode:
      // - Reduce animations
      // - Optimize network operations
      document.documentElement.classList.add('power-saving-low');
      document.documentElement.classList.remove('power-saving-high');
    } else {
      // No power saving
      document.documentElement.classList.remove('power-saving-low');
      document.documentElement.classList.remove('power-saving-high');
    }
    
    // Store settings for persistence
    try {
      localStorage.setItem('powerSavingMode', powerSavingMode);
      localStorage.setItem('autoPowerSaving', autoPowerSaving ? 'true' : 'false');
    } catch (e) {
      // Ignore storage errors
    }
  };

  return (
    <PowerSavingContext.Provider
      value={{
        powerSavingMode,
        setPowerSavingMode,
        autoPowerSaving,
        setAutoPowerSaving,
      }}
    >
      {children}
    </PowerSavingContext.Provider>
  );
}

// Custom hook to use the power saving context
export function usePowerSaving() {
  return useContext(PowerSavingContext);
}