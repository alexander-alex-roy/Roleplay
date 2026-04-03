import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    
    // Set initial value
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    
    // Add event listener
    mql.addEventListener("change", onChange)
    
    // Cleanup
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}

export function useMobileOptimizations() {
  React.useEffect(() => {
    // Disable double-tap zoom on iOS
    const handleGesture = (e: Event) => {
      const touchEvent = e as unknown as { scale?: number };
      if (touchEvent.scale !== undefined && touchEvent.scale !== 1) {
        e.preventDefault()
      }
    }
    
    document.addEventListener('gesturestart', handleGesture)
    document.addEventListener('gesturechange', handleGesture)
    document.addEventListener('gestureend', handleGesture)
    
    return () => {
      document.removeEventListener('gesturestart', handleGesture)
      document.removeEventListener('gesturechange', handleGesture)
      document.removeEventListener('gestureend', handleGesture)
    }
  }, [])
}
