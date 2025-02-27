import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Post from './Post';
import PostForm from './PostForm';
import { useAuth } from '../context/AuthContext';

interface Author {
    _id: string;
    username: string;
}

interface PostType {
    _id: string;
    headline: string;
    text: string;
    author: Author;
    createdAt: string;
    updatedAt: string;
}

const Posts: React.FC = () => {
    const [posts, setPosts] = useState<PostType[]>([]);
    const { user } = useAuth();

    const fetchPosts = async () => {
        try {
            const response = await axios.get<PostType[]>('/api/posts');
            setPosts(response.data);
        } catch (error) {
            console.error('Error fetching posts:', error);
        }
    };

    useEffect(() => {
        fetchPosts();
    }, []);

    return (
        <div className="max-w-2xl mx-auto p-4">
            {user && <PostForm onPostCreated={fetchPosts} />}
            <div className="space-y-4">
                {posts.map((post) => (
                    <Post
                        key={post._id}
                        post={post}
                        currentUserId={user?._id}
                        onPostUpdated={fetchPosts}
                        onPostDeleted={fetchPosts}
                    />
                ))}
            </div>
        </div>
    );
};

export default Posts;
