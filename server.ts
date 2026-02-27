import './polyfill';
import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import * as pdfjs from 'pdfjs-dist';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-folder-id']
  }));
  app.use(express.json({ limit: '50mb' }));

  // Normalization middleware for API routes
  app.use('/api', (req, res, next) => {
    if (req.path.length > 1 && req.path.endsWith('/')) {
      const query = req.url.slice(req.path.length);
      const safepath = req.path.slice(0, -1);
      console.log(`[SERVER V5] Normalizing API path: ${req.path} -> ${safepath}`);
      req.url = safepath + query;
    }
    next();
  });

  // Request logging middleware
  app.use((req, res, next) => {
    console.log(`[SERVER V5] ${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
  });

  app.get(["/api/health", "/api/health/"], (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString(), env: process.env.NODE_ENV });
  });

  // PDF Extraction API
  app.post("/api/pdf/extract", async (req, res) => {
    console.log(`[SERVER V5] Hit /api/pdf/extract`);
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    try {
      console.log(`[SERVER] Extracting PDF from: ${url}`);
      
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
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += `--- Page ${i} ---\n${pageText}\n\n`;
      }

      console.log(`[SERVER] Successfully extracted ${pdf.numPages} pages`);
      res.json({ text: fullText });
    } catch (err: any) {
      console.error("[SERVER ERROR] PDF Extraction:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // API Proxy for Yandex Search
  app.post("/api/yandex/search", async (req, res) => {
    console.log(`[SERVER V5] Hit /api/yandex/search`);
    const { query, apiKey, folderId } = req.body;
    if (!apiKey || !folderId) {
      return res.status(400).json({ error: "API Key and Folder ID are required" });
    }

    try {
      const url = `https://searchapi.api.cloud.yandex.net/v2/web/search`;
      
      const searchRequestBody = {
        query: {
          searchType: "SEARCH_TYPE_RU",
          queryText: `${query} инструкция по эксплуатации filetype:pdf`
        },
        folderId,
        responseFormat: "FORMAT_XML"
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Api-Key ${apiKey}`
        },
        body: JSON.stringify(searchRequestBody)
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[SERVER ERROR] Yandex V2 Error: ${errText}`);
        throw new Error(`Search API error: ${response.status} ${errText}`);
      }

      const data = await response.json();
      // Yandex Cloud API returns bytes as base64 in JSON
      const xmlText = Buffer.from(data.rawData, 'base64').toString('utf8');
      
      const results: { title: string; url: string }[] = [];
      const docRegex = /<doc[^>]*>([\s\S]*?)<\/doc>/g;
      const urlRegex = /<url>([\s\S]*?)<\/url>/;
      const titleRegex = /<title>([\s\S]*?)<\/title>/;

      let match;
      while ((match = docRegex.exec(xmlText)) !== null) {
        const docContent = match[1];
        const urlMatch = urlRegex.exec(docContent);
        const titleMatch = titleRegex.exec(docContent);
        
        if (urlMatch && titleMatch) {
          const cleanTitle = titleMatch[1].replace(/<[^>]*>/g, '').trim();
          results.push({
            title: cleanTitle,
            url: urlMatch[1].trim()
          });
        }
      }

      res.json(results.slice(0, 10));
    } catch (err: any) {
      console.error("[SERVER ERROR] Yandex Search Proxy:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // API Proxy for YandexGPT
  app.post("/api/yandex/gpt", async (req, res) => {
    console.log(`[SERVER V5] Hit /api/yandex/gpt`);
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

  // API 404 Handler - Catch-all for any /api request that didn't match above
  app.all("/api*", (req, res) => {
    console.log(`[SERVER V5] API 404: ${req.method} ${req.url}`);
    res.status(404).json({ 
      error: `API Route ${req.method} ${req.url} not found`,
      message: "If you are seeing HTML, the request might have been redirected or shadowed."
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
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
