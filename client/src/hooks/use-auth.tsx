import { createContext, ReactNode, useContext, useEffect } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Define user types directly until schema import issue is resolved
interface User {
  id: number;
  username: string;
  password: string;
  role: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  active: boolean;
  createdAt: Date;
  lastLogin?: Date;
}

// API response might have a different structure with userId
interface ApiUser {
  userId?: number;
  username?: string;
  role?: string;
}

interface InsertUser {
  username: string;
  password: string;
  role?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  active?: boolean;
}

type SelectUser = User;

// Helper function to normalize user data that comes from API
function normalizeUserData(userData: any): SelectUser | null {
  if (!userData) return null;
  
  // Check if the data is wrapped in a user property (common API pattern)
  const rawUser = userData.user || userData;
  
  // Extract role properly, ensuring admin privileges are correctly identified
  // Server can return a string or a user object containing the role
  const role = typeof rawUser.role === 'string' 
    ? rawUser.role 
    : (rawUser.role === 'admin' || rawUser.role === 'a' ? 'admin' : 'user');
  
  // Map API response which might have userId to our User type
  return {
    id: rawUser.id || rawUser.userId || 0,
    username: rawUser.username || 'User',
    password: '', // We never get the password
    role: role,
    email: rawUser.email,
    firstName: rawUser.firstName,
    lastName: rawUser.lastName,
    active: rawUser.active !== false,
    createdAt: rawUser.createdAt ? new Date(rawUser.createdAt) : new Date(),
    lastLogin: rawUser.lastLogin ? new Date(rawUser.lastLogin) : undefined
  };
}

// Response types for auth endpoints
type AuthResponse = {
  user: SelectUser;
  token: string;
};

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  refetchUser: () => Promise<SelectUser | null>;
  loginMutation: UseMutationResult<AuthResponse, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<AuthResponse, Error, InsertUser>;
};

type LoginData = Pick<InsertUser, "username" | "password">;

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  
  // Get token from localStorage to determine initial auth state
  const hasToken = !!localStorage.getItem("auth_token");
  
  const {
    data: rawUserData,
    error,
    isLoading,
    refetch
  } = useQuery<any, Error>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    // Always enabled - will automatically refetch on mount to ensure user data is available
    enabled: true,
    // Refetch when window gets focus to keep session updated
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 1,
    // Reuse the data across navigation
    staleTime: 300000, // 5 minutes
    gcTime: 3600000 // 1 hour - gcTime is the newer name for cacheTime
  });
  
  // Normalize user data using our helper function
  const user = normalizeUserData(rawUserData);
  
  // Effect to monitor token changes and refresh user data
  useEffect(() => {
    const tokenCheckInterval = setInterval(() => {
      const currentToken = localStorage.getItem("auth_token");
      // If token exists but user data is missing, refetch
      if (currentToken && !user) {
        refetch();
      }
    }, 2000); // Check every 2 seconds
    
    return () => clearInterval(tokenCheckInterval);
  }, [user, refetch]);

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/auth/login", credentials);
      const data = await res.json();
      // Normalize the user data and ensure it's never null
      const normalizedUser = normalizeUserData(data.user);
      if (!normalizedUser) {
        throw new Error("Invalid user data received from server");
      }
      return {
        user: normalizedUser,
        token: data.token
      };
    },
    onSuccess: (data: AuthResponse) => {
      // The backend /api/auth/me endpoint returns {user: {userId, username, role}}
      // so we need to format the cache data in the same way
      queryClient.setQueryData(["/api/auth/me"], {user: {
        userId: data.user.id,
        username: data.user.username,
        role: data.user.role
      }});
      // Store the token in localStorage
      localStorage.setItem("auth_token", data.token);
      toast({
        title: "Login successful",
        description: `Welcome back, ${data.user.firstName || data.user.username}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message || "Invalid username or password",
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      const res = await apiRequest("POST", "/api/auth/register", credentials);
      const data = await res.json();
      // Normalize the user data and ensure it's never null
      const normalizedUser = normalizeUserData(data.user);
      if (!normalizedUser) {
        throw new Error("Invalid user data received from server");
      }
      return {
        user: normalizedUser,
        token: data.token
      };
    },
    onSuccess: (data: AuthResponse) => {
      // The backend /api/auth/me endpoint returns {user: {userId, username, role}}
      // so we need to format the cache data in the same way
      queryClient.setQueryData(["/api/auth/me"], {user: {
        userId: data.user.id,
        username: data.user.username,
        role: data.user.role
      }});
      // Store the token in localStorage
      localStorage.setItem("auth_token", data.token);
      toast({
        title: "Registration successful",
        description: `Welcome, ${data.user.firstName || data.user.username}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message || "Unable to create account",
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      // We don't actually have a logout endpoint, just clear the token
      localStorage.removeItem("auth_token");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/me"], null);
      toast({
        title: "Logged out",
        description: "You have been successfully logged out",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create a refetch function that returns a promise
  const refetchUser = async (): Promise<SelectUser | null> => {
    try {
      const { data } = await refetch();
      // Normalize the user data before returning
      return normalizeUserData(data);
    } catch (error) {
      console.error("Error refetching user:", error);
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        refetchUser,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Helper function to check if a user has admin privileges
export function isUserAdmin(user: SelectUser | null): boolean {
  if (!user) return false;
  return user.role === 'admin';
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  
  // Add isAdmin helper for convenience
  return {
    ...context,
    isAdmin: isUserAdmin(context.user)
  };
}