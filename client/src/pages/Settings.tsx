import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const [settings, setSettings] = useState({
    barcodeScanner: true,
    defaultUnit: "KGS",
    expirationWarningDays: 30,
    printAutomatically: false,
    enableSounds: true,
  });
  
  const { toast } = useToast();
  
  const handleSaveSettings = () => {
    // In a real app, this would save to the server
    toast({
      title: "Settings Saved",
      description: "Your settings have been updated successfully."
    });
  };
  
  return (
    <div className="mt-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>System Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="barcode-scanner" className="font-medium">Barcode Scanner</Label>
                <p className="text-sm text-gray-500">Enable barcode scanning functionality</p>
              </div>
              <Switch 
                id="barcode-scanner" 
                checked={settings.barcodeScanner}
                onCheckedChange={(checked) => setSettings({...settings, barcodeScanner: checked})}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="default-unit" className="font-medium">Default Unit</Label>
              <Select
                value={settings.defaultUnit}
                onValueChange={(value) => setSettings({...settings, defaultUnit: value})}
              >
                <SelectTrigger id="default-unit">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="KGS">KGS</SelectItem>
                  <SelectItem value="LBS">LBS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="expiration-warning" className="font-medium">Expiration Warning</Label>
              <Select
                value={settings.expirationWarningDays.toString()}
                onValueChange={(value) => setSettings({...settings, expirationWarningDays: parseInt(value)})}
              >
                <SelectTrigger id="expiration-warning">
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
              <div>
                <Label htmlFor="print-automatically" className="font-medium">Print Automatically</Label>
                <p className="text-sm text-gray-500">Automatically print label when creating new pallet</p>
              </div>
              <Switch 
                id="print-automatically" 
                checked={settings.printAutomatically}
                onCheckedChange={(checked) => setSettings({...settings, printAutomatically: checked})}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="enable-sounds" className="font-medium">Enable Sounds</Label>
                <p className="text-sm text-gray-500">Play sounds for scanner and operations</p>
              </div>
              <Switch 
                id="enable-sounds" 
                checked={settings.enableSounds}
                onCheckedChange={(checked) => setSettings({...settings, enableSounds: checked})}
              />
            </div>
          </div>
          
          <div className="flex justify-end mt-6">
            <Button onClick={handleSaveSettings}>Save Settings</Button>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm">Warehouse Pallet System v1.0.0</p>
            <p className="text-sm text-gray-500">© 2023 Warehouse Systems Inc.</p>
            <p className="text-sm mt-4">
              This warehouse inventory management system is designed for tracking pallets, lots, and material movements.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
