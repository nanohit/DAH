'use client';

import { useState } from 'react';
import PostList from '@/components/PostList';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function BookmarksPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  const handlePostUpdated = () => {
    setKey(prev => prev + 1);
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Bookmarked Posts</h1>
      <PostList onPostUpdated={handlePostUpdated} isBookmarksPage={true} />
    </div>
  );
} 