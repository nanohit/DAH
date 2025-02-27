'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

interface Post {
  _id: string;
  headline: string;
  text: string;
  imageUrl?: string;
  author: {
    _id: string;
    username: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface PostListProps {
  onPostUpdated: () => void;
}

export default function PostList({ onPostUpdated }: PostListProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [editHeadline, setEditHeadline] = useState('');
  const [editText, setText] = useState('');
  const { user } = useAuth();

  const fetchPosts = async () => {
    try {
      const response = await fetch('https://dah-tyxc.onrender.com/api/posts');
      if (!response.ok) {
        throw new Error('Failed to fetch posts');
      }
      const data = await response.json();
      setPosts(data);
    } catch (error) {
      console.error('Error fetching posts:', error);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleEdit = (post: Post) => {
    setEditingPost(post._id);
    setEditHeadline(post.headline);
    setText(post.text);
  };

  const handleCancelEdit = () => {
    setEditingPost(null);
    setEditHeadline('');
    setText('');
  };

  const handleUpdate = async (postId: string) => {
    try {
      const response = await fetch(`https://dah-tyxc.onrender.com/api/posts/${postId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          headline: editHeadline,
          text: editText
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update post');
      }

      handleCancelEdit();
      onPostUpdated();
      fetchPosts();
    } catch (error) {
      console.error('Error updating post:', error);
    }
  };

  const handleDelete = async (postId: string) => {
    if (!window.confirm('Are you sure you want to delete this post?')) {
      return;
    }

    try {
      const response = await fetch(`https://dah-tyxc.onrender.com/api/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete post');
      }

      onPostUpdated();
      fetchPosts();
    } catch (error) {
      console.error('Error deleting post:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const time = `${hours}:${minutes}`;
    
    // Check if the date is today
    if (date.toDateString() === now.toDateString()) {
      return `${time} Today`;
    }
    
    // Check if the date was yesterday
    if (date.toDateString() === yesterday.toDateString()) {
      return `${time} Yesterday`;
    }
    
    // For older dates, show the full date
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${time} ${day}.${month}.${year}`;
  };

  const getPostTimestamp = (post: Post) => {
    const createdTime = formatDate(post.createdAt);
    const wasEdited = post.updatedAt && new Date(post.updatedAt).getTime() > new Date(post.createdAt).getTime();
    
    if (wasEdited) {
      const editedTime = formatDate(post.updatedAt);
      return `${post.author.username} ${createdTime}   Edited ${editedTime}`;
    }
    
    return `${post.author.username} ${createdTime}`;
  };

  return (
    <div className="space-y-6">
      {posts.map((post) => (
        <div key={post._id} className="bg-white p-6 rounded-lg shadow-md">
          {editingPost === post._id ? (
            <div>
              <input
                type="text"
                value={editHeadline}
                onChange={(e) => setEditHeadline(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              />
              <textarea
                value={editText}
                onChange={(e) => setText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] mb-4"
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleUpdate(post._id)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold mb-2">{post.headline}</h2>
              <div className="text-sm text-gray-600 mb-4">
                {getPostTimestamp(post)}
              </div>
              {post.imageUrl && (
                <div className="mb-4">
                  <img 
                    src={post.imageUrl} 
                    alt={post.headline}
                    className="w-full h-auto rounded-lg shadow-sm"
                  />
                </div>
              )}
              <p className="text-gray-800 mb-4 whitespace-pre-wrap">{post.text}</p>
              {user && user._id === post.author._id && (
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => handleEdit(post)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(post._id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
} 