import { createContext, ReactNode, useContext, useState, useEffect } from "react";

type UnitType = "KGS" | "LBS";

type UnitContextType = {
  preferredUnit: UnitType;
  setPreferredUnit: (unit: UnitType) => void;
  autoConvert: boolean;
  setAutoConvert: (autoConvert: boolean) => void;
};

const UnitContext = createContext<UnitContextType | null>(null);

export function UnitProvider({ children }: { children: ReactNode }) {
  // Initialize from localStorage or use LBS as default
  const [preferredUnit, setPreferredUnit] = useState<UnitType>(() => {
    const savedUnit = localStorage.getItem("preferredUnit");
    return (savedUnit as UnitType) || "LBS";
  });
  
  // Whether to automatically convert values when displaying them
  const [autoConvert, setAutoConvert] = useState<boolean>(() => {
    const savedAutoConvert = localStorage.getItem("autoConvert");
    return savedAutoConvert ? JSON.parse(savedAutoConvert) : true;
  });
  
  // Update localStorage when settings change
  useEffect(() => {
    localStorage.setItem("preferredUnit", preferredUnit);
  }, [preferredUnit]);
  
  useEffect(() => {
    localStorage.setItem("autoConvert", JSON.stringify(autoConvert));
  }, [autoConvert]);
  
  return (
    <UnitContext.Provider 
      value={{ 
        preferredUnit, 
        setPreferredUnit, 
        autoConvert, 
        setAutoConvert 
      }}
    >
      {children}
    </UnitContext.Provider>
  );
}

export function useUnitSettings() {
  const context = useContext(UnitContext);
  if (!context) {
    throw new Error("useUnitSettings must be used within a UnitProvider");
  }
  return context;
}