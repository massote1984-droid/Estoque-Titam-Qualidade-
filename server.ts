import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Import the Firebase configuration
import firebaseConfig from './firebase-applet-config.json' assert { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logFile = process.env.VERCEL ? path.join("/tmp", "server.log") : path.join(process.cwd(), "server.log");
function log(msg: string) {
  const entry = `${new Date().toISOString()} - ${msg}\n`;
  try {
    fs.appendFileSync(logFile, entry);
  } catch (e) {
    // Ignore log errors in production if filesystem is read-only
  }
  console.log(msg);
}

log("Starting server process...");

// Initialize Firebase SDK on server
const appFirebase = initializeApp(firebaseConfig);
const db = getFirestore(appFirebase, firebaseConfig.firestoreDatabaseId);

async function startServer() {
  log("startServer function called");
  const app = express();
  const PORT = 3000;

  // Health check
  app.get("/api/health", (req, res) => {
    log("Health check hit");
    res.json({ 
      status: "ok", 
      env: process.env.VERCEL ? 'vercel' : 'local'
    });
  });

  app.use((req, res, next) => {
    log(`${req.method} ${req.url}`);
    next();
  });

  app.use(express.json());

  app.post("/api/parse-nfe", async (req, res) => {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: "Content is required" });

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
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
    } catch (error) {
      console.error("Gemini Error:", error);
      res.status(500).json({ error: "Failed to parse NF-e" });
    }
  });

  // API 404 handler
  app.all("/api/*", (req, res) => {
    log(`API 404: ${req.method} ${req.url}`);
    res.status(404).json({ error: `Route ${req.method} ${req.url} not found` });
  });

  // Global Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    log(`GLOBAL ERROR: ${err.message}`);
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
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  if (process.env.NODE_ENV !== "test" && !process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      log(`Server running on http://localhost:${PORT}`);
      log(`NODE_ENV: ${process.env.NODE_ENV}`);
    });
  }

  return app;
}

const appPromise = startServer().catch(err => {
  log(`CRITICAL SERVER STARTUP ERROR: ${err.message}`);
  if (!process.env.VERCEL) {
    process.exit(1);
  }
  return null;
});

export default appPromise;
