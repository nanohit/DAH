import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

interface CommentUser {
  _id: string;
  username: string;
  profilePicture?: string;
}

interface CommentType {
  _id: string;
  content: string;
  user: CommentUser;
  replies?: CommentType[];
  createdAt: string;
  parentComment?: string;
}

interface CommentProps {
  comment: CommentType;
  onReply: (commentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  depth?: number;
}

export default function Comment({ comment, onReply, onDelete, depth = 0 }: CommentProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [showAllReplies, setShowAllReplies] = useState(false);
  const { user } = useAuth();

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim()) return;

    try {
      await onReply(comment._id, replyContent);
      setReplyContent('');
      setIsReplying(false);
    } catch (error) {
      console.error('Error submitting reply:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const replies = comment.replies || [];
  const visibleReplies = showAllReplies ? replies : replies.slice(0, 2);
  const hasMoreReplies = replies.length > 2;

  return (
    <div className={`pl-${depth * 4} mt-4`}>
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex items-start space-x-3">
          {comment.user.profilePicture ? (
            <img
              src={comment.user.profilePicture}
              alt={comment.user.username}
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-gray-500 text-sm">
                {comment.user.username.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <span className="font-medium">{comment.user.username}</span>
              <span className="text-gray-500 text-sm">
                {formatDate(comment.createdAt)}
              </span>
            </div>
            <p className="mt-1 text-gray-800">{comment.content}</p>
            <div className="mt-2 flex items-center space-x-4">
              <button
                onClick={() => setIsReplying(!isReplying)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Reply
              </button>
              {user && user._id === comment.user._id && (
                <button
                  onClick={() => onDelete(comment._id)}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Delete
                </button>
              )}
            </div>
            {isReplying && (
              <form onSubmit={handleReplySubmit} className="mt-3">
                <textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Write a reply..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
                <div className="mt-2 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsReplying(false)}
                    className="px-3 py-1 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Reply
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
      {replies.length > 0 && (
        <div className="ml-8 mt-2">
          {visibleReplies.map((reply) => (
            <Comment
              key={reply._id}
              comment={reply}
              onReply={onReply}
              onDelete={onDelete}
              depth={depth + 1}
            />
          ))}
          {hasMoreReplies && !showAllReplies && (
            <button
              onClick={() => setShowAllReplies(true)}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800"
            >
              Show {replies.length - 2} more {replies.length - 2 === 1 ? 'reply' : 'replies'}
            </button>
          )}
          {showAllReplies && hasMoreReplies && (
            <button
              onClick={() => setShowAllReplies(false)}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800"
            >
              Show less
            </button>
          )}
        </div>
      )}
    </div>
  );
} 