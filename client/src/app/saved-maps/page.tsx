'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { getUserMaps, deleteMap, SavedMap, bookmarkMap } from '@/utils/mapUtils';
import Link from 'next/link';
import MapCommentSection from '@/components/MapCommentSection';
import { useAuth } from '@/context/AuthContext';

// Format date for display - just show time for today's date or full date for older dates
const formatTime = (dateString: string) => {
  if (!dateString) return 'Unknown date';
  
  try {
    const date = new Date(dateString);
    const now = new Date();
    
    // Check if the date is today
    const isToday = date.getDate() === now.getDate() &&
                   date.getMonth() === now.getMonth() &&
                   date.getFullYear() === now.getFullYear();
    
    if (isToday) {
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')} Today`;
    } else {
      // Return a simple date format for non-today dates
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    }
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
};

// Format date in the style of "18:27 Today" or "Jul 23"
const formatDateTime = (dateString: string) => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    const now = new Date();
    
    // Check if the date is today
    const isToday = date.getDate() === now.getDate() &&
                   date.getMonth() === now.getMonth() &&
                   date.getFullYear() === now.getFullYear();
    
    if (isToday) {
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')} Today`;
    } else {
      // Return a simple date format for non-today dates
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    }
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};

// User badge component
const UserBadge = ({ badge }: { badge?: string }) => {
  if (!badge) return null;

  return (
    <span className="text-[12px] text-gray-400 font-normal -mt-[2px] block leading-tight">
      {badge}
    </span>
  );
};

