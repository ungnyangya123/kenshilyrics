#!/usr/bin/env node
// 의존성 없는 미리보기 서버: node tools/serve.mjs [포트]  →  http://localhost:8000
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const port = Number(process.argv[2]) || 8000;
const root = path.resolve(".");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml" };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(root, p);
  // 공개 대상 파일만 제공 (raw/, tools/ 등은 막음)
  const ok = /^\/(index\.html|style\.css|app\.js|data\/[\w.\-]+\.json)$/.test(p) && file.startsWith(root);
  if (!ok || !fs.existsSync(file)) { res.writeHead(404); res.end("not found"); return; }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`http://localhost:${port}  (종료: Ctrl+C)`));
