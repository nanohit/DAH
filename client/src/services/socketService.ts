import { Manager, type Socket } from 'socket.io-client';

// Determine the API URL based on environment
// Prioritize localhost in development, regardless of NEXT_PUBLIC_API_URL
const isDevelopment = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const API_URL = isDevelopment 
  ? 'http://localhost:5001'
  : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001');

// Only log on development and only once on load
if (process.env.NODE_ENV === 'development') {
  console.log('[SOCKET] Will connect to:', API_URL);
}

/**
 * Class to manage socket.io connections
 */
class SocketService {
  private socket: any = null; // Using any to avoid type issues with Socket
  private manager: any = null; // Using any to avoid type issues with Manager
  private serverUrl: string = API_URL;
  private connectionAttempts: number = 0;
  private isConnecting: boolean = false;
  private _isRealTimeEnabled: boolean = false; // Default to disabled
  private eventHandlers: Map<string, Map<Function, Function>> = new Map();
  private shouldLogConnection: boolean = true;
  private activePostRooms: Set<string> = new Set();
  private maxConnectionAttempts = 10; // Increased from 5 to 10
  private autoReconnectTimer: NodeJS.Timeout | null = null;
  private logFrequencyCounter: number = 0;
  
  constructor() {
    // Load real-time setting from localStorage when service is initialized
    this.loadRealTimeSettingFromStorage();
  }
  
  // Only log a percentage of the time to reduce console noise
  private shouldLog(percentage: number = 1): boolean {
    return process.env.NODE_ENV === 'development' && Math.random() * 100 < percentage;
  }
  
  // Only log every N events to reduce frequency
  private shouldLogNth(n: number = 10): boolean {
    this.logFrequencyCounter = (this.logFrequencyCounter + 1) % n;
    return process.env.NODE_ENV === 'development' && this.logFrequencyCounter === 0;
  }
  
  /**
   * Load real-time enabled setting from localStorage
   */
  private loadRealTimeSettingFromStorage(): void {
    if (typeof window !== 'undefined') {
      const savedSetting = localStorage.getItem('socketRealTimeEnabled');
      if (savedSetting !== null) {
        this._isRealTimeEnabled = savedSetting === 'true';
      } else {
        // If no saved setting, use the default (false) and save it
        this.saveRealTimeSettingToStorage();
      }
    }
  }
  
