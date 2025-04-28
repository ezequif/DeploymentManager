// Format date in MM/DD/YYYY format
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}/${d.getFullYear()}`;
}

// Format date and time in MM/DD/YYYY hh:mm AM/PM format
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  const formattedHours = hours % 12 || 12;
  const formattedMinutes = minutes.toString().padStart(2, '0');
  
  return `${formatDate(d)} ${formattedHours}:${formattedMinutes} ${ampm}`;
}

// Format number to always show 1 decimal place
export function formatQuantity(quantity: number): string {
  return quantity.toFixed(1);
}

// Check if date is expiring soon (within 30 days)
export function isExpiringSoon(expirationDate: string): boolean {
  const expDate = new Date(expirationDate);
  const today = new Date();
  
  // Set hours, minutes, seconds to 0 for accurate day comparison
  today.setHours(0, 0, 0, 0);
  
  const diffTime = expDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays <= 30 && diffDays >= 0;
}

// Check if date is expired
export function isExpired(expirationDate: string): boolean {
  const expDate = new Date(expirationDate);
  const today = new Date();
  
  // Set hours, minutes, seconds to 0 for accurate day comparison
  today.setHours(0, 0, 0, 0);
  
  return expDate < today;
}

// Format elapsed time for last sync
export function formatElapsedTime(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) {
    return "Just now";
  } else if (seconds < 120) {
    return "1 minute ago";
  } else if (seconds < 3600) {
    return `${Math.floor(seconds / 60)} minutes ago`;
  } else if (seconds < 7200) {
    return "1 hour ago";
  } else if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)} hours ago`;
  } else {
    return `${Math.floor(seconds / 86400)} days ago`;
  }
}

/**
 * Normalize date string to YYYY-MM-DD format for consistent storage
 * This function handles timezone issues by explicitly setting the date
 * to preserve the exact date chosen by the user, regardless of timezone.
 * 
 * @param dateString Date string in any format that JavaScript can parse (preferably YYYY-MM-DD)
 * @returns Normalized date string in YYYY-MM-DD format
 */
export function normalizeDate(dateString: string): string {
  // If it's already in YYYY-MM-DD format, parse it directly
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(n => parseInt(n, 10));
    
    // Build the date using UTC to avoid timezone shifts
    // We subtract 1 from month because JS months are 0-indexed
    const utcDate = new Date(Date.UTC(year, month - 1, day));
    
    // Format it back to YYYY-MM-DD
    const pad = (num: number) => num.toString().padStart(2, '0');
    return `${utcDate.getUTCFullYear()}-${pad(utcDate.getUTCMonth() + 1)}-${pad(utcDate.getUTCDate())}`;
  }
  
  try {
    // For other formats, first convert to a Date
    const date = new Date(dateString);
    
    // Then get the UTC components
    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = date.getUTCDate().toString().padStart(2, '0');
    
    // Return the date in ISO format (YYYY-MM-DD) using UTC values
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error("Error normalizing date:", error);
    return dateString; // Return original if something goes wrong
  }
}
