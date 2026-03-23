#!/usr/bin/env node
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const { exec } = require('child_process');

const PORT = 5173;
const DIST = path.join(__dirname, 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
};

const server = http.createServer((req, res) => {
  // Decode URL and strip query string
  const rawPath = decodeURIComponent(req.url.split('?')[0]);

  // API endpoint for IP discovery
  if (rawPath === '/api/ip') {
    const os = require('os');
    const nets = os.networkInterfaces();
    let localIp = 'localhost';
    
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
        // 'IPv4' is for Node < 18, 4 is for Node >= 18
        const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4
        if (net.family === familyV4Value && !net.internal) {
          localIp = net.address;
          break;
        }
      }
      if (localIp !== 'localhost') break;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ip: localIp }));
    return;
  }

  // Resolve to absolute path and block path-traversal attacks
  let resolved = path.join(DIST, '.' + rawPath);
  console.log(`  REQ: ${rawPath} -> ${resolved}`);
  
  // Security check: ensure we stay inside DIST
  if (!resolved.startsWith(DIST)) {
    console.warn(`  403: Security check failed for ${resolved}`);
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  let filePath = resolved;

  // SPA fallback: serve index.html for missing files or directories
  let isDir = false;
  try { isDir = fs.statSync(filePath).isDirectory(); } catch { /* not found or inaccessible */ }

  if (!fs.existsSync(filePath) || isDir) {
    filePath = path.join(DIST, 'index.html');
  }

  console.log(`  SERV: ${filePath}`);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.error(`  404: Failed to read ${filePath}: ${err.message}`);
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type':   MIME[ext] || 'application/octet-stream',
      'Content-Length': data.length,
    });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  const nets = os.networkInterfaces();
  let localIp = 'localhost';
  
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4;
      if (net.family === familyV4Value && !net.internal) {
        localIp = net.address;
        break;
      }
    }
    if (localIp !== 'localhost') break;
  }

  console.log('');
  console.log('  ✅  Quiz Patente B — in esecuzione');
  console.log(`  🌐  Locale:   http://localhost:${PORT}`);
  console.log(`  🏠  LAN:      http://${localIp}:${PORT}  <-- Collegati da altri dispositivi`);
  console.log(`  📛  DNS:      http://quizpatente.local:${PORT}`);
  console.log('');
  console.log('  Tieni aperta questa finestra mentre usi il quiz.');
  console.log('  Chiudila per fermare il server.');
  console.log('');
  console.log('  --- INFO PER SMARTPHONE ---');
  console.log(`  Per collegarti dal telefono, assicurati di essere sulla stessa Wi-Fi`);
  console.log(`  e digita nel browser: http://${localIp}:${PORT}`);
  console.log('  ---------------------------');
  console.log('');

  exec(`start "" "http://quizpatente.local:${PORT}"`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ❌  Porta ${PORT} già in uso — prova a chiudere altre istanze.\n`);
  } else {
    console.error('\n  ❌  Errore server:', err.message, '\n');
  }
  process.exit(1);
});
