'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import PostList from '@/components/PostList';
import socketService from '@/services/socketService';
import useSocketConnection from '@/hooks/useSocketConnection';
import SocketStatus from '@/components/SocketStatus';
import { getUserMaps, SavedMap } from '@/utils/mapUtils';
import api from '@/services/api';

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const [combinedItems, setCombinedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 10;
  
  // Use the socket connection hook for consistent connection management
  useSocketConnection({
    debugName: 'HomePage',
    checkInterval: 20000 // Check every 20 seconds
  });

  const fetchItems = async (skipCount = 0) => {
    try {
      setLoading(true);
      
      // Fetch both posts and maps in parallel
      const [postsResponse, maps] = await Promise.all([
        api.get(`/api/posts?limit=${LIMIT}&skip=${skipCount}`),
        getUserMaps()
      ]);

      // Convert maps to post-like format
      const mapPosts = maps.map(map => ({
        _id: map._id,
        headline: map.name,
        text: `${map.elementCount || 0} elements, ${map.connectionCount || 0} connections`,
        author: map.user,
        createdAt: map.createdAt,
        updatedAt: map.updatedAt || map.lastSaved,
        comments: map.comments || [],
        isMap: true, // Add flag to identify maps
        mapData: map // Store original map data
      }));

      // Combine and sort all items by date
      const allItems = [...postsResponse.data.posts, ...mapPosts].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      if (skipCount === 0) {
        setCombinedItems(allItems);
      } else {
        setCombinedItems(prev => [...prev, ...allItems]);
      }

      setHasMore(postsResponse.data.hasMore);
      setSkip(skipCount + LIMIT);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems(0);
  }, []);

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      fetchItems(skip);
    }
  };
  
  const handleItemUpdate = () => {
    fetchItems(0);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <PostList 
          onPostUpdated={handleItemUpdate}
          posts={combinedItems}
          hasMorePosts={hasMore}
          onLoadMore={handleLoadMore}
          isLoading={loading}
        />
      </div>
      <SocketStatus />
    </div>
  );
}