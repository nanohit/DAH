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
          
          <div className="bg-black rounded-lg w-[800px] max-h-[800px] relative flex flex-col">
            <div className="p-6">
              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search books..."
                  className="flex-1 px-4 py-2 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 bg-black text-gray-200 placeholder-gray-500"
                />
                <button
                  onClick={handleSearch}
                  disabled={isLoading}
                  className="px-4 py-2 bg-black text-white rounded-md hover:bg-white hover:text-black disabled:bg-gray-900 disabled:text-gray-400 transition-colors duration-200 border border-gray-700"
                >
                  {isLoading ? 'Searching...' : 'Search'}
                </button>
              </div>

              {error && (
                <div className={`mb-4 p-3 rounded-md ${
                  error.isWarning 
                    ? 'bg-yellow-900 text-yellow-200' 
                    : 'bg-red-900 text-red-200'
                }`}>
                  {error.message}
                </div>
              )}

              <div className="overflow-y-auto max-h-[600px]">
                {searchResults.map((book) => (
                  <div key={book.id} className="mb-2 p-2 hover:bg-gray-900 border border-gray-700 rounded-md">
                    <h3 className="text-sm font-medium text-gray-200">{book.title}</h3>
                    <p className="text-xs text-gray-400 mb-1">{book.author}</p>
                    <div className="flex gap-1">
                      {book.formats
                        .filter(format => format.format !== 'mobi')
                        .map((format) => (
                        <button
                          key={format.id}
                          onClick={() => handleDownload(book.id, format.format)}
                          className="px-2 py-0.5 text-xs bg-gray-900 text-gray-300 rounded hover:bg-gray-800 border border-gray-600"
                        >
                          {format.format.toUpperCase()}
                        </button>
                      ))}
                      <a
                        href={`https://flibusta.is/b/${book.id}/read`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-0.5 text-xs bg-gray-900 text-gray-400 rounded hover:bg-gray-800 border border-gray-600"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Read online (VPN)
                      </a>
                    </div>
                  </div>
                ))}

                {!isLoading && searchResults.length === 0 && !error && (
                  <div className="text-center text-gray-400 py-4">
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