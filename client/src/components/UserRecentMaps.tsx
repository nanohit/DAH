'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';

interface MapData {
  _id: string;
  name: string;
  user: {
    _id: string;
    username: string;
  };
  lastSaved?: string;
  updatedAt?: string;
  createdAt: string;
}

interface UserRecentMapsProps {
  maxMaps?: number;
}

export default function UserRecentMaps({ maxMaps = 5 }: UserRecentMapsProps) {
  const { isAuthenticated, user } = useAuth();
  const [maps, setMaps] = useState<MapData[]>([]);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const [visibleMapIndex, setVisibleMapIndex] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchMaps = async () => {
    // Only fetch if authenticated and we have a user ID
    if (isAuthenticated && user && user._id) {
      const token = localStorage.getItem('token');
      if (!token) {
        setHasAttemptedLoad(true);
        return;
      }

      try {
        // Use the standard /api/maps endpoint to get ALL maps at once
        const response = await axios.get('/api/maps', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (Array.isArray(response.data)) {
          // Filter maps owned by current user
          const userMaps = response.data.filter(map => 
            map.user && map.user._id === user._id
          );
          
          // Sort by last updated time
          const sortedMaps = [...userMaps].sort((a, b) => {
            const dateA = new Date(a.lastSaved || a.updatedAt || a.createdAt).getTime();
            const dateB = new Date(b.lastSaved || b.updatedAt || b.createdAt).getTime();
            return dateB - dateA;
          });
          
          // Store all maps at once
          setMaps(sortedMaps);
        }
        setHasAttemptedLoad(true);
      } catch (error) {
        console.error('Error fetching maps:', error);
        setHasAttemptedLoad(true);
      }
    } else {
      setHasAttemptedLoad(true);
    }
  };

  useEffect(() => {
    fetchMaps();
    
    // Set up event listener for map deletions
    const handleMapDeleted = (event: CustomEvent) => {
      if (event.detail && event.detail.mapId) {
        // Remove the deleted map from state
        setMaps(prevMaps => {
          const filtered = prevMaps.filter(map => map._id !== event.detail.mapId);
          return filtered;
        });
      }
    };
    
    // TypeScript cast for CustomEvent
    window.addEventListener('map-deleted', handleMapDeleted as EventListener);
    
    // Clean up event listener
    return () => {
      window.removeEventListener('map-deleted', handleMapDeleted as EventListener);
    };
  }, [isAuthenticated, user]);

  const scrollNext = () => {
    if (visibleMapIndex + maxMaps < maps.length) {
      setVisibleMapIndex(prevIndex => prevIndex + maxMaps);
    }
  };

  const scrollPrev = () => {
    if (visibleMapIndex > 0) {
      setVisibleMapIndex(prevIndex => Math.max(0, prevIndex - maxMaps));
    }
  };

  // Helper function to format date
  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (error) {
      return '';
    }
  };

  // Don't render anything if not authenticated or if we've attempted to load but have no maps
  if (!isAuthenticated || !user || (hasAttemptedLoad && maps.length === 0)) {
    return null;
  }

  // Get currently visible maps - limit to exactly maxMaps to prevent going over
  const visibleMaps = maps.slice(visibleMapIndex, visibleMapIndex + maxMaps);
  
  // We're on the last page if there are no more maps after this batch
  const isLastPage = visibleMapIndex + maxMaps >= maps.length;
  
  // Calculate remaining slots in the grid
  const remainingSlots = maxMaps - visibleMaps.length;
  
  // Show create button in two cases:
  // 1. On first page when user has fewer than 5 maps total
  // 2. On last page when there's empty space available
  const showCreateButton = (visibleMapIndex === 0 && maps.length < 5) || 
                           (isLastPage && remainingSlots > 0);
  
  // Set navigation flags - STRICTLY enforce no cycling
  const canScrollNext = visibleMapIndex + maxMaps < maps.length;
  const canScrollPrev = visibleMapIndex > 0;
  
  // Prepare our grid items
  const displayItems = [];
  
  // Add maps first
  visibleMaps.forEach((map, idx) => {
    const dateToShow = map.lastSaved || map.updatedAt || map.createdAt;
    const formattedDate = formatDate(dateToShow);
    
    displayItems.push(
      <Link href={`/maps?id=${map._id}`} key={map._id || idx} className="block w-full">
        <div className="border border-gray-200 rounded-lg h-[112px] flex flex-col justify-between bg-white p-4 transition-all duration-300 ease-in-out hover:translate-y-[-3px] hover:shadow-[0_2px_0_rgba(0,0,0,0.1)]">
          <div className="flex-grow">
            <span className="text-gray-900 font-medium text-sm line-clamp-2 text-left overflow-hidden break-words">
              {map.name || "New page"}
            </span>
          </div>
          <div className="flex-shrink-0 mt-2">
            <span className="text-gray-600 text-xs text-left block">
              {map.user.username}
            </span>
            <span className="text-gray-400 text-xs text-left block">
              {formattedDate}
            </span>
          </div>
        </div>
      </Link>
    );
  });
  
  // Add the "create new map" button if there's space and we should show it
  if (showCreateButton && displayItems.length < maxMaps) {
    displayItems.push(
      <Link href="/maps" key="create-new-map" className="block w-full">
        <div className="border border-gray-200 rounded-lg h-[112px] flex items-center justify-center bg-white transition-all duration-300 ease-in-out hover:translate-y-[-5px] hover:shadow-[0_2px_0_rgba(0,0,0,0.1)]">
          <svg className="w-8 h-8 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
      </Link>
    );
  }
    
  // Add invisible placeholders for any remaining slots
  if (displayItems.length < maxMaps) {
    // Calculate how many more items we need
    const emptySlots = maxMaps - displayItems.length;
    for (let i = 0; i < emptySlots; i++) {
      displayItems.push(
        <div key={`empty-${i}`} className="w-full opacity-0" aria-hidden="true">
          <div className="pointer-events-none h-[112px]"></div>
        </div>
      );
    }
  }
  
  return (
    <div className="w-full px-0 mb-4" ref={containerRef}>
      <div className="relative">
        <div className="grid grid-cols-5 gap-3 mb-5">
          {displayItems}
        </div>
        
        {/* Left navigation arrow */}
        {canScrollPrev && (
          <button 
            onClick={scrollPrev}
            className="absolute -left-5 top-1/2 transform -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center z-10 transition-all hover:shadow-lg hover:scale-105"
            aria-label="Previous maps"
          >
            <svg className="w-5 h-5 text-gray-700 transform rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        )}
        
        {/* Right navigation arrow */}
        {canScrollNext && (
          <button 
            onClick={scrollNext}
            className="absolute -right-5 top-1/2 transform -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center z-10 transition-all hover:shadow-lg hover:scale-105"
            aria-label="Next maps"
          >
            <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
} 