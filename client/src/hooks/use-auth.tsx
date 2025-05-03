import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { z } from "zod";
// We need to import User and InsertUser from schema
import { users, insertUserSchema } from "@shared/schema";
// Define SelectUser type based on schema
type SelectUser = typeof users.$inferSelect;
// Define InsertUser type based on schema
type InsertUser = z.infer<typeof insertUserSchema>;
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  refetchUser: () => Promise<SelectUser | null>;
  loginMutation: UseMutationResult<{user: SelectUser, token: string}, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<{user: SelectUser, token: string}, Error, InsertUser>;
};

type LoginData = Pick<InsertUser, "username" | "password">;

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  
  // Get token from localStorage to determine initial auth state
  const hasToken = !!localStorage.getItem("auth_token");
  
  const {
    data: user,
    error,
    isLoading,
    refetch
  } = useQuery<SelectUser | null, Error>({
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

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/auth/login", credentials);
      return await res.json();
    },
    onSuccess: (data: {user: SelectUser, token: string}) => {
      queryClient.setQueryData(["/api/auth/me"], data.user);
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
      return await res.json();
    },
    onSuccess: (data: {user: SelectUser, token: string}) => {
      queryClient.setQueryData(["/api/auth/me"], data.user);
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
      return data ?? null;
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}