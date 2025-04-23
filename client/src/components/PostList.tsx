'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import CommentSection, { Comment, User } from './CommentSection';
import MapCommentSection from './MapCommentSection';
import Image from 'next/image';
import FormatToolbar from './FormatToolbar';
import ReactMarkdown from 'react-markdown';
import type { ComponentProps } from 'react';
import Link from 'next/link';
import { useParticles } from '@/hooks/useParticles';
import UserBadge from './UserBadge';
import { usePathname, useRouter } from 'next/navigation';
import api from '@/services/api';
import socketService from '@/services/socketService';
import useSocketConnection from '@/hooks/useSocketConnection';
import { bookmarkMap, deleteMap } from '@/utils/mapUtils';

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
  likes?: string[];
  dislikes?: string[];
  bookmarks?: Array<{
    user: string;
    timestamp: string;
  }>;
  isOptimistic?: boolean;
  isMap?: boolean;
  mapData?: any;
}

// Type for creating optimistic posts
interface OptimisticPost extends Omit<Post, 'headline' | 'text'> {
  headline: string;
  text: string;
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
  const router = useRouter();

  const [posts, setPosts] = useState<Post[]>(initialPosts || []);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [skip, setSkip] = useState(0);
  const LIMIT = 10;
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
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
  
  // Use the socket connection hook
  const { isConnected: socketConnected } = useSocketConnection({
    debugName: 'PostList',
    autoReconnect: true
  });

  // Add state for map comments visibility and counts
  const [visibleMapComments, setVisibleMapComments] = useState<string[]>([]);
  const [mapCommentCounts, setMapCommentCounts] = useState<Record<string, number>>({});
  const [storedMapComments, setStoredMapComments] = useState<Record<string, any[]>>({});

  // Toggle map comment visibility
  const toggleMapComments = (mapId: string) => {
    setVisibleMapComments(prev => 
      prev.includes(mapId) 
        ? prev.filter(id => id !== mapId) 
        : [...prev, mapId]
    );
  };

  // Handle map comment updates from child components
  const handleMapCommentUpdate = (mapId: string, count: number, comments: any[]) => {
    setMapCommentCounts(prev => ({
      ...prev,
      [mapId]: count
    }));
    
    // Store the updated comments
    setStoredMapComments(prev => ({
      ...prev,
      [mapId]: comments
    }));
  };

  // Get map comment count
  const getMapCommentCount = (post: Post): number => {
    if (post._id in mapCommentCounts) {
      return mapCommentCounts[post._id] || 0;
    }
    return post.comments?.length || 0;
  };
  
  // Get map comments (either from stored state or initial data)
  const getStoredMapComments = (post: Post): any[] => {
    if (post._id in storedMapComments) {
      return storedMapComments[post._id] || [];
    }
    return post.comments || [];
  };

  // Update posts when initialPosts changes
  useEffect(() => {
    if (initialPosts) {
      setPosts(initialPosts);
    }
  }, [initialPosts]);

