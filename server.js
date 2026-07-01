const express = require('express');
const http = require('http');
const httpProxy = require('http-proxy-middleware');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/stream', (req, res) => {
    const targetUrl = req.query.url;
    
    if (!targetUrl) {
        return res.status(400).send('URL parameter is required');
    }

    let fullUrl = targetUrl;
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        fullUrl = 'http://' + targetUrl;
    }

    try {
        const urlObj = new URL(fullUrl);
        const targetHost = urlObj.host;
        const targetPath = urlObj.pathname + urlObj.search;

        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || 80,
            path: targetPath,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': '*/*',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive'
            }
        };

        const proxy = http.request(options, (proxyRes) => {
            const contentType = proxyRes.headers['content-type'] || '';
            
            if (contentType.includes('video') || contentType.includes('application/octet-stream')) {
                res.writeHead(proxyRes.statusCode, {
                    'Content-Type': contentType,
                    'Content-Length': proxyRes.headers['content-length'],
                    'Accept-Ranges': 'bytes',
                    'Content-Range': proxyRes.headers['content-range'],
                    'Cache-Control': 'no-cache'
                });
                proxyRes.pipe(res);
            } else {
                let data = '';
                proxyRes.on('data', chunk => data += chunk);
                proxyRes.on('end', () => {
                    try {
                        const jsonData = JSON.parse(data);
                        const videoUrl = jsonData.url || jsonData.stream_url || jsonData.video_url || jsonData.play_url;
                        
                        if (videoUrl) {
                            res.send(`
                                <!DOCTYPE html>
                                <html>
                                <head>
                                    <meta charset="UTF-8">
                                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                    <title>Video Stream</title>
                                    <style>
                                        * { margin: 0; padding: 0; box-sizing: border-box; }
                                        body { background: #000; display: flex; justify-content: center; align-items: center; height: 100vh; overflow: hidden; }
                                        video { max-width: 100%; max-height: 100vh; }
                                    </style>
                                </head>
                                <body>
                                    <video controls autoplay playsinline>
                                        <source src="${videoUrl}" type="video/mp4">
                                        Your browser does not support the video tag.
                                    </video>
                                </body>
                                </html>
                            `);
                        } else {
                            res.status(404).send('Video URL not found in response');
                        }
                    } catch (e) {
                        res.status(500).send('Error processing video data');
                    }
                });
            }
        });

        proxy.on('error', (err) => {
            console.error('Proxy error:', err);
            res.status(500).send('Error connecting to video source');
        });

        proxy.end();

    } catch (error) {
        console.error('URL parsing error:', error);
        res.status(400).send('Invalid URL format');
    }
});

app.get('/direct', (req, res) => {
    const targetUrl = req.query.url;
    
    if (!targetUrl) {
        return res.status(400).send('URL parameter is required');
    }

    let fullUrl = targetUrl;
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        fullUrl = 'http://' + targetUrl;
    }

    try {
        const urlObj = new URL(fullUrl);
        const targetHost = urlObj.host;
        const targetPath = urlObj.pathname + urlObj.search;

        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || 80,
            path: targetPath,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': '*/*',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive'
            }
        };

        const proxy = http.request(options, (proxyRes) => {
            const contentType = proxyRes.headers['content-type'] || '';
            
            res.writeHead(proxyRes.statusCode, {
                'Content-Type': contentType || 'video/mp4',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'no-cache'
            });

            proxyRes.pipe(res);
        });

        proxy.on('error', (err) => {
            console.error('Proxy error:', err);
            res.status(500).send('Error connecting to video source');
        });

        proxy.end();

    } catch (error) {
        console.error('URL parsing error:', error);
        res.status(400).send('Invalid URL format');
    }
});

app.get('/player', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Video Player</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { background: #000; display: flex; justify-content: center; align-items: center; height: 100vh; overflow: hidden; }
                video { max-width: 100%; max-height: 100vh; }
            </style>
        </head>
        <body>
            <video id="videoPlayer" controls autoplay playsinline></video>
            <script>
                const urlParams = new URLSearchParams(window.location.search);
                const videoUrl = urlParams.get('url');
                if (videoUrl) {
                    const video = document.getElementById('videoPlayer');
                    video.src = '/direct?url=' + encodeURIComponent(videoUrl);
                } else {
                    document.body.innerHTML = '<div style="color:white;font-family:sans-serif;">No video URL provided</div>';
                }
            </script>
        </body>
        </html>
    `);
});

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Video Stream</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { background: #000; display: flex; justify-content: center; align-items: center; height: 100vh; overflow: hidden; }
                video { max-width: 100%; max-height: 100vh; }
            </style>
        </head>
        <body>
            <video id="videoPlayer" controls autoplay playsinline></video>
            <script>
                const urlParams = new URLSearchParams(window.location.search);
                const videoUrl = urlParams.get('url');
                if (videoUrl) {
                    const video = document.getElementById('videoPlayer');
                    video.src = '/direct?url=' + encodeURIComponent(videoUrl);
                } else {
                    const defaultUrl = 'http://192.168.0.104:8080/watch?id=3032129946669007320';
                    const video = document.getElementById('videoPlayer');
                    video.src = '/direct?url=' + encodeURIComponent(defaultUrl);
                }
            </script>
        </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
