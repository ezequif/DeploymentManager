import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";
import { useEffect, useState } from "react";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element | null;
}) {
  const { user, isLoading, refetchUser } = useAuth();
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  
  // Check if token exists in localStorage and load user data if needed
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("auth_token");
      setHasToken(!!token);
      
      // If we have a token but no user data, try to refetch
      if (token && !user) {
        await refetchUser();
      }
      
      setIsAuthenticating(false);
    };
    
    checkAuth();
  }, [user, refetchUser]);

  return (
    <Route path={path}>
      {(isLoading || isAuthenticating) ? (
        // Show loading state during authentication check
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (!user && !hasToken) ? (
        // Redirect to auth page if no user and no token
        <Redirect to="/auth" />
      ) : (
        // Show protected component - even if no user but token exists
        // The background process will fetch user data
        <Component />
      )}
    </Route>
  );
}