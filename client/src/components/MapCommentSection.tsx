'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { formatDate } from '@/utils/date';
import { sanitizeHtml, markdownToHtml } from '@/utils/html';
import ReactMarkdown from 'react-markdown';
import CommentInput from './CommentInput';
import Link from 'next/link';
import api from '@/services/api';
import FormatToolbar from './FormatToolbar';

export interface User {
  _id: string;
  username: string;
  badge?: string;
}

export interface Comment {
  _id: string;
  content: string;
  user: User;
  createdAt: string;
  replies: Comment[];
  parentComment: string | null;
  likes: string[];
  dislikes: string[];
}

export interface MapCommentSectionProps {
  mapId: string;
  initialComments?: Comment[];
  onCommentUpdate?: (count: number, comments: Comment[]) => void;
}

export default function MapCommentSection({ mapId, initialComments = [], onCommentUpdate }: MapCommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [newComment, setNewComment] = useState('');
  const [newReply, setNewReply] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showAllComments, setShowAllComments] = useState(false);
  const [branchCollapsed, setBranchCollapsed] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMainFormatToolbar, setShowMainFormatToolbar] = useState(false);
  const { user } = useAuth();

  const convertContentToHtml = useCallback((content: string): string => {
    const trimmed = (content || '').trim();
    if (!trimmed) return '';
    const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(trimmed);
    const baseHtml = looksLikeHtml ? trimmed : markdownToHtml(trimmed);
    return sanitizeHtml(baseHtml);
  }, []);

  const fetchComments = async () => {
    setIsLoading(true);
    try {
      const response = await api.get(`/api/comments/map/${mapId}`);
      setComments(response.data);
      setIsLoading(false);
      return response.data;
    } catch (error) {
      console.error('Error fetching comments:', error);
      setError('Failed to fetch comments');
      setIsLoading(false);
      throw new Error('Failed to fetch comments');
    }
  };

  useEffect(() => {
    fetchComments().then(fetchedComments => {
      // Update the comment count in parent component
      if (onCommentUpdate && fetchedComments) {
        onCommentUpdate(countTotalComments(fetchedComments), fetchedComments);
      }
    });
  }, [mapId]);

  const updateRepliesRecursively = (comments: Comment[], parentId: string, newReply: Comment): Comment[] => {
    return comments.map(comment => {
      if (comment._id === parentId) {
        return {
          ...comment,
          replies: [...(comment.replies || []), newReply]
        };
      }
      if (comment.replies && comment.replies.length > 0) {
        const updatedReplies = updateRepliesRecursively(comment.replies, parentId, newReply);
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
    if (!user) {
      setError('You must be logged in to comment');
      return;
    }
    
    const content = parentId ? newReply : newComment;
    if (!content.trim()) {
      setError('Comment cannot be empty');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`Submitting comment to map ${mapId}`, {
        content,
        parentId: parentId || 'none',
        userLoggedIn: !!user,
        userId: user?._id
      });
      
      const response = await api.post(`/api/comments/map/${mapId}`, {
        content,
        parentCommentId: parentId
      });
      
      console.log('Comment submission response:', response.data);
      
      if (parentId) {
        setBranchCollapsed(prev => ({
          ...prev,
          [parentId]: false
        }));
        
        const refreshedComments = await fetchComments();
        setComments(refreshedComments);
        
        // Update the comment count
        if (onCommentUpdate) {
          onCommentUpdate(countTotalComments(refreshedComments), refreshedComments);
        }
        
        setNewReply('');
      } else {
        const newComment = response.data;
        const updatedComments = [newComment, ...comments];
        setComments(updatedComments);
        
        // Update the comment count
        if (onCommentUpdate) {
          onCommentUpdate(countTotalComments(updatedComments), updatedComments);
        }
        
        setNewComment('');
      }

      setReplyingTo(null);
      setIsLoading(false);
    } catch (error: any) {
      console.error('Error posting comment:', error);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to post comment';
      setError(errorMessage);
      
      console.error('Detailed error info:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        stack: error.stack
      });
      
      setIsLoading(false);
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!user || !editContent.trim()) return;

    try {
      await api.patch(`/api/comments/${commentId}`, { content: editContent });
      setEditingComment(null);
      setEditContent('');
      const refreshedComments = await fetchComments();
      
      // Update the comment count and pass comments back to parent
      if (onCommentUpdate) {
        onCommentUpdate(countTotalComments(refreshedComments), refreshedComments);
      }
    } catch (error) {
      console.error('Error editing comment:', error);
      setError('Failed to edit comment');
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

    try {
      await api.delete(`/api/comments/${commentId}`);
      
      if (parentId) {
        setComments(comments => {
          const updatedComments = comments.map(c => {
            if (c._id === parentId) {
              return {
                ...c,
                replies: c.replies.filter(r => r._id !== commentId)
              };
            }
            return c;
          });
          
          // Update comment count
          if (onCommentUpdate) {
            onCommentUpdate(countTotalComments(updatedComments), updatedComments);
          }
          
          return updatedComments;
        });
      } else {
        const updatedComments = comments.filter(c => c._id !== commentId);
        setComments(updatedComments);
        
        // Update comment count
        if (onCommentUpdate) {
          onCommentUpdate(countTotalComments(updatedComments), updatedComments);
        }
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      setError('Failed to delete comment');
    }
  };

  const handleLikeComment = async (commentId: string) => {
    if (!user) return;
    try {
      await api.post(`/api/comments/${commentId}/like`);
      
      // Create a recursive function to update comments and their nested replies
      const updateLikeRecursively = (comments: Comment[]): Comment[] => {
        return comments.map(comment => {
          if (comment._id === commentId) {
            // Update this comment's likes/dislikes
            return {
              ...comment,
              likes: comment.likes.includes(user._id)
                ? comment.likes.filter(id => id !== user._id)
                : [...comment.likes, user._id],
              dislikes: comment.dislikes.filter(id => id !== user._id)
            };
          }
          
          // If this comment has replies, check them recursively
          if (comment.replies && comment.replies.length > 0) {
            return {
              ...comment,
              replies: updateLikeRecursively(comment.replies)
            };
          }
          
          // Otherwise, return comment unchanged
          return comment;
        });
      };
      
      setComments(prevComments => {
        const updatedComments = updateLikeRecursively(prevComments);
        
        // Update comment count and pass comments to parent
        if (onCommentUpdate) {
          onCommentUpdate(countTotalComments(updatedComments), updatedComments);
        }
        
        return updatedComments;
      });
    } catch (error) {
      console.error('Error liking comment:', error);
      setError('Failed to like comment');
    }
  };

  const handleDislikeComment = async (commentId: string) => {
    if (!user) return;
    try {
      await api.post(`/api/comments/${commentId}/dislike`);
      
      // Create a recursive function to update comments and their nested replies
      const updateDislikeRecursively = (comments: Comment[]): Comment[] => {
        return comments.map(comment => {
          if (comment._id === commentId) {
            // Update this comment's likes/dislikes
            return {
              ...comment,
              dislikes: comment.dislikes.includes(user._id)
                ? comment.dislikes.filter(id => id !== user._id)
                : [...comment.dislikes, user._id],
              likes: comment.likes.filter(id => id !== user._id)
            };
          }
          
          // If this comment has replies, check them recursively
          if (comment.replies && comment.replies.length > 0) {
            return {
              ...comment,
              replies: updateDislikeRecursively(comment.replies)
            };
          }
          
          // Otherwise, return comment unchanged
          return comment;
        });
      };
      
      setComments(prevComments => {
        const updatedComments = updateDislikeRecursively(prevComments);
        
        // Update comment count and pass comments to parent
        if (onCommentUpdate) {
          onCommentUpdate(countTotalComments(updatedComments), updatedComments);
        }
        
        return updatedComments;
      });
    } catch (error) {
      console.error('Error disliking comment:', error);
      setError('Failed to dislike comment');
    }
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
                  {comment.user?.badge && (
                    <span className="text-[12px] text-gray-400 font-normal -mt-[2px] block leading-tight">
                      {comment.user.badge}
                    </span>
                  )}
                  <span className="text-gray-500 text-sm">
                    {formatDate(comment.createdAt)}
                  </span>
                </div>
                {canModify && (
                  <div className="space-x-2 text-sm">
                    <button
                      onClick={() => {
                        setEditingComment(comment._id);
                        setEditContent(comment.content);
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
            {replies.map(reply => renderComment(reply, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const totalComments = countTotalComments(comments);

  return (
    <div className="w-full">
      {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
      
      {/* Main comment input form */}
      <CommentInput
        placeholder="Add a comment..."
        value={newComment}
        onChange={setNewComment}
        onSubmit={(e) => handleSubmitComment(e)}
        isLoading={isLoading}
        showFormatToolbar={showMainFormatToolbar}
        setShowFormatToolbar={setShowMainFormatToolbar}
      />
      
      {/* Comment list */}
      <div className="mt-4 space-y-4">
        {comments.map(comment => renderComment(comment))}
      </div>
    </div>
  );
} 