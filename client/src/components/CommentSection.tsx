'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

export interface User {
  _id: string;
  username: string;
}

export interface Comment {
  _id: string;
  content: string;
  user: User;
  createdAt: string;
  replies: Comment[];
  parentComment: string | null;
}

export interface CommentSectionProps {
  postId: string;
  initialComments?: Comment[];
}

export default function CommentSection({ postId, initialComments = [] }: CommentSectionProps) {
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
  const { user } = useAuth();

  useEffect(() => {
    const fetchComments = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/comments/post/${postId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch comments');
        }
        const data = await response.json();
        setComments(data);
      } catch (err) {
        console.error('Error fetching comments:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch comments');
      } finally {
        setIsLoading(false);
      }
    };

    fetchComments();
  }, [postId]);

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

  const formatDate = (dateString: string) => {
    if (!dateString || isNaN(new Date(dateString).getTime())) {
      return 'Invalid date';
    }

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

  const handleSubmitComment = async (e: React.FormEvent, parentId?: string) => {
    e.preventDefault();
    if (!user) return;
    
    const content = parentId ? newReply : newComment;
    if (!content.trim()) return;

    try {
      const response = await fetch('/api/comments/post/' + postId, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          content,
          parentCommentId: parentId
        })
      });

      if (!response.ok) throw new Error('Failed to post comment');

      const newCommentData = await response.json();
      
      if (parentId) {
        const formattedComment = {
          ...newCommentData,
          replies: [],
          parentComment: parentId
        };
        
        setBranchCollapsed(prev => ({
          ...prev,
          [parentId]: false
        }));
        
        const refreshResponse = await fetch(`/api/comments/post/${postId}`);
        if (refreshResponse.ok) {
          const refreshedComments = await refreshResponse.json();
          setComments(refreshedComments);
        } else {
          setComments(prevComments => updateRepliesRecursively(prevComments, parentId, formattedComment));
        }
        
        setNewReply('');
      } else {
        const formattedComment = {
          ...newCommentData,
          replies: []
        };
        setComments(prevComments => [formattedComment, ...prevComments]);
        setNewComment('');
        setShowAllComments(true);
      }

      setReplyingTo(null);
    } catch (error) {
      console.error('Error posting comment:', error);
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!user || !editContent.trim()) return;

    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ content: editContent })
      });

      if (!response.ok) throw new Error('Failed to edit comment');

      const updatedComment = await response.json();

      setComments(prevComments => 
        updateCommentContentRecursively(prevComments, commentId, updatedComment.content)
      );

      setEditingComment(null);
      setEditContent('');
    } catch (error) {
      console.error('Error editing comment:', error);
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
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete comment');

      if (parentId) {
        setComments(prevComments => deleteReplyRecursively(prevComments, commentId));
      } else {
        setComments(prevComments => prevComments.filter(comment => comment._id !== commentId));
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const renderComment = (comment: Comment, depth: number = 0) => {
    const isAuthor = user && comment.user && user._id === comment.user._id;
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
                  <span className="text-gray-800">{comment.user?.username}</span>
                  <span className="text-gray-500 text-sm">
                    {formatDate(comment.createdAt)}
                  </span>
                </div>
                {isAuthor && (
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
                  <div className="flex items-stretch">
                    <input
                      type="text"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleEditComment(comment._id);
                        }
                      }}
                      className="flex-grow p-2 border-none focus:outline-none text-[#000000] placeholder:text-gray-400"
                    />
                    <button
                      onClick={() => handleEditComment(comment._id)}
                      className="px-6 py-2 bg-gray-600 text-white hover:bg-gray-700 transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-black">{comment.content}</p>
                  {user && (
                    <button
                      onClick={() => setReplyingTo(comment._id)}
                      className="text-sm text-gray-600 hover:text-gray-800 mt-1"
                    >
                      reply
                    </button>
                  )}
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
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="flex items-stretch">
                <input
                  type="text"
                  value={newReply}
                  onChange={(e) => setNewReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmitComment(e as any, comment._id);
                    }
                  }}
                  placeholder="Write a reply..."
                  className="flex-grow p-2 border-none focus:outline-none text-[#000000] placeholder:text-gray-400"
                />
                <button
                  onClick={(e) => handleSubmitComment(e as any, comment._id)}
                  className="px-6 py-2 bg-gray-600 text-white hover:bg-gray-700 transition-colors"
                >
                  Post
                </button>
              </div>
            </div>
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
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="flex items-stretch">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmitComment(e as any);
                      }
                    }}
                    placeholder="Be the first to comment..."
                    className="flex-grow p-2 border-none focus:outline-none text-[#000000] placeholder:text-gray-400"
                    onClick={() => user ? null : alert('Please log in to comment')}
                    readOnly={!user}
                  />
                  <button
                    onClick={(e) => handleSubmitComment(e as any)}
                    className="px-6 py-2 bg-gray-600 text-white hover:bg-gray-700 transition-colors"
                    disabled={!user}
                  >
                    Post
                  </button>
                </div>
              </div>
            </div>
          ) : !showAllComments ? (
            <button
              onClick={() => setShowAllComments(true)}
              className="w-full p-4 text-center text-gray-600 hover:text-gray-800"
            >
              Show {totalComments} {totalComments === 1 ? 'comment' : 'comments'}
            </button>
          ) : (
            <div className="p-4">
              <button
                onClick={() => setShowAllComments(false)}
                className="w-full text-center text-gray-600 hover:text-gray-800 mb-4"
              >
                Hide all {totalComments} {totalComments === 1 ? 'comment' : 'comments'}
              </button>
              
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-4">
                <div className="flex items-stretch">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmitComment(e as any);
                      }
                    }}
                    placeholder="Write a comment..."
                    className="flex-grow p-2 border-none focus:outline-none text-black"
                  />
                  <button
                    onClick={(e) => handleSubmitComment(e as any)}
                    className="px-6 py-2 bg-gray-600 text-white hover:bg-gray-700 transition-colors"
                  >
                    Post
                  </button>
                </div>
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