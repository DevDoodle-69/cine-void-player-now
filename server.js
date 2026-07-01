const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const PORT = 3000;

// Enable CORS for all routes
app.use(cors());

// Serve a simple HTML player for the root path
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Video Stream</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    background: #000; 
                    display: flex; 
                    justify-content: center; 
                    align-items: center; 
                    height: 100vh; 
                    overflow: hidden;
                }
                video {
                    max-width: 100vw;
                    max-height: 100vh;
                    width: auto;
                    height: auto;
                }
            </style>
        </head>
        <body>
            <video id="videoPlayer" controls autoplay></video>
            <script>
                // Get URL from query parameter
                const urlParams = new URLSearchParams(window.location.search);
                const videoUrl = urlParams.get('url');
                
                if (videoUrl) {
                    const video = document.getElementById('videoPlayer');
                    // Use the proxy endpoint
                    video.src = '/stream?url=' + encodeURIComponent(videoUrl);
                } else {
                    document.body.innerHTML = '<h1 style="color:white;">Please provide a URL parameter</h1>';
                }
            </script>
        </body>
        </html>
    `);
});

// Stream endpoint
app.get('/stream', async (req, res) => {
    try {
        const targetUrl = req.query.url;
        
        if (!targetUrl) {
            return res.status(400).send('URL parameter is required');
        }

        // Ensure URL has protocol
        let fullUrl = targetUrl;
        if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
            fullUrl = 'http://' + fullUrl;
        }

        console.log(`Proxying request to: ${fullUrl}`);

        // Make request to the target server
        const response = await axios({
            method: 'GET',
            url: fullUrl,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': '*/*',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Range': req.headers.range || undefined
            },
            timeout: 30000,
            maxRedirects: 5,
            validateStatus: function (status) {
                return status >= 200 && status < 400;
            }
        });

        // Get the content type
        const contentType = response.headers['content-type'] || 'video/mp4';
        
        // Set response headers for video streaming
        res.setHeader('Content-Type', contentType);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Range, Accept-Encoding');

        // Handle range requests for seeking
        if (req.headers.range) {
            const range = req.headers.range;
            const fileSize = parseInt(response.headers['content-length']) || 0;
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            
            res.status(206);
            res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
            res.setHeader('Content-Length', end - start + 1);
        }

        // Pipe the video stream to the response
        response.data.pipe(res);

        // Handle errors in the stream
        response.data.on('error', (error) => {
            console.error('Stream error:', error);
            if (!res.headersSent) {
                res.status(500).send('Stream error');
            }
        });

    } catch (error) {
        console.error('Proxy error:', error.message);
        
        if (error.response) {
            // The request was made and the server responded with a status code
            console.error('Status:', error.response.status);
            console.error('Headers:', error.response.headers);
            res.status(error.response.status).send(`Server responded with status ${error.response.status}`);
        } else if (error.request) {
            // The request was made but no response was received
            console.error('No response received');
            res.status(504).send(`
                <h1>Connection Error</h1>
                <p>Could not connect to the video server at ${targetUrl}</p>
                <p>Error: ${error.message}</p>
                <p>Please check if the server is running and accessible.</p>
            `);
        } else {
            // Something happened in setting up the request
            res.status(500).send(`Error: ${error.message}`);
        }
    }
});

// Handle OPTIONS requests for CORS preflight
app.options('/stream', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Range, Accept-Encoding');
    res.sendStatus(200);
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Proxy server running at http://localhost:${PORT}`);
    console.log(`Usage: http://localhost:${PORT}/?url=192.168.0.104:8080/watch?id=3032129946669007320`);
    console.log(`Direct stream: http://localhost:${PORT}/stream?url=192.168.0.104:8080/watch?id=3032129946669007320`);
});
