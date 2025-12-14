# Deploy Z-Library Proxy Worker

## Prerequisites
1. Install Cloudflare Wrangler CLI (if not already installed):
   ```bash
   npm install -g wrangler
   ```

2. Login to Cloudflare:
   ```bash
   wrangler login
   ```

## Deploy

```bash
cd cloudflare-proxy/zlibrary-proxy
npm install
wrangler deploy
```

This will deploy the worker and give you a URL like:
`https://zlibrary-proxy.YOUR_SUBDOMAIN.workers.dev`

## Update Environment Variable

After deployment, update your `.env` file with the actual worker URL:
```
ZLIBRARY_PROXY_URL=https://zlibrary-proxy.YOUR_SUBDOMAIN.workers.dev
```

Then restart your backend server.


