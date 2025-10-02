const cors_proxy = require('cors-anywhere');

const host = process.env.HOST || '0.0.0.0';
const port = process.env.PORT || 8080;

// Set your API key here or via environment variable
const VALID_API_KEY = process.env.API_KEY || 'your-secret-key-here';

cors_proxy.createServer({
    originWhitelist: [], // Allow all origins
    requireHeader: [],   // Don't require any special headers
    removeHeaders: ['cookie', 'cookie2']
}).listen(port, host, function() {
    // Wrap the request handler to check API key
    const originalHandler = this._events.request;
    this._events.request = function(req, res) {
        // Extract token from query parameter or header
        const url = new URL(req.url, `http://${req.headers.host}`);
        const token = url.searchParams.get('token') ||
                     url.searchParams.get('key') ||
                     req.headers['x-api-key'] ||
                     req.headers['authorization']?.replace('Bearer ', '');

        if (token !== VALID_API_KEY) {
            res.writeHead(401, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({
                error: 'Unauthorized',
                message: 'Valid API key required. Provide via ?token=YOUR_KEY or X-API-Key header'
            }));
            return;
        }

        // Remove token from URL before proxying to avoid leaking it
        url.searchParams.delete('token');
        url.searchParams.delete('key');
        req.url = url.pathname + url.search;

        originalHandler.call(this, req, res);
    };

    console.log('========================================');
    console.log('Authenticated CORS Proxy Server');
    console.log('========================================');
    console.log(`Running on: http://${host}:${port}`);
    console.log(`API Key: ${VALID_API_KEY}`);
    console.log('');
    console.log('Usage examples:');
    console.log(`  http://localhost:${port}/?token=${VALID_API_KEY}&https://example.com/image.jpg`);
    console.log(`  curl -H "X-API-Key: ${VALID_API_KEY}" http://localhost:${port}/https://example.com/image.jpg`);
    console.log('========================================');
});
