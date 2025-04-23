import axios from 'axios';
import { toast } from 'react-hot-toast';

// Define Map interfaces
interface MapElement {
  id: string;
  type: 'element' | 'book' | 'line' | 'image' | 'link';
  left: number;
  top: number;
  width?: number;
  height?: number;
  text: string;
  orientation: 'horizontal' | 'vertical';
  bookData?: {
    key: string;
    _id?: string;
    title: string;
    author: string[];
    thumbnail?: string;
    highResThumbnail?: string;
    description?: string;
    source: 'openlib' | 'google' | 'alphy';
    flibustaStatus?: 'not_checked' | 'checking' | 'found' | 'not_found' | 'uploaded';
    completed?: boolean;
    bookmarks?: Array<{
      user: string | { _id: string };
      timestamp: string;
    }>;
    flibustaVariants?: Array<{
      title: string;
      author: string;
      sourceId: string;
      formats: Array<{
        format: string;
        url: string;
      }>;
    }>;
  };
  lineData?: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    isDraggingStart?: boolean;
    isDraggingEnd?: boolean;
  };
  imageData?: {
    url: string;
    alt: string;
  };
  linkData?: {
    url: string;
    title?: string;
    previewUrl?: string;
    description?: string;
    siteName?: string;
    favicon?: string;
    displayUrl?: string;
    image?: string;
    youtubeVideoId?: string;
  };
}

interface Connection {
  id: string;
  start: string;
  end: string;
  startPoint?: 'top' | 'right' | 'bottom' | 'left';
  endPoint?: 'top' | 'right' | 'bottom' | 'left';
}

interface MapData {
  name: string;
  elements: MapElement[];
  connections: Connection[];
  canvasPosition: { x: number; y: number };
  scale: number;
  canvasWidth: number;
  canvasHeight: number;
  isPrivate: boolean;
}

export interface SavedMap extends MapData {
  _id: string;
  user: {
    _id: string;
    username: string;
    badge?: string;
  };
  createdAt: string;
  updatedAt: string;
  lastSaved: string;
  elementCount?: number;
  connectionCount?: number;
  comments?: any[];
  bookmarks?: Array<{
    user: string;
    timestamp: string;
  }>;
  isBookmarked?: boolean;
  isOwner?: boolean;
  isPrivate: boolean;
}

// Create a debounce function for autosave that returns a promise
const debouncePromise = <F extends (...args: any[]) => Promise<any>>(func: F, waitFor: number) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let resolveList: Array<(value: any) => void> = [];
  
  console.log('Creating new debounced promise function with wait time:', waitFor);

  return (...args: Parameters<F>): Promise<ReturnType<F>> => {
    return new Promise(resolve => {
      resolveList.push(resolve);
      
      if (timeout) {
        console.log('Clearing existing timeout in debouncePromise');
        clearTimeout(timeout);
      }
      
      console.log('Setting new timeout in debouncePromise for', waitFor, 'ms');
      timeout = setTimeout(async () => {
        console.log('Timeout fired in debouncePromise, executing function');
        const result = await func(...args);
        resolveList.forEach(r => r(result));
        resolveList = [];
        timeout = null;
      }, waitFor);
    });
  };
};

// Clean line data to ensure it's properly formatted for MongoDB storage
const cleanLineData = (lineData: MapElement['lineData']) => {
  if (!lineData) {
    // Create default line data if none exists
    return {
      startX: 0,
      startY: 0,
      endX: 100,
      endY: 100
    };
  }

  // Keep only the essential coordinate properties and ensure they're numbers
  return {
    startX: typeof lineData.startX === 'number' ? lineData.startX : 0,
    startY: typeof lineData.startY === 'number' ? lineData.startY : 0,
    endX: typeof lineData.endX === 'number' ? lineData.endX : 100,
    endY: typeof lineData.endY === 'number' ? lineData.endY : 100
  };
};

