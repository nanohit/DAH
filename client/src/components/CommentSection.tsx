'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { formatDate } from '@/utils/date';
import { sanitizeHtml, markdownToHtml } from '@/utils/html';
import CommentInput from './CommentInput';
import Link from 'next/link';
import UserBadge from './UserBadge';
import api from '@/services/api';
import socketService from '@/services/socketService';

// Debug flag - set to false to disable all debug logging
const DEBUG_ENABLED = false;

// Debug logger that only logs when DEBUG_ENABLED is true
const debugLog = (...args: any[]) => {
  if (DEBUG_ENABLED) {
    console.log(...args);
  }
};

export interface User {
  _id: string;
  username: string;
}

export interface Comment {
  _id: string;
  content: string;
  user: User;
  createdAt: string;
  parentComment: string | null;
  replies?: Comment[];
  likes: string[];
  dislikes: string[];
  isOptimistic?: boolean;
  clientHandled?: boolean;
  post: string;
}

export interface CommentSectionProps {
  postId: string;
  initialComments?: Comment[];
}

// TypeScript interfaces for Socket Events
interface CommentCreatedEvent {
  comment: Comment;
  parentCommentId?: string;
}

interface CommentUpdatedEvent {
  _id: string;
  content: string;
  post: string;
  [key: string]: any;
}

interface CommentDeletedEvent {
  commentId: string;
  parentCommentId?: string;
}

