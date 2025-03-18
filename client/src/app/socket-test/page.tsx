'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import socketService from '@/services/socketService';
import api from '@/services/api';

export default function SocketTestPage() {
  const { user, isAuthenticated } = useAuth();
  const [testPost, setTestPost] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedPostId, setSelectedPostId] = useState('');
  const [recentPosts, setRecentPosts] = useState<any[]>([]);

  // Add a log message
  const addLog = (message: string) => {
    setLogs(prev => [`${new Date().toLocaleTimeString()} - ${message}`, ...prev]);
  };

  // Check socket connection
  useEffect(() => {
    // Connect to socket
    socketService.connect();
    
    // Update connection status every second
    const interval = setInterval(() => {
      setIsConnected(socketService.isConnected());
    }, 1000);
    
    // Load recent posts for testing
    const fetchRecentPosts = async () => {
      try {
        const response = await api.get('/api/posts?limit=5');
        setRecentPosts(response.data.posts || []);
        if (response.data.posts?.length > 0) {
          setSelectedPostId(response.data.posts[0]._id);
        }
      } catch (error) {
        addLog('Error fetching posts: ' + (error as Error).message);
      }
    };
    
    fetchRecentPosts();
    
    return () => {
      clearInterval(interval);
    };
  }, []);

  // Handle socket room join
  const handleJoinRoom = () => {
    if (!selectedPostId) {
      addLog('Please select a post ID first');
      return;
    }
    
    try {
      socketService.joinPostRoom(selectedPostId);
      addLog(`Joined room for post: ${selectedPostId}`);
    } catch (error) {
      addLog(`Error joining room: ${(error as Error).message}`);
    }
  };

  // Handle socket room leave
  const handleLeaveRoom = () => {
    if (!selectedPostId) {
      addLog('Please select a post ID first');
      return;
    }
    
    try {
      socketService.leavePostRoom(selectedPostId);
      addLog(`Left room for post: ${selectedPostId}`);
    } catch (error) {
      addLog(`Error leaving room: ${(error as Error).message}`);
    }
  };

  // Create a test post
  const handleCreatePost = async () => {
    if (!isAuthenticated) {
      addLog('Please log in first');
      return;
    }
    
    try {
      addLog('Creating test post...');
      const postData = {
        headline: `Test Post ${new Date().toLocaleTimeString()}`,
        text: `This is a test post created at ${new Date().toISOString()}`
      };
      
      const response = await api.post('/api/posts', postData);
      setTestPost(response.data);
      setSelectedPostId(response.data._id);
      addLog(`Post created with ID: ${response.data._id}`);
      
      // Refresh recent posts
      const postsResponse = await api.get('/api/posts?limit=5');
      setRecentPosts(postsResponse.data.posts || []);
    } catch (error) {
      addLog(`Error creating post: ${(error as Error).message}`);
    }
  };

  // Update the test post
  const handleUpdatePost = async () => {
    if (!selectedPostId) {
      addLog('Please select a post first');
      return;
    }
    
    try {
      addLog(`Updating post ${selectedPostId}...`);
      const postData = {
        headline: `Updated Post ${new Date().toLocaleTimeString()}`,
        text: `This post was updated at ${new Date().toISOString()}`
      };
      
      const response = await api.patch(`/api/posts/${selectedPostId}`, postData);
      addLog(`Post updated: ${response.data._id}`);
      
      // Refresh recent posts
      const postsResponse = await api.get('/api/posts?limit=5');
      setRecentPosts(postsResponse.data.posts || []);
    } catch (error) {
      addLog(`Error updating post: ${(error as Error).message}`);
    }
  };

  // Like the test post
  const handleLikePost = async () => {
    if (!selectedPostId) {
      addLog('Please select a post first');
      return;
    }
    
    try {
      addLog(`Liking post ${selectedPostId}...`);
      const response = await api.post(`/api/posts/${selectedPostId}/like`);
      addLog(`Post liked: ${JSON.stringify(response.data)}`);
    } catch (error) {
      addLog(`Error liking post: ${(error as Error).message}`);
    }
  };

  // Dislike the test post
  const handleDislikePost = async () => {
    if (!selectedPostId) {
      addLog('Please select a post first');
      return;
    }
    
    try {
      addLog(`Disliking post ${selectedPostId}...`);
      const response = await api.post(`/api/posts/${selectedPostId}/dislike`);
      addLog(`Post disliked: ${JSON.stringify(response.data)}`);
    } catch (error) {
      addLog(`Error disliking post: ${(error as Error).message}`);
    }
  };

  // Bookmark the test post
  const handleBookmarkPost = async () => {
    if (!selectedPostId) {
      addLog('Please select a post first');
      return;
    }
    
    try {
      addLog(`Bookmarking post ${selectedPostId}...`);
      const response = await api.post(`/api/posts/${selectedPostId}/bookmark`);
      addLog(`Post bookmarked: ${JSON.stringify(response.data)}`);
    } catch (error) {
      addLog(`Error bookmarking post: ${(error as Error).message}`);
    }
  };

  // Function to check socket connections directly
  const checkSocketConnection = async () => {
    try {
      addLog('Checking socket connection...');
      
      // First verify if server's Socket.io is actually working
      // by making a special API call that will trigger a direct socket message
      const response = await api.get(`/api/debug/socket-test?postId=${selectedPostId}&userId=${user?._id || 'anonymous'}`);
      addLog(`Debug socket test initiated: ${response.data.message}`);
    } catch (error) {
      addLog(`Error checking socket: ${(error as Error).message}`);
    }
  };

  // Add a comment to the test post
  const handleAddComment = async () => {
    if (!selectedPostId) {
      addLog('Please select a post first');
      return;
    }
    
    try {
      addLog(`Adding comment to post ${selectedPostId}...`);
      const commentData = {
        content: `Test comment created at ${new Date().toISOString()}`
      };
      
      const response = await api.post(`/api/comments/post/${selectedPostId}`, commentData);
      addLog(`Comment added: ${response.data._id}`);
    } catch (error) {
      addLog(`Error adding comment: ${(error as Error).message}`);
    }
  };

  // Listen for socket events
  useEffect(() => {
    if (!selectedPostId) return;
    
    // Set up event listeners for the various socket events
    const onPostCreated = (post: any) => {
      addLog(`Socket Event: post-created received - ${post._id}`);
    };
    
    const onPostUpdated = (post: any) => {
      addLog(`Socket Event: post-updated received - ${post._id}`);
    };
    
    const onPostDeleted = (postId: string) => {
      addLog(`Socket Event: post-deleted received - ${postId}`);
    };
    
    const onPostLiked = (data: any) => {
      addLog(`Socket Event: post-liked received - ${data.postId}`);
    };
    
    const onPostDisliked = (data: any) => {
      addLog(`Socket Event: post-disliked received - ${data.postId}`);
    };
    
    const onPostBookmarked = (data: any) => {
      addLog(`Socket Event: post-bookmarked received - ${data.postId}`);
    };
    
    const onCommentCreated = (data: any) => {
      addLog(`Socket Event: comment-created received - ${data.comment._id}`);
    };
    
    const onCommentUpdated = (comment: any) => {
      addLog(`Socket Event: comment-updated received - ${comment._id}`);
    };
    
    const onCommentDeleted = (data: any) => {
      addLog(`Socket Event: comment-deleted received - ${data.commentId}`);
    };
    
    // Register the event listeners
    socketService.on('post-created', onPostCreated);
    socketService.on('post-updated', onPostUpdated);
    socketService.on('post-deleted', onPostDeleted);
    socketService.on('post-liked', onPostLiked);
    socketService.on('post-disliked', onPostDisliked);
    socketService.on('post-bookmarked', onPostBookmarked);
    socketService.on('comment-created', onCommentCreated);
    socketService.on('comment-updated', onCommentUpdated);
    socketService.on('comment-deleted', onCommentDeleted);
    
    // Clean up event listeners when the component unmounts
    return () => {
      socketService.off('post-created', onPostCreated);
      socketService.off('post-updated', onPostUpdated);
      socketService.off('post-deleted', onPostDeleted);
      socketService.off('post-liked', onPostLiked);
      socketService.off('post-disliked', onPostDisliked);
      socketService.off('post-bookmarked', onPostBookmarked);
      socketService.off('comment-created', onCommentCreated);
      socketService.off('comment-updated', onCommentUpdated);
      socketService.off('comment-deleted', onCommentDeleted);
    };
  }, [selectedPostId]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Socket.io Test Page</h1>
      
      <div className="p-4 border border-gray-300 rounded mb-4 flex items-center gap-2">
        <span>Socket Status:</span>
        <span className={`px-2 py-1 rounded text-white ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="p-4 border border-gray-300 rounded">
          <h2 className="text-xl font-bold mb-4">Select Post</h2>
          
          <div className="mb-4">
            <label className="block mb-2">Post ID:</label>
            <select 
              className="w-full p-2 border border-gray-300 rounded"
              value={selectedPostId}
              onChange={(e) => setSelectedPostId(e.target.value)}
            >
              <option value="">Select a post</option>
              {recentPosts.map(post => (
                <option key={post._id} value={post._id}>
                  {post.headline} ({post._id})
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex gap-2 mb-4">
            <button 
              onClick={handleJoinRoom}
              className="px-4 py-2 bg-blue-500 text-white rounded"
            >
              Join Room
            </button>
            <button 
              onClick={handleLeaveRoom}
              className="px-4 py-2 bg-red-500 text-white rounded"
            >
              Leave Room
            </button>
          </div>
        </div>
        
        <div className="p-4 border border-gray-300 rounded">
          <h2 className="text-xl font-bold mb-4">Test Actions</h2>
          
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={handleCreatePost}
              className="px-4 py-2 bg-green-500 text-white rounded"
              disabled={!isAuthenticated}
            >
              Create Post
            </button>
            
            <button 
              onClick={handleUpdatePost}
              className="px-4 py-2 bg-yellow-500 text-white rounded"
              disabled={!selectedPostId || !isAuthenticated}
            >
              Update Post
            </button>
            
            <button 
              onClick={handleLikePost}
              className="px-4 py-2 bg-blue-500 text-white rounded"
              disabled={!selectedPostId || !isAuthenticated}
            >
              Like Post
            </button>
            
            <button 
              onClick={handleDislikePost}
              className="px-4 py-2 bg-orange-500 text-white rounded"
              disabled={!selectedPostId || !isAuthenticated}
            >
              Dislike Post
            </button>
            
            <button 
              onClick={handleBookmarkPost}
              className="px-4 py-2 bg-purple-500 text-white rounded"
              disabled={!selectedPostId || !isAuthenticated}
            >
              Bookmark Post
            </button>
            
            <button 
              onClick={handleAddComment}
              className="px-4 py-2 bg-indigo-500 text-white rounded"
              disabled={!selectedPostId || !isAuthenticated}
            >
              Add Comment
            </button>
            
            <button 
              onClick={checkSocketConnection}
              className="px-4 py-2 bg-red-500 text-white rounded col-span-2"
              disabled={!selectedPostId}
            >
              Test Socket Connection
            </button>
          </div>
        </div>
      </div>
      
      <div className="p-4 border border-gray-300 rounded">
        <h2 className="text-xl font-bold mb-4">Event Log</h2>
        <div className="bg-gray-100 p-4 rounded h-60 overflow-auto">
          {logs.length === 0 ? (
            <p className="text-gray-500">No events logged yet...</p>
          ) : (
            <ul className="space-y-1">
              {logs.map((log, index) => (
                <li key={index} className="text-sm font-mono">{log}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
} 