import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 8123);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

function resolvePath(urlPath) {
  const cleanPath = decodeURIComponent((urlPath || "/").split("?")[0]);
  const relativePath =
    cleanPath === "/" ? "index.html" : cleanPath.replace(/^\/+/, "");
  return path.join(root, relativePath);
}

const server = http.createServer(async (req, res) => {
  const resolvedPath = resolvePath(req.url);

  try {
    let filePath = resolvedPath;
    const stats = await fs.stat(filePath);
    if (stats.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    const content = await fs.readFile(filePath);
    res.statusCode = 200;
    res.setHeader(
      "Content-Type",
      mimeTypes[path.extname(filePath).toLowerCase()] ||
        "application/octet-stream",
    );
    res.end(content);
  } catch {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Not found");
  }
});

server.listen(port, host, () => {
  console.log(`Static server running at http://${host}:${port}`);
});
