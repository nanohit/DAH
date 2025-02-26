'use client';

import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Welcome to Book Library</h1>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Browse Books</h2>
          <p className="text-gray-600 mb-4">
            Explore our vast collection of books across various genres and authors.
          </p>
          <a href="/books" className="text-blue-600 hover:text-blue-800">
            View Books →
          </a>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Join Our Community</h2>
          <p className="text-gray-600 mb-4">
            Create an account to save your favorite books and track your reading progress.
          </p>
          <a href="/register" className="text-blue-600 hover:text-blue-800">
            Register Now →
          </a>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Member Benefits</h2>
          <p className="text-gray-600 mb-4">
            Get access to exclusive features and personalized recommendations.
          </p>
          <a href="/login" className="text-blue-600 hover:text-blue-800">
            Login →
          </a>
        </div>
      </div>
    </div>
  );
}