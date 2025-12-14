/**
 * Z-Library download proxy.
 * Streams already-authorized download URLs (e.g., https://dln1.ncdn.ec/...) through a Cloudflare Worker.
 */

const allowedHostSuffixes = ['.ncdn.ec'];
const allowedExactHosts = ['z-library.sk', 'z-library.ec'];

const decodeBase64Url = (value: string) => {
	try {
		const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
		const padded = normalized.padEnd(normalized.length + (4 - (normalized.length % 4)) % 4, '=');
		return atob(padded);
	} catch {
		return null;
	}
};

export default {
	async fetch(request: Request): Promise<Response> {
		try {
			const url = new URL(request.url);
			const segments = url.pathname.split('/').filter(Boolean);

			if (segments.length < 2 || segments[0] !== 'download') {
				return new Response('Invalid path. Use /download/:base64url', { status: 400 });
				}

			const encodedTarget = segments.slice(1).join('/');
			const decodedTarget = decodeBase64Url(encodedTarget);

			if (!decodedTarget) {
				return new Response('Invalid download token', { status: 400 });
			}

			const targetUrl = new URL(decodedTarget);
			const hostname = targetUrl.hostname.toLowerCase();
			const allowed =
				targetUrl.protocol === 'https:' &&
				(allowedExactHosts.includes(hostname) ||
					allowedHostSuffixes.some((suffix) => hostname.endsWith(suffix)));

			if (!allowed) {
				return new Response('Target host is not allowed', { status: 400 });
			}

			const upstream = await fetch(targetUrl.toString(), {
				headers: {
					'User-Agent':
						'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
					'Accept': '*/*',
					'Referer': 'https://z-library.sk/',
				},
				redirect: 'follow',
			});

			const responseHeaders = new Headers(upstream.headers);
			responseHeaders.set('Access-Control-Allow-Origin', '*');
			responseHeaders.set('Cache-Control', 'private, max-age=0');

			return new Response(upstream.body, {
				status: upstream.status,
				headers: responseHeaders,
			});
		} catch (error: any) {
			console.error('Z-Library proxy error:', error);
			return new Response(`Proxy error: ${error.message || 'unknown error'}`, {
				status: 500,
				headers: {
					'Content-Type': 'text/plain; charset=utf-8',
					'Access-Control-Allow-Origin': '*',
				},
			});
		}
	},
} satisfies ExportedHandler<{}>;