export default function SavedMapsPage() {
  const [maps, setMaps] = useState<SavedMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuth();

  // Fetch all saved maps on page load
  useEffect(() => {
    const fetchMaps = async () => {
      setLoading(true);
      try {
        const userMaps = await getUserMaps();
        
        // Log information about the maps we received
        console.log(`Received ${userMaps.length} maps`);
        
        // Log the first few maps to debug the structure
        userMaps.slice(0, 3).forEach((map, index) => {
          console.log(`Map ${index + 1}:`, {
            _id: map._id,
            name: map.name,
            user: map.user,
            elementCount: map.elementCount,
            connectionCount: map.connectionCount,
            bookmarks: map.bookmarks ? map.bookmarks.length : 0
          });
        });
        
        setMaps(userMaps);
      } catch (error) {
        console.error('Error fetching maps:', error);
        toast.error('Failed to load maps');
      } finally {
        setLoading(false);
      }
    };

    fetchMaps();
  }, []);

  // Handle deleting a map
  const handleDeleteMap = async (mapId: string) => {
    try {
      const success = await deleteMap(mapId);
      if (success) {
        setMaps(maps.filter(map => map._id !== mapId));
        setDeleteConfirm(null);
        toast.success('Map deleted successfully');
      }
    } catch (error) {
      console.error('Error deleting map:', error);
      toast.error('Failed to delete map');
    }
  };

  // Function to open a map
  const handleOpenMap = (mapId: string) => {
    // Check if the map belongs to the current user
    const map = maps.find(m => m._id === mapId);
    
    console.log('Opening map:', {
      mapId,
      mapFound: !!map,
      userId: user?._id,
      mapUserId: map?.user._id,
      isOwner: map && user && map.user._id === user._id
    });
    
    if (map && user && map.user._id === user._id) {
      // If the map belongs to the current user, open in edit mode
      console.log('Opening map in edit mode');
      router.push(`/maps?id=${mapId}`);
    } else {
      // If the map doesn't belong to the current user, open in view-only mode
      console.log('Opening map in view-only mode');
      router.push(`/maps/view?id=${mapId}`);
    }
  };

  // Handle bookmarking a map
  const handleBookmark = async (mapId: string) => {
    if (!user) {
      toast.error('You must be logged in to bookmark maps');
      return;
    }
    
    try {
      console.log(`Attempting to bookmark map with ID: ${mapId}`);
      const success = await bookmarkMap(mapId);
      
      if (success) {
        console.log(`Successfully toggled bookmark for map: ${mapId}`);
        
        // Update UI locally
        setMaps(prevMaps => prevMaps.map(map => {
          if (map._id === mapId) {
            const isCurrentlyBookmarked = isMapBookmarked(map);
            return {
              ...map,
              bookmarks: isCurrentlyBookmarked
                ? map.bookmarks?.filter(b => b.user !== user._id) || []
                : [...(map.bookmarks || []), { user: user._id, timestamp: new Date().toISOString() }]
            };
          }
          return map;
        }));
        
        const wasBookmarked = isMapBookmarked(maps.find(m => m._id === mapId)!);
        toast.success(wasBookmarked 
          ? 'Map removed from bookmarks' 
          : 'Map bookmarked successfully');
      } else {
        console.error(`Failed to bookmark map: ${mapId}`);
        toast.error('Failed to bookmark map. Please try again.');
      }
    } catch (error) {
      console.error('Error bookmarking map:', error);
      toast.error('Failed to bookmark map. Please try again.');
    }
  };

  // Check if a map is bookmarked by the current user
  const isMapBookmarked = (map: SavedMap): boolean => {
    if (!user || !map.bookmarks) return false;
    
    // Try different ways the user ID might be stored in the bookmarks array
    return map.bookmarks.some(bookmark => {
      // Check if bookmark.user is a string
      if (typeof bookmark.user === 'string') {
        return bookmark.user === user._id;
      }
      // Check if bookmark.user is an object with _id
      else if (typeof bookmark.user === 'object' && bookmark.user !== null) {
        return bookmark.user._id === user._id;
      }
      return false;
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Saved Maps</h1>
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          </div>
        </div>
      </div>
    );
  }

  // No maps state
  if (maps.length === 0) {
    return (
      <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Saved Maps</h1>
          <div className="bg-white shadow rounded-lg p-8 text-center">
            <h2 className="text-xl text-gray-600 mb-4">No saved maps found</h2>
            <p className="text-gray-500 mb-6">Create a new map to get started</p>
            <Link 
              href="/maps" 
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              Create New Map
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Saved Maps</h1>
          <Link 
            href="/maps" 
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            Create New Map
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {maps.map((map) => (
            <div 
              key={map._id} 
              className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
            >
              <div className="p-4">
                {/* Author and time info - styled like post header */}
                <div className="flex justify-between items-start mb-2">
                  <div className="flex flex-col -space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-800">
                        {typeof map.user === 'object' && map.user ? (
                          <Link href={`/user/${map.user?.username}`} className="hover:underline">
                            {map.user?.username || 'Unknown'}
                          </Link>
                        ) : (
                          <span>Unknown Author</span>
                        )}
                      </span>
                      <span className="text-gray-500 text-sm whitespace-nowrap">
                        {formatDateTime(map.createdAt)}
                        <span className="mx-1.5 text-gray-300">|</span>
                        {formatDateTime(map.lastSaved || map.updatedAt)}
                      </span>
                    </div>
                    {map.user?.badge && <UserBadge badge={map.user.badge} />}
                  </div>

                  {/* Bookmark and delete buttons */}
                  <div className="flex items-center space-x-2 text-sm">
                    {user && (
                      <button
                        onClick={() => handleBookmark(map._id)}
                        className="text-gray-600 hover:text-gray-800"
                      >
                        {isMapBookmarked(map) ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                          </svg>
                        ) : (
                          <span>bookmark</span>
                        )}
                      </button>
                    )}
                    
                    {/* Delete button for map owner or admin */}
                    {user && (user._id === map.user._id || user.isAdmin) && (
                      <>
                        {deleteConfirm === map._id ? (
                          <>
                            <span className="text-gray-300">|</span>
                            <button
                              onClick={() => handleDeleteMap(map._id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              confirm
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="text-gray-600 hover:text-gray-800"
                            >
                              cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="text-gray-300">|</span>
                            <button
                              onClick={() => setDeleteConfirm(map._id)}
                              className="text-gray-600 hover:text-red-600 transition-colors"
                            >
                              delete
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
                
                {/* Map title and stats - clickable to open map */}
                <div 
                  className="cursor-pointer" 
                  onClick={() => handleOpenMap(map._id)}
                >
                  {map.name && (
                    <h2 className="text-xl font-semibold mb-2 text-black hover:underline">{map.name || 'Untitled Map'}</h2>
                  )}
                  
                  {/* Map stats - styled like post text */}
                  <div className="prose prose-sm max-w-none !text-black mb-4">
                    <p className="text-black">{map.elementCount || 0} elements</p>
                    <p className="text-black">{map.connectionCount || 0} connections</p>
                  </div>
                </div>
                
                {/* Comment section - always visible */}
                <MapCommentSection mapId={map._id} initialComments={map.comments || []} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 