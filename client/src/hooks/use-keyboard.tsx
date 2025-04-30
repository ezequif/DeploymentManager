import { useState, useEffect } from 'react';

export function useKeyboard() {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  
  useEffect(() => {
    // For iOS devices
    const detectKeyboardIOS = () => {
      const originalHeight = window.innerHeight;
      
      const keyboardListener = () => {
        // If the window height is significantly smaller than the original,
        // we can assume the keyboard is open
        const keyboardThreshold = originalHeight * 0.65;
        const isOpen = window.innerHeight < keyboardThreshold;
        
        if (isOpen !== isKeyboardOpen) {
          setIsKeyboardOpen(isOpen);
          
          // Add or remove a class from the body for CSS adjustments
          if (isOpen) {
            document.body.classList.add('keyboard-open');
          } else {
            document.body.classList.remove('keyboard-open');
          }
        }
      };
      
      // Detect changes to window size
      window.addEventListener('resize', keyboardListener);
      
      // Detect focus on input elements
      const handleFocus = () => {
        // Short delay to let keyboard open
        setTimeout(() => keyboardListener(), 300);
      };
      
      // Detect blur on input elements
      const handleBlur = () => {
        // Short delay to let keyboard close
        setTimeout(() => {
          setIsKeyboardOpen(false);
          document.body.classList.remove('keyboard-open');
        }, 100);
      };
      
      // Add event listeners to all input elements
      const inputElements = document.querySelectorAll('input, textarea, select');
      inputElements.forEach(element => {
        element.addEventListener('focus', handleFocus);
        element.addEventListener('blur', handleBlur);
      });
      
      return () => {
        window.removeEventListener('resize', keyboardListener);
        inputElements.forEach(element => {
          element.removeEventListener('focus', handleFocus);
          element.removeEventListener('blur', handleBlur);
        });
      };
    };
    
    // For Android devices (we use a different approach)
    const detectKeyboardAndroid = () => {
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const viewportListener = () => {
        if (!window.visualViewport) return;
        
        const isOpen = window.innerHeight - window.visualViewport.height > 150;
        
        if (isOpen !== isKeyboardOpen) {
          setIsKeyboardOpen(isOpen);
          
          if (isOpen) {
            document.body.classList.add('keyboard-open');
          } else {
            document.body.classList.remove('keyboard-open');
          }
        }
      };
      
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', viewportListener);
        
        return () => {
          window.visualViewport?.removeEventListener('resize', viewportListener);
        };
      }
      
      return () => {}; // No cleanup needed if visualViewport isn't supported
    };
    
    // Use the appropriate detection method based on the platform
    const userAgent = navigator.userAgent.toLowerCase();
    let cleanup;
    
    if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
      cleanup = detectKeyboardIOS();
    } else if (userAgent.includes('android')) {
      cleanup = detectKeyboardAndroid();
    } else {
      // Fallback for other devices using input focus/blur
      const handleFocus = () => {
        setIsKeyboardOpen(true);
        document.body.classList.add('keyboard-open');
      };
      
      const handleBlur = () => {
        setIsKeyboardOpen(false);
        document.body.classList.remove('keyboard-open');
      };
      
      const inputElements = document.querySelectorAll('input, textarea, select');
      inputElements.forEach(element => {
        element.addEventListener('focus', handleFocus);
        element.addEventListener('blur', handleBlur);
      });
      
      cleanup = () => {
        inputElements.forEach(element => {
          element.removeEventListener('focus', handleFocus);
          element.removeEventListener('blur', handleBlur);
        });
      };
    }
    
    return cleanup;
  }, [isKeyboardOpen]);
  
  return isKeyboardOpen;
}