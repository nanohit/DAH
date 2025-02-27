import React, { useState } from 'react';
import axios from 'axios';

interface PostProps {
    post: {
        _id: string;
        headline: string;
        text: string;
        author: {
            _id: string;
            username: string;
        };
    };
    currentUserId: string;
    onPostUpdated: () => void;
    onPostDeleted: () => void;
}

const Post: React.FC<PostProps> = ({ post, currentUserId, onPostUpdated, onPostDeleted }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [headline, setHeadline] = useState(post.headline);
    const [text, setText] = useState(post.text);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await axios.patch(`/api/posts/${post._id}`, { headline, text });
            setIsEditing(false);
            onPostUpdated();
        } catch (error) {
            console.error('Error updating post:', error);
        }
    };

    const handleDelete = async () => {
        try {
            await axios.delete(`/api/posts/${post._id}`);
            onPostDeleted();
        } catch (error) {
            console.error('Error deleting post:', error);
        }
    };

    const isAuthor = currentUserId === post.author._id;

    if (isEditing) {
        return (
            <form onSubmit={handleUpdate} className="bg-white p-4 rounded shadow mb-4">
                <div className="space-y-4">
                    <div>
                        <label htmlFor="headline" className="block text-sm font-medium text-gray-700">
                            Headline
                        </label>
                        <input
                            type="text"
                            id="headline"
                            value={headline}
                            onChange={(e) => setHeadline(e.target.value)}
                            required
                            className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label htmlFor="text" className="block text-sm font-medium text-gray-700">
                            Text
                        </label>
                        <textarea
                            id="text"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            required
                            rows={4}
                            className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="submit"
                            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                        >
                            Save
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsEditing(false)}
                            className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </form>
        );
    }

    return (
        <div className="bg-white p-4 rounded shadow mb-4">
            <h2 className="text-xl font-bold mb-1">{post.headline}</h2>
            <p className="text-sm text-gray-600 mb-2">Posted by {post.author.username}</p>
            <p className="text-gray-800 mb-4">{post.text}</p>
            {isAuthor && (
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsEditing(true)}
                        className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                    >
                        Edit
                    </button>
                    <button
                        onClick={handleDelete}
                        className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
                    >
                        Delete
                    </button>
                </div>
            )}
        </div>
    );
};

export default Post;
