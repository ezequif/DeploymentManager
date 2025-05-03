import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Always get a fresh token just before the request
  const token = localStorage.getItem("auth_token");
  
  // Prepare headers with content type if data is provided
  const headers: Record<string, string> = data 
    ? { "Content-Type": "application/json" } 
    : {};
  
  // Add Authorization header if token exists
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });
  
    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    console.error(`Error in ${method} request to ${url}:`, error);
    
    // If we get a 401, log a warning
    if (error instanceof Error && error.message.includes("401")) {
      console.warn("Unauthorized access, auth token may be invalid");
    }
    
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Always get a fresh token just before the request 
    // This ensures we're using the latest token
    const token = localStorage.getItem("auth_token");
    
    // Setup headers with the auth token if it exists
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    try {
      const res = await fetch(queryKey[0] as string, {
        credentials: "include",
        headers,
      });
  
      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }
  
      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      console.error(`Error fetching ${queryKey[0]}:`, error);
      
      // If we get a 401, clear the token to force re-login
      if (error instanceof Error && error.message.includes("401")) {
        console.warn("Unauthorized access, auth token may be invalid");
      }
      
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
