const http = require('http')
const fs = require('fs')
const path = require('path')
const url = require('url')

// MIME type mapping
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
}

// Get the repository root directory (parent of test directory)
const repoRoot = path.resolve(__dirname, '..')

function createServer() {
  const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true)
    let pathname = parsedUrl.pathname

    // Only serve files under /base/ prefix
    if (!pathname.startsWith('/base/')) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not Found - Only /base/ prefix is supported')
      return
    }

    // Remove /base/ prefix to get the actual file path
    pathname = pathname.substring(5) // Remove '/base'

    // Construct the full file path
    const filePath = path.join(repoRoot, pathname)

    // Security check: ensure the file path is within the repository root
    const normalizedPath = path.normalize(filePath)
    if (!normalizedPath.startsWith(repoRoot)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' })
      res.end('Forbidden - Path traversal not allowed')
      return
    }

    // Check if file exists
    fs.stat(filePath, (err, stats) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('File not found')
        return
      }

      // If it's a directory, try to serve index.html or list directory contents
      if (stats.isDirectory()) {
        const indexPath = path.join(filePath, 'index.html')
        fs.stat(indexPath, (indexErr) => {
          if (!indexErr) {
            // Serve index.html
            serveFile(indexPath, res)
          } else {
            // List directory contents
            fs.readdir(filePath, (dirErr, files) => {
              if (dirErr) {
                res.writeHead(500, { 'Content-Type': 'text/plain' })
                res.end('Internal Server Error')
                return
              }

              const html = generateDirectoryListing(pathname, files)
              res.writeHead(200, { 'Content-Type': 'text/html' })
              res.end(html)
            })
          }
        })
      } else {
        // Serve the file
        serveFile(filePath, res)
      }
    })
  })

  return server
}

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase()
  const contentType = mimeTypes[ext] || 'application/octet-stream'

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' })
      res.end('Internal Server Error')
      return
    }

    res.writeHead(200, { 'Content-Type': contentType })
    res.end(data)
  })
}

function generateDirectoryListing(pathname, files) {
  const title = `Directory listing for /base${pathname}`
  let html = `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    h1 { color: #333; }
    ul { list-style-type: none; padding: 0; }
    li { margin: 5px 0; }
    a { text-decoration: none; color: #0066cc; }
    a:hover { text-decoration: underline; }
    .parent { font-weight: bold; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <ul>`

  // Add parent directory link if not at root
  if (pathname !== '/') {
    const parentPath = path.dirname(pathname)
    html += `    <li class="parent"><a href="/base${
      parentPath === '/' ? '' : parentPath
    }/">../</a></li>`
  }

  // Add files and directories
  files.sort().forEach((file) => {
    const filePath = path.join(pathname, file)
    html += `    <li><a href="/base${filePath}">${file}</a></li>`
  })

  html += `  </ul>
</body>
</html>`

  return html
}

// Start server if this file is run directly
if (require.main === module) {
  const port = process.env.PORT || 3000
  const server = createServer()

  server.listen(port, () => {
    console.log(`Static server running at http://localhost:${port}/base/`)
    console.log(`Serving files from: ${repoRoot}`)
  })
}

// Export for use in tests
module.exports = { createServer }
