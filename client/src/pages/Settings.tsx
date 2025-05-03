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
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { LockIcon } from "lucide-react";
import { z } from "zod";

export default function Settings() {
  const { preferredUnit, setPreferredUnit, autoConvert, setAutoConvert } = useUnitSettings();
  const { user, refetchUser } = useAuth();
  
  // Refresh user auth state when component mounts
  useEffect(() => {
    const refreshAuth = async () => {
      await refetchUser();
    };
    refreshAuth();
  }, [refetchUser]);
  
  const [settings, setSettings] = useState({
    barcodeScanner: true,
    expirationWarningDays: 30,
    printAutomatically: false,
    enableSounds: true,
  });
  
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  const [formErrors, setFormErrors] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  const { toast } = useToast();
  
  // Password change mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const response = await apiRequest('POST', '/api/auth/change-password', data);
      return await response.json();
    },
    onSuccess: (data) => {
      // Store the new token
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }
      
      // Clear the form
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      
      // Show success message
      toast({
        title: 'Password Changed',
        description: 'Your password has been successfully updated.',
        variant: 'default',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error Changing Password',
        description: error.message || 'There was a problem changing your password.',
        variant: 'destructive',
      });
    }
  });
  
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
        <TabsList className="grid w-full grid-cols-5 h-auto">
          <TabsTrigger value="preferences" className="text-xs sm:text-sm py-1.5 px-1 sm:py-2 sm:px-3">Preferences</TabsTrigger>
          <TabsTrigger value="security" className="text-xs sm:text-sm py-1.5 px-1 sm:py-2 sm:px-3">Security</TabsTrigger>
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
        
        <TabsContent value="security" className="mt-2 sm:mt-4">
          <Card>
            <CardHeader className="px-3 py-3 sm:px-6 sm:py-4">
              <CardTitle className="flex items-center text-base sm:text-lg">
                <LockIcon className="mr-2 h-4 w-4" /> 
                Security Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 space-y-3 sm:space-y-4">
              <div className="space-y-4">
                <h3 className="text-sm sm:text-base font-medium">Change Password</h3>
                <p className="text-xs sm:text-sm text-gray-500">
                  Use the form below to change your password. For security reasons, you'll need to enter your current password.
                </p>
                
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="current-password" className="text-sm">Current Password</Label>
                    <Input 
                      id="current-password"
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({
                        ...passwordForm,
                        currentPassword: e.target.value
                      })}
                      placeholder="Enter your current password"
                      className="h-8 sm:h-10 text-xs sm:text-sm"
                    />
                    {formErrors.currentPassword && (
                      <p className="text-xs text-red-500">{formErrors.currentPassword}</p>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor="new-password" className="text-sm">New Password</Label>
                    <Input 
                      id="new-password"
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({
                        ...passwordForm,
                        newPassword: e.target.value
                      })}
                      placeholder="Enter your new password"
                      className="h-8 sm:h-10 text-xs sm:text-sm"
                    />
                    {formErrors.newPassword && (
                      <p className="text-xs text-red-500">{formErrors.newPassword}</p>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor="confirm-password" className="text-sm">Confirm New Password</Label>
                    <Input 
                      id="confirm-password"
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({
                        ...passwordForm,
                        confirmPassword: e.target.value
                      })}
                      placeholder="Confirm your new password"
                      className="h-8 sm:h-10 text-xs sm:text-sm"
                    />
                    {formErrors.confirmPassword && (
                      <p className="text-xs text-red-500">{formErrors.confirmPassword}</p>
                    )}
                  </div>
                  
                  <div className="pt-2">
                    <Button
                      onClick={() => {
                        // Reset form errors
                        setFormErrors({
                          currentPassword: '',
                          newPassword: '',
                          confirmPassword: '',
                        });
                        
                        // Validate form
                        let valid = true;
                        
                        if (!passwordForm.currentPassword) {
                          setFormErrors(prev => ({
                            ...prev,
                            currentPassword: 'Current password is required'
                          }));
                          valid = false;
                        }
                        
                        if (!passwordForm.newPassword) {
                          setFormErrors(prev => ({
                            ...prev,
                            newPassword: 'New password is required'
                          }));
                          valid = false;
                        } else if (passwordForm.newPassword.length < 6) {
                          setFormErrors(prev => ({
                            ...prev,
                            newPassword: 'Password must be at least 6 characters'
                          }));
                          valid = false;
                        }
                        
                        if (!passwordForm.confirmPassword) {
                          setFormErrors(prev => ({
                            ...prev,
                            confirmPassword: 'Please confirm your new password'
                          }));
                          valid = false;
                        } else if (passwordForm.newPassword !== passwordForm.confirmPassword) {
                          setFormErrors(prev => ({
                            ...prev,
                            confirmPassword: 'Passwords do not match'
                          }));
                          valid = false;
                        }
                        
                        if (valid) {
                          // Submit the form
                          changePasswordMutation.mutate({
                            currentPassword: passwordForm.currentPassword,
                            newPassword: passwordForm.newPassword,
                          });
                        }
                      }}
                      disabled={changePasswordMutation.isPending}
                      className="w-full text-xs sm:text-sm h-8 sm:h-10"
                    >
                      {changePasswordMutation.isPending ? 'Changing Password...' : 'Change Password'}
                    </Button>
                  </div>
                </div>
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
