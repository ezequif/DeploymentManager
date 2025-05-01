import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { ImportCSV } from "@/components/ImportCSV";
import { ExportCSV } from "@/components/ExportCSV";
import { useUnitSettings } from "@/hooks/use-unit-settings";

export default function Settings() {
  const { preferredUnit, setPreferredUnit, autoConvert, setAutoConvert } = useUnitSettings();
  
  const [settings, setSettings] = useState({
    barcodeScanner: true,
    expirationWarningDays: 30,
    printAutomatically: false,
    enableSounds: true,
  });
  
  const { toast } = useToast();
  
  // Update unit settings
  const handleSaveSettings = () => {
    // In a real app, this would save to the server
    toast({
      title: "Settings Saved",
      description: "Your settings have been updated successfully."
    });
  };
  
  return (
    <div className="mt-6 space-y-6">
      <Tabs defaultValue="preferences" className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-auto">
          <TabsTrigger value="preferences" className="text-xs sm:text-sm py-1.5 px-1 sm:py-2 sm:px-3">Preferences</TabsTrigger>
          <TabsTrigger value="import" className="text-xs sm:text-sm py-1.5 px-1 sm:py-2 sm:px-3">Data Import</TabsTrigger>
          <TabsTrigger value="export" className="text-xs sm:text-sm py-1.5 px-1 sm:py-2 sm:px-3">Data Export</TabsTrigger>
          <TabsTrigger value="about" className="text-xs sm:text-sm py-1.5 px-1 sm:py-2 sm:px-3">About</TabsTrigger>
        </TabsList>
        
        <TabsContent value="preferences" className="mt-2 sm:mt-4">
          <Card>
            <CardHeader className="px-3 py-3 sm:px-6 sm:py-4">
              <CardTitle className="text-base sm:text-lg">System Settings</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 space-y-3 sm:space-y-4">
              <div className="grid gap-3 sm:gap-4">
                <div className="flex items-center justify-between">
                  <div className="pr-2">
                    <Label htmlFor="barcode-scanner" className="text-sm sm:text-base font-medium">Barcode Scanner</Label>
                    <p className="text-xs sm:text-sm text-gray-500">Enable barcode scanning functionality</p>
                  </div>
                  <Switch 
                    id="barcode-scanner" 
                    checked={settings.barcodeScanner}
                    onCheckedChange={(checked) => setSettings({...settings, barcodeScanner: checked})}
                  />
                </div>
                
                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="default-unit" className="text-sm sm:text-base font-medium">Preferred Weight Unit</Label>
                  <Select
                    value={preferredUnit}
                    onValueChange={(value) => {
                      setPreferredUnit(value as "KGS" | "LBS");
                      // Show feedback to user
                      toast({
                        title: "Unit Preference Updated",
                        description: `Your preferred unit is now set to ${value}`,
                      });
                    }}
                  >
                    <SelectTrigger id="default-unit" className="h-8 sm:h-10 text-xs sm:text-sm">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KGS">KGS</SelectItem>
                      <SelectItem value="LBS">LBS</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">The unit that quantities will be displayed in by default</p>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="pr-2">
                    <Label htmlFor="auto-convert-units" className="text-sm sm:text-base font-medium">Auto-Convert Units</Label>
                    <p className="text-xs sm:text-sm text-gray-500">Automatically convert between KGS and LBS</p>
                  </div>
                  <Switch 
                    id="auto-convert-units" 
                    checked={autoConvert}
                    onCheckedChange={(checked) => {
                      setAutoConvert(checked);
                      // Show feedback to user
                      toast({
                        title: checked ? "Auto-Convert Enabled" : "Auto-Convert Disabled",
                        description: checked 
                          ? `Weights will automatically display in ${preferredUnit}`
                          : "Weights will display in their original units",
                      });
                    }}
                  />
                </div>
                
                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="expiration-warning" className="text-sm sm:text-base font-medium">Expiration Warning</Label>
                  <Select
                    value={settings.expirationWarningDays.toString()}
                    onValueChange={(value) => setSettings({...settings, expirationWarningDays: parseInt(value)})}
                  >
                    <SelectTrigger id="expiration-warning" className="h-8 sm:h-10 text-xs sm:text-sm">
                      <SelectValue placeholder="Days before expiration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="14">14 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="60">60 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">Days before expiration to show warning</p>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="pr-2">
                    <Label htmlFor="print-automatically" className="text-sm sm:text-base font-medium">Print Automatically</Label>
                    <p className="text-xs sm:text-sm text-gray-500">Auto-print label for new pallets</p>
                  </div>
                  <Switch 
                    id="print-automatically" 
                    checked={settings.printAutomatically}
                    onCheckedChange={(checked) => setSettings({...settings, printAutomatically: checked})}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="pr-2">
                    <Label htmlFor="enable-sounds" className="text-sm sm:text-base font-medium">Enable Sounds</Label>
                    <p className="text-xs sm:text-sm text-gray-500">Play sounds for scanner operations</p>
                  </div>
                  <Switch 
                    id="enable-sounds" 
                    checked={settings.enableSounds}
                    onCheckedChange={(checked) => setSettings({...settings, enableSounds: checked})}
                  />
                </div>
              </div>
              
              <div className="flex justify-end mt-4 sm:mt-6">
                <Button 
                  onClick={handleSaveSettings}
                  className="text-xs sm:text-sm h-8 sm:h-10 px-3 sm:px-4"
                >
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="import" className="mt-2 sm:mt-4">
          <Card>
            <CardHeader className="px-3 py-3 sm:px-6 sm:py-4">
              <CardTitle className="text-base sm:text-lg">Data Import</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              <ImportCSV />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="export" className="mt-2 sm:mt-4">
          <Card>
            <CardHeader className="px-3 py-3 sm:px-6 sm:py-4">
              <CardTitle className="text-base sm:text-lg">Data Export</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              <ExportCSV />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="about" className="mt-2 sm:mt-4">
          <Card>
            <CardHeader className="px-3 py-3 sm:px-6 sm:py-4">
              <CardTitle className="text-base sm:text-lg">About</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              <div className="space-y-2">
                <p className="text-xs sm:text-sm">Warehouse Pallet System v1.0.0</p>
                <p className="text-xs sm:text-sm text-gray-500">© 2023 Warehouse Systems Inc.</p>
                <p className="text-xs sm:text-sm mt-4">
                  This warehouse inventory management system is designed for tracking pallets, lots, and material movements.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