  /**
   * Save real-time enabled setting to localStorage
   */
  private saveRealTimeSettingToStorage(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('socketRealTimeEnabled', this._isRealTimeEnabled.toString());
    }
  }
  
  /**
   * Get real-time enabled status
   */
  public isRealTimeEnabled(): boolean {
    return this._isRealTimeEnabled;
  }
  
  /**
   * Set real-time enabled status
   */
  public setRealTimeEnabled(value: boolean): void {
    this._isRealTimeEnabled = value;
    
    // Save to localStorage
    this.saveRealTimeSettingToStorage();
    
    if (this.shouldLog(25)) {
      console.log(`[SOCKET] Real-time updates ${value ? 'enabled' : 'disabled'}`);
    }
    
    // If disabling, disconnect the socket
    if (!value && this.socket?.connected) {
      this.socket.disconnect();
      if (this.shouldLog(25)) {
        console.log('[SOCKET] Disconnected due to real-time being disabled');
      }
    } else if (value && !this.socket?.connected) {
      // If enabling, try to connect
      this.connect();
    }
  }
  
  /**
   * Connect to the socket.io server
   */
  public connect(): void {
    // Don't connect if real-time is disabled
    if (!this._isRealTimeEnabled) {
      if (this.shouldLog(1)) {
        console.log('[SOCKET] Not connecting - real-time updates are disabled');
      }
      return;
    }
    
    // Prevent duplicate connection attempts
    if (this.socket?.connected) {
      return;
    }
    
    if (this.isConnecting) {
      return;
    }
    
    this.isConnecting = true;
    this.connectionAttempts++;
    
    // Only log connection attempts occasionally to reduce noise
    if (this.shouldLogConnection && this.shouldLogNth(5)) {
      console.log('[SOCKET] Connecting to:', this.serverUrl);
      // Only log environment details very rarely
      if (this.shouldLog(5)) {
        console.log('[SOCKET] Environment details:', {
          isDevelopment,
          hostname: typeof window !== 'undefined' ? window.location.hostname : 'SSR',
          nextPublicApiUrl: process.env.NEXT_PUBLIC_API_URL || 'not set'
        });
      }
      
      // Only log every few attempts to reduce console noise
      this.shouldLogConnection = false;
      setTimeout(() => {
        this.shouldLogConnection = true;
      }, 60000); // Reset logging flag after 60 seconds
    }
    
    try {
      // Create a manager and socket
      this.manager = new Manager(this.serverUrl, {
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        timeout: 20000,
        transports: isDevelopment 
          ? ['polling', 'websocket'] 
          : ['websocket', 'polling']
      });
      
      // Create socket
      this.socket = this.manager.socket('/');
      
      // Set up event listeners
      if (this.socket) {
        this.socket.on('connect', () => {
          if (this.shouldLog(20)) {
            console.log('[SOCKET] Connected successfully');
          }
          this.isConnecting = false;
          this.connectionAttempts = 0;
          
          // Rejoin any active post rooms after reconnection
          this.activePostRooms.forEach(postId => {
            this.joinPostRoom(postId);
          });
        });
        
        this.socket.on('disconnect', (reason: string) => {
          if (this.shouldLog(20)) {
            console.log(`[SOCKET] Disconnected: ${reason}`);
          }
          this.isConnecting = false;
        });
        
        this.socket.on('connect_error', (err: Error) => {
          if (this.shouldLog(20)) {
            console.log(`[SOCKET] Connection error: ${err.message}`);
          }
          this.isConnecting = false;
        });
      }
    } catch (error) {
      console.error('[SOCKET] Error during connection setup:', error);
      this.isConnecting = false;
    }
  }

  /**
   * Allows setting the server URL manually, useful for testing different environments
   */
  setServerUrl(url: string) {
    if (this.socket?.connected) {
      if (this.shouldLog(50)) {
        console.log('[SOCKET] Disconnecting before changing server URL');
      }
      this.disconnect();
    }
    
    this.serverUrl = url;
    if (this.shouldLog(50)) {
      console.log('[SOCKET] Server URL changed to:', url);
    }
    
    // Reset connection state
    this.connectionAttempts = 0;
    
    // Reconnect with new URL
    this.connect();
  }

  /**
   * Get the current server URL
   */
  getServerUrl(): string {
    return this.serverUrl;
  }

  /**
   * Join the global feed room to receive all new post events
   */
  joinGlobalFeed() {
    if (!this._isRealTimeEnabled) return;
    
    if (!this.socket?.connected) {
      if (this.shouldLog(1)) {
        console.log('[SOCKET] Will join global feed after connecting');
      }
      return;
    }
    
    if (this.shouldLog(5)) {
      console.log('[SOCKET] Joining global feed');
    }
    this.socket.emit('join-feed');
  }

  /**
   * Join a post's room to receive updates about it
   */
  public joinPostRoom(postId: string): void {
    if (!this._isRealTimeEnabled) return;
    
    // Track the room
    this.activePostRooms.add(postId);
    
    if (!this.socket?.connected) {
      this.connect();
      return;
    }
    
    // Only log join attempts VERY rarely (1% of the time) to reduce console noise
    if (Math.random() < 0.01) {
      console.log(`[SOCKET] Joining room for post: ${postId}`);
    }
    
    // Listen for room join confirmation just once
    this.socket.once('room-joined', (data: any) => {
      if (data && data.room === `post:${postId}`) {
        // Log room join confirmations at a low rate (5% of the time)
        if (Math.random() < 0.05) {
          console.log(`[SOCKET] Successfully joined room: ${data.room}`);
        }
      }
    });
    
    // Send just the postId, not an object with postId property
    this.socket?.emit('join-post', postId);
  }
  
  /**
   * Leave a post's room
   */
  public leavePostRoom(postId: string): void {
    // Remove from tracking
    this.activePostRooms.delete(postId);
    
    if (!this.socket?.connected) return;
    
    // Only log leave attempts VERY rarely (1% of the time) to reduce noise
    if (Math.random() < 0.01) {
      console.log(`[SOCKET] Leaving room for post: ${postId}`);
    }
    
    // Send just the postId, not an object with postId property
    this.socket.emit('leave-post', postId);
  }
  
  /**
   * Register an event handler
   */
  public on(event: string, callback: Function): void {
    // If real-time updates are disabled, don't even try to register handlers
    if (!this._isRealTimeEnabled) {
      if (this.shouldLog(1)) {
        console.log(`[SOCKET] Not registering ${event} handler - real-time updates are disabled`);
      }
      return;
    }
    
    // Connect if needed
    if (!this.socket) {
      if (this.shouldLog(5)) {
        console.log(`[SOCKET] No socket when registering ${event}, connecting first`);
      }
      this.connect();
    }

    // Create a Map for this event type if it doesn't exist
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Map());
    }

    // Store reference to the callback
    const handlers = this.eventHandlers.get(event);
    
    if (handlers && !handlers.has(callback)) {
      // Create a wrapper that will be called by socket.io
      const wrappedCallback = (...args: any[]) => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`[SOCKET] Error in ${event} handler:`, error);
        }
      };
      
      // Store the wrapper with the original callback as key
      handlers.set(callback, wrappedCallback);
      
      // Add the actual event listener to the socket
      if (this.shouldLog(5)) {
        console.log(`[SOCKET] Setting up master handler for event: ${event}`);
      }
      
      this.socket?.on(event, (...args: any[]) => {
        if (this.shouldLog(10)) {
          console.log(`[SOCKET][${event}] Event received`);
        }
        wrappedCallback(...args);
      });
    }
  }
  
  /**
   * Remove an event handler
   */
  public off(event: string, callback?: Function): void {
    // No socket means no handlers to remove
    if (!this.socket) {
      // Only log 5% of the time to reduce noise
      if (Math.random() < 0.05) {
        console.log(`[SOCKET] No socket when removing handler for ${event}`);
      }
      return;
    }
    
    // For a specific callback
    if (callback && this.eventHandlers.has(event)) {
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        // Only log 5% of the time to reduce noise
        if (Math.random() < 0.05) {
          console.log(`[SOCKET] Removing specific handler for ${event}`);
        }
        // Remove this specific handler
        handlers.delete(callback);
        
        // If no more handlers for this event, clean up the master handler
        if (handlers.size === 0) {
          // Only log 10% of the time to reduce noise
          if (Math.random() < 0.1) {
            console.log(`[SOCKET] No more handlers for ${event}, removing master handler`);
          }
          this.socket.off(event);
          this.eventHandlers.delete(event);
        }
      }
    } 
    // For all callbacks of an event
    else if (this.eventHandlers.has(event)) {
      // Only log 10% of the time to reduce noise
      if (Math.random() < 0.1) {
        console.log(`[SOCKET] Removing all handlers for ${event}`);
      }
      // Remove all handlers for this event
      this.socket.off(event);
      this.eventHandlers.delete(event);
    }
  }

  /**
   * Check if socket is connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Send a ping to test the connection
   */
  ping(): Promise<boolean> {
    return new Promise((resolve) => {
      // If not connected, try to connect first
      if (!this.socket?.connected) {
        // Only log 20% of ping attempts to reduce noise
        if (Math.random() < 0.2) {
          console.log('[SOCKET] Not connected, attempting to connect before ping');
        }
        this.connect();
        
        // Wait a bit for the connection to establish
        setTimeout(() => {
          if (this.socket?.connected) {
            this.doPing(resolve);
          } else {
            // Only log 20% of ping failures to reduce noise
            if (Math.random() < 0.2) {
              console.log('[SOCKET] Cannot ping, socket not connected after attempt');
            }
            resolve(false);
          }
        }, 2000);
        
        return;
      }
      
      this.doPing(resolve);
    });
  }
  
  private doPing(resolve: (success: boolean) => void) {
    if (!this.socket?.connected) {
      resolve(false);
      return;
    }
    
    let pongReceived = false;
    
    // Set up a one-time pong listener
    const onPong = () => {
      // Only log 20% of pong responses to reduce noise
      if (Math.random() < 0.2) {
        console.log('[SOCKET] Pong received');
      }
      pongReceived = true;
      resolve(true);
    };
    
    this.socket.once('pong', onPong);
    
    // Send ping
    // Only log 20% of ping sends to reduce noise
    if (Math.random() < 0.2) {
      console.log('[SOCKET] Sending ping');
    }
    this.socket.emit('ping');
    
    // Time out after 5 seconds
    setTimeout(() => {
      if (!pongReceived) {
        // Always log ping failures since they're important
        console.log('[SOCKET] Pong not received, connection may be broken');
        this.socket?.off('pong', onPong);
        resolve(false);
      }
    }, 5000);
  }
  
  /**
   * Force reconnection
   */
  reconnect() {
    if (this.shouldLog(25)) {
      console.log('[SOCKET] Forcing reconnection');
    }
    this.disconnect();
    this.connectionAttempts = 0;
    this.connect();
  }

  /**
   * Disconnect the socket
   */
  disconnect() {
    if (!this.socket) return;
    
    if (this.autoReconnectTimer) {
      clearTimeout(this.autoReconnectTimer);
      this.autoReconnectTimer = null;
    }
    
    this.isConnecting = false;
    this.socket.disconnect();
    this.socket = null;
    this.eventHandlers.clear();
    this.connectionAttempts = 0;
    // Keep activePostRooms so we can reconnect to them later
  }
}

// Create a singleton instance
const socketService = new SocketService();

export default socketService; 