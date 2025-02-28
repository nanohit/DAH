'use client';

import { useState } from 'react';
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
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showAllComments, setShowAllComments] = useState<Record<string, boolean>>({});
  const { user } = useAuth();

  const fetchComments = async () => {
    try {
      const response = await fetch(`https://dah-tyxc.onrender.com/api/comments/post/${postId}`);
      if (!response.ok) throw new Error('Failed to fetch comments');
      const data = await response.json();
      setComments(data);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent, parentId?: string) => {
    e.preventDefault();
    if (!user || !newComment.trim()) return;

    try {
      const response = await fetch('https://dah-tyxc.onrender.com/api/comments/post/' + postId, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          content: newComment,
          parentCommentId: parentId
        })
      });

      if (!response.ok) throw new Error('Failed to post comment');

      const newCommentData = await response.json();
      
      if (parentId) {
        setComments(comments.map(comment => 
          comment._id === parentId
            ? { ...comment, replies: [...comment.replies, newCommentData] }
            : comment
        ));
      } else {
        setComments([newCommentData, ...comments]);
      }

      setNewComment('');
      setReplyingTo(null);
    } catch (error) {
      console.error('Error posting comment:', error);
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!user || !editContent.trim()) return;

    try {
      const response = await fetch(`https://dah-tyxc.onrender.com/api/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ content: editContent })
      });

      if (!response.ok) throw new Error('Failed to edit comment');

      const updatedComment = await response.json();

      setComments(comments.map(comment => {
        if (comment._id === commentId) {
          return { ...comment, content: updatedComment.content };
        }
        return {
          ...comment,
          replies: comment.replies.map(reply =>
            reply._id === commentId
              ? { ...reply, content: updatedComment.content }
              : reply
          )
        };
      }));

      setEditingComment(null);
      setEditContent('');
    } catch (error) {
      console.error('Error editing comment:', error);
    }
  };

  const handleDeleteComment = async (commentId: string, parentId?: string) => {
    if (!user || !window.confirm('Are you sure you want to delete this comment?')) return;

    try {
      const response = await fetch(`https://dah-tyxc.onrender.com/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete comment');

      if (parentId) {
        setComments(comments.map(comment =>
          comment._id === parentId
            ? { ...comment, replies: comment.replies.filter(reply => reply._id !== commentId) }
            : comment
        ));
      } else {
        setComments(comments.filter(comment => comment._id !== commentId));
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const toggleShowAllComments = (commentId: string) => {
    setShowAllComments(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }));
  };

  const renderComment = (comment: Comment, isReply = false) => {
    const isAuthor = user && user._id === comment.user._id;
    const isEditing = editingComment === comment._id;

    return (
      <div key={comment._id} className={`mb-4 ${isReply ? 'ml-8' : ''}`}>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="font-semibold">{comment.user.username}</span>
              <span className="text-gray-500 text-sm ml-2">
                {new Date(comment.createdAt).toLocaleDateString()}
              </span>
            </div>
            {isAuthor && (
              <div className="space-x-2">
                <button
                  onClick={() => {
                    setEditingComment(comment._id);
                    setEditContent(comment.content);
                  }}
                  className="text-blue-500 hover:text-blue-700 text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteComment(comment._id, comment.parentComment || undefined)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  Delete
                </button>
              </div>
            )}
          </div>

          {isEditing ? (
            <form onSubmit={(e) => {
              e.preventDefault();
              handleEditComment(comment._id);
            }}>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full p-2 border rounded mb-2"
                rows={3}
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingComment(null)}
                  className="px-3 py-1 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Save
                </button>
              </div>
            </form>
          ) : (
            <>
              <p className="text-gray-800 mb-2">{comment.content}</p>
              {user && !isReply && (
                <button
                  onClick={() => setReplyingTo(comment._id)}
                  className="text-blue-500 hover:text-blue-700 text-sm"
                >
                  Reply
                </button>
              )}
            </>
          )}
        </div>

        {replyingTo === comment._id && (
          <form onSubmit={(e) => handleSubmitComment(e, comment._id)} className="mt-2 ml-8">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a reply..."
              className="w-full p-2 border rounded mb-2"
              rows={3}
            />
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="px-3 py-1 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Reply
              </button>
            </div>
          </form>
        )}

        {comment.replies.length > 0 && (
          <div className="mt-2">
            {(showAllComments[comment._id] ? comment.replies : comment.replies.slice(0, 2)).map(reply =>
              renderComment(reply, true)
            )}
            {comment.replies.length > 2 && (
              <button
                onClick={() => toggleShowAllComments(comment._id)}
                className="text-blue-500 hover:text-blue-700 text-sm mt-2 ml-8"
              >
                {showAllComments[comment._id]
                  ? 'Show less replies'
                  : `Show ${comment.replies.length - 2} more replies`}
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mt-6">
      {user && (
        <form onSubmit={(e) => handleSubmitComment(e)} className="mb-6">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment..."
            className="w-full p-2 border rounded mb-2"
            rows={3}
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Post Comment
          </button>
        </form>
      )}

      <div>
        {comments.map(comment => renderComment(comment))}
      </div>
    </div>
  );
} 