// Save a map to the server
export const saveMap = async (
  mapData: MapData, 
  mapId: string | null = null
): Promise<SavedMap | null> => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('You must be logged in to save maps');
      return null;
    }

    // Clean up all line data to avoid having any undefined/null values
    if (mapData.elements) {
      mapData.elements = mapData.elements.map(element => {
        if (element.type === 'line' && element.lineData) {
          element.lineData = cleanLineData(element.lineData);
        }
        return element;
      });
    }

    // Calculate element counts for analytics
    const elementCount = mapData.elements?.filter(e => e.type !== 'line').length || 0;
    const connectionCount = mapData.elements?.filter(e => e.type === 'line').length || 0;
    
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    let response;

    // If we have a mapId, update the existing map
    if (mapId && mapId !== 'new' && !mapId.startsWith('temp-')) {
      response = await axios.put(`/api/maps/${mapId}`, 
        { 
          ...mapData,
          elementCount,
          connectionCount
        }, 
        { headers }
      );
    } else {
      // Otherwise, create a new map
      response = await axios.post('/api/maps', 
        { 
          ...mapData,
          elementCount,
          connectionCount
        }, 
        { headers }
      );
    }

    if (response.status >= 200 && response.status < 300) {
      // Invalidate maps cache after saving
      invalidateMapsCache();
      return response.data;
    }
    
    return null;
  } catch (error) {
    console.error('Error saving map:', error);
    return null;
  }
};

// Load a map from the server
export const loadMap = async (mapId: string): Promise<SavedMap | null> => {
  try {
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.log('No token found, redirecting to view-only mode');
      // For unauthenticated users, redirect to view-only page
      if (typeof window !== 'undefined') {
        window.location.href = `/maps/view?id=${mapId}`;
      }
      return null;
    }

    const headers = {
      Authorization: `Bearer ${token}`,
    };

    try {
      console.log('Attempting to load map as owner');
      // First try to load the map as the owner
      const response = await axios.get(`/api/maps/${mapId}`, { headers });
      
      // Log the response data to check if isPrivate is included
      console.log('[DEBUG loadMap] Response data includes isPrivate:', 'isPrivate' in response.data);
      if ('isPrivate' in response.data) {
        console.log('[DEBUG loadMap] isPrivate value from server:', response.data.isPrivate);
      } else {
        console.log('[DEBUG loadMap] isPrivate property is missing in response data!');
        console.log('[DEBUG loadMap] Response data keys:', Object.keys(response.data));
      }

      // If successful, the user is the owner
      const mapData = response.data;
      mapData.isOwner = true;
      return mapData;
    } catch (error) {
      // If we get a 401 error, the user is not the owner
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        console.log('User is not the owner of this map, trying view-only mode');
        
        // Enhanced error handling - check if server suggests view-only mode
        const errorData = error.response.data;
        if (errorData && errorData.isViewOnly) {
          console.log('Server indicated this map should be viewed in view-only mode');
          
          // Redirect to the NEW view-only page
          if (typeof window !== 'undefined') {
            window.location.href = `/maps/view?id=${mapId}`;
            return null;
          }
        }
        
        // Try to load the map in view-only mode
        const viewResponse = await axios.get(`/api/maps/${mapId}/view`, { headers: { Authorization: `Bearer ${token}` } });
        console.log('Successfully loaded map in view-only mode');
        return viewResponse.data;
      }
      // For other errors, rethrow
      throw error;
    }
  } catch (error) {
    console.error('Error loading map:', error);
    toast.error('Failed to load map');
    return null;
  }
};

