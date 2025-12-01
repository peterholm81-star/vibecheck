import { useState, useEffect } from 'react';

/**
 * Custom hook to detect if the screen is mobile-sized.
 * 
 * HOW IT WORKS:
 * - Checks if the screen width is less than 768 pixels
 * - Updates automatically when the window is resized
 * - Returns true for mobile, false for desktop
 * 
 * WHY 768px?
 * This is a common breakpoint that matches Tailwind's "md:" breakpoint.
 * Most phones and small tablets are under 768px wide.
 */
export function useIsMobile(breakpoint: number = 768): boolean {
  // Start by checking if we're on mobile
  // We use a function to avoid errors during server-side rendering
  const [isMobile, setIsMobile] = useState(() => {
    // Check if window exists (it won't during SSR)
    if (typeof window === 'undefined') return false;
    return window.innerWidth < breakpoint;
  });

  useEffect(() => {
    // This function runs whenever the window is resized
    const handleResize = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    // Add the event listener
    window.addEventListener('resize', handleResize);

    // Run once immediately to set the correct value
    handleResize();

    // Clean up the event listener when the component unmounts
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  return isMobile;
}

