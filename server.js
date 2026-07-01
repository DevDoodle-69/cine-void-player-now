const express = require('express');
const http = require('http');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 1. The Video Player Interface
// ==========================================
app.get('/stream', (req, res) => {
    // We parse the URL manually from req.originalUrl instead of req.query.url.
    // Why? Because your target URL contains a second '?' (watch?id=...). 
    // Standard query parsers will split this, breaking the link. This prevents that.
    const urlIndex = req.originalUrl.indexOf('url=');
    if (urlIndex === -1) {
        return res.status(400).send('Please provide a url parameter.');
    }
    
    // Extract everything after "url="
    const targetUrl = req.originalUrl.substring(urlIndex + 4);

    // Serve a completely clean, fullscreen video player. No extra text.
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Direct Stream</title>
            <style>
                /* Remove all margins and make background black */
                body, html { 
                    margin: 0; padding: 0; 
                    width: 100vw; height: 100vh; 
                    background-color: #000; 
                    overflow: hidden; 
                }
                /* Force video player to take up the entire screen */
                video { 
                    width: 100%; height: 100%; 
                    outline: none; 
                }
            </style>
        </head>
        <body>
            <video controls autoplay>
                <source src="/proxy?url=${encodeURIComponent(targetUrl)}" type="video/mp4">
                Your browser does not support the video tag.
            </video>
        </body>
        </html>
    `);
});

// ==========================================
// 2. The Background Video Proxy Tunnel
// ==========================================
app.get('/proxy', (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('URL required');

    // Ensure the URL has a protocol
    let finalUrl = targetUrl;
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = 'http://' + finalUrl;
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(finalUrl);
    } catch (err) {
        return res.status(400).send('Invalid URL provided.');
    }

    const requestModule = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
            // CRITICAL: Forward the 'Range' header from the user's browser 
            // so that player controls (skipping/seeking) work perfectly.
            ...(req.headers.range && { range: req.headers.range }),
            host: parsedUrl.host,
        }
    };

    // Request the video from the local IP
    const proxyReq = requestModule.request(options, (proxyRes) => {
        // Forward the HTTP status and headers (like Content-Length and Content-Range)
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        
        // Pipe the raw video stream directly to the user
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
        console.error('Proxy Error:', err.message);
        if (!res.headersSent) {
            res.status(500).end();
        }
    });

    // If the user closes the web page, immediately stop downloading the local video
    req.on('close', () => {
        proxyReq.destroy();
    });

    proxyReq.end();
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Test URL: http://localhost:${PORT}/stream?url=192.168.0.104:8080/watch?id=3032129946669007320`);
});
