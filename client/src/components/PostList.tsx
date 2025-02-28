'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import CommentSection, { Comment, User } from './CommentSection';
import Image from 'next/image';
import FormatToolbar from './FormatToolbar';
import ReactMarkdown from 'react-markdown';

interface Post {
  _id: string;
  headline: string;
  text: string;
  imageUrl?: string;
  author: User;
  createdAt: string;
  updatedAt: string;
  comments: Comment[];
}

interface PostListProps {
  onPostUpdated: () => void;
}

export default function PostList({ onPostUpdated }: PostListProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [editHeadline, setEditHeadline] = useState('');
  const [editText, setEditText] = useState('');
  const [headline, setHeadline] = useState('');
  const [text, setText] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>('');
  const { user } = useAuth();
  const [showFormatToolbar, setShowFormatToolbar] = useState(false);
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  const fetchPosts = async () => {
    try {
      const response = await fetch('/api/posts');
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
    setEditText(post.text);
  };

  const handleCancelEdit = () => {
    setEditingPost(null);
    setEditHeadline('');
    setEditText('');
  };

  const handleUpdate = async (postId: string) => {
    try {
      const response = await fetch(`/api/posts/${postId}`, {
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
      const response = await fetch(`/api/posts/${postId}`, {
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
      return `${createdTime}   Edited ${editedTime}`;
    }
    
    return createdTime;
  };

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('https://api.imgbb.com/1/upload?key=YOUR_IMGBB_API_KEY', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        setImageUrl(data.data.url);
      } else {
        throw new Error('Failed to upload image');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!headline.trim() || !text.trim()) return;

    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          headline,
          text,
          imageUrl
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create post');
      }

      setHeadline('');
      setText('');
      setImageUrl('');
      setSelectedImage(null);
      onPostUpdated();
      fetchPosts();
    } catch (error) {
      console.error('Error creating post:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent, postId?: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (postId) {
        handleUpdate(postId);
      } else {
        handleSubmit(e);
      }
    }
  };

  const handleFormat = (type: string, selection: { start: number; end: number }) => {
    if (!textInputRef.current) return;

    const input = textInputRef.current;
    const currentText = input.value;
    let newText = currentText;
    let newCursorPos = selection.end;

    switch (type) {
      case 'bold':
        newText = currentText.slice(0, selection.start) + `**${currentText.slice(selection.start, selection.end)}**` + currentText.slice(selection.end);
        newCursorPos += 2;
        break;
      case 'italic':
        newText = currentText.slice(0, selection.start) + `*${currentText.slice(selection.start, selection.end)}*` + currentText.slice(selection.end);
        newCursorPos += 1;
        break;
      case 'link':
        const url = prompt('Enter URL:');
        if (url) {
          newText = currentText.slice(0, selection.start) + `[${currentText.slice(selection.start, selection.end)}](${url})` + currentText.slice(selection.end);
          newCursorPos = selection.start + newText.length;
        }
        break;
      case 'clear':
        // Remove markdown formatting
        newText = currentText.slice(selection.start, selection.end)
          .replace(/\*\*/g, '')  // Remove bold
          .replace(/\*/g, '')    // Remove italic
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Remove links
        newText = currentText.slice(0, selection.start) + newText + currentText.slice(selection.end);
        break;
    }

    setText(newText);
    input.value = newText;
    input.focus();
    input.setSelectionRange(newCursorPos, newCursorPos);
    setShowFormatToolbar(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      setShowFormatToolbar(true);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    } else if (e.key === 'Escape') {
      setShowFormatToolbar(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-4">
            <div className="flex items-stretch">
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                onKeyDown={(e) => handleKeyPress(e)}
                className="flex-grow p-2 border-none focus:outline-none text-[#000000]"
                placeholder="Headline"
              />
              <button
                onClick={handleSubmit}
                className="px-6 py-2 bg-gray-600 text-white hover:bg-gray-700 transition-colors"
              >
                Post
              </button>
            </div>
          </div>
          <div className="relative">
            <textarea
              ref={textInputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full p-2 border rounded-lg focus:outline-none text-[#000000] min-h-[100px] mb-3"
              placeholder="Post text (Press Tab for formatting options)"
            />
            <FormatToolbar
              inputRef={textInputRef}
              isVisible={showFormatToolbar}
              onClose={() => setShowFormatToolbar(false)}
              onFormat={handleFormat}
            />
          </div>
          <div className="flex items-center space-x-3">
            <label className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg cursor-pointer hover:bg-gray-700 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
              </svg>
              Add Image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setSelectedImage(file);
                    handleImageUpload(file);
                  }
                }}
              />
            </label>
            {uploadingImage && <span className="text-gray-600">Uploading...</span>}
            {selectedImage && !uploadingImage && <span className="text-gray-600">{selectedImage.name}</span>}
          </div>
          {imageUrl && (
            <div className="mt-3 relative w-full" style={{ height: '200px' }}>
              <Image 
                src={imageUrl} 
                alt="Preview" 
                fill
                style={{ objectFit: 'contain' }}
                className="rounded-lg"
              />
              <button
                onClick={() => {
                  setImageUrl('');
                  setSelectedImage(null);
                }}
                className="absolute top-2 right-2 p-1 bg-gray-800 bg-opacity-50 rounded-full text-white hover:bg-opacity-70 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {posts.map((post) => (
        <div key={post._id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {editingPost === post._id ? (
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center space-x-2">
                  <span className="text-gray-800">{post.author.username}</span>
                  <span className="text-gray-500 text-sm">{getPostTimestamp(post)}</span>
                </div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-4">
                <div className="flex items-stretch">
                  <input
                    type="text"
                    value={editHeadline}
                    onChange={(e) => setEditHeadline(e.target.value)}
                    onKeyDown={(e) => handleKeyPress(e, post._id)}
                    className="flex-grow p-2 border-none focus:outline-none text-[#000000]"
                    placeholder="Headline"
                  />
                  <button
                    onClick={() => handleUpdate(post._id)}
                    className="px-6 py-2 bg-gray-600 text-white hover:bg-gray-700 transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => handleKeyPress(e, post._id)}
                className="w-full p-2 border rounded-lg focus:outline-none text-[#000000] min-h-[100px]"
                placeholder="Post text"
              />
            </div>
          ) : (
            <>
              <div className="p-4">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-800">{post.author.username}</span>
                    <span className="text-gray-500 text-sm">{getPostTimestamp(post)}</span>
                  </div>
                  {user && user._id === post.author._id && (
                    <div className="space-x-2 text-sm">
                      <button
                        onClick={() => handleEdit(post)}
                        className="text-gray-600 hover:text-gray-800"
                      >
                        edit
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={() => handleDelete(post._id)}
                        className="text-gray-600 hover:text-gray-800"
                      >
                        delete
                      </button>
                    </div>
                  )}
                </div>
                <h2 className="text-xl font-semibold mb-3 text-black">{post.headline}</h2>
                {post.imageUrl && (
                  <div className="mb-4 relative w-full" style={{ height: '400px' }}>
                    <Image 
                      src={post.imageUrl} 
                      alt={post.headline}
                      fill
                      style={{ objectFit: 'contain' }}
                      className="rounded-lg"
                    />
                  </div>
                )}
                <div className="prose prose-sm max-w-none !text-black [&>*]:text-black [&_p]:!text-black [&_strong]:!text-black [&_em]:!text-black">
                  <ReactMarkdown
                    components={{
                      p: ({children}) => <p className="!text-black">{children}</p>,
                      strong: ({children}) => <strong className="!text-black">{children}</strong>,
                      em: ({children}) => <em className="!text-black">{children}</em>,
                      a: ({ href, children }) => {
                        const isExternal = href?.startsWith('http') || href?.startsWith('www');
                        const finalHref = isExternal ? href : `https://${href}`;
                        return (
                          <a 
                            href={finalHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="!text-blue-600 hover:!text-blue-800"
                          >
                            {children}
                          </a>
                        );
                      }
                    }}
                  >
                    {post.text}
                  </ReactMarkdown>
                </div>
              </div>
              <CommentSection postId={post._id} initialComments={post.comments} />
            </>
          )}
        </div>
      ))}
    </div>
  );
} 