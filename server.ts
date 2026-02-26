import express from "express";
import { createServer as createViteServer } from "vite";
import fetch from "node-fetch"; // node-fetch for server-side requests if needed, but native fetch is in node 18+

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Proxy for Yandex Search
  app.post("/api/yandex/search", async (req, res) => {
    const { query, apiKey } = req.body;
    try {
      // In a real scenario, you'd call Yandex Search API here
      // For now, we'll keep the mock logic but on the server side
      const mockResults = [
        { title: `Инструкция ${query} (Официальный PDF)`, url: `https://example.com/manuals/${query.replace(/\s+/g, '_')}_manual.pdf` },
        { title: `Руководство пользователя ${query}`, url: `https://manuals-lib.ru/data/${query.replace(/\s+/g, '_')}.pdf` },
        { title: `Технический регламент ${query}`, url: `https://service-center.pro/docs/service_${query.replace(/\s+/g, '_')}.pdf` }
      ];
      res.json(mockResults);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API Proxy for YandexGPT
  app.post("/api/yandex/gpt", async (req, res) => {
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

startServer();
