/**
 * Flibusta Proxy Worker
 */

const FLIBUSTA_BASE = 'https://flibusta.is';

interface Env {
	ENVIRONMENT?: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		try {
			const url = new URL(request.url);
			console.log('Received request for:', url.pathname);
			
			// Normalize pathname (remove trailing slash)
			const normalizedPath = url.pathname.endsWith('/') && url.pathname !== '/'
				? url.pathname.slice(0, -1)
				: url.pathname;

			// Support search proxying: /search?ask=...
			if (normalizedPath === '/search') {
				const searchParams = new URLSearchParams(url.search);
				const queryString = searchParams.toString();

				if (!searchParams.get('ask')) {
					console.log('Missing "ask" query parameter for search');
					return new Response('Missing "ask" query parameter', { status: 400 });
				}

				const flibustaUrl = `${FLIBUSTA_BASE}/booksearch${queryString ? `?${queryString}` : ''}`;
				console.log('Proxying search to Flibusta:', flibustaUrl);

				const headers = {
					'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
					'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
					'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
					'Accept-Encoding': 'gzip, deflate, br',
					'Cache-Control': 'no-cache',
					'Pragma': 'no-cache',
					'Referer': `${FLIBUSTA_BASE}/`
				};

				const response = await fetch(flibustaUrl, {
					headers,
					redirect: 'follow',
					cf: {
						cacheTtl: 300,
						cacheEverything: true
					}
				});

				console.log('Flibusta search response:', {
					status: response.status,
					statusText: response.statusText
				});

				const body = await response.text();
				const contentType = response.headers.get('content-type') || 'text/html; charset=utf-8';

				return new Response(body, {
					status: response.status,
					headers: {
						'Content-Type': contentType,
						'Cache-Control': 'public, max-age=300',
						'Access-Control-Allow-Origin': '*'
					}
				});
			}

			// Extract book ID and format from the path
			const [_, bookId, format] = normalizedPath.split('/');
			
			if (!bookId || !format) {
				console.log('Invalid request format');
				return new Response('Invalid request. Format: /:bookId/:format', { status: 400 });
			}

			console.log(`Attempting to fetch book ID: ${bookId}, format: ${format}`);

			// Construct Flibusta URL
			const flibustaUrl = `${FLIBUSTA_BASE}/b/${bookId}/${format}`;
			console.log('Requesting from Flibusta:', flibustaUrl);

			// Common browser-like headers
			const headers = {
				'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
				'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
				'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
				'Accept-Encoding': 'gzip, deflate, br',
				'Cache-Control': 'no-cache',
				'Pragma': 'no-cache',
				'Referer': `${FLIBUSTA_BASE}/b/${bookId}`
			};

			// Make request to Flibusta
			console.log('Sending request with headers:', headers);
			const response = await fetch(flibustaUrl, {
				headers,
				redirect: 'follow',
				cf: {
					cacheTtl: 3600,
					cacheEverything: true
				}
			});

			console.log('Flibusta response:', {
				status: response.status,
				statusText: response.statusText,
				headers: Object.fromEntries(response.headers.entries())
			});

			// Handle response
			if (!response.ok) {
				if (response.status === 404) {
					return new Response('Book or format not found', { status: 404 });
				}
				return new Response(`Failed to fetch book: ${response.statusText}`, { status: response.status });
			}

			// Get content type and filename from response
			const contentType = response.headers.get('content-type');
			const contentDisposition = response.headers.get('content-disposition');
			let filename = `${bookId}.${format}`;

			if (contentDisposition) {
				const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
				if (match) {
					filename = match[1].replace(/['"]/g, '');
				}
			}

			console.log('Preparing response with:', {
				contentType,
				filename,
				contentLength: response.headers.get('content-length')
			});

			// Create response headers
			const responseHeaders = new Headers({
				'Content-Type': contentType || 'application/octet-stream',
				'Content-Disposition': `attachment; filename="${filename}"`,
				'Cache-Control': 'public, max-age=3600',
				'Access-Control-Allow-Origin': '*',
			});

			// Stream the response
			return new Response(response.body, {
				status: 200,
				headers: responseHeaders,
			});

		} catch (error: any) {
			console.error('Proxy error:', error);
			const errorMessage = error.message || 'Unknown error';
			return new Response(`Internal server error: ${errorMessage}`, { 
				status: 500,
				headers: {
					'Content-Type': 'text/plain',
					'Access-Control-Allow-Origin': '*',
				}
			});
		}
	},
} satisfies ExportedHandler<Env>;
