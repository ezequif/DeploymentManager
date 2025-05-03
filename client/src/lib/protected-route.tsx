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
  const { user, isLoading } = useAuth();
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  
  // Check if token exists in localStorage
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    setHasToken(!!token);
  }, []);

  return (
    <Route path={path}>
      {(isLoading || hasToken === null) ? (
        // Show loading state during authentication check
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (!user && !hasToken) ? (
        // Redirect to auth page if no user and no token
        <Redirect to="/auth" />
      ) : (
        // Show protected component
        <Component />
      )}
    </Route>
  );
}