  const fetchPosts = async (skipCount = 0) => {
    if (initialPosts && skipCount === 0) {
      return; // Don't fetch if we already have initialPosts and this is the initial fetch
    }

    try {
      setLoading(true);
      const endpoint = isBookmarksPage ? '/api/posts/bookmarked' : '/api/posts';
      
      // Always use LIMIT (10 posts)
      const limit = LIMIT;
      
      const response = await api.get(`${endpoint}?limit=${limit}&skip=${skipCount}`);
      
      if (skipCount === 0) {
        setPosts(response.data.posts);
      } else {
        // For pagination, append new posts to existing ones without replacing
        setPosts(prevPosts => [
          ...prevPosts.filter(post => !post.isOptimistic), // Keep real posts
          ...response.data.posts
        ]);
      }
      setHasMore(response.data.hasMore);
      setSkip(skipCount + limit);
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
    setEditingPostId(post._id);
    setEditHeadline(post.headline);
    setEditText(post.text);
  };

  const handleCancelEdit = () => {
    setEditingPostId(null);
    setEditHeadline('');
    setEditText('');
  };

  const handleUpdate = async (postId: string) => {
    // Debug information
    console.log("Update called with values:", {
      editHeadline,
      editText,
      postId
    });
    
    // Safely check trimming with null/undefined checks
    const headlineEmpty = !editHeadline || editHeadline.trim() === '';
    const textEmpty = !editText || editText.trim() === '';
    
    if (headlineEmpty && textEmpty) {
      alert('Please enter either a headline or content for your post.');
      return;
    }

    // Store the original author badge in case we need it later
    const originalPost = posts.find(post => post._id === postId);
    const originalAuthorBadge = originalPost?.author?.badge;

    try {
      // Update UI optimistically
      setPosts(prevPosts => 
        prevPosts.map(post => {
          if (post._id === postId) {
            return {
              ...post,
              headline: editHeadline ? editHeadline.trim() : post.headline,
              text: editText ? editText.trim() : post.text,
              updatedAt: new Date().toISOString()
            };
          }
          return post;
        })
      );

      // Make the actual API call
      const response = await api.patch(`/api/posts/${postId}`, {
        headline: editHeadline ? editHeadline.trim() : undefined,
        text: editText ? editText.trim() : undefined
      });

      // No need to explicitly update the state again since we've done it optimistically
      // and socket.io will handle any discrepancies

      // Reset form state
      setEditingPostId(null);
      setEditHeadline('');
      setEditText('');

      // Tell parent component a post was updated
      onPostUpdated();
    } catch (error) {
      console.error('Error updating post:', error);
      alert('Failed to update post. Please try again.');
      
      // Get the post again to ensure we have the latest data
      try {
        const response = await api.get(`/api/posts/${postId}`);
        
        // Update the single post with the badge preserved
        setPosts(prevPosts => 
          prevPosts.map(post => {
            if (post._id === postId) {
              const serverData = response.data;
              // Preserve badge from original post if missing in server response
              if (!serverData.author.badge && originalAuthorBadge) {
                return {
                  ...serverData,
                  author: {
                    ...serverData.author,
                    badge: originalAuthorBadge
                  }
                };
              }
              return serverData;
            }
            return post;
          })
        );
      } catch (fetchError) {
        // If fetching the single post fails, fall back to fetching all posts
        fetchPosts(0);
      }
    }
  };

  const handleDelete = async (postId: string) => {
    if (!window.confirm('Are you sure you want to delete this post?')) {
      return;
    }

    // Store deleted post before removing it in case we need to restore it
    const postToDelete = posts.find(post => post._id === postId);

    try {      
      // Remove post optimistically from UI first
      setPosts(prevPosts => prevPosts.filter(post => post._id !== postId));

      // Make the actual API call
      await api.delete(`/api/posts/${postId}`);
      
      // No need to call onPostUpdated() or fetchPosts() here
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post. Please try again.');
      
      // If we have the deleted post, put it back in the list
      if (postToDelete) {
        setPosts(prevPosts => [...prevPosts, postToDelete].sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ));
      } else {
        // Otherwise, fall back to fetching all posts
        fetchPosts(0);
      }
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
      return `${createdTime} <span class="hidden md:inline">  Edited ${editedTime}</span>`;
    }
    
    return createdTime;
  };

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`https://api.imgbb.com/1/upload?key=${process.env.NEXT_PUBLIC_IMGBB_API_KEY}`, {
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
      // Prepare the new post data for optimistic update
      const optimisticPost: OptimisticPost = {
        _id: `temp-${Date.now()}`, // Temporary ID until server response
        headline: headline.trim() || '',  // Use empty string instead of undefined
        text: text.trim() || '',  // Use empty string instead of undefined
        imageUrl,
        author: {
          _id: user?._id || '',
          username: user?.username || '',
          badge: user?.badge || ''  // Explicitly include the badge
        },
        comments: [],
        likes: [],
        dislikes: [],
        bookmarks: [], // Add empty bookmarks array to prevent undefined errors
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isOptimistic: true, // Flag to identify optimistic posts
        isMap: false,
        mapData: undefined
      };

      // Add the optimistic post to the UI immediately
      setPosts(prevPosts => {
        // Add optimistic post and sort by date (newest first)
        return [optimisticPost, ...prevPosts].sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
      
      // Clear the form
      setHeadline('');
      setText('');
      setImageUrl('');
      setSelectedImage(null);
      
      // Make the actual API call
      const response = await api.post('/api/posts', {
        headline: headline.trim() || undefined,
        text: text.trim() || undefined,
        imageUrl
      });
      
      // After receiving the response, immediately join the post's room
      const newPostId = response.data._id;
      console.log('[DEBUG] Joining room for newly created post:', newPostId);
      socketService.joinPostRoom(newPostId);
      
      // Replace the optimistic post with the real one from the server but preserve badge if missing
      setPosts(prevPosts => {
        // Replace optimistic post with actual post
        const updatedPosts = prevPosts.map(post => {
          if (post._id === optimisticPost._id) {
            // Make sure badge is preserved if missing in server response
            const serverData = response.data;
            if (!serverData.author.badge && user?.badge) {
              return {
                ...serverData,
                author: {
                  ...serverData.author,
                  badge: user.badge
                }
              };
            }
            return serverData;
          }
          return post;
        });
        
        // Ensure consistent sorting
        return updatedPosts.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });

      // No need to call onPostUpdated() or fetchPosts() anymore
    } catch (error) {
      console.error('Error creating post:', error);
      // Remove the optimistic post if there was an error
      setPosts(prevPosts => prevPosts.filter(post => !post.isOptimistic));
      alert('Failed to create post. Please try again.');
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
    if (!user) return;
    
    try {
      // Get the current post
      const currentPost = posts.find(post => post._id === postId);
      if (!currentPost) return;
      
      // Check if already bookmarked
      const isCurrentlyBookmarked = isPostBookmarked(currentPost);
      
      // Update UI optimistically
      if (isBookmarksPage) {
        // On bookmarks page, remove the post
        setPosts(prevPosts => prevPosts.filter(post => post._id !== postId));
      } else {
        // On other pages, toggle the bookmark status
        setPosts(prevPosts => {
          // Map through posts and update the target post
          const updatedPosts = prevPosts.map(post => {
            if (post._id === postId) {
              return {
                ...post,
                bookmarks: isCurrentlyBookmarked
                  ? post.bookmarks?.filter(b => b.user !== user?._id) || []
                  : [...(post.bookmarks || []), { user: user?._id || '', timestamp: new Date().toISOString() }]
              };
            }
            return post;
          });
          
          // Sort posts by date to maintain consistent ordering
          return updatedPosts.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });
      }
      
      // Make the actual API call (non-blocking)
      await api.post(`/api/posts/${postId}/bookmark`);
    } catch (error) {
      console.error('Error bookmarking post:', error);
      // No need to revert UI for bookmarking since it's not critical
    }
  };

  const isPostBookmarked = (post: Post) => {
    if (!user || !post.bookmarks) return false;
    return post.bookmarks.some(bookmark => bookmark.user === user._id);
  };

  const isMapBookmarked = (mapData: any) => {
    if (!user || !mapData || !mapData.bookmarks) return false;
    return mapData.bookmarks.some((bookmark: any) => bookmark.user === user._id);
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
      // Get the current post
      const currentPost = posts.find(post => post._id === postId);
      if (!currentPost) return;
      
      // Check if already liked
      const isAlreadyLiked = currentPost.likes?.includes(user._id) || false;
      
      // Update UI optimistically
      setPosts(prevPosts => {
        // Map through posts and update the target post
        const updatedPosts = prevPosts.map(post => {
          if (post._id === postId) {
            return {
              ...post,
              likes: isAlreadyLiked
                ? post.likes?.filter(id => id !== user._id) || []
                : [...(post.likes || []), user._id],
              dislikes: post.dislikes?.filter(id => id !== user._id) || []
            };
          }
          return post;
        });
        
        // Sort posts by date to maintain consistent ordering
        return updatedPosts.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
      
      // Make the actual API call (non-blocking)
      await api.post(`/api/posts/${postId}/like`);
    } catch (error) {
      console.error('Error liking post:', error);
      // No UI reversion needed for likes since they're not critical
    }
  };

  const handleDislike = async (postId: string) => {
    if (!user) return;
    
    try {
      // Get the current post
      const currentPost = posts.find(post => post._id === postId);
      if (!currentPost) return;
      
      // Check if already disliked
      const isAlreadyDisliked = currentPost.dislikes?.includes(user._id) || false;
      
      // Update UI optimistically
      setPosts(prevPosts => {
        // Map through posts and update the target post
        const updatedPosts = prevPosts.map(post => {
          if (post._id === postId) {
            return {
              ...post,
              dislikes: isAlreadyDisliked
                ? post.dislikes?.filter(id => id !== user._id) || []
                : [...(post.dislikes || []), user._id],
              likes: post.likes?.filter(id => id !== user._id) || []
            };
          }
          return post;
        });
        
        // Sort posts by date to maintain consistent ordering
        return updatedPosts.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
      
      // Make the actual API call (non-blocking)
      await api.post(`/api/posts/${postId}/dislike`);
    } catch (error) {
      console.error('Error disliking post:', error);
      // No UI reversion needed for dislikes since they're not critical
    }
  };

  // Connect to socket when component mounts
  useEffect(() => {
    // Initialize socket connection is now handled by the useSocketConnection hook
    
    // Ensure we're joined to the global feed for all posts
    if (socketService.isRealTimeEnabled()) {
      socketService.joinGlobalFeed();
    }
    
    // Set up event listeners for real-time updates
    const onPostCreated = (newPost: Post) => {
      // Only log 10% of post creation events
      const shouldLog = Math.random() < 0.1;
      
      if (shouldLog) {
        console.log(`[PostList] Post created: ${newPost._id}`);
      }
      
      if (isBookmarksPage) {
        if (shouldLog) {
          console.log('[PostList] Ignoring post-created on bookmarks page');
        }
        return; // Don't add new posts on bookmarks page
      }
      
      // Check if we already have this post
      const existingPost = posts.find(p => p._id === newPost._id);
      if (existingPost && !existingPost.isOptimistic) {
        if (shouldLog) {
          console.log(`[PostList] Post already exists, ignoring: ${newPost._id}`);
        }
        return;
      }
      
      if (shouldLog) {
        console.log(`[PostList] Adding post to UI: ${newPost._id}`);
      }
      
      // Add the new post and ensure proper chronological sorting (newest first)
      setPosts(prevPosts => {
        // Filter out any optimistic version of this post first (if it exists)
        const filteredPosts = prevPosts.filter(post => 
          !post.isOptimistic && (post._id !== newPost._id)
        );
        
        // Add the new post and sort by date (newest first)
        return [newPost, ...filteredPosts].sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
      
      // Join room for the new post - only log 5% of the time
      if (Math.random() < 0.05) {
        console.log(`[PostList] Joining room for new post: ${newPost._id}`);
      }
      socketService.joinPostRoom(newPost._id);
    };
    
    const onPostUpdated = (updatedPost: Post) => {
      // Only log 10% of post update events
      const shouldLog = Math.random() < 0.1;
      
      if (shouldLog) {
        console.log(`[PostList] Post updated: ${updatedPost._id}`);
      }
      
      setPosts(prevPosts => {
        // Map over previous posts, replacing the updated post
        const updatedPosts = prevPosts.map(post => 
          post._id === updatedPost._id ? updatedPost : post
        );
        
        // Re-sort posts by date to maintain consistent ordering
        return updatedPosts.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
    };
    
    const onPostDeleted = (deletedPostId: string) => {
      // Only log 10% of post deletion events
      const shouldLog = Math.random() < 0.1;
      
      if (shouldLog) {
        console.log(`[PostList] Post deleted: ${deletedPostId}`);
      }
      
      setPosts(prevPosts => prevPosts.filter(post => post._id !== deletedPostId));
      
      // Leave the room for this post
      if (shouldLog) {
        console.log(`[PostList] Leaving room for deleted post: ${deletedPostId}`);
      }
      socketService.leavePostRoom(deletedPostId);
    };
    
    const onPostLiked = ({ postId, likes, dislikes, userId }: { 
      postId: string; 
      likes: string[]; 
      dislikes: string[];
      userId: string;
    }) => {
      // Only log 5% of post like events (very frequent)
      if (Math.random() < 0.05) {
        console.log(`[PostList] Post liked: ${postId} by ${userId}`);
      }
      
      setPosts(prevPosts => {
        const updatedPosts = prevPosts.map(post => {
          if (post._id === postId) {
            return {
              ...post,
              likes,
              dislikes
            };
          }
          return post;
        });
        
        // Re-sort posts by date to maintain consistent ordering
        return updatedPosts.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
    };
    
    const onPostDisliked = ({ postId, likes, dislikes, userId }: { 
      postId: string; 
      likes: string[]; 
      dislikes: string[];
      userId: string;
    }) => {
      // Only log 5% of post dislike events (very frequent)
      if (Math.random() < 0.05) {
        console.log(`[PostList] Post disliked: ${postId} by ${userId}`);
      }
      
      setPosts(prevPosts => {
        const updatedPosts = prevPosts.map(post => {
          if (post._id === postId) {
            return {
              ...post,
              likes,
              dislikes
            };
          }
          return post;
        });
        
        // Re-sort posts by date to maintain consistent ordering
        return updatedPosts.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
    };
    
    const onPostBookmarked = ({ postId, bookmarks, userId }: { 
      postId: string; 
      bookmarks: { user: string; timestamp: string; }[];
      userId: string;
    }) => {
      // Only log 5% of bookmark events
      if (Math.random() < 0.05) {
        console.log(`[PostList] Post bookmarked: ${postId} by ${userId}`);
      }
      
      if (isBookmarksPage && userId === user?._id) {
        // If this is the bookmarks page and the current user unbookmarked a post, remove it
        if (!bookmarks.some(b => b.user === userId)) {
          setPosts(prevPosts => prevPosts.filter(post => post._id !== postId));
          return;
        }
      }
      
      setPosts(prevPosts => {
        const updatedPosts = prevPosts.map(post => {
          if (post._id === postId) {
            return {
              ...post,
              bookmarks
            };
          }
          return post;
        });
        
        // Re-sort posts by date to maintain consistent ordering
        return updatedPosts.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
    };
    
    // Register event listeners
    socketService.on('post-created', onPostCreated);
    socketService.on('post-updated', onPostUpdated);
    socketService.on('post-deleted', onPostDeleted);
    socketService.on('post-liked', onPostLiked);
    socketService.on('post-disliked', onPostDisliked);
    socketService.on('post-bookmarked', onPostBookmarked);
    
    // Clean up event listeners when component unmounts
    return () => {
      // Only log 10% of cleanup operations to reduce noise
      if (Math.random() < 0.1) {
        console.log('[PostList] Cleaning up socket event listeners');
      }
      
      socketService.off('post-created', onPostCreated);
      socketService.off('post-updated', onPostUpdated);
      socketService.off('post-deleted', onPostDeleted);
      socketService.off('post-liked', onPostLiked);
      socketService.off('post-disliked', onPostDisliked);
      socketService.off('post-bookmarked', onPostBookmarked);
    };
  }, [isBookmarksPage, user?._id]);
  
  // Join post rooms for all visible posts
  useEffect(() => {
    if (!posts?.length) return;
    
    // Get real-time status from the socket service
    const isRealTimeEnabled = socketService.isRealTimeEnabled();
    
    // Don't join rooms if real-time updates are disabled
    if (!isRealTimeEnabled) return;
    
    // Join rooms for all posts to receive updates
    posts.forEach(post => {
      socketService.joinPostRoom(post._id);
    });
    
    // Clean up when component unmounts or posts change
    return () => {
      if (isRealTimeEnabled) {
        posts.forEach(post => {
          socketService.leavePostRoom(post._id);
        });
      }
    };
  }, [posts]);

  const handleOpenMap = (mapId: string, mapData: any) => {
    if (user && mapData.user._id === user._id) {
      router.push(`/maps?id=${mapId}`);
    } else {
      router.push(`/maps/view?id=${mapId}`);
    }
  };

  const handleBookmarkMap = async (mapId: string) => {
    try {
      const success = await bookmarkMap(mapId);
      if (success) {
        // Update local state optimistically
        setPosts(prevPosts => prevPosts.map(post => {
          if (post._id === mapId && post.isMap) {
            return {
              ...post,
              mapData: {
                ...post.mapData,
                bookmarks: post.mapData.bookmarks || []
              }
            };
          }
          return post;
        }));
        onPostUpdated();
      }
    } catch (error) {
      console.error('Error bookmarking map:', error);
    }
  };

  const handleDeleteMap = async (mapId: string) => {
    if (!window.confirm('Are you sure you want to delete this map?')) {
      return;
    }

    try {
      const success = await deleteMap(mapId);
      if (success) {
        setPosts(prevPosts => prevPosts.filter(post => post._id !== mapId));
        onPostUpdated();
      }
    } catch (error) {
      console.error('Error deleting map:', error);
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
              Alphy is your hub for engaging discussions and knowledge management. The platform is in its initial stages, and we highly value your feedback!
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
              className="w-full py-2 px-2 border rounded-lg focus:outline-none text-[#000000] mb-3 text-sm"
              placeholder="Headline"
            />
            <div className="relative">
              <textarea
                ref={textInputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full py-1 px-2 border rounded-lg focus:outline-none text-[#000000] min-h-[60px] mb-2 text-sm"
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
                  className="border border-gray-400/50 text-black hover:bg-black hover:text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-200"
                >
                  Add Image
                </button>
                {uploadingImage && <span className="text-gray-600">Uploading...</span>}
                {selectedImage && !uploadingImage && <span className="text-gray-600">{selectedImage.name}</span>}
              </div>
              <button
                onClick={handleSubmit}
                className="border border-gray-400/50 bg-black text-white hover:bg-gray-800 px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-200"
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
                  sizes="(max-width: 768px) 100vw, 300px"
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
          {/* Vote buttons - only show for regular posts */}
          {!post.isMap && (
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
          )}

          {/* Post/Map content */}
          <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {editingPostId === post._id ? (
              <div className="p-4">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-800">
                      <Link href={`/user/${post.author.username}`} className="hover:underline">
                        {post.author.username}
                      </Link>
                    </span>
                    <span className="text-gray-500 text-sm" dangerouslySetInnerHTML={{ __html: getPostTimestamp(post) }}></span>
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
                {post.isMap ? (
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex flex-col -space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-800">
                            <Link href={`/user/${post.author.username}`} className="hover:underline">
                              {post.author.username}
                            </Link>
                          </span>
                          <span className="text-gray-500 text-sm" dangerouslySetInnerHTML={{ __html: getPostTimestamp(post) }}></span>
                        </div>
                        <UserBadge badge={post.author.badge || ''} />
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        {user && (
                          <button
                            onClick={() => handleBookmarkMap(post._id)}
                            className="text-gray-600 hover:text-gray-800"
                          >
                            {isMapBookmarked(post.mapData) ? (
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
                              onClick={() => handleDeleteMap(post._id)}
                              className="text-gray-600 hover:text-gray-800"
                            >
                              delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {/* Map title */}
                    <div 
                      className="cursor-pointer" 
                      onClick={() => handleOpenMap(post._id, post.mapData)}
                    >
                      <h2 className="text-lg font-semibold mb-1 text-black hover:underline">
                        {post.headline}
                      </h2>
                      
                      {/* Map stats with comments on right */}
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center text-sm text-gray-500">
                          {post.mapData?.isPrivate && (
                            <span className="bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 text-xs px-2 py-0.5 rounded-md mr-2 shadow-sm border border-blue-100/50 whitespace-nowrap">Visible only to you</span>
                          )}
                          <span>{(post.mapData?.elementCount || 0)} elements</span>
                          <span className="mx-1">•</span>
                          <span>{(post.mapData?.connectionCount || 0)} connections</span>
                        </div>
                        
                        {/* Comment toggle button with rotating arrow */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleMapComments(post._id);
                          }}
                          className="text-gray-500 text-sm hover:text-gray-700 flex items-center"
                        >
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            className={`h-3 w-3 mr-1 transition-transform ${visibleMapComments.includes(post._id) ? 'rotate-180' : ''}`} 
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          {getMapCommentCount(post) > 0 
                            ? `${getMapCommentCount(post)} comments` 
                            : 'comments'}
                        </button>
                      </div>
                    </div>
                    
                    {/* Map comment section - conditionally visible */}
                    {visibleMapComments.includes(post._id) && (
                      <div className="mt-2 pt-3 border-t border-gray-100">
                        <MapCommentSection 
                          mapId={post._id} 
                          initialComments={getStoredMapComments(post)} 
                          onCommentUpdate={(count, comments) => handleMapCommentUpdate(post._id, count, comments)}
                        />
                      </div>
                    )}
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
                          <span className="text-gray-500 text-sm" dangerouslySetInnerHTML={{ __html: getPostTimestamp(post) }}></span>
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
                      <h2 className="text-xl font-semibold mb-2 text-black">
                        {post.headline}
                      </h2>
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