export default function CommentSection({ postId, initialComments = [] }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const commentsRef = useRef<Comment[]>(initialComments);
  const [newComment, setNewComment] = useState('');
  const [newReply, setNewReply] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showAllComments, setShowAllComments] = useState(false);
  const [branchCollapsed, setBranchCollapsed] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commentsCount, setCommentsCount] = useState(0);
  const { user } = useAuth();
  const convertContentToHtml = useCallback((content: string): string => {
    const trimmed = (content || '').trim();
    if (!trimmed) return '';
    const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(trimmed);
    const baseHtml = looksLikeHtml ? trimmed : markdownToHtml(trimmed);
    return sanitizeHtml(baseHtml);
  }, []);

  const fetchComments = async () => {
    // Skip fetching comments for optimistic posts (they don't exist in DB yet)
    if (postId.startsWith('temp-')) {
      return [];
    }
    
    try {
      const response = await api.get(`/api/comments/post/${postId}`);
      
      // Sort comments by createdAt date, newest first
      const sortedComments = response.data.sort((a: Comment, b: Comment) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      // Sort all levels of nested replies
      return sortedComments.map(sortCommentRepliesRecursively);
    } catch (error) {
      console.error('Error fetching comments:', error);
      // Return empty array instead of throwing error
      return [];
    }
  };
  
  // Helper function to sort all replies recursively
  const sortCommentRepliesRecursively = (comment: Comment): Comment => {
    if (!comment.replies || comment.replies.length === 0) {
      return comment;
    }
    
    // Sort immediate replies by newest first
    const sortedReplies = comment.replies
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(sortCommentRepliesRecursively); // Apply recursively to all nested replies
      
    return {
      ...comment,
      replies: sortedReplies
    };
  };

  useEffect(() => {
    // If we already have initial comments, use those
    if (initialComments?.length > 0) {
      // Make sure initialComments are also sorted consistently
      const sortedInitialComments = [...initialComments].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ).map(sortCommentRepliesRecursively);
      
      setComments(sortedInitialComments);
    } else {
      // Otherwise fetch comments (if not an optimistic post)
      fetchComments().then(comments => {
        setComments(comments);
      });
    }
  }, [postId, initialComments]);

  const updateRepliesRecursively = (comments: Comment[], parentId: string, newReply: Comment, addAtBeginning: boolean = false): Comment[] => {
    return comments.map(comment => {
      if (comment._id === parentId) {
        return {
          ...comment,
          replies: addAtBeginning 
            ? [newReply, ...(comment.replies || [])]
            : [...(comment.replies || []), newReply]
        };
      }
      if (comment.replies && comment.replies.length > 0) {
        const updatedReplies = updateRepliesRecursively(comment.replies, parentId, newReply, addAtBeginning);
        if (updatedReplies !== comment.replies) {
          return {
            ...comment,
            replies: updatedReplies
          };
        }
      }
      return comment;
    });
  };

  const updateCommentContentRecursively = (comments: Comment[], commentId: string, newContent: string): Comment[] => {
    return comments.map(comment => {
      if (comment._id === commentId) {
        return { ...comment, content: newContent };
      }
      if (comment.replies && comment.replies.length > 0) {
        return {
          ...comment,
          replies: updateCommentContentRecursively(comment.replies, commentId, newContent)
        };
      }
      return comment;
    });
  };

  const countTotalComments = (comments: Comment[]): number => {
    return comments.reduce((total, comment) => {
      return total + 1 + countRepliesRecursively(comment);
    }, 0);
  };

  const countRepliesRecursively = (comment: Comment): number => {
    if (!comment.replies || comment.replies.length === 0) return 0;
    return comment.replies.reduce((total, reply) => {
      return total + 1 + countRepliesRecursively(reply);
    }, 0);
  };

  const handleSubmitComment = async (e: React.FormEvent, parentId?: string) => {
    e.preventDefault();
    if (!user) return;
    
    const content = parentId ? newReply : newComment;
    if (!content.trim()) return;

    try {
      // Only log ~10% of comment submissions to reduce noise
      const shouldLogCommentSubmission = Math.random() < 0.1 && DEBUG_ENABLED;
      if (shouldLogCommentSubmission) {
        debugLog(`[CommentSection] Submitting ${parentId ? 'reply' : 'new comment'} for post ${postId}`);
      }
      
      // Create optimistic comment for instant UI update
      const optimisticId = `temp-${Date.now()}`;
      const optimisticComment: Comment = {
        _id: optimisticId,
        content,
        user: {
          _id: user._id,
          username: user.username,
          badge: user.badge
        } as User & { badge?: string },
        createdAt: new Date().toISOString(),
        replies: [],
        parentComment: parentId || null,
        likes: [],
        dislikes: [],
        isOptimistic: true,
        post: postId
      };
      
      // Update UI immediately
      if (parentId) {
        // Add reply optimistically
        setBranchCollapsed(prev => ({
          ...prev,
          [parentId]: false
        }));
        
        // Update comments with the new reply
        setComments(prevComments => {
          // First, check if it's a direct reply to a top-level comment
          const parentComment = prevComments.find(c => c._id === parentId);
          
          if (parentComment) {
            // It's a direct reply to a top-level comment
            return prevComments.map(comment => {
              if (comment._id === parentId) {
                return {
                  ...comment,
                  replies: [optimisticComment, ...(comment.replies || [])]
                };
              }
              return comment;
            });
          } else {
            // It might be a reply to a nested comment
            const updatedComments = prevComments.map(comment => {
              if (comment.replies && comment.replies.length > 0) {
                return {
                  ...comment,
                  replies: updateRepliesRecursively(comment.replies, parentId, optimisticComment, true)
                };
              }
              return comment;
            });
            return updatedComments;
          }
        });
        
        // Clear input field immediately
        setNewReply('');
        // Close the reply field immediately
        setReplyingTo(null);
      } else {
        // Add top-level comment optimistically
        setComments(prevComments => {
          const updatedComments = [optimisticComment, ...prevComments];
          if (shouldLogCommentSubmission) {
            debugLog(`[CommentSection] Updated comments with optimistic top-level comment`);
          }
          return updatedComments;
        });
        setNewComment('');
        setShowAllComments(true);
      }
      
      // Make the actual API request
      const response = await api.post(`/api/comments/post/${postId}`, {
        content,
        parentCommentId: parentId
      });
      
      // Replace the optimistic comment with the real one
      const serverComment = response.data;
      
      // After successful server response, refresh comments to ensure
      // we have the correct structure especially for nested replies
      if (parentId) {
        // Fetch fresh comments to ensure proper structure for nested replies
        const freshComments = await fetchComments();
        setComments(freshComments);
      } else {
        // For top-level comments, just replace the optimistic one
        setComments(prevComments => 
          prevComments.map(c => 
            c._id === optimisticId ? { ...serverComment, replies: [] } : c
          )
        );
      }
      
      // ... rest of the function ...
    } catch (error) {
      console.error('Error posting comment:', error);
      // Remove optimistic comment on error
      if (parentId) {
        setComments(prevComments => {
          return prevComments.map(comment => {
            // Remove from direct replies
            if (comment._id === parentId) {
              return {
                ...comment,
                replies: (comment.replies || []).filter(reply => !reply.isOptimistic)
              };
            }
            
            // Check nested replies
            if (comment.replies && comment.replies.length > 0) {
              return {
                ...comment,
                replies: removeOptimisticCommentsRecursively(comment.replies)
              };
            }
            
            return comment;
          });
        });
      } else {
        // Remove top-level optimistic comment
        setComments(prevComments => prevComments.filter(comment => !comment.isOptimistic));
      }
      
      // Show error to user
      setError('Failed to post comment. Please try again.');
      setTimeout(() => setError(null), 3000);
    }
  };
  
  // Helper function to replace an optimistic comment with the real one in a nested structure
  const replaceCommentRecursively = (comments: Comment[], optimisticId: string, realComment: Comment): Comment[] => {
    return comments.map(comment => {
      if (comment._id === optimisticId) {
        return realComment;
      }
      
      if (comment.replies && comment.replies.length > 0) {
        return {
          ...comment,
          replies: replaceCommentRecursively(comment.replies, optimisticId, realComment)
        };
      }
      
      return comment;
    });
  };
  
  // Helper function to remove all optimistic comments in a nested structure
  const removeOptimisticCommentsRecursively = (comments: Comment[]): Comment[] => {
    // Filter out optimistic comments at this level
    return comments.filter(comment => !comment.isOptimistic).map(comment => {
      // For remaining comments, recursively filter their replies
      if (comment.replies && comment.replies.length > 0) {
        return {
          ...comment,
          replies: removeOptimisticCommentsRecursively(comment.replies)
        };
      }
      return comment;
    });
  };

  const handleEditComment = async (commentId: string) => {
    if (!user || !editContent.trim()) return;

    try {
      // Store original comment content in case of error
      const originalComment = comments.find(c => c._id === commentId) || 
                              comments.flatMap(c => c.replies || []).find(r => r._id === commentId);
      
      // Update UI optimistically
      setComments(prevComments => 
        updateCommentContentRecursively(prevComments, commentId, editContent)
      );
      
      // Clear edit state
      setEditingComment(null);
      setEditContent('');
      
      // Make the actual API call
      await api.patch(`/api/comments/${commentId}`, { content: editContent });
    } catch (error) {
      console.error('Error editing comment:', error);
      alert('Failed to edit comment. Please try again.');
      
      // Restore original content on error
      fetchComments().then(setComments);
    }
  };

  const deleteReplyRecursively = (comments: Comment[], replyId: string): Comment[] => {
    return comments.map(comment => {
      if (comment.replies && comment.replies.length > 0) {
        return {
          ...comment,
          replies: comment.replies.filter(reply => reply._id !== replyId)
            .map(reply => ({
              ...reply,
              replies: deleteReplyRecursively(reply.replies || [], replyId)
            }))
        };
      }
      return comment;
    });
  };

  const handleDeleteComment = async (commentId: string, parentId?: string) => {
    if (!user || !window.confirm('Are you sure you want to delete this comment?')) return;

    // Store comment for potential restoration
    const commentToDelete = findCommentRecursively(comments, commentId);
    
    try {
      // Remove from UI optimistically
      if (parentId) {
        setComments(prevComments => deleteReplyRecursively(prevComments, commentId));
      } else {
        setComments(prevComments => prevComments.filter(c => c._id !== commentId));
      }
      
      // Make the actual API call
      await api.delete(`/api/comments/${commentId}`);
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Failed to delete comment. Please try again.');
      
      // Restore deleted comment on error
      fetchComments().then(setComments);
    }
  };

  // Helper function to find a comment anywhere in the comment tree
  const findCommentRecursively = (comments: Comment[], commentId: string): Comment | null => {
    for (const comment of comments) {
      if (comment._id === commentId) {
        return comment;
      }
      
      if (comment.replies && comment.replies.length > 0) {
        const found = findCommentRecursively(comment.replies, commentId);
        if (found) return found;
      }
    }
    
    return null;
  };

  const handleLikeComment = async (commentId: string) => {
    if (!user) return;
    
    try {
      // Find the comment to like
      const targetComment = findCommentRecursively(comments, commentId);
      if (!targetComment) return;
      
      // Check if already liked
      const isAlreadyLiked = targetComment.likes.includes(user._id);
      
      // Update UI optimistically
      setComments(prevComments => 
        updateCommentsRecursively(prevComments, commentId, comment => ({
          ...comment,
          likes: isAlreadyLiked
            ? comment.likes.filter(id => id !== user._id)
            : [...comment.likes, user._id],
          dislikes: comment.dislikes.filter(id => id !== user._id)
        }))
      );
      
      // Make the actual API call
      await api.post(`/api/comments/${commentId}/like`);
    } catch (error) {
      console.error('Error liking comment:', error);
      // Revert on error
      fetchComments().then(setComments);
    }
  };

  const handleDislikeComment = async (commentId: string) => {
    if (!user) return;
    
    try {
      // Find the comment to dislike
      const targetComment = findCommentRecursively(comments, commentId);
      if (!targetComment) return;
      
      // Check if already disliked
      const isAlreadyDisliked = targetComment.dislikes.includes(user._id);
      
      // Update UI optimistically
      setComments(prevComments => 
        updateCommentsRecursively(prevComments, commentId, comment => ({
          ...comment,
          dislikes: isAlreadyDisliked
            ? comment.dislikes.filter(id => id !== user._id)
            : [...comment.dislikes, user._id],
          likes: comment.likes.filter(id => id !== user._id)
        }))
      );
      
      // Make the actual API call
      await api.post(`/api/comments/${commentId}/dislike`);
    } catch (error) {
      console.error('Error disliking comment:', error);
      // Revert on error
      fetchComments().then(setComments);
    }
  };

  // Helper function to update a comment anywhere in the tree
  const updateCommentsRecursively = (
    comments: Comment[], 
    commentId: string, 
    updateFn: (comment: Comment) => Comment
  ): Comment[] => {
    return comments.map(comment => {
      if (comment._id === commentId) {
        return updateFn(comment);
      }
      
      if (comment.replies && comment.replies.length > 0) {
        return {
          ...comment,
          replies: updateCommentsRecursively(comment.replies, commentId, updateFn)
        };
      }
      
      return comment;
    });
  };

  const renderComment = (comment: Comment, depth: number = 0) => {
    const isAuthor = user && comment.user && user._id === comment.user._id;
    const isAdmin = user?.isAdmin;
    const canModify = isAuthor || isAdmin;
    const isEditing = editingComment === comment._id;
    const replies = comment.replies || [];
    const marginClass = depth > 0 ? 'ml-8' : '';
    const hasReplies = replies.length > 0;
    const isCollapsed = branchCollapsed[comment._id];
    const totalReplies = countRepliesRecursively(comment);

    // Skip rendering if the comment data is invalid
    if (!comment.user || !comment.createdAt) {
      console.error('Invalid comment data:', comment);
      return null;
    }

    return (
      <div key={comment._id} className={`${marginClass} relative group`}>
        {depth > 0 && (
          <>
            <div 
              className="absolute left-[-24px] top-[-12px] bottom-0 w-[24px] bg-transparent cursor-pointer"
              onClick={() => {
                const parentId = comment.parentComment;
                if (parentId) {
                  setBranchCollapsed(prev => ({ 
                    ...prev, 
                    [parentId]: !prev[parentId] 
                  }));
                }
              }}
            >
              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gray-200" />
              <div className="absolute left-0 top-[32px] w-[24px] h-[2px] bg-gray-200" />
            </div>
            {/* Add continuous vertical line for same-level comments */}
            <div className="absolute left-[-24px] top-[-12px] w-[2px] bg-gray-200" style={{ height: 'calc(100% + 12px)' }} />
          </>
        )}
        
        {!branchCollapsed[comment.parentComment || ''] && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-3">
            <div className="p-3">
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center space-x-2">
                  <span className="text-gray-800">
                    <Link href={`/user/${comment.user?.username}`} className="hover:underline">
                      {comment.user?.username}
                    </Link>
                  </span>
                  <span className="text-gray-500 text-sm">
                    {formatDate(comment.createdAt)}
                  </span>
                </div>
                {canModify && (
                  <div className="space-x-2 text-sm">
                    <button
                      onClick={() => {
                        setEditingComment(comment._id);
                        setEditContent(convertContentToHtml(comment.content));
                      }}
                      className="text-gray-600 hover:text-gray-800"
                    >
                      edit
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={() => handleDeleteComment(comment._id, comment.parentComment || undefined)}
                      className="text-gray-600 hover:text-gray-800"
                    >
                      delete
                    </button>
                  </div>
                )}
              </div>

              {isEditing ? (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <CommentInput
                    value={editContent}
                    onChange={setEditContent}
                    onSubmit={() => handleEditComment(comment._id)}
                    buttonText="Save"
                  />
                </div>
              ) : (
                <>
                  <div
                    className="prose prose-sm max-w-none [&>*]:text-black"
                    dangerouslySetInnerHTML={{ __html: convertContentToHtml(comment.content) }}
                  />
                  <div className="flex items-center space-x-4 mt-2">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => user ? handleDislikeComment(comment._id) : undefined}
                        className={`flex items-center space-x-1 ${
                          user && comment.dislikes.includes(user._id) ? 'text-gray-700' : 'text-gray-400'
                        }`}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                        <span className="text-sm">{comment.dislikes.length}</span>
                      </button>
                      <button
                        onClick={() => user ? handleLikeComment(comment._id) : undefined}
                        className={`flex items-center space-x-1 ${
                          user && comment.likes.includes(user._id) ? 'text-gray-700' : 'text-gray-400'
                        }`}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        <span className="text-sm">{comment.likes.length}</span>
                      </button>
                    </div>

                    {user && (
                      <button
                        onClick={() => {
                          if (replyingTo === comment._id) {
                            setReplyingTo(null);
                            setNewReply('');
                          } else {
                            setReplyingTo(comment._id);
                          }
                        }}
                        className="text-gray-500 hover:text-gray-700 text-sm ml-auto"
                      >
                        {replyingTo === comment._id ? 'cancel' : 'reply'}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            {hasReplies && isCollapsed && (
              <div 
                onClick={() => setBranchCollapsed(prev => ({ ...prev, [comment._id]: false }))}
                className="border-t border-gray-200 p-2 text-center text-gray-600 hover:text-gray-800 cursor-pointer hover:bg-gray-50"
              >
                Show {totalReplies} {totalReplies === 1 ? 'reply' : 'replies'}
              </div>
            )}
          </div>
        )}

        {replyingTo === comment._id && !branchCollapsed[comment.parentComment || ''] && (
          <div className="mt-3 ml-8 mb-3">
            <CommentInput
              value={newReply}
              onChange={setNewReply}
              onSubmit={(e) => handleSubmitComment(e, comment._id)}
              placeholder="Write a reply... (Tab for formatting)"
            />
          </div>
        )}

        {hasReplies && !isCollapsed && (
          <div className="mt-3">
            {replies.map(reply => {
              return renderComment(reply, depth + 1);
            })}
          </div>
        )}
      </div>
    );
  };

  // Update comments ref whenever comments state changes
  useEffect(() => {
    commentsRef.current = comments;
  }, [comments]);

  // Socket.io event listeners
  useEffect(() => {
    if (!postId) return;
    
    // Skip socket registration if real-time updates are disabled
    if (!socketService.isRealTimeEnabled()) {
      if (Math.random() < 0.05) { // Only log 5% of the time
        debugLog('[CommentSection] Real-time updates are disabled, skipping socket setup');
      }
      return;
    }

    // Only log 5% of setup operations to reduce noise
    const shouldLogSetup = Math.random() < 0.05;
    if (shouldLogSetup) {
      debugLog(`[CommentSection] Setting up socket listeners for post ${postId}`);
    }
    
    // Make sure socket is connected and join the post room
    socketService.connect();
    
    // Function to ensure we're joined to the room
    const ensureRoomJoined = () => {
      if (socketService.isConnected()) {
        socketService.joinPostRoom(postId);
        // Extremely low log frequency (1%)
        if (Math.random() < 0.01) {
          debugLog(`[CommentSection] Room join command sent for post ${postId}`);
        }
      } else {
        if (shouldLogSetup) {
          debugLog(`[CommentSection] Socket not connected, will try again soon`);
        }
        socketService.connect();
      }
    };
    
    // Join immediately
    ensureRoomJoined();
    
    // Join again after a delay to ensure connection is established
    const joinTimer = setTimeout(ensureRoomJoined, 1000);
    
    // Set up a periodic check to make sure we stay in the room
    const periodicJoinCheck = setInterval(ensureRoomJoined, 30000);
    
    // Test socket connection by sending a ping after joining the room
    const pingTimer = setTimeout(() => {
      socketService.ping().then(isConnected => {
        if (shouldLogSetup) {
          debugLog(`[CommentSection] Ping test: ${isConnected ? 'Connected' : 'Not connected'}`);
        }
        
        // If not connected, try to reconnect
        if (!isConnected) {
          if (shouldLogSetup) {
            debugLog(`[CommentSection] Reconnecting after failed ping test`);
          }
          socketService.reconnect();
          setTimeout(ensureRoomJoined, 1000);
        }
      });
    }, 2000);
    
    // Only log debug info 1% of the time
    if (Math.random() < 0.01 && comments.length > 0) {
      debugLog(`[CommentSection] Tracking ${comments.length} comments (first ID: ${comments[0]._id})`);
    }

    // Register event handlers DIRECTLY without saving references
    // This ensures proper closure handling and prevents stale closures
    socketService.on('comment-created', (data: CommentCreatedEvent) => {
      // Only log critical comment events 
      if (Math.random() < 0.05) {
        debugLog('[CommentSection] Received comment-created event for post:', postId);
      }
      
      const { comment, parentCommentId } = data;
      
      // Add debugging for comment structure
      if (!comment || typeof comment !== 'object') {
        debugLog('[CommentSection] Invalid comment data received:', data);
        return;
      }
      
      // Only process if this comment belongs to our post
      if (comment.post !== postId) {
        if (Math.random() < 0.1) {
          debugLog(`[CommentSection] Comment is for different post, skipping`);
        }
        return;
      }
      
      // IMPORTANT: Skip if we were the original creator
      // Check if this is your own comment that you just created
      const isOwnComment = user && comment.user && user._id === comment.user._id;
      
      // Get current comments from ref to avoid stale closure issues
      const currentComments = commentsRef.current;
      
      // Extra check for optimistic comments (fix duplication)
      // We need to also check if this is a reply or a top-level comment
      let isDuplicate = false;
      
      if (parentCommentId) {
        // For replies, check if we have an optimistic version of this in any parent comment's replies
        const duplicateCheck = (comments: Comment[]): boolean => {
          for (const c of comments) {
            // Check if any reply in this comment has the same content from the same user
            if (c._id === parentCommentId && c.replies) {
              const hasOptimisticVersion = c.replies.some(reply => 
                reply.user._id === comment.user._id && 
                reply.content === comment.content &&
                // Either it's already the same comment or it's an optimistic version
                (reply._id === comment._id || reply.isOptimistic)
              );
              if (hasOptimisticVersion) {
                return true;
              }
            }
            
            // Check nested replies
            if (c.replies && c.replies.length > 0) {
              if (duplicateCheck(c.replies)) {
                return true;
              }
            }
          }
          return false;
        };
        
        isDuplicate = duplicateCheck(currentComments);
      } else {
        // For top-level comments, check if we have an optimistic version
        isDuplicate = currentComments.some(c => 
          // Either exact ID match or similar content from same user (likely optimistic)
          c._id === comment._id || 
          (c.isOptimistic && c.user._id === comment.user._id && c.content === comment.content)
        );
      }
      
      if (isDuplicate) {
        if (Math.random() < 0.05) {
          debugLog('[CommentSection] Duplicate comment or optimistic version detected, skipping');
        }
        return;
      }
      
      // Skip if this comment is flagged as already handled by this client
      if (comment.clientHandled) {
        if (Math.random() < 0.05) {
          debugLog('[CommentSection] Comment was already handled by this client, skipping');
        }
        return;
      }
      
      // Update comments array to include the new comment
      if (parentCommentId) {
        // It's a reply to another comment
        if (Math.random() < 0.1) {
          debugLog(`[CommentSection] Adding reply to parent comment: ${parentCommentId}`);
        }
        setComments(prevComments => {
          return prevComments.map(c => {
            if (c._id === parentCommentId) {
              return {
                ...c,
                replies: [comment, ...(c.replies || [])]
              };
            }
            
            // Check nested replies
            if (c.replies && c.replies.length > 0) {
              return {
                ...c,
                replies: updateRepliesRecursively(c.replies, parentCommentId, comment, true)
              };
            }
            
            return c;
          });
        });
      } else {
        // It's a top-level comment
        if (Math.random() < 0.1) {
          debugLog('[CommentSection] Adding top-level comment');
        }
        setComments(prev => {
          const newComments = [comment, ...prev];
          return newComments;
        });
      }
      
      // Always update the count - this is what the user will see when comments are collapsed
      setCommentsCount(prev => prev + 1);
      
      // Only auto-expand the comments for the user who created the comment, 
      // based on matching the current user's ID
      const shouldAutoExpand = isOwnComment && !showAllComments;
      if (shouldAutoExpand) {
        debugLog('[CommentSection] Auto-expanding comments for comment author');
        setShowAllComments(true);
      }
    });
    
    socketService.on('comment-updated', (updatedComment: CommentUpdatedEvent) => {
      // Only log 5% of comment update events
      if (Math.random() < 0.05) {
        debugLog('[CommentSection] Comment updated:', updatedComment._id);
      }
      
      // Only process if this comment belongs to our post
      if (updatedComment.post !== postId) return;
      
      setComments(prevComments => updateCommentsRecursively(
        prevComments, 
        updatedComment._id, 
        () => updatedComment as Comment
      ));
    });
    
    socketService.on('comment-deleted', (data: CommentDeletedEvent) => {
      // Only log 5% of comment deletion events
      if (Math.random() < 0.05) {
        debugLog('[CommentSection] Comment deleted:', data.commentId);
      }
      
      const { commentId, parentCommentId } = data;
      
      if (parentCommentId) {
        // It's a reply
        setComments(prevComments => deleteReplyRecursively(prevComments, commentId));
      } else {
        // Top-level comment
        setComments(prevComments => prevComments.filter(c => c._id !== commentId));
      }
      
      // Update the count
      setCommentsCount(prev => Math.max(0, prev - 1));
    });
    
    // Add special debug listener
    socketService.on('connect', () => {
      // Log reconnections only 10% of the time
      if (Math.random() < 0.1) {
        debugLog('[CommentSection] Socket reconnected, rejoining room:', postId);
      }
      socketService.joinPostRoom(postId);
    });
    
    return () => {
      // Only log 10% of cleanup operations to reduce noise
      const shouldLogCleanup = Math.random() < 0.1;
      
      if (shouldLogCleanup) {
        debugLog(`[CommentSection] Cleaning up listeners for post ${postId}`);
      }
      
      socketService.leavePostRoom(postId);
      
      // Remove ALL handlers for these events (with reduced logging via socketService)
      socketService.off('comment-created');
      socketService.off('comment-updated');
      socketService.off('comment-deleted');
      socketService.off('connect');
      
      // Clear all timers
      clearTimeout(joinTimer);
      clearTimeout(pingTimer);
      clearInterval(periodicJoinCheck);
    };
  }, [postId, user?._id]); // Only depend on postId and user._id - comments state is accessed from closure

  // Calculate totalComments
  const totalComments = useMemo(() => {
    return countTotalComments(comments);
  }, [comments]);

  // Update commentsCount whenever totalComments changes
  useEffect(() => {
    setCommentsCount(totalComments);
  }, [totalComments]);

  // Update the toggle text based on comment count
  const toggleText = useMemo(() => {
    if (commentsCount === 0) {
      return "Be the first to comment";
    } else if (commentsCount === 1) {
      return `Show 1 comment`;
    } else {
      return `Show ${commentsCount} comments`;
    }
  }, [commentsCount]);

  return (
    <div className="border-t border-gray-200">
      {error && (
        <div className="text-red-500 p-4">
          {error}
        </div>
      )}
      
      {isLoading ? (
        <div className="text-center py-4">
          Loading comments...
        </div>
      ) : (
        <>
          {comments.length === 0 ? (
            <div className="p-4">
              <CommentInput
                value={newComment}
                onChange={setNewComment}
                onSubmit={handleSubmitComment}
                placeholder={toggleText}
                disabled={!user}
                readOnly={!user}
                onClick={() => user ? null : alert('Please log in to comment')}
              />
            </div>
          ) : !showAllComments ? (
            <button
              onClick={() => setShowAllComments(true)}
              className="w-full p-4 text-center text-gray-600 hover:text-gray-800 flex items-center justify-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              <span>{toggleText}</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          ) : (
            <div className="p-4">
              <button
                onClick={() => setShowAllComments(false)}
                className="w-full text-center text-gray-600 hover:text-gray-800 mb-4 flex items-center justify-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
                <span>Hide all {commentsCount} {commentsCount === 1 ? 'comment' : 'comments'}</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
              
              <div className="mb-4">
                <CommentInput
                  value={newComment}
                  onChange={setNewComment}
                  onSubmit={handleSubmitComment}
                  placeholder="Write a comment... (Tab for formatting)"
                  showFormatToolbar={false} // Removed format toolbar for main comment
                  setShowFormatToolbar={() => {}}
                />
              </div>

              <div className="space-y-3">
                {comments.map(comment => renderComment(comment, 0))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
} 