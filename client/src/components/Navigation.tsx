'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { logout } from '@/services/auth';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { SearchModal } from '@/components/Search/SearchModal';
import { FlibustaSearch } from '@/components/Search/FlibustaSearch';
import { BookSearchResult } from '@/types';
import { BsBookmark, BsBookmarkFill } from 'react-icons/bs';

const Navigation = () => {
  const { isAuthenticated, isAdmin, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isUserProfilePage = user?.username && decodeURIComponent(pathname) === `/user/${user.username}`;
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBookmarkHovered, setIsBookmarkHovered] = useState(false);
  const isBookmarksPage = pathname === '/bookmarks';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

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
    <nav className="bg-black fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Desktop Nav */}
          <div className="flex items-center">
            <Link href="/" className="text-white font-bold text-xl tracking-wider font-ibm-plex-mono">
              alphy
            </Link>
            
            {/* Desktop Navigation Links */}
            <div className="hidden md:flex ml-10 items-baseline space-x-4">
              <Link 
                href="/maps" 
                className="border border-gray-400/50 text-white hover:bg-white hover:text-black px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-200"
              >
                + New Map
              </Link>
              <Link 
                href="/saved-maps" 
                className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-xs font-medium group"
              >
                <span className="relative">
                  Saved Maps
                  <span className="absolute -bottom-1 left-0 w-0 h-[0.5px] bg-gray-500 transition-all duration-300 group-hover:w-full"></span>
                </span>
              </Link>
              <Link 
                href="/books" 
                className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-xs font-medium group"
              >
                <span className="relative">
                  BooksDB
                  <span className="absolute -bottom-1 left-0 w-0 h-[0.5px] bg-gray-500 transition-all duration-300 group-hover:w-full"></span>
                </span>
              </Link>
              <FlibustaSearch />
            </div>
          </div>

          {/* Right side elements (desktop) */}
          <div className="hidden md:flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                <Link
                  href="/bookmarks"
                  className={`${isBookmarksPage ? 'text-white' : 'text-gray-300 hover:text-white'} flex items-center transition-colors duration-200`}
                  onMouseEnter={() => setIsBookmarkHovered(true)}
                  onMouseLeave={() => setIsBookmarkHovered(false)}
                >
                  {isBookmarksPage || isBookmarkHovered ? (
                    <BsBookmarkFill size={20} />
                  ) : (
                    <BsBookmark size={20} />
                  )}
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

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
              className="text-gray-300 hover:text-white p-1"
              aria-label="Toggle menu"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                className="w-6 h-6"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} 
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className={`${mobileMenuOpen ? 'block' : 'hidden'} md:hidden absolute top-16 left-0 right-0 z-50 bg-black shadow-lg`}>
        <div className="px-2 pt-2 pb-3 space-y-3 border-t border-gray-700">
          <Link 
            href="/maps" 
            className="block text-gray-300 hover:text-white px-3 py-2 rounded-md text-base font-medium"
          >
            + New Map
          </Link>
          <Link 
            href="/saved-maps" 
            className="block text-gray-300 hover:text-white px-3 py-2 rounded-md text-base font-medium"
          >
            Saved Maps
          </Link>
          <Link 
            href="/books" 
            className="block text-gray-300 hover:text-white px-3 py-2 rounded-md text-base font-medium"
          >
            BooksDB
          </Link>
          <div className="block text-gray-300 hover:text-white px-3 py-2 rounded-md text-base font-medium">
            <FlibustaSearch showText={true} />
          </div>
        </div>

        {/* Mobile menu auth */}
        <div className="pt-4 pb-3 border-t border-gray-700">
          <div className="px-2 space-y-3">
            {isAuthenticated ? (
              <>
                <Link
                  href="/bookmarks"
                  className="block text-gray-300 hover:text-white px-3 py-2 rounded-md text-base font-medium"
                >
                  <div className="flex items-center">
                    <BsBookmark size={18} className="mr-2" />
                    <span>Bookmarks</span>
                  </div>
                </Link>
                <Link
                  href={`/user/${user?.username}`}
                  className="block text-gray-300 hover:text-white px-3 py-2 rounded-md text-base font-medium"
                >
                  Welcome, <span className="font-bold">{user?.username}</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="block text-gray-300 hover:text-white px-3 py-2 rounded-md text-base font-medium w-full text-left"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link 
                  href="/login" 
                  className="block text-gray-300 hover:text-white px-3 py-2 rounded-md text-base font-medium"
                >
                  Login
                </Link>
                <Link 
                  href="/register" 
                  className="block text-gray-300 hover:text-white px-3 py-2 rounded-md text-base font-medium"
                >
                  Register
                </Link>
              </>
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