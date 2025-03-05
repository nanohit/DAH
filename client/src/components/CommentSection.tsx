'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { formatDate } from '@/utils/date';
import FormatToolbar from './FormatToolbar';
import ReactMarkdown from 'react-markdown';
import CommentInput from './CommentInput';
import Link from 'next/link';
import UserBadge from './UserBadge';
import api from '@/services/auth';

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
  likes: string[];
  dislikes: string[];
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
  const [showMainFormatToolbar, setShowMainFormatToolbar] = useState(false);
  const [showReplyFormatToolbar, setShowReplyFormatToolbar] = useState(false);
  const [showEditFormatToolbar, setShowEditFormatToolbar] = useState(false);
  const { user } = useAuth();
  const mainCommentInputRef = useRef<HTMLTextAreaElement>(null);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  const handleFormat = (type: string, selection: { start: number; end: number }, inputRef: React.RefObject<HTMLTextAreaElement>, setText: (text: string) => void) => {
    if (!inputRef.current) return;

    const input = inputRef.current;
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
          const selectedText = currentText.slice(selection.start, selection.end);
          const linkText = selectedText || 'link';
          newText = currentText.slice(0, selection.start) + `[${linkText}](${url})` + currentText.slice(selection.end);
          newCursorPos = selection.start + newText.length;
        }
        break;
      case 'clear':
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
  };

  const fetchComments = async () => {
    try {
      const response = await api.get(`/api/comments/post/${postId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching comments:', error);
      throw new Error('Failed to fetch comments');
    }
  };

  useEffect(() => {
    fetchComments().then(setComments);
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

  const handleSubmitComment = async (e: React.FormEvent, parentId?: string) => {
    e.preventDefault();
    if (!user) return;
    
    const content = parentId ? newReply : newComment;
    if (!content.trim()) return;

    try {
      await api.post(`/api/comments/post/${postId}`, {
        content,
        parentCommentId: parentId
      });
      
      if (parentId) {
        const formattedComment = {
          ...comments.find(c => c._id === parentId)!,
          replies: [],
          parentComment: parentId
        };
        
        setBranchCollapsed(prev => ({
          ...prev,
          [parentId]: false
        }));
        
        const refreshedComments = await fetchComments();
        setComments(refreshedComments);
        
        setNewReply('');
      } else {
        const formattedComment = {
          ...comments.find(c => c._id === parentId)!,
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
      await api.patch(`/api/comments/${commentId}`, { content: editContent });
      setEditingComment(null);
      setEditContent('');
      fetchComments();
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
      await api.delete(`/api/comments/${commentId}`);
      
      if (parentId) {
        setComments(prevComments => deleteReplyRecursively(prevComments, commentId));
      } else {
        setComments(prevComments => prevComments.filter(c => c._id !== commentId));
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    if (!user) return;
    try {
      await api.post(`/api/comments/${commentId}/like`);
      setComments(comments.map(comment => {
        if (comment._id === commentId) {
          return {
            ...comment,
            likes: comment.likes.includes(user._id)
              ? comment.likes.filter(id => id !== user._id)
              : [...comment.likes, user._id],
            dislikes: comment.dislikes.filter(id => id !== user._id)
          };
        }
        return comment;
      }));
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  const handleDislikeComment = async (commentId: string) => {
    if (!user) return;
    try {
      await api.post(`/api/comments/${commentId}/dislike`);
      setComments(comments.map(comment => {
        if (comment._id === commentId) {
          return {
            ...comment,
            dislikes: comment.dislikes.includes(user._id)
              ? comment.dislikes.filter(id => id !== user._id)
              : [...comment.dislikes, user._id],
            likes: comment.likes.filter(id => id !== user._id)
          };
        }
        return comment;
      }));
    } catch (error) {
      console.error('Error disliking comment:', error);
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
                  <div className="prose prose-sm max-w-none [&>*]:text-black [&_p]:!text-black [&_strong]:!text-black [&_em]:!text-black">
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
                      {comment.content}
                    </ReactMarkdown>
                  </div>
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
                placeholder="Be the first to comment... (Tab for formatting)"
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
              <span>Show {totalComments} {totalComments === 1 ? 'comment' : 'comments'}</span>
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
                <span>Hide all {totalComments} {totalComments === 1 ? 'comment' : 'comments'}</span>
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