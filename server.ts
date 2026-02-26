import express from "express";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Proxy for Yandex Search
  app.post("/api/yandex/search", async (req, res) => {
    const { query, apiKey, folderId } = req.body;
    if (!apiKey || !folderId) return res.status(400).json({ error: "API Key and Folder ID are required" });

    try {
      const url = `https://searchapi.cloud.yandex.net/v1/search?folderid=${folderId}&query=${encodeURIComponent(query + " инструкция по эксплуатации filetype:pdf")}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Api-Key ${apiKey}`
        }
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Search API error: ${response.status} ${errText}`);
      }

      const xmlText = await response.text();
      
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
