/**
 * server.js — static dev server.
 *
 * Previously resolved request paths as `'.' + request.url` with no normalisation and
 * no root containment, so `/../../../../Users/you/.ssh/id_rsa` was served straight off
 * the filesystem — and it bound every interface, making that reachable from the local
 * network. It also answered missing files with HTTP 200. See finding F-18.
 *
 * `python -m http.server 8080` is an equally good alternative if Node is not to hand.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const HOST = '127.0.0.1';        // loopback only — this is a dev server, not a host
const ROOT = path.resolve(__dirname);

const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.wasm': 'application/wasm'
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
    res.writeHead(status, {
        'Content-Type': type,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
    });
    res.end(body);
}

http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return send(res, 405, 'Method Not Allowed');
    }

    // Strip the query string and decode before resolving, so that neither can be used
    // to smuggle traversal segments past the containment check below.
    let pathname;
    try {
        pathname = decodeURIComponent(new URL(req.url, `http://${HOST}`).pathname);
    } catch {
        return send(res, 400, 'Bad Request');
    }
    if (pathname === '/') pathname = '/index.html';

    const filePath = path.resolve(ROOT, '.' + pathname);

    // Containment: the resolved path must sit inside ROOT. path.resolve has already
    // collapsed any '..', so this is checked after normalisation, not before.
    if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
        console.warn(`blocked traversal attempt: ${req.url}`);
        return send(res, 403, 'Forbidden');
    }

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT' || err.code === 'EISDIR') {
                return send(res, 404, 'Not Found');   // 404 means 404
            }
            console.error(err);
            return send(res, 500, 'Internal Server Error');
        }
        const type = mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
        send(res, 200, content, type);
    });
}).listen(PORT, HOST, () => {
    console.log(`Serving ${ROOT}`);
    console.log(`http://${HOST}:${PORT}/`);
});
