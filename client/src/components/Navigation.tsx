'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { logout } from '@/services/auth';
import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';
import { SearchModal } from '@/components/Search/SearchModal';
import { FlibustaSearch } from '@/components/Search/FlibustaSearch';
import { BookSearchResult } from '@/types';

const Navigation = () => {
  const { isAuthenticated, isAdmin, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isUserProfilePage = user?.username && decodeURIComponent(pathname) === `/user/${user.username}`;
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  const handleBookSubmit = async (bookData: BookSearchResult) => {
    setError(null);
    try {
      // Close the modal and redirect to books page
      setIsSearchModalOpen(false);
      router.push('/books');
    } catch (error) {
      console.error('Error handling book submission:', error);
      setError(error instanceof Error ? error.message : 'Failed to handle book submission');
    }
  };

  return (
    <nav className="bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="text-white font-bold text-xl tracking-wider">
              Alphy
            </Link>
            <div className="ml-10 flex items-baseline space-x-4">
              <Link 
                href="/maps" 
                className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
              >
                Maps
              </Link>
              <Link 
                href="/saved-maps" 
                className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
              >
                Saved Maps
              </Link>
              <Link 
                href="/books" 
                className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
              >
                BooksDB
              </Link>
              <FlibustaSearch />
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                <button
                  onClick={() => {
                    setError(null);
                    setIsSearchModalOpen(true);
                  }}
                  className="border border-gray-400/50 text-white hover:bg-white hover:text-black px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-200"
                >
                  Add Book
                </button>
                <Link
                  href="/bookmarks"
                  className="border border-gray-400/50 text-white hover:bg-white hover:text-black px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-200"
                >
                  Bookmarks
                </Link>
                <Link
                  href={`/user/${user?.username}`}
                  className="border border-gray-400/50 text-white hover:bg-white hover:text-black px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-200"
                >
                  Welcome, <span className="font-bold">{user?.username}</span>
                </Link>
                {isUserProfilePage && (
                  <button
                    onClick={handleLogout}
                    className="border border-gray-400/50 text-white hover:bg-red-600 hover:border-red-600 px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-200"
                  >
                    Logout
                  </button>
                )}
              </>
            ) : (
              <div className="space-x-4">
                <Link 
                  href="/login" 
                  className="border border-gray-400/50 text-white hover:bg-white hover:text-black px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-200"
                >
                  Login
                </Link>
                <Link 
                  href="/register" 
                  className="border border-gray-400/50 text-white hover:bg-white hover:text-black px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-200"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {isSearchModalOpen && (
        <SearchModal 
          onClose={() => {
            setError(null);
            setIsSearchModalOpen(false);
          }} 
          onBookSubmit={handleBookSubmit}
          error={error}
        />
      )}
    </nav>
  );
};

export default Navigation;