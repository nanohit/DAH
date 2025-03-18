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

export const FlibustaSearch = ({ trigger }: { trigger?: () => void }) => {
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
        className="border border-gray-400/50 text-white hover:bg-white hover:text-black px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-200"
      >
        Flibusta Search
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-[9999]">
          <div className="fixed inset-0 bg-gray-800 bg-opacity-75" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="bg-white rounded-lg w-[800px] max-h-[800px] relative flex flex-col">
            <div className="p-6">
              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search books on Flibusta..."
                  className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
                <button
                  onClick={handleSearch}
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-blue-300"
                >
                  {isLoading ? 'Searching...' : 'Search'}
                </button>
              </div>

              {error && (
                <div className={`mb-4 p-3 rounded-md ${
                  error.isWarning 
                    ? 'bg-yellow-100 text-yellow-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  {error.message}
                </div>
              )}

              <div className="overflow-y-auto max-h-[600px]">
                {searchResults.map((book) => (
                  <div key={book.id} className="mb-2 p-2 hover:bg-gray-50 border rounded-md">
                    <h3 className="text-sm font-medium text-gray-900">{book.title}</h3>
                    <p className="text-xs text-gray-600 mb-1">{book.author}</p>
                    <div className="flex gap-1">
                      {book.formats
                        .filter(format => format.format !== 'mobi')
                        .map((format) => (
                        <button
                          key={format.id}
                          onClick={() => handleDownload(book.id, format.format)}
                          className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                        >
                          {format.format.toUpperCase()}
                        </button>
                      ))}
                      <a
                        href={`https://flibusta.is/b/${book.id}/read`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-0.5 text-xs bg-gray-50 text-gray-600 rounded hover:bg-gray-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Read online (VPN)
                      </a>
                    </div>
                  </div>
                ))}

                {!isLoading && searchResults.length === 0 && !error && (
                  <div className="text-center text-gray-700 py-4">
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