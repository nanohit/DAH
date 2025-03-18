'use client';

import { useState, useEffect } from 'react';
import useSocketConnection from '@/hooks/useSocketConnection';
import socketService from '@/services/socketService';
import { useAuth } from '@/context/AuthContext';

interface SocketStatusProps {
  showReconnectButton?: boolean;
  showDebugMenu?: boolean;
  className?: string;
}

export default function SocketStatus({ 
  showReconnectButton = true,
  showDebugMenu = true,
  className = '' 
}: SocketStatusProps) {
  const { isConnected, reconnect, isRealTimeEnabled, setRealTimeEnabled } = useSocketConnection({ debugName: 'StatusIndicator' });
  const [showStatus, setShowStatus] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [serverUrl, setServerUrl] = useState(socketService.getServerUrl());
  const { user } = useAuth();
  const isAdmin = user?.isAdmin === true;
  
  // Only show the connection status indicator if disconnected for more than 3 seconds
  useEffect(() => {
    if (isConnected) {
      setShowStatus(false);
    } else {
      const timer = setTimeout(() => {
        setShowStatus(true);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [isConnected]);
  
  const handleSetServerUrl = () => {
    socketService.setServerUrl(serverUrl);
    setTimeout(() => reconnect(), 500);
  };
  
  const handleForceLocalhost = () => {
    setServerUrl('http://localhost:5001');
    socketService.setServerUrl('http://localhost:5001');
    setTimeout(() => reconnect(), 500);
  };
  
  const handleToggleRealTime = () => {
    setRealTimeEnabled(!isRealTimeEnabled);
  };
  
  // If user is not an admin, hide the component completely
  if (!isAdmin) return null;
  
  // For admins, always show the debug panel
  return (
    <div className={`fixed bottom-4 right-4 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 ${className}`}>
      <div className="flex flex-col space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-gray-200">
          <span className="text-sm font-semibold">Socket Admin Panel</span>
          {!isConnected && (
            <span className="inline-flex items-center">
              <span className="inline-block w-3 h-3 bg-red-500 rounded-full mr-2 animate-pulse"></span>
              <span className="text-red-700 text-xs">Disconnected</span>
            </span>
          )}
        </div>
        
        {/* Real-time toggle */}
        <div className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-300">
          <span className="text-sm font-medium">Real-time updates</span>
          <button 
            onClick={handleToggleRealTime}
            className={`px-3 py-1 text-xs rounded text-white transition-colors ${
              isRealTimeEnabled ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'
            }`}
          >
            {isRealTimeEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
        
        {/* Connection status */}
        <div className="flex items-center justify-between">
          <span className="text-xs">Status: {isConnected ? 'Connected ✅' : 'Disconnected ❌'}</span>
          
          {showReconnectButton && (
            <button 
              onClick={reconnect}
              className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
              disabled={!isRealTimeEnabled}
            >
              Reconnect
            </button>
          )}
        </div>
        
        {/* Advanced debugging - toggleable */}
        <div className="mt-1">
          <button 
            onClick={() => setShowDebug(!showDebug)}
            className="text-xs text-gray-500 underline"
          >
            {showDebug ? 'Hide Advanced' : 'Show Advanced'}
          </button>
          
          {showDebug && (
            <div className="mt-2 space-y-2 p-2 bg-gray-50 rounded">
              <div className="text-xs font-semibold">Server Configuration</div>
              
              <div className="flex items-center gap-1">
                <input 
                  type="text" 
                  value={serverUrl} 
                  onChange={(e) => setServerUrl(e.target.value)}
                  className="text-xs p-1 border border-gray-300 rounded flex-1"
                  placeholder="Server URL"
                />
                <button 
                  onClick={handleSetServerUrl}
                  className="px-2 py-1 bg-blue-500 text-white text-xs rounded"
                  disabled={!isRealTimeEnabled}
                >
                  Set
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleForceLocalhost}
                  className="px-2 py-1 bg-green-500 text-white text-xs rounded"
                  disabled={!isRealTimeEnabled}
                >
                  Use Localhost
                </button>
                
                <button 
                  onClick={reconnect}
                  className="px-2 py-1 bg-orange-500 text-white text-xs rounded"
                  disabled={!isRealTimeEnabled}
                >
                  Force Reconnect
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 