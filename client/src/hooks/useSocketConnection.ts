import { useEffect, useState, useCallback } from 'react';
import socketService from '@/services/socketService';

/**
 * A hook to manage socket.io connection state and provide reconnection capabilities.
 * 
 * @param options.checkInterval Interval in ms to check the connection (default: 30000ms)
 * @param options.autoReconnect Whether to automatically reconnect when disconnected (default: true)
 * @param options.debugName Name to use in debug logs (default: 'Component')
 * @returns Object containing connection state and utility functions
 */
export function useSocketConnection({
  checkInterval = 30000,
  autoReconnect = true,
  debugName = 'Component'
} = {}) {
  const [isConnected, setIsConnected] = useState(socketService.isConnected());
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(socketService.isRealTimeEnabled());
  const [lastLogTime, setLastLogTime] = useState(0);
  
  // Helper to prevent excessive logging
  const shouldLog = () => {
    // Only log in development
    if (process.env.NODE_ENV !== 'development') return false;
    
    // Log at most once every 60 seconds
    const now = Date.now();
    if (now - lastLogTime < 60000) return false;
    
    setLastLogTime(now);
    return true;
  };

  // Toggle real-time updates
  const toggleRealTimeEnabled = useCallback(() => {
    const newValue = !socketService.isRealTimeEnabled();
    socketService.setRealTimeEnabled(newValue);
    setIsRealTimeEnabled(newValue);
    return newValue;
  }, []);

  // Effect to watch for changes to the real-time enabled setting
  useEffect(() => {
    // Check initial state
    setIsRealTimeEnabled(socketService.isRealTimeEnabled());
    
    // Monitor the real-time enabled setting - check less frequently (every 15 seconds)
    const statusCheckInterval = setInterval(() => {
      const enabled = socketService.isRealTimeEnabled();
      setIsRealTimeEnabled(enabled);
    }, 15000); // Reduced from 5000ms to 15000ms
    
    return () => {
      clearInterval(statusCheckInterval);
    };
  }, []);

  // Initialize connection and set up periodic checks
  useEffect(() => {
    // Only attempt to connect if real-time updates are enabled
    if (isRealTimeEnabled) {
      // Ensure socket is connected
      if (!socketService.isConnected()) {
        if (shouldLog()) {
          console.log(`[${debugName}] Initializing socket connection`);
        }
        socketService.connect();
      }
    }
    
    // Function to update connection status
    const updateConnectionStatus = () => {
      const connected = socketService.isConnected();
      setIsConnected(connected);
      return connected;
    };
    
    // Update status immediately
    updateConnectionStatus();
    
    // Set up connection status check interval - check less frequently when disabled
    const connectionCheckInterval = setInterval(() => {
      // Only check/reconnect if real-time updates are enabled
      if (isRealTimeEnabled) {
        const connected = updateConnectionStatus();
        
        if (!connected && autoReconnect) {
          if (shouldLog()) {
            console.log(`[${debugName}] Socket not connected, attempting to reconnect`);
          }
          socketService.reconnect();
        }
      }
    }, isRealTimeEnabled ? checkInterval : checkInterval * 3); // Check less often if disabled
    
    // Clean up on unmount
    return () => {
      clearInterval(connectionCheckInterval);
    };
  }, [checkInterval, autoReconnect, debugName, isRealTimeEnabled, lastLogTime]);
  
  // Utility function to force reconnection
  const reconnect = useCallback(() => {
    // Only reconnect if real-time updates are enabled
    if (isRealTimeEnabled) {
      if (shouldLog()) {
        console.log(`[${debugName}] Manually triggering reconnection`);
      }
      socketService.reconnect();
    } else {
      if (shouldLog()) {
        console.log(`[${debugName}] Cannot reconnect - real-time updates are disabled`);
      }
    }
  }, [isRealTimeEnabled, debugName]);
  
  // Set real-time enabled status
  const setRealTimeEnabled = useCallback((enabled: boolean) => {
    socketService.setRealTimeEnabled(enabled);
    setIsRealTimeEnabled(enabled);
  }, []);
  
  return {
    isConnected,
    isRealTimeEnabled,
    reconnect,
    socketService,
    toggleRealTimeEnabled,
    setRealTimeEnabled
  };
}

export default useSocketConnection; 