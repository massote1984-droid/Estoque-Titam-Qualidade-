import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

log("Starting server process...");

let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

async function startServer() {
  log("startServer function called");
  const app = express();
  const PORT = 3000;

  app.use((req, res, next) => {
    log(`${req.method} ${req.url}`);
    next();
  });

  app.use(express.json({ limit: '10mb' }));

  // Health check
  app.get("/api/health", (req, res) => {
    log("Health check hit");
    res.json({ 
      status: "ok", 
      env: process.env.NODE_ENV || 'development'
    });
  });

  app.post("/api/parse-nfe", async (req, res) => {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: "Content is required" });

    try {
      const ai = getAi();
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Extraia os seguintes dados desta Nota Fiscal (pode ser XML ou texto): 
        - Chave de Acesso
        - Número da NF
        - Valor Total
        - Data da NF (formato YYYY-MM-DD)
        - Fornecedor
        - Descrição do Produto
        - Tonelada (se disponível, senão 0)
        - Mês de referência (Ex: Janeiro de 2026, baseado na data da NF)
        
        Conteúdo: ${content}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              chave_acesso: { type: Type.STRING },
              nf_numero: { type: Type.STRING },
              valor: { type: Type.NUMBER },
              data_nf: { type: Type.STRING },
              fornecedor: { type: Type.STRING },
              descricao_produto: { type: Type.STRING },
              tonelada: { type: Type.NUMBER },
              mes: { type: Type.STRING }
            },
            required: ["chave_acesso", "nf_numero", "valor", "data_nf", "fornecedor", "descricao_produto", "mes"]
          }
        }
      });

      res.json(JSON.parse(response.text || "{}"));
    } catch (error: any) {
      console.error("Gemini Error:", error);
      res.status(500).json({ error: error?.message || "Failed to parse NF-e" });
    }
  });

  // API 404 handler
  app.all("/api/*", (req, res) => {
    log(`API 404: ${req.method} ${req.url}`);
    res.status(404).json({ error: `Route ${req.method} ${req.url} not found` });
  });

  // Global Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("GLOBAL ERROR:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (process.env.NODE_ENV !== "test") {
    app.listen(PORT, "0.0.0.0", () => {
      log(`Server running on http://localhost:${PORT}`);
      log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    });
  }

  return app;
}

const appPromise = startServer().catch(err => {
  console.error(`CRITICAL SERVER STARTUP ERROR: ${err.message}`);
  process.exit(1);
});

export default appPromise;
