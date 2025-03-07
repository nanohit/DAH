import { useState } from 'react';
import { useRouter } from 'next/navigation';

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

export const FlibustaSearch = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<BookResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<SearchError | null>(null);
  const router = useRouter();

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/books/flibusta/search?query=${encodeURIComponent(searchTerm)}`);
      const data = await response.json();

      if (!response.ok) {
        let errorMessage = data.error || 'Failed to search books';
        let isWarning = false;

        // Handle specific error codes
        if (data.code === 'REGION_BLOCKED') {
          errorMessage = 'Access to Flibusta is blocked in your region. Please wait while we try to connect through a proxy...';
          isWarning = true;
        } else if (data.code === 'CONNECTION_ERROR') {
          errorMessage = 'Having trouble connecting to Flibusta. Please try again in a few moments...';
          isWarning = true;
        }

        throw new Error(errorMessage, { cause: { code: data.code, isWarning } });
      }

      setSearchResults(data.data || []);
    } catch (err) {
      const error = err as Error;
      const cause = error.cause as { code?: string; isWarning?: boolean };
      
      setError({
        message: error.message,
        code: cause?.code,
        isWarning: cause?.isWarning
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (bookId: string, format: string) => {
    try {
      const response = await fetch(`/api/books/flibusta/download/${bookId}/${format}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get download link');
      }

      // Open the download URL in a new tab
      window.open(data.data.downloadUrl, '_blank');
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Failed to get download link',
        code: 'DOWNLOAD_ERROR'
      });
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
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="absolute inset-0 bg-gray-800 bg-opacity-75" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="bg-white rounded-lg w-[800px] max-h-[800px] relative flex flex-col">
            <div className="p-6">
              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search books on Flibusta..."
                  className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  <div key={book.id} className="mb-6 p-4 border rounded-md">
                    <h3 className="text-lg font-semibold">{book.title}</h3>
                    <p className="text-gray-600 mb-3">{book.author}</p>
                    <div className="flex gap-2">
                      {book.formats.map((format) => (
                        <button
                          key={format.id}
                          onClick={() => handleDownload(book.id, format.format)}
                          className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                        >
                          Download {format.format.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {!isLoading && searchResults.length === 0 && !error && (
                  <div className="text-center text-gray-500 py-8">
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