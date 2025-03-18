'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/services/api';
import { format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import PostList, { Post } from '@/components/PostList';

interface User {
  _id: string;
  username: string;
  bio: string;
  badge: string;
  profilePicture: string;
  createdAt: string;
}

export default function UserProfile() {
  const { username } = useParams();
  const { user: currentUser } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 10;

  const badges = [
    '',
    'platinum shitposter✨',
    'aesthete💅',
    'lurker👁',
    'dialectician disaster ⚖️',
    'researcher🔍',
    'nerd🤖',
    'cynic🕯️',
    'melancholic🌑',
    'soloist🎭',
    'ancap🐍',
    'commie🇨🇳',
    'local schizo',
    ...(username === 'nano' ? ['Architector'] : [])
  ];

  const fetchUserData = async () => {
    try {
      setInitialLoading(true);
      const [userResponse, postsResponse] = await Promise.all([
        api.get(`/api/users/${username}`),
        api.get(`/api/users/${username}/posts?limit=${LIMIT}&skip=0`)
      ]);

      setUser(userResponse.data);
      setPosts(postsResponse.data.posts);
      setBio(userResponse.data.bio || '');
      setHasMore(postsResponse.data.hasMore);
      setSkip(LIMIT);
    } catch (error) {
      console.error('Error fetching user data:', error);
      setError('Failed to load user data');
    } finally {
      setInitialLoading(false);
    }
  };

  const loadMorePosts = async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const response = await api.get(`/api/users/${username}/posts?limit=${LIMIT}&skip=${skip}`);
      setPosts(prev => [...prev, ...response.data.posts]);
      setHasMore(response.data.hasMore);
      setSkip(prev => prev + LIMIT);
    } catch (error) {
      console.error('Error loading more posts:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [username]);

  const handlePostUpdated = () => {
    setSkip(0);
    setHasMore(true);
    fetchUserData();
  };

  const handleBioUpdate = async () => {
    if (!user) return;
    try {
      await api.patch(`/api/users/${user._id}/bio`, { bio });
      setUser(prev => prev ? { ...prev, bio } : null);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating bio:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleBioUpdate();
    }
  };

  const handleBadgeUpdate = async (newBadge: string) => {
    if (!user) return;
    try {
      await api.patch(`/api/users/${user._id}/badge`, { badge: newBadge });
      setUser(prev => prev ? { ...prev, badge: newBadge } : null);
    } catch (error) {
      console.error('Error updating badge:', error);
    }
  };

  if (initialLoading) return <div className="text-center p-4">Loading...</div>;
  if (error) return <div className="text-center p-4 text-red-500">{error}</div>;
  if (!user) return <div className="text-center p-4">User not found</div>;

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center gap-4">
          {user.profilePicture && (
            <img
              src={user.profilePicture}
              alt={`${user.username}'s profile`}
              className="w-20 h-20 rounded-full object-cover"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold text-black">{user.username}</h1>
            {user.badge && (
              <div className="text-sm text-gray-500 mt-1">{user.badge}</div>
            )}
            <p className="text-gray-500">
              Joined {format(new Date(user.createdAt), 'MMMM d, yyyy')}
            </p>
            {currentUser?.username === user.username && (
              <select
                value={user.badge || ''}
                onChange={(e) => handleBadgeUpdate(e.target.value)}
                className="mt-2 p-1 text-sm border rounded text-gray-700"
              >
                <option value="">Select your badge</option>
                {badges.filter(b => b).map((badge) => (
                  <option key={badge} value={badge}>
                    {badge}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="mt-4">
          {isEditing && currentUser?.username === user.username ? (
            <div className="flex gap-2">
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                onKeyDown={handleKeyPress}
                className="w-full p-2 border rounded text-black"
                placeholder="Write something about yourself..."
              />
              <button
                onClick={handleBioUpdate}
                className="px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setBio(user.bio);
                }}
                className="px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="relative">
              <p className="text-gray-700">{user.bio || 'No bio yet'}</p>
              {currentUser?.username === user.username && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="absolute top-0 right-0 text-gray-600 hover:text-gray-700"
                >
                  Edit bio
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4 text-black">Posts by {user.username}</h2>
        <PostList 
          posts={posts} 
          onPostUpdated={handlePostUpdated} 
          showPostCreation={false}
          hasMorePosts={hasMore}
          onLoadMore={loadMorePosts}
          isLoading={loadingMore}
        />
      </div>
    </div>
  );
} 