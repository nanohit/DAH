'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import PostList from '@/components/PostList';

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);

  const handlePostUpdate = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <PostList key={refreshKey} onPostUpdated={handlePostUpdate} />
      </div>
    </div>
  );
}