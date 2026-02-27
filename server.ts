import './polyfill';
import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import * as pdfjs from 'pdfjs-dist';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Custom CORS middleware to handle credentials correctly
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-folder-id, Accept, x-client-version');
    
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json({ limit: '50mb' }));

  // Request logging middleware
  app.use((req, res, next) => {
    if (req.url.startsWith('/api')) {
      const clientVersion = req.headers['x-client-version'] || 'unknown';
      console.log(`[SERVER V8] ${new Date().toISOString()} ${req.method} ${req.url} (Client: ${clientVersion})`);
    }
    next();
  });

  // Health check
  app.get(["/api/health", "/api/health/"], (req, res) => {
    res.json({ status: "ok", version: "V8", time: new Date().toISOString() });
  });

  // PDF Extraction API
  app.post("/api/pdf/extract", async (req, res) => {
    console.log(`[SERVER V8] Hit /api/pdf/extract`);
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.status}`);
      const buffer = await response.arrayBuffer();

      const loadingTask = pdfjs.getDocument({ 
        data: new Uint8Array(buffer),
        useSystemFonts: true,
        disableFontFace: true
      });
      const pdf = await loadingTask.promise;
      
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += `--- Page ${i} ---\n${pageText}\n\n`;
      }
      res.json({ text: fullText });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API Proxy for Yandex Search
  app.post("/api/yandex/search", async (req, res) => {
    console.log(`[SERVER V8] Hit /api/yandex/search`);
    const { query, apiKey, folderId } = req.body;
    if (!apiKey || !folderId) return res.status(400).json({ error: "Keys required" });

    try {
      const response = await fetch(`https://searchapi.api.cloud.yandex.net/v2/web/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Api-Key ${apiKey}`
        },
        body: JSON.stringify({
          query: {
            searchType: "SEARCH_TYPE_RU",
            queryText: `${query} инструкция по эксплуатации filetype:pdf`
          },
          folderId,
          responseFormat: "FORMAT_XML"
        })
      });

      const data = await response.json();
      const xmlText = Buffer.from(data.rawData, 'base64').toString('utf8');
      const results: any[] = [];
      const docRegex = /<doc[^>]*>([\s\S]*?)<\/doc>/g;
      let match;
      while ((match = docRegex.exec(xmlText)) !== null) {
        const url = /<url>([\s\S]*?)<\/url>/.exec(match[1])?.[1];
        const title = /<title>([\s\S]*?)<\/title>/.exec(match[1])?.[1]?.replace(/<[^>]*>/g, '');
        if (url && title) results.push({ title, url });
      }
      res.json(results.slice(0, 10));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API Proxy for YandexGPT
  app.post("/api/yandex/gpt", async (req, res) => {
    console.log(`[SERVER V8] Hit /api/yandex/gpt`);
    const { apiKey, folderId, body } = req.body;
    try {
      const response = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Api-Key ${apiKey}`,
          'x-folder-id': folderId
        },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API 404 Handler
  app.all("/api*", (req, res) => {
    console.log(`[SERVER V8] API 404: ${req.method} ${req.url}`);
    res.status(404).json({ error: `API Route not found: ${req.url}` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    
    app.use((req, res, next) => {
      if (req.url.startsWith('/api')) {
        console.warn(`[VITE WARNING] API request leaked to Vite: ${req.url}`);
      }
      vite.middlewares(req, res, next);
    });
  } else {
    app.use(express.static("dist"));
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
