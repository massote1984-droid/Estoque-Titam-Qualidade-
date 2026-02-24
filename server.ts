import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";

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

let db: Database.Database | null = null;

function getDb() {
  if (db) return db;
  
  try {
    const dbPath = process.env.VERCEL ? path.join("/tmp", "stock.db") : path.join(process.cwd(), "stock.db");
    log(`Initializing database at: ${dbPath}`);
    db = new Database(dbPath);
    
    db.exec(`
      CREATE TABLE IF NOT EXISTS entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mes TEXT,
        chave_acesso TEXT,
        nf_numero TEXT,
        tonelada REAL,
        valor REAL,
        descricao_produto TEXT,
        data_nf TEXT,
        data_descarga TEXT,
        status TEXT,
        fornecedor TEXT,
        placa_veiculo TEXT,
        container TEXT,
        destino TEXT,
        data_faturamento_vli TEXT,
        cte_vli TEXT,
        hora_chegada TEXT,
        hora_entrada TEXT,
        hora_saida TEXT,
        data_emissao_nf TEXT,
        cte_intertex TEXT,
        data_emissao_cte TEXT,
        cte_transportador TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    log("Database initialized successfully");
    return db;
  } catch (err: any) {
    log(`Database Initialization Error: ${err.message}`);
    throw err;
  }
}

async function startServer() {
  log("startServer function called");
  const app = express();
  const PORT = 3000;

  // Health check
  app.get("/api/health", (req, res) => {
    log("Health check hit");
    let dbStatus = false;
    try {
      dbStatus = !!getDb();
    } catch (e) {
      dbStatus = false;
    }
    res.json({ 
      status: "ok", 
      database: dbStatus,
      env: process.env.VERCEL ? 'vercel' : 'local'
    });
  });

  app.use((req, res, next) => {
    log(`${req.method} ${req.url}`);
    if (req.url.startsWith('/api/') && req.url !== '/api/health') {
      try {
        getDb();
      } catch (err: any) {
        return res.status(500).json({ 
          error: "Database Error", 
          message: err.message,
          hint: "This often happens on Vercel with native modules like better-sqlite3."
        });
      }
    }
    next();
  });

  app.use(express.json());

  // API Routes
  app.get("/api/entries", (req, res) => {
    log("GET /api/entries hit");
    try {
      const database = getDb();
      const entries = database.prepare("SELECT * FROM entries ORDER BY created_at DESC").all();
      res.json(entries);
    } catch (error: any) {
      log(`Error in GET /api/entries: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/entries", (req, res) => {
    log(`POST /api/entries hit`);
    try {
      const database = getDb();
      const {
        mes, chave_acesso, nf_numero, tonelada, valor, descricao_produto,
        data_nf, data_descarga, status, fornecedor, placa_veiculo, container, destino
      } = req.body;

      const stmt = database.prepare(`
        INSERT INTO entries (
          mes, chave_acesso, nf_numero, tonelada, valor, descricao_produto,
          data_nf, data_descarga, status, fornecedor, placa_veiculo, container, destino
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        mes, chave_acesso, nf_numero, tonelada, valor, descricao_produto,
        data_nf, data_descarga, status, fornecedor, placa_veiculo, container, destino
      );

      log(`Entry saved successfully, ID: ${result.lastInsertRowid}`);
      res.json({ id: result.lastInsertRowid });
    } catch (error: any) {
      log(`Error in POST /api/entries: ${error.message}`);
      res.status(500).json({ error: error.message || "Failed to save entry" });
    }
  });

  app.put("/api/entries/:id", (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    
    try {
      const database = getDb();
      const keys = Object.keys(updates);
      if (keys.length === 0) return res.status(400).json({ error: "No updates provided" });

      const setClause = keys.map(key => `${key} = ?`).join(", ");
      const values = [...Object.values(updates), id];

      const stmt = database.prepare(`UPDATE entries SET ${setClause} WHERE id = ?`);
      stmt.run(...values);

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/stock-summary", (req, res) => {
    try {
      const database = getDb();
      const summary = database.prepare(`
        SELECT 
          fornecedor,
          SUM(CASE WHEN status IN ('Estoque', 'Rejeitado') THEN 1 ELSE 0 END) as in_stock,
          SUM(CASE WHEN status IN ('Embarcado', 'Devolvido') THEN 1 ELSE 0 END) as exited
        FROM entries
        GROUP BY fornecedor
      `).all();
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

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
              tonelada: { type: Type.NUMBER }
            },
            required: ["chave_acesso", "nf_numero", "valor", "data_nf", "fornecedor", "descricao_produto"]
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
      log(`DATABASE_PATH: ${path.join(process.cwd(), "stock.db")}`);
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
