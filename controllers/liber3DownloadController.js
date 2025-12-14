const axios = require('axios');
const { Readable } = require('stream');

const IPFS_MIRRORS = [
  process.env.LIBER3_IPFS_GATEWAY || 'https://ipfs.io/ipfs',
  'https://gateway.pinata.cloud/ipfs',
  'https://dweb.link/ipfs',
  'https://cloudflare-ipfs.com/ipfs',
  'https://gateway.ipfs.io/ipfs',
  'https://w3s.link/ipfs',
  'https://nftstorage.link/ipfs',
  'https://cf-ipfs.com/ipfs',
];

// @desc Proxy Liber3/IPFS download with mirror fallback
// @route GET /api/books/liber3/download/:cid
// @access Public
async function downloadLiber3(req, res) {
  const { cid } = req.params;
  if (!cid) {
    return res.status(400).json({ success: false, message: 'cid is required' });
  }

  const mirrors = IPFS_MIRRORS.map((base) => `${base.replace(/\/$/, '')}/${cid}`);
  const timeoutMs = Number(process.env.LIBER3_DOWNLOAD_TIMEOUT_MS || 15000);
  let lastError;

  for (const url of mirrors) {
    try {
      const response = await axios.get(url, {
        responseType: 'stream',
        timeout: timeoutMs,
        maxRedirects: 3,
        validateStatus: (s) => s >= 200 && s < 400,
      });

      res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
      if (response.headers['content-length']) {
        res.setHeader('Content-Length', response.headers['content-length']);
      }
      if (response.headers['content-disposition']) {
        res.setHeader('Content-Disposition', response.headers['content-disposition']);
      } else {
        res.setHeader('Content-Disposition', `attachment; filename="${cid}.bin"`);
      }

      response.data.pipe(res);
      response.data.on('error', (err) => {
        res.destroy(err);
      });
      return;
    } catch (error) {
      lastError = error;
      // try next mirror
    }
  }

  // Final fallback: verified fetch via delegated routing (no swarm ports)
  try {
    const { verifiedFetch } = await import('@helia/verified-fetch');
    const resp = await verifiedFetch(`ipfs://${cid}`, { timeout: timeoutMs });
    if (!resp.ok) {
      throw new Error(`verified fetch failed with status ${resp.status}`);
    }

    res.setHeader('Content-Type', resp.headers.get('content-type') || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${cid}.bin"`);

    if (resp.headers.get('content-length')) {
      res.setHeader('Content-Length', resp.headers.get('content-length'));
    }

    const nodeStream = Readable.fromWeb(resp.body);
    nodeStream.on('error', (err) => res.destroy(err));
    nodeStream.pipe(res);
    return;
  } catch (error) {
    lastError = error;
  }

  res.status(504).json({
    success: false,
    message: 'Failed to fetch from IPFS mirrors',
    error: lastError?.message,
    mirrors,
  });
}

module.exports = { downloadLiber3 };

