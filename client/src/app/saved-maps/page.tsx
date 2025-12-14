'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { getUserMaps, deleteMap, SavedMap, bookmarkMap, notifyMapDeleted } from '@/utils/mapUtils';
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
  const [sortBy, setSortBy] = useState<'updated' | 'created'>('created');
  const [visibleComments, setVisibleComments] = useState<string[]>([]);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [mapComments, setMapComments] = useState<Record<string, any[]>>({});
  const router = useRouter();
  const { user } = useAuth();
  const isNanoAdmin = user?.username === 'nano';
  const canvasButtonLabel = isNanoAdmin ? '+ New Map Canvas' : '+ Новая доска';

  // Toggle comment visibility
  const toggleComments = (mapId: string) => {
    setVisibleComments(prev => 
      prev.includes(mapId) 
        ? prev.filter(id => id !== mapId) 
        : [...prev, mapId]
    );
  };

  // Handle comment updates from child components
  const handleCommentUpdate = (mapId: string, count: number, updatedComments: any[]) => {
    setCommentCounts(prev => ({
      ...prev,
      [mapId]: count
    }));
    
    // Store the updated comments
    setMapComments(prev => ({
      ...prev,
      [mapId]: updatedComments
    }));
  };

  // Get comment count for a map
  const getCommentCount = (map: SavedMap): number => {
    if (map._id in commentCounts) {
      return commentCounts[map._id] || 0;
    }
    if (typeof map.commentsCount === 'number') {
      return map.commentsCount;
    }
    return map.comments?.length || 0;
  };
  
  // Get comments for a map (either from our stored state or the initial data)
  const getMapComments = (map: SavedMap): any[] => {
    if (map._id in mapComments) {
      return mapComments[map._id] || [];
    }
    return map.comments || [];
  };

  // Fetch all saved maps on page load
  useEffect(() => {
    const fetchMaps = async () => {
      setLoading(true);
      try {
        const userMaps = await getUserMaps();

        // Also fetch TL maps and normalize to SavedMap shape
        let tlMaps: SavedMap[] = [];
        try {
          const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
          if (token) {
            const res = await fetch('/api/tl-maps', {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              const data = await res.json();
              tlMaps = (data || []).map((m: any) => ({
                _id: m._id,
                name: m.name || 'Untitled Map',
                user: m.user || { _id: 'unknown', username: 'Unknown' },
                createdAt: m.createdAt || '',
                updatedAt: m.updatedAt || '',
                lastSaved: m.lastSaved || m.updatedAt || m.createdAt || '',
                elements: [],
                connections: [],
                canvasPosition: { x: 0, y: 0 },
                scale: 1,
                canvasWidth: 0,
                canvasHeight: 0,
                isPrivate: m.isPrivate || false,
                elementCount: m.elementCount || 0,
                connectionCount: m.connectionCount || 0,
                comments: m.comments || [],
                commentsCount: m.commentsCount || 0,
                bookmarks: m.bookmarks || [],
                // marker to distinguish TL maps in UI
                // @ts-ignore
                isTl: true,
              }));
            }
          }
        } catch (err) {
          console.warn('Failed to fetch TL maps', err);
        }

        // Tag TL maps with isTl marker for typing
        setMaps([
          ...userMaps,
          ...tlMaps.map((m) => ({ ...m, isTl: true } as SavedMap & { isTl: boolean })),
        ]);
      } catch (error) {
        console.error('Error fetching maps:', error);
        toast.error('Failed to load maps');
      } finally {
        setLoading(false);
      }
    };

    fetchMaps();
  }, []);

  // Function to sort maps based on current sort option
  const sortedMaps = useMemo(() => {
    if (sortBy === 'updated') {
      return [...maps].sort((a, b) => {
        const dateA = new Date(a.lastSaved || a.updatedAt || a.createdAt).getTime();
        const dateB = new Date(b.lastSaved || b.updatedAt || b.createdAt).getTime();
        return dateB - dateA;
      });
    } else {
      return [...maps].sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });
    }
  }, [maps, sortBy]);

  // Handle deleting a map
  const handleDeleteMap = async (mapId: string) => {
    try {
      const isTl = (maps.find(m => m._id === mapId) as any)?.isTl;
      let success = false;
      if (isTl) {
        const token = localStorage.getItem('token');
        if (!token) {
          toast.error('You must be logged in to delete maps');
          return;
        }
        const res = await fetch(`/api/tl-maps/${mapId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        success = res.ok;
      } else {
        success = await deleteMap(mapId);
      }
      if (success) {
        setMaps(maps.filter(map => map._id !== mapId));
        setDeleteConfirm(null);
        notifyMapDeleted(mapId);
      }
    } catch (error) {
      console.error('Error deleting map:', error);
      toast.error('Failed to delete map');
    }
  };

  // Function to open a map
  const handleOpenMap = (mapId: string, isTl?: boolean) => {
    // Check if the map belongs to the current user
    const map = maps.find(m => m._id === mapId);
    
    console.log('Opening map:', {
      mapId,
      mapFound: !!map,
      userId: user?._id,
      mapUserId: map?.user._id,
      isOwner: map && user && map.user._id === user._id
    });
    
    // Canvas maps open via map-canvas route (no view-only variant)
    if ((map as any)?.isTl || isTl) {
      router.push(`/map-canvas?id=${mapId}`);
      return;
    }

    if (map && user && map.user._id === user._id) {
      console.log('Opening map in edit mode');
      router.push(`/maps?id=${mapId}`);
    } else {
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
        const userObj = bookmark.user as { _id: string };
        return userObj._id === user._id;
      }
      return false;
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div className="inline-flex border border-gray-400/50 rounded-md overflow-hidden opacity-50 pointer-events-none">
              <button className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-800">Last Added</button>
              <button className="px-3 py-1.5 text-xs font-medium bg-white text-black">Last Updated</button>
            </div>
            <div className="flex items-center gap-2">
              {isNanoAdmin && (
                <Link
                  href="/maps"
                  className="border border-gray-400/50 text-black hover:bg-black hover:text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-200"
                >
                  + New Map
                </Link>
              )}
              <Link
                href="/map-canvas"
                className="border border-gray-400/50 text-black hover:bg-black hover:text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-200"
              >
                {canvasButtonLabel}
              </Link>
            </div>
          </div>
          <div className="flex justify-center items-center h-48">
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
          <div className="flex justify-between items-center mb-6">
            <div className="inline-flex border border-gray-400/50 rounded-md overflow-hidden opacity-50 pointer-events-none">
              <button className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-800">Last Added</button>
              <button className="px-3 py-1.5 text-xs font-medium bg-white text-black">Last Updated</button>
            </div>
            <div className="flex items-center gap-2">
              {isNanoAdmin && (
                <Link
                  href="/maps"
                  className="border border-gray-400/50 text-black hover:bg-black hover:text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-200"
                >
                  + New Map
                </Link>
              )}
              <Link
                href="/map-canvas"
                className="border border-gray-400/50 text-black hover:bg-black hover:text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-200"
              >
                {canvasButtonLabel}
              </Link>
            </div>
          </div>
          <div className="bg-white shadow rounded-lg p-6 text-center">
            <h2 className="text-lg text-gray-600 mb-3">No saved maps found</h2>
            <p className="text-gray-500 mb-4">Create a new map to get started</p>
            {isNanoAdmin ? (
              <Link
                href="/maps"
                className="border border-gray-400/50 text-black hover:bg-black hover:text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-200"
              >
                + New Map
              </Link>
            ) : (
              <Link
                href="/map-canvas"
                className="border border-gray-400/50 text-black hover:bg-black hover:text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-200"
              >
                {canvasButtonLabel}
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="inline-flex border border-gray-400/50 rounded-md overflow-hidden">
            <button
              onClick={() => setSortBy('created')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors duration-200 ${
                sortBy === 'created' 
                  ? 'bg-gray-100 text-gray-800' 
                  : 'bg-white text-black hover:bg-gray-50'
              }`}
            >
              Last Added
            </button>
            <button
              onClick={() => setSortBy('updated')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors duration-200 ${
                sortBy === 'updated' 
                  ? 'bg-gray-100 text-gray-800' 
                  : 'bg-white text-black hover:bg-gray-50'
              }`}
            >
              Last Updated
            </button>
          </div>
          {user && (
            <div className="flex gap-2">
              {isNanoAdmin && (
                <Link
                  href="/maps"
                  className="border border-gray-400/50 text-black hover:bg-black hover:text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-200"
                >
                  + New Map
                </Link>
              )}
              <Link
                href="/map-canvas"
                className="border border-gray-400/50 text-black hover:bg-black hover:text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-200"
              >
                {canvasButtonLabel}
              </Link>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sortedMaps.map((map) => (
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
              onClick={() => handleOpenMap(map._id, (map as any).isTl)}
                >
                  {map.name && (
                    <h2 className="text-lg font-semibold mb-1 text-black hover:underline">{map.name || 'Untitled Map'}</h2>
                  )}
                  
                  {/* Map stats with comments on right */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center text-sm text-gray-500">
                      {map.isPrivate && (
                        <span className="bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 text-xs px-2 py-0.5 rounded-md mr-2 shadow-sm border border-blue-100/50 whitespace-nowrap">Visible only to you</span>
                      )}
                      <span>{map.elementCount || 0} elements</span>
                      <span className="mx-1">•</span>
                      <span>{map.connectionCount || 0} connections</span>
                    </div>
                    
                    {/* Comment toggle button with rotating arrow */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleComments(map._id);
                      }}
                      className="text-gray-500 text-sm hover:text-gray-700 flex items-center"
                    >
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className={`h-3 w-3 mr-1 transition-transform ${visibleComments.includes(map._id) ? 'rotate-180' : ''}`} 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      {getCommentCount(map) > 0 
                        ? `${getCommentCount(map)} comments` 
                        : 'comments'}
                    </button>
                  </div>
                </div>

                {/* Comment section - conditionally visible */}
                {visibleComments.includes(map._id) && (
                  <div className="mt-2 pt-3 border-t border-gray-100">
                    <MapCommentSection 
                      mapId={map._id} 
                      initialComments={getMapComments(map)} 
                      onCommentUpdate={(count, comments) => handleCommentUpdate(map._id, count, comments)}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 