// Load a map in view-only mode (for maps not owned by the current user)
export const loadMapViewOnly = async (mapId: string): Promise<SavedMap | null> => {
  console.log('loadMapViewOnly called with ID:', mapId);
  try {
    const token = localStorage.getItem('token');
    
    // Don't require token for viewing maps
    // if (!token) {
    //   console.log('No token found, user not logged in');
    //   toast.error('You must be logged in to view maps');
    //   return null;
    // }

    const headers = token ? {
      Authorization: `Bearer ${token}`,
    } : {};

    console.log('Sending request to /api/maps/:id/view endpoint');
    const response = await axios.get(`/api/maps/${mapId}/view`, { headers });
    console.log('View-only map data received:', response.data ? 'yes' : 'no');
    return response.data;
  } catch (error) {
    console.error('Error loading map for viewing:', error);
    
    if (axios.isAxiosError(error)) {
      console.log('Axios error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      
      if (error.response?.status === 404) {
        toast.error('Map not found');
      } else if (error.response?.status === 401) {
        toast.error('Not authorized to view this map');
      } else {
        toast.error('Failed to load map');
      }
    } else {
      toast.error('Failed to load map');
    }
    return null;
  }
};

// Add a cache for maps with timestamp
let mapsCache: {
  data: SavedMap[] | null;
  timestamp: number;
} = {
  data: null,
  timestamp: 0
};

// Cache lifetime in milliseconds (5 seconds)
const CACHE_LIFETIME = 5000;

// Get all maps
export const getUserMaps = async (): Promise<SavedMap[]> => {
  try {
    const token = localStorage.getItem('token');
    const now = Date.now();
    
    // Check if we have cached data that's still fresh
    if (mapsCache.data && (now - mapsCache.timestamp < CACHE_LIFETIME)) {
      console.log('Using cached maps data, age:', (now - mapsCache.timestamp) + 'ms');
      return mapsCache.data;
    }
    
    // For unauthenticated users, use the public endpoint
    if (!token) {
      console.log('No token found, using public maps endpoint');
      const response = await axios.get('/api/maps/public?include=comments');
      
      console.log(`API returned ${response.data.length} public maps`);
      // Cache the results
      mapsCache = {
        data: response.data,
        timestamp: Date.now()
      };
      return response.data;
    }

    const headers = {
      Authorization: `Bearer ${token}`,
    };

    console.log('Fetching maps from API with authentication...');
    // Request comments and bookmarks to be populated in the response
    const response = await axios.get('/api/maps?include=comments,bookmarks', { headers });
    
    console.log(`API returned ${response.data.length} maps`);
    
    // Verbose logging to debug issues
    if (response.data.length > 0) {
      const firstMap = response.data[0];
      console.log('First map structure:', {
        _id: firstMap._id,
        name: firstMap.name,
        user: firstMap.user,
        userType: firstMap.user ? typeof firstMap.user : 'undefined',
        hasUsername: firstMap.user && typeof firstMap.user === 'object' ? !!firstMap.user.username : false,
        commentsCount: firstMap.comments ? firstMap.comments.length : 0,
        bookmarksCount: firstMap.bookmarks ? firstMap.bookmarks.length : 0
      });
    }
    
    // Ensure all maps have user info in the correct format
    const processedMaps = response.data.map((map: any, index: number) => {
      try {
        // Clone the map to avoid modifying the original
        const processedMap = { ...map };
        
        // Process user info
        if (!map.user) {
          console.log(`Map ${index} (${map._id}) has no user info`);
          processedMap.user = {
            _id: 'unknown',
            username: 'Unknown',
            badge: ''
          };
        } else if (typeof map.user !== 'object') {
          console.log(`Map ${index} (${map._id}) has user as non-object: ${typeof map.user}`);
          processedMap.user = {
            _id: map.user,
            username: 'Unknown',
            badge: ''
          };
        } else if (!map.user.username) {
          console.log(`Map ${index} (${map._id}) has user object but no username`);
          processedMap.user = {
            ...map.user,
            _id: map.user._id || 'unknown',
            username: 'Unknown',
            badge: map.user.badge || ''
          };
        }
        
        // Ensure elementCount and connectionCount exist
        if (typeof processedMap.elementCount !== 'number') {
          processedMap.elementCount = 0;
        }
        
        if (typeof processedMap.connectionCount !== 'number') {
          processedMap.connectionCount = 0;
        }
        
        // Ensure comments array exists
        if (!processedMap.comments) {
          processedMap.comments = [];
        }
        
        return processedMap;
      } catch (err) {
        console.error(`Error processing map ${index}:`, err);
        // Return a safe fallback
        return {
          _id: map._id || `error-map-${index}`,
          name: map.name || 'Error Map',
          user: { _id: 'error', username: 'Error', badge: '' },
          elements: [],
          connections: [],
          canvasPosition: { x: 0, y: 0 },
          scale: 1,
          createdAt: '',
          updatedAt: '',
          lastSaved: '',
          elementCount: 0,
          connectionCount: 0,
          comments: []
        };
      }
    });
    
    // Cache the results
    mapsCache = {
      data: processedMaps,
      timestamp: Date.now()
    };
    
    return processedMaps;
  } catch (error) {
    console.error('Error fetching maps:', error);
    toast.error('Failed to fetch maps');
    return [];
  }
};

// Function to invalidate the maps cache (call this after map creation, deletion, or updating)
export const invalidateMapsCache = () => {
  mapsCache = {
    data: null,
    timestamp: 0
  };
};

/**
 * Delete a map by ID
 */
export const deleteMap = async (mapId: string): Promise<boolean> => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('You must be logged in to delete maps');
      return false;
    }

    const headers = { Authorization: `Bearer ${token}` };
    await axios.delete(`/api/maps/${mapId}`, { headers });
    toast.success('Map deleted successfully');
    
    // Explicitly trigger the map deleted event
    notifyMapDeleted(mapId);
    
    // Invalidate maps cache after deletion
    invalidateMapsCache();
    
    return true;
  } catch (error) {
    console.error('Error deleting map:', error);
    toast.error('Failed to delete map');
    return false;
  }
};

