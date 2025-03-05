'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import CommentSection, { Comment, User } from './CommentSection';
import Image from 'next/image';
import FormatToolbar from './FormatToolbar';
import ReactMarkdown from 'react-markdown';
import type { ComponentProps } from 'react';
import Link from 'next/link';
import { useParticles } from '@/hooks/useParticles';
import UserBadge from './UserBadge';
import { usePathname } from 'next/navigation';
import api from '@/services/api';

export interface Post {
  _id: string;
  headline: string;
  text: string;
  imageUrl?: string;
  author: {
    _id: string;
    username: string;
    badge?: string;
  };
  createdAt: string;
  updatedAt: string;
  comments: Comment[];
  likes: string[];
  dislikes: string[];
  bookmarks: Array<{
    user: string;
    timestamp: string;
  }>;
}

interface PostListProps {
  onPostUpdated: () => void;
  isBookmarksPage?: boolean;
  posts?: Post[];
  showPostCreation?: boolean;
  hasMorePosts?: boolean;
  onLoadMore?: () => void;
  isLoading?: boolean;
}

export default function PostList({ 
  onPostUpdated, 
  isBookmarksPage = false, 
  posts: initialPosts, 
  showPostCreation = true,
  hasMorePosts,
  onLoadMore,
  isLoading = false
}: PostListProps) {
  useParticles(); // Initialize particles animation
  const pathname = usePathname();
  const isMainPage = pathname === '/';

  console.log('=== PostList Component Mounted ===');
  console.log('Initial props:', { isBookmarksPage, initialPosts });

  const [posts, setPosts] = useState<Post[]>(initialPosts || []);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [skip, setSkip] = useState(0);
  const LIMIT = 10;
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [editHeadline, setEditHeadline] = useState('');
  const [editText, setEditText] = useState('');
  const [headline, setHeadline] = useState('');
  const [text, setText] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>('');
  const { user, isAuthenticated } = useAuth();
  const [showFormatToolbar, setShowFormatToolbar] = useState(false);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState('');
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Update posts when initialPosts changes
  useEffect(() => {
    if (initialPosts) {
      setPosts(initialPosts);
    }
  }, [initialPosts]);

  const fetchPosts = async (skipCount = 0) => {
    if (initialPosts) {
      return;
    }

    try {
      setLoading(true);
      const endpoint = isBookmarksPage ? '/api/posts/bookmarked' : '/api/posts';
      const response = await api.get(`${endpoint}?limit=${LIMIT}&skip=${skipCount}`);
      
      if (skipCount === 0) {
        setPosts(response.data.posts);
      } else {
        setPosts(prevPosts => [...prevPosts, ...response.data.posts]);
      }
      setHasMore(response.data.hasMore);
      setSkip(skipCount + LIMIT);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Restore the initial fetch for the main/bookmarks page
  useEffect(() => {
    if (!initialPosts) {
      fetchPosts(0);
    }
  }, [isBookmarksPage, initialPosts]);

  const loadMorePosts = () => {
    if (loading || isLoading) return;
    
    if (onLoadMore) {
      onLoadMore();
    } else if (hasMore) {
      fetchPosts(skip);
    }
  };

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
      await api.patch(`/api/posts/${postId}`, {
        headline: editHeadline,
        text: editText
      });

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
      await api.delete(`/api/posts/${postId}`);
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

      const response = await fetch(`https://api.imgbb.com/1/upload?key=dea282c8a3ed6b4d82eed4ea65ab3826`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        setImageUrl(data.data.display_url);
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
    if (!headline.trim() && !text.trim() && !imageUrl) return;

    try {
      await api.post('/api/posts', {
        headline: headline.trim() || undefined,
        text: text.trim() || undefined,
        imageUrl
      });

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

  type MarkdownComponentProps = {
    children?: React.ReactNode;
    [key: string]: any;
  };

  // @ts-ignore - Working around react-markdown type issues
  const markdownComponents = {
    p: ({ children, ...props }: MarkdownComponentProps) => (
      <p className="!text-black" {...props}>{children}</p>
    ),
    strong: ({ children, ...props }: MarkdownComponentProps) => (
      <strong className="!text-black" {...props}>{children}</strong>
    ),
    em: ({ children, ...props }: MarkdownComponentProps) => (
      <em className="!text-black" {...props}>{children}</em>
    ),
    a: ({ children, href, ...props }: MarkdownComponentProps & { href?: string }) => {
      const isExternal = href?.startsWith('http') || href?.startsWith('www');
      const finalHref = isExternal ? href : `https://${href}`;
      return (
        <a 
          href={finalHref}
          target="_blank"
          rel="noopener noreferrer"
          className="!text-blue-600 hover:!text-blue-800"
          {...props}
        >
          {children}
        </a>
      );
    }
  };

  const handleBookmark = async (postId: string) => {
    try {
      await api.post(`/api/posts/${postId}/bookmark`);

      if (isBookmarksPage) {
        setPosts(prevPosts => prevPosts.filter(post => post._id !== postId));
      } else {
        setPosts(prevPosts => prevPosts.map(post => {
          if (post._id === postId) {
            const isCurrentlyBookmarked = isPostBookmarked(post);
            return {
              ...post,
              bookmarks: isCurrentlyBookmarked
                ? post.bookmarks.filter(b => b.user !== user?._id)
                : [...post.bookmarks, { user: user?._id || '', timestamp: new Date().toISOString() }]
            };
          }
          return post;
        }));
      }
    } catch (error) {
      console.error('Error bookmarking post:', error);
    }
  };

  const isPostBookmarked = (post: Post) => {
    return post.bookmarks.some(b => b.user === user?._id);
  };

  const handleImageClick = (imageUrl: string) => {
    setModalImageUrl(imageUrl);
    setShowImageModal(true);
  };

  const handleCloseModal = () => {
    setShowImageModal(false);
    setModalImageUrl('');
  };

  // Add keyboard event handler for Escape key
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showImageModal) {
        handleCloseModal();
      }
    };

    if (showImageModal) {
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [showImageModal]);

  const handleLike = async (postId: string) => {
    if (!user) return;
    try {
      await api.post(`/api/posts/${postId}/like`);
      setPosts(posts.map(post => {
        if (post._id === postId) {
          return {
            ...post,
            likes: post.likes.includes(user._id) 
              ? post.likes.filter(id => id !== user._id)
              : [...post.likes, user._id],
            dislikes: post.dislikes.filter(id => id !== user._id)
          };
        }
        return post;
      }));
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleDislike = async (postId: string) => {
    if (!user) return;
    try {
      await api.post(`/api/posts/${postId}/dislike`);
      setPosts(posts.map(post => {
        if (post._id === postId) {
          return {
            ...post,
            dislikes: post.dislikes.includes(user._id)
              ? post.dislikes.filter(id => id !== user._id)
              : [...post.dislikes, user._id],
            likes: post.likes.filter(id => id !== user._id)
          };
        }
        return post;
      }));
    } catch (error) {
      console.error('Error disliking post:', error);
    }
  };

  return (
    <div className="space-y-6">
      {!isAuthenticated && isMainPage && (
        <div className="bg-black text-center py-8 px-4 rounded-lg relative overflow-hidden">
          {/* Particle animation container */}
          <div className="absolute inset-0">
            <div id="particles-js" className="absolute inset-0"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 to-black/20"></div>
          </div>
          
          {/* Content */}
          <div className="relative z-10">
            <h1 className="text-white text-3xl font-bold mb-3 tracking-tight">
              Welcome to Alphy!
            </h1>
            <p className="text-gray-300 text-base mb-4 max-w-xl mx-auto">
              Alphy is your hub for engaging discussions and book exploration. The platform is in its initial stages, and we highly value your feedback!
            </p>
            <div className="flex justify-center gap-3">
              <Link 
                href="/register" 
                className="px-5 py-1.5 bg-white text-black font-semibold rounded-md hover:bg-gray-100 transition-colors text-sm"
              >
                Sign up
              </Link>
              <Link 
                href="/login" 
                className="px-5 py-1.5 bg-transparent text-white font-semibold rounded-md border border-white hover:bg-white/10 transition-colors text-sm"
              >
                Log in
              </Link>
            </div>
          </div>
        </div>
      )}
      {showPostCreation && isAuthenticated && !isBookmarksPage && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4">
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              onKeyDown={(e) => handleKeyPress(e)}
              className="w-full p-2 border rounded-lg focus:outline-none text-[#000000] mb-4"
              placeholder="Headline"
            />
            <div className="relative">
              <textarea
                ref={textInputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full p-2 border rounded-lg focus:outline-none text-[#000000] min-h-[100px] mb-3"
                placeholder="Post text (Tab for formatting)"
              />
              <FormatToolbar
                inputRef={textInputRef}
                isVisible={showFormatToolbar}
                onClose={() => setShowFormatToolbar(false)}
                onFormat={handleFormat}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) {
                        setSelectedImage(file);
                        handleImageUpload(file);
                      }
                    };
                    input.click();
                  }}
                  className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-sm"
                >
                  Add Image
                </button>
                {uploadingImage && <span className="text-gray-600">Uploading...</span>}
                {selectedImage && !uploadingImage && <span className="text-gray-600">{selectedImage.name}</span>}
              </div>
              <button
                onClick={handleSubmit}
                className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-sm"
              >
                Post!
              </button>
            </div>
            {imageUrl && (
              <div className="mt-3 relative w-[300px] h-[200px]">
                <Image 
                  src={imageUrl} 
                  alt="Preview" 
                  fill
                  style={{ objectFit: 'cover' }}
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
      )}

      {showImageModal && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={handleCloseModal}
        >
          {/* Dark overlay */}
          <div className="fixed inset-0 bg-black/75" />
          
          {/* Image container */}
          <div className="relative z-[101]">
            <Image
              src={modalImageUrl}
              alt="Full size"
              width={1920}
              height={1080}
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            />
            <button
              onClick={handleCloseModal}
              className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white hover:bg-black/75 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {posts.map((post) => (
        <div key={post._id} className="flex items-start space-x-4">
          {/* Vote buttons */}
          <div className="flex flex-col items-center mt-8 pt-2 space-y-4 bg-white rounded-lg shadow-sm border border-gray-200 p-2">
            <button
              onClick={() => handleDislike(post._id)}
              className={`flex flex-col items-center ${
                user && post.dislikes?.includes(user._id) ? 'text-gray-700' : 'text-gray-400'
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
              <span className="text-sm -mt-1">{post.dislikes?.length || 0}</span>
            </button>
            
            <button
              onClick={() => handleLike(post._id)}
              className={`flex flex-col items-center ${
                user && post.likes?.includes(user._id) ? 'text-gray-700' : 'text-gray-400'
              }`}
            >
              <span className="text-sm mb-0">{post.likes?.length || 0}</span>
              <svg className="w-6 h-6 -mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Post content */}
          <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {editingPost === post._id ? (
              <div className="p-4">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-800">
                      <Link href={`/user/${post.author.username}`} className="hover:underline">
                        {post.author.username}
                      </Link>
                    </span>
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
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-col -space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-800">
                          <Link href={`/user/${post.author.username}`} className="hover:underline">
                            {post.author.username}
                          </Link>
                        </span>
                        <span className="text-gray-500 text-sm">{getPostTimestamp(post)}</span>
                      </div>
                      <UserBadge badge={post.author.badge || ''} />
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      {user && (
                        <button
                          onClick={() => handleBookmark(post._id)}
                          className="text-gray-600 hover:text-gray-800"
                        >
                          {isPostBookmarked(post) ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                            </svg>
                          ) : (
                            <span>bookmark</span>
                          )}
                        </button>
                      )}
                      {user && (user._id === post.author._id || user.isAdmin) && (
                        <>
                          <span className="text-gray-300">|</span>
                          <button
                            onClick={() => handleEdit(post)}
                            className="text-gray-600 hover:text-gray-800"
                          >
                            edit
                          </button>
                          <button
                            onClick={() => handleDelete(post._id)}
                            className="text-gray-600 hover:text-gray-800"
                          >
                            delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {post.headline && (
                    <h2 className="text-xl font-semibold mb-2 text-black">{post.headline}</h2>
                  )}
                  {post.imageUrl && (
                    <div 
                      className="mb-4 relative w-[300px] h-[200px] cursor-pointer"
                      onClick={() => handleImageClick(post.imageUrl!)}
                    >
                      <Image 
                        src={post.imageUrl} 
                        alt={post.headline || 'Post image'}
                        fill
                        style={{ objectFit: 'cover' }}
                        className="rounded-lg hover:opacity-90 transition-opacity"
                      />
                    </div>
                  )}
                  {post.text && (
                    <div className="prose prose-sm max-w-none !text-black [&>*]:text-black [&_p]:!text-black [&_strong]:!text-black [&_em]:!text-black">
                      {/* @ts-ignore - Working around react-markdown type issues */}
                      <ReactMarkdown components={markdownComponents}>
                        {post.text}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
                <CommentSection postId={post._id} initialComments={post.comments} />
              </>
            )}
          </div>
        </div>
      ))}

      {/* Show the load more button only if:
          1. For user profile: hasMorePosts is true
          2. For main/bookmarks page: hasMore is true and no initialPosts provided */}
      {((hasMorePosts && initialPosts) || (!initialPosts && hasMore)) && (
        <div ref={loadMoreRef} className="flex justify-center mt-4">
          <button
            onClick={loadMorePosts}
            disabled={loading || isLoading}
            className="px-6 py-2 bg-gray-600 text-white hover:bg-gray-700 transition-colors rounded-lg disabled:opacity-50 flex items-center space-x-2"
          >
            {(loading || isLoading) ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Loading...</span>
              </>
            ) : (
              'Show more posts'
            )}
          </button>
        </div>
      )}
    </div>
  );
} 