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

// Define the Map interface
interface UserMap {
  _id: string;
  name: string;
  user: {
    _id: string;
    username: string;
    badge?: string;
  };
  createdAt: string;
  updatedAt: string;
  elementCount: number;
  connectionCount: number;
  isMap: boolean;
  headline?: string;
  text?: string;
  author?: any;
  comments?: any[];
  likes?: any[];
  dislikes?: any[];
}

export default function UserProfile() {
  const { username } = useParams();
  const { user: currentUser } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [maps, setMaps] = useState<UserMap[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [loadingMoreMaps, setLoadingMoreMaps] = useState(false);
  const [error, setError] = useState('');
  const [postsSkip, setPostsSkip] = useState(0);
  const [mapsSkip, setMapsSkip] = useState(0);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [hasMoreMaps, setHasMoreMaps] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'maps'>('posts');
  const [mapsLoaded, setMapsLoaded] = useState(false);
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
      // Only fetch user data and posts initially
      const [userResponse, postsResponse] = await Promise.all([
        api.get(`/api/users/${username}`),
        api.get(`/api/users/${username}/posts?limit=${LIMIT}&skip=0`)
      ]);

      setUser(userResponse.data);
      setPosts(postsResponse.data.posts);
      setBio(userResponse.data.bio || '');
      setHasMorePosts(postsResponse.data.hasMore);
      setPostsSkip(LIMIT);
    } catch (error) {
      console.error('Error fetching user data:', error);
      setError('Failed to load user data');
    } finally {
      setInitialLoading(false);
    }
  };

  const fetchUserMaps = async () => {
    if (mapsLoaded) return;
    
    try {
      const mapsResponse = await api.get(`/api/users/${username}/maps?limit=${LIMIT}&skip=0`);
      
      // Process maps to fit the expected format for PostList
      const processedMaps = mapsResponse.data.maps.map((map: any) => ({
        ...map,
        isMap: true,
        headline: map.name,
        text: `Elements: ${map.elementCount}, Connections: ${map.connectionCount}`,
        author: map.user,
        likes: [],
        dislikes: [],
        comments: map.comments || []
      }));
      
      setMaps(processedMaps);
      setHasMoreMaps(mapsResponse.data.hasMore);
      setMapsSkip(LIMIT);
      setMapsLoaded(true);
    } catch (error) {
      console.error('Error fetching maps:', error);
    }
  };

  const loadMorePosts = async () => {
    if (loadingMorePosts || !hasMorePosts) return;

    setLoadingMorePosts(true);
    try {
      const response = await api.get(`/api/users/${username}/posts?limit=${LIMIT}&skip=${postsSkip}`);
      setPosts(prev => [...prev, ...response.data.posts]);
      setHasMorePosts(response.data.hasMore);
      setPostsSkip(prev => prev + LIMIT);
    } catch (error) {
      console.error('Error loading more posts:', error);
    } finally {
      setLoadingMorePosts(false);
    }
  };

  const loadMoreMaps = async () => {
    if (loadingMoreMaps || !hasMoreMaps) return;

    setLoadingMoreMaps(true);
    try {
      const response = await api.get(`/api/users/${username}/maps?limit=${LIMIT}&skip=${mapsSkip}`);
      
      // Process maps to fit the expected format for PostList
      const processedMaps = response.data.maps.map((map: any) => ({
        ...map,
        isMap: true,
        headline: map.name,
        text: `Elements: ${map.elementCount}, Connections: ${map.connectionCount}`,
        author: map.user,
        likes: [],
        dislikes: [],
        comments: map.comments || []
      }));
      
      setMaps(prev => [...prev, ...processedMaps]);
      setHasMoreMaps(response.data.hasMore);
      setMapsSkip(prev => prev + LIMIT);
    } catch (error) {
      console.error('Error loading more maps:', error);
    } finally {
      setLoadingMoreMaps(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [username]);

  // Load maps data when maps tab is activated
  useEffect(() => {
    if (activeTab === 'maps' && !mapsLoaded && !initialLoading) {
      fetchUserMaps();
    }
  }, [activeTab, mapsLoaded, initialLoading]);

  const handlePostUpdated = () => {
    setPostsSkip(0);
    setMapsSkip(0);
    setHasMorePosts(true);
    setHasMoreMaps(true);
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

  const handleTabChange = (tab: 'posts' | 'maps') => {
    setActiveTab(tab);
    if (tab === 'maps' && !mapsLoaded) {
      fetchUserMaps();
    }
  };

  if (initialLoading) return <div className="text-center p-4">Loading...</div>;
  if (error) return <div className="text-center p-4 text-red-500">{error}</div>;
  if (!user) return <div className="text-center p-4">User not found</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 mt-8">
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
        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-4">
          <button
            className={`py-2 px-4 mr-2 font-medium text-sm focus:outline-none ${
              activeTab === 'posts'
                ? 'text-black border-b-2 border-gray-800 font-semibold'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => handleTabChange('posts')}
          >
            Posts
          </button>
          <button
            className={`py-2 px-4 font-medium text-sm focus:outline-none ${
              activeTab === 'maps'
                ? 'text-black border-b-2 border-gray-800 font-semibold'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => handleTabChange('maps')}
          >
            Maps
          </button>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'posts' && (
          <PostList 
            posts={posts} 
            onPostUpdated={handlePostUpdated}
            showPostCreation={false}
            hasMorePosts={hasMorePosts}
            onLoadMore={loadMorePosts}
            isLoading={loadingMorePosts}
          />
        )}

        {activeTab === 'maps' && (
          <PostList 
            posts={maps as Post[]} 
            onPostUpdated={handlePostUpdated}
            showPostCreation={false}
            hasMorePosts={hasMoreMaps}
            onLoadMore={loadMoreMaps}
            isLoading={loadingMoreMaps || (!mapsLoaded && !initialLoading)}
          />
        )}
      </div>
    </div>
  );
} 