// Create an autosave function
export const createAutosave = (
  mapData: () => MapData,
  mapId: string | null,
  delay = 3000 // Default to 3 seconds for responsiveness
) => {
  console.log('Creating autosave function with mapId:', mapId, 'delay:', delay);
  let consecutiveErrorCount = 0;
  const MAX_CONSECUTIVE_ERRORS = 3;
  
  // This inner function does the actual saving
  const saveFunction = async (): Promise<boolean> => {
    try {
      const data = mapData();
      console.log('About to send autosave for mapId:', mapId);
      const result = await saveMap(data, mapId);
      console.log('Autosave completed with result:', result ? 'Success' : 'Failed');
      
      // Reset error count on successful save
      consecutiveErrorCount = 0;
      return true;
    } catch (error) {
      console.error('Autosave error:', error);
      consecutiveErrorCount++;
      
      // If we've had too many consecutive errors, disable autosave
      if (consecutiveErrorCount >= MAX_CONSECUTIVE_ERRORS) {
        console.error('Too many consecutive autosave errors. Autosave disabled.');
        toast.error('Autosave has been disabled due to repeated errors');
        return false; // Signal to disable autosave
      }
      return true; // Keep trying
    }
  };
  
  // Create a debounced version of the save function
  const debouncedSave = debouncePromise(saveFunction, delay);
  
  // Return a function that triggers the debounced save
  return async (): Promise<boolean> => {
    console.log('Autosave trigger function called');
    return await debouncedSave();
  };
};

// Bookmark a map
export const bookmarkMap = async (mapId: string): Promise<boolean> => {
  try {
    const token = localStorage.getItem('token');
    
    if (!token) {
      toast.error('You must be logged in to bookmark maps');
      return false;
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const response = await axios.post(`/api/maps/${mapId}/bookmark`, {}, { headers });
    
    if (response.status === 200) {
      // Invalidate maps cache after bookmarking/unbookmarking
      invalidateMapsCache();
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error bookmarking map:', error);
    toast.error('Failed to bookmark map');
    return false;
  }
};

// Get bookmarked maps
export const getBookmarkedMaps = async (): Promise<SavedMap[]> => {
  try {
    const token = localStorage.getItem('token');
    
    if (!token) {
      toast.error('You must be logged in to view bookmarked maps');
      return [];
    }

    const headers = {
      Authorization: `Bearer ${token}`,
    };

    const response = await axios.get('/api/maps/bookmarked', { headers });
    return response.data.maps;
  } catch (error) {
    console.error('Error fetching bookmarked maps:', error);
    toast.error('Failed to fetch bookmarked maps');
    return [];
  }
};

// Get user's recent maps (just for the navbar section)
export const getUserRecentMaps = async (limit = 3): Promise<SavedMap[]> => {
  try {
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.log('No token found, cannot fetch recent maps for unauthenticated user');
      return [];
    }

    const headers = {
      Authorization: `Bearer ${token}`,
    };

    // Use the dedicated endpoint for recent maps
    const response = await axios.get(`/api/maps/recent?limit=${limit}`, { headers });
    
    console.log(`API returned ${response.data.length} recent maps for user`);
    
    return response.data;
  } catch (error) {
    console.error('Error fetching recent maps:', error);
    return [];
  }
};

/**
 * Notify the application that a map has been deleted
 * @param mapId The ID of the deleted map
 */
export const notifyMapDeleted = (mapId: string) => {
  window.dispatchEvent(new CustomEvent('map-deleted', { 
    detail: { mapId },
    bubbles: true,
    composed: true
  }));
};

export type { MapElement, Connection, MapData };
// SavedMap is already exported as an interface above 
// SavedMap is already exported as an interface above 