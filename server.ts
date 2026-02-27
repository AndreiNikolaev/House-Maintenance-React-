import './polyfill';
import express from "express";
import cors from "cors";
import path from "path";
import { createServer as createViteServer } from "vite";
import * as pdfjs from 'pdfjs-dist';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // 1. CORS & Headers
  app.use(cors({
    origin: true,
    credentials: true
  }));
  app.use(express.json({ limit: '50mb' }));

  // 2. Logger
  app.use((req, res, next) => {
    if (req.url.includes('/api')) {
      console.log(`[V10 MONITOR] ${req.method} ${req.url} | Cookies: ${req.headers.cookie ? 'YES' : 'NO'}`);
    }
    next();
  });

  // 3. API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", version: "V10" });
  });

  app.post("/api/pdf/extract", async (req, res) => {
    console.log("[V10 API] PDF Extract");
    const { url } = req.body;
    try {
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, disableFontFace: true }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: any) => item.str).join(' ') + '\n';
      }
      res.json({ text });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/yandex/search", async (req, res) => {
    console.log("[V10 API] Yandex Search");
    const { query, apiKey, folderId } = req.body;
    try {
      const response = await fetch('https://searchapi.api.cloud.yandex.net/v2/web/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Api-Key ${apiKey}` },
        body: JSON.stringify({
          query: { searchType: "SEARCH_TYPE_RU", queryText: `${query} инструкция по эксплуатации filetype:pdf` },
          folderId, responseFormat: "FORMAT_XML"
        })
      });
      const data = await response.json();
      const xml = Buffer.from(data.rawData, 'base64').toString('utf8');
      const results: any[] = [];
      const matches = xml.matchAll(/<doc>[\s\S]*?<url>(.*?)<\/url>[\s\S]*?<title>(.*?)<\/title>/g);
      for (const m of matches) {
        results.push({ url: m[1], title: m[2].replace(/<[^>]*>/g, '') });
      }
      res.json(results.slice(0, 10));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/yandex/gpt", async (req, res) => {
    console.log("[V10 API] Yandex GPT");
    const { apiKey, folderId, body } = req.body;
    try {
      const response = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Api-Key ${apiKey}`, 'x-folder-id': folderId },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Proxy for downloading PDFs (CORS bypass)
  app.get("/api/proxy", async (req, res) => {
    const url = req.query.url as string;
    if (!url) return res.status(400).send("URL is required");
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
      const contentType = response.headers.get("content-type");
      if (contentType) res.setHeader("Content-Type", contentType);
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  // 4. API 404 (Safety net before Vite)
  app.all("/api*", (req, res) => {
    console.warn(`[V10 API] 404 Not Found: ${req.url}`);
    res.status(404).json({ error: "API route not found" });
  });

  // 5. Vite / Static
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => res.sendFile(path.resolve("dist/index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
