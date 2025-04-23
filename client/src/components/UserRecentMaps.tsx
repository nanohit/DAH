'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import axios from 'axios';

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

export default function UserRecentMaps({ maxMaps = 3 }: UserRecentMapsProps) {
  const { isAuthenticated, user } = useAuth();
  const [maps, setMaps] = useState<MapData[]>([]);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);

  const fetchMaps = async () => {
    // Only fetch if authenticated and we have a user ID
    if (isAuthenticated && user && user._id) {
      const token = localStorage.getItem('token');
      if (!token) {
        setHasAttemptedLoad(true);
        return;
      }

      try {
        // Use the standard /api/maps endpoint that definitely exists
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
          
          // Take only the 3 most recent
          setMaps(sortedMaps.slice(0, maxMaps));
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
        // Option 1: Remove the deleted map directly from state
        setMaps(prevMaps => prevMaps.filter(map => map._id !== event.detail.mapId));
        
        // Option 2: Or simply refetch all maps (as backup)
        fetchMaps();
      }
    };
    
    // TypeScript cast for CustomEvent
    window.addEventListener('map-deleted', handleMapDeleted as EventListener);
    
    // Clean up event listener
    return () => {
      window.removeEventListener('map-deleted', handleMapDeleted as EventListener);
    };
  }, [isAuthenticated, user, maxMaps]);

  // Don't render anything if not authenticated or if we've attempted to load but have no maps
  if (!isAuthenticated || !user || (hasAttemptedLoad && maps.length === 0)) {
    return null;
  }

  // Prepare items for rendering - maps first, then create new map button
  const displayItems = [];
  
  // Add maps first
  maps.forEach((map, idx) => {
    displayItems.push(
      <Link href={`/maps?id=${map._id}`} key={map._id || idx} className="block">
        <div className="border border-gray-200 rounded-lg h-[80px] flex items-start bg-white p-4 pt-3 md:pt-5 transition-all duration-300 ease-in-out hover:translate-y-[-3px] hover:shadow-[0_2px_0_rgba(0,0,0,0.1)]">
          <span className="text-gray-700 font-medium line-clamp-2 md:line-clamp-2 line-clamp-3 text-left overflow-hidden text-xs md:text-sm break-words">
            {map.name || "Untitled Map"}
          </span>
        </div>
      </Link>
    );
  });
  
  // Add the create new map button directly after maps
  if (maps.length > 0) {
    displayItems.push(
      <Link href="/maps" key="create-new-map" className="block">
        <div className="border border-gray-200 rounded-lg h-[80px] flex items-center justify-center bg-white transition-all duration-300 ease-in-out hover:translate-y-[-5px] hover:shadow-[0_2px_0_rgba(0,0,0,0.1)]">
          <svg className="w-8 h-8 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
      </Link>
    );
  }
  
  // Add empty invisible placeholders to maintain grid layout
  const totalItemsNeeded = 4; // Always 4 columns
  const emptySpacesNeeded = totalItemsNeeded - displayItems.length;
  
  for (let i = 0; i < emptySpacesNeeded; i++) {
    displayItems.push(
      <div key={`empty-${i}`} className="border border-transparent rounded-lg h-[80px] opacity-0">
        <span className="text-gray-700 font-medium">Empty</span>
      </div>
    );
  }

  return (
    <div className="w-full px-0 mb-4">
      <div className="grid grid-cols-4 gap-3 mb-5">
        {displayItems}
      </div>
    </div>
  );
} 