const http = require('http');
const https = require('https');
const { URL } = require('url');

const host = process.env.HOST || '0.0.0.0';
const port = process.env.PORT || 8080;

// Set your API key here or via environment variable
const VALID_API_KEY = process.env.API_KEY || 'your-secret-key-here';

// Allowed domains (whitelist) - empty array means allow all
const ALLOWED_DOMAINS = process.env.ALLOWED_DOMAINS ?
    process.env.ALLOWED_DOMAINS.split(',') : [];

// Request timeout in milliseconds
const TIMEOUT = 30000;

const server = http.createServer((req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
            'Access-Control-Max-Age': '86400'
        });
        res.end();
        return;
    }

    // Extract token from query parameter or header
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);
    const token = requestUrl.searchParams.get('token') ||
                 requestUrl.searchParams.get('key') ||
                 req.headers['x-api-key'] ||
                 req.headers['authorization']?.replace('Bearer ', '');

    // Validate API key
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

    // Extract target URL - support multiple formats
    let targetUrl = null;

    // Format 1: Path-based /https://example.com
    if (requestUrl.pathname.length > 1) {
        targetUrl = requestUrl.pathname.substring(1); // Remove leading /
    }

    // Format 2: Query parameter ?url=https://example.com
    if (!targetUrl && requestUrl.searchParams.has('url')) {
        targetUrl = requestUrl.searchParams.get('url');
    }

    // Format 3: URL after token in query string (?token=KEY&URL)
    // The URL gets added as a parameter without a key, so we need to find it
    if (!targetUrl) {
        for (const [key, value] of requestUrl.searchParams.entries()) {
            // Skip known parameters
            if (key === 'token' || key === 'key') continue;

            // Check if the key itself is a URL (happens when no value is provided)
            if (key.startsWith('http://') || key.startsWith('https://')) {
                targetUrl = key;
                break;
            }

            // Or if the value is a URL
            if (value && (value.startsWith('http://') || value.startsWith('https://'))) {
                targetUrl = value;
                break;
            }
        }
    }

    if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
        res.writeHead(400, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
            error: 'Bad Request',
            message: 'Valid target URL required. Formats: /?token=KEY&url=TARGET or /TARGET?token=KEY',
            received_params: Object.fromEntries(requestUrl.searchParams.entries())
        }));
        return;
    }

    let parsedTarget;
    try {
        parsedTarget = new URL(targetUrl);
    } catch (err) {
        res.writeHead(400, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
            error: 'Bad Request',
            message: 'Invalid target URL'
        }));
        return;
    }

    // Check domain whitelist
    if (ALLOWED_DOMAINS.length > 0) {
        const isAllowed = ALLOWED_DOMAINS.some(domain =>
            parsedTarget.hostname.endsWith(domain)
        );
        if (!isAllowed) {
            res.writeHead(403, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({
                error: 'Forbidden',
                message: 'Target domain not in whitelist'
            }));
            return;
        }
    }

    // Block internal/private IPs
    const hostname = parsedTarget.hostname.toLowerCase();
    if (hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.16.') ||
        hostname.startsWith('[::1]') ||
        hostname === '0.0.0.0') {
        console.log(`[BLOCKED] Internal/private address: ${hostname}`);
        res.writeHead(403, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
            error: 'Forbidden',
            message: 'Cannot proxy to internal/private addresses',
            hostname: hostname
        }));
        return;
    }

    // Log the request
    console.log(`[PROXY] ${parsedTarget.hostname} - ${parsedTarget.pathname}`);

    // Prepare proxy request
    const protocol = parsedTarget.protocol === 'https:' ? https : http;
    const options = {
        hostname: parsedTarget.hostname,
        port: parsedTarget.port,
        path: parsedTarget.pathname + parsedTarget.search,
        method: req.method,
        headers: {
            'User-Agent': req.headers['user-agent'] || 'CORS-Proxy/1.0',
            'Accept': req.headers['accept'] || '*/*'
        },
        timeout: TIMEOUT
    };

    // Forward request
    const proxyReq = protocol.request(options, (proxyRes) => {
        // Set CORS headers
        const headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Expose-Headers': '*'
        };

        // Forward response headers (except cookies)
        Object.keys(proxyRes.headers).forEach(key => {
            if (key.toLowerCase() !== 'set-cookie') {
                headers[key] = proxyRes.headers[key];
            }
        });

        res.writeHead(proxyRes.statusCode, headers);
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
        console.error(`[ERROR] ${parsedTarget.hostname} - ${err.message}`);
        if (!res.headersSent) {
            res.writeHead(502, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({
                error: 'Bad Gateway',
                message: 'Failed to fetch from target URL',
                details: err.message
            }));
        }
    });

    proxyReq.on('timeout', () => {
        proxyReq.destroy();
        if (!res.headersSent) {
            res.writeHead(504, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({
                error: 'Gateway Timeout',
                message: 'Request to target URL timed out'
            }));
        }
    });

    // Forward request body for POST/PUT
    if (req.method === 'POST' || req.method === 'PUT') {
        req.pipe(proxyReq);
    } else {
        proxyReq.end();
    }
});

server.listen(port, host, () => {
    console.log('========================================');
    console.log('Secure CORS Proxy Server');
    console.log('========================================');
    console.log(`Running on: http://${host}:${port}`);
    console.log(`API Key: ${VALID_API_KEY}`);
    console.log(`Timeout: ${TIMEOUT}ms`);
    if (ALLOWED_DOMAINS.length > 0) {
        console.log(`Allowed domains: ${ALLOWED_DOMAINS.join(', ')}`);
    } else {
        console.log('Allowed domains: ALL (configure ALLOWED_DOMAINS to restrict)');
    }
    console.log('');
    console.log('Usage examples:');
    console.log(`  http://localhost:${port}/?token=${VALID_API_KEY}&https://example.com/image.jpg`);
    console.log(`  curl -H "X-API-Key: ${VALID_API_KEY}" http://localhost:${port}/https://example.com/image.jpg`);
    console.log('========================================');
});
