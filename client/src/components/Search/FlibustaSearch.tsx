import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/services/api';
import { toast } from 'react-hot-toast';

interface BookFormat {
  id: string;
  format: string;
}

interface BookResult {
  id: string;
  title: string;
  author: string;
  formats: BookFormat[];
}

interface SearchError {
  message: string;
  code?: string;
  isWarning?: boolean;
}

export const FlibustaSearch = ({ trigger, showText = false }: { trigger?: () => void; showText?: boolean }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<BookResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<SearchError | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (trigger) {
      setIsModalOpen(true);
    }
  }, [trigger]);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const response = await api.get(`/api/books/flibusta/search?query=${encodeURIComponent(searchTerm)}`);
      const data = response.data;

      if (!data) {
        throw new Error('Failed to search on Flibusta');
      }

      setSearchResults(data.data || []);
    } catch (err) {
      console.error('Error searching Flibusta:', err);
      setError({
        message: err instanceof Error ? err.message : 'Failed to search',
        code: 'SEARCH_ERROR'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (bookId: string, format: string) => {
    try {
      // Direct access to Cloudflare worker URL
      window.location.href = `${process.env.NEXT_PUBLIC_FLIBUSTA_PROXY_URL}/${bookId}/${format}`;
    } catch (error) {
      console.error('Error downloading book:', error);
      toast.error('Failed to download book. Please try again.');
    }
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="text-gray-300 hover:text-white transition-colors duration-200 flex items-center justify-center relative top-[2px]"
        title="Flibusta Search"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="18" 
          height="18" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        {showText && <span className="ml-2">Search</span>}
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-[9999]">
          <div className="fixed inset-0 bg-black bg-opacity-75" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="bg-white rounded-lg w-[700px] max-h-[800px] relative flex flex-col">
            <div className="p-4">
              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search books..."
                  className="flex-1 h-[38px] px-4 py-2 border border-gray-200 rounded-md focus:outline-none bg-white text-gray-900 placeholder-gray-400"
                />
                <button
                  onClick={handleSearch}
                  disabled={isLoading}
                  className="px-6 py-2 h-[38px] bg-white text-[15px] font-medium text-black rounded-md hover:bg-black hover:text-white disabled:bg-gray-100 disabled:text-gray-400 transition-colors duration-200 border border-gray-200"
                >
                  {isLoading ? 'Searching...' : 'Search'}
                </button>
              </div>

              {error && (
                <div className={`mb-4 p-3 rounded-md ${
                  error.isWarning 
                    ? 'bg-yellow-50 text-yellow-800 border border-yellow-200' 
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  {error.message}
                </div>
              )}

              <div className="overflow-y-auto max-h-[600px]">
                {searchResults.map((book) => (
                  <div key={book.id} className="mb-2 p-2 hover:bg-gray-50 border border-gray-200 rounded-md">
                    <h3 className="text-sm font-medium text-gray-900">{book.title}</h3>
                    <p className="text-xs text-gray-600 mb-1">{book.author}</p>
                    <div className="flex gap-1">
                      {book.formats
                        .filter(format => format.format !== 'mobi')
                        .map((format) => (
                        <button
                          key={format.id}
                          onClick={() => handleDownload(book.id, format.format)}
                          className="px-2 py-0.5 text-xs bg-white text-gray-700 rounded hover:bg-gray-100 border border-gray-200"
                        >
                          {format.format.toUpperCase()}
                        </button>
                      ))}
                      <a
                        href={`https://flibusta.is/b/${book.id}/read`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-0.5 text-xs bg-white text-gray-600 rounded hover:bg-gray-100 border border-gray-200"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Read online (VPN)
                      </a>
                    </div>
                  </div>
                ))}

                {!isLoading && searchResults.length === 0 && !error && hasSearched && (
                  <div className="text-center text-gray-600 py-4">
                    No books found. Try a different search term.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}; 