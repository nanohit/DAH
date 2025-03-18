'use client';

import { useState, useEffect } from 'react';
import api from '@/services/api';
import socketService from '@/services/socketService';
import { useAuth } from '@/context/AuthContext';

export default function TestPage() {
  const { user, isAuthenticated } = useAuth();
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // Check socket connection status periodically
  useEffect(() => {
    socketService.connect();
    
    const interval = setInterval(() => {
      setIsConnected(socketService.isConnected());
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Add a log message
  const addLog = (message: string) => {
    setLogs(prev => [`${new Date().toLocaleTimeString()} - ${message}`, ...prev]);
  };

  const testSocket = async () => {
    try {
      setLoading(true);
      const result = await api.get('/api/debug/socket-test');
      setResponse(result.data);
      addLog(`Socket test initiated: ${result.data.message || 'No message'}`);
    } catch (error) {
      console.error('Socket test error:', error);
      setResponse({ error: (error as Error).message });
      addLog(`Error: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const testPing = async () => {
    try {
      setLoading(true);
      addLog('Sending ping to server...');
      const success = await socketService.ping();
      addLog(success ? 'Ping successful! Connection works.' : 'Ping failed. Connection may be broken.');
    } catch (error) {
      addLog(`Ping error: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const createTestPost = async () => {
    if (!isAuthenticated) {
      addLog('You must be logged in to create a post');
      return;
    }
    
    try {
      setLoading(true);
      addLog('Creating test post...');
      
      const postData = {
        headline: `Real-time test post - ${new Date().toLocaleTimeString()}`,
        text: `This is a test post created at ${new Date().toISOString()} to verify real-time functionality.`,
      };
      
      const response = await api.post('/api/posts', postData);
      addLog(`Post created with ID: ${response.data._id}`);
      setResponse(response.data);
    } catch (error) {
      addLog(`Error creating post: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const likeLatestPost = async () => {
    if (!isAuthenticated || !response?._id) {
      addLog('You must be logged in and have created a test post');
      return;
    }
    
    try {
      setLoading(true);
      addLog(`Liking post ${response._id}...`);
      const result = await api.post(`/api/posts/${response._id}/like`);
      addLog('Post liked successfully');
    } catch (error) {
      addLog(`Error liking post: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const commentOnLatestPost = async () => {
    if (!isAuthenticated || !response?._id) {
      addLog('You must be logged in and have created a test post');
      return;
    }
    
    try {
      setLoading(true);
      addLog(`Adding comment to post ${response._id}...`);
      
      const commentData = {
        content: `This is a test comment created at ${new Date().toISOString()}`,
      };
      
      const result = await api.post(`/api/comments/post/${response._id}`, commentData);
      addLog(`Comment added with ID: ${result.data._id}`);
    } catch (error) {
      addLog(`Error adding comment: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Socket.io Real-Time Test Page</h1>
      
      <div className="mb-4 p-4 flex items-center gap-4 border border-gray-300 rounded">
        <span>Socket Status:</span>
        <span className={`px-3 py-1 rounded-full text-white text-sm ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      
      <div className="mb-4">
        <p className="mb-2">This page lets you test if real-time updates are working properly.</p>
        <p className="text-sm text-gray-600 mb-4">
          Open another browser window with the main app to see real-time updates in action.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          <button 
            onClick={testSocket}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            Test Socket Connection
          </button>
          
          <button 
            onClick={testPing}
            disabled={loading || !isConnected}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
          >
            Send Ping
          </button>
          
          <button 
            onClick={createTestPost}
            disabled={loading || !isAuthenticated}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            Create Test Post
          </button>
          
          <button 
            onClick={likeLatestPost}
            disabled={loading || !isAuthenticated || !response?._id}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
          >
            Like Test Post
          </button>
          
          <button 
            onClick={commentOnLatestPost}
            disabled={loading || !isAuthenticated || !response?._id}
            className="px-4 py-2 md:col-span-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50"
          >
            Comment on Test Post
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 border border-gray-300 rounded bg-gray-50">
          <h2 className="text-lg font-bold mb-2">Log:</h2>
          <div className="bg-white p-2 rounded h-60 overflow-auto border border-gray-200">
            {logs.length === 0 ? (
              <p className="text-gray-500 p-2">No logs yet. Test the connection to see logs.</p>
            ) : (
              <ul className="space-y-1">
                {logs.map((log, index) => (
                  <li key={index} className="text-xs font-mono border-b border-gray-100 py-1">{log}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
        
        <div className="p-4 border border-gray-300 rounded bg-gray-50">
          <h2 className="text-lg font-bold mb-2">Last Response:</h2>
          <div className="bg-white p-2 rounded overflow-auto h-60 border border-gray-200">
            {!response ? (
              <p className="text-gray-500 p-2">No response data yet. Click a button to make a request.</p>
            ) : (
              <pre className="text-xs">{JSON.stringify(response, null, 2)}</pre>
            )}
          </div>
        </div>
      </div>
      
      <div className="mt-8">
        <h2 className="text-lg font-bold mb-2">Real-Time Testing Instructions:</h2>
        <ol className="list-decimal pl-5 space-y-2">
          <li>Open two browser windows side by side</li>
          <li>In Window 1: Navigate to the homepage (http://localhost:3000)</li>
          <li>In Window 2: Stay on this test page</li>
          <li>Click "Create Test Post" to create a new post</li>
          <li>Verify the post appears instantly in Window 1 without refreshing</li>
          <li>Click "Like Test Post" to like the post</li>
          <li>Verify the like count updates instantly in Window 1</li>
          <li>Click "Comment on Test Post" to add a comment</li>
          <li>Verify the comment appears instantly if the post is expanded in Window 1</li>
        </ol>
      </div>
    </div>
  );
} 