import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("Starting server process...");

async function startServer() {
  let db: Database.Database;
  try {
    db = new Database("stock.db");
    console.log("Database initialized");
    
    // Initialize Database
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
  } catch (err) {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  }

  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    console.log("Health check hit");
    res.json({ 
      status: "ok", 
      database: !!db, 
      time: new Date().toISOString(),
      node_env: process.env.NODE_ENV 
    });
  });

  app.get("/api/entries", (req, res) => {
    console.log("GET /api/entries hit");
    try {
      const entries = db.prepare("SELECT * FROM entries ORDER BY created_at DESC").all();
      res.json(entries);
    } catch (error: any) {
      console.error("Database Error in GET /api/entries:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/entries", (req, res) => {
    console.log("POST /api/entries hit with body:", JSON.stringify(req.body).substring(0, 100));
    try {
      const {
        mes, chave_acesso, nf_numero, tonelada, valor, descricao_produto,
        data_nf, data_descarga, status, fornecedor, placa_veiculo, container, destino
      } = req.body;

      const stmt = db.prepare(`
        INSERT INTO entries (
          mes, chave_acesso, nf_numero, tonelada, valor, descricao_produto,
          data_nf, data_descarga, status, fornecedor, placa_veiculo, container, destino
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        mes, chave_acesso, nf_numero, tonelada, valor, descricao_produto,
        data_nf, data_descarga, status, fornecedor, placa_veiculo, container, destino
      );

      console.log("Entry saved successfully, ID:", result.lastInsertRowid);
      res.json({ id: result.lastInsertRowid });
    } catch (error: any) {
      console.error("Database Error in POST /api/entries:", error);
      res.status(500).json({ error: error.message || "Failed to save entry" });
    }
  });

  app.put("/api/entries/:id", (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    
    const keys = Object.keys(updates);
    if (keys.length === 0) return res.status(400).json({ error: "No updates provided" });

    const setClause = keys.map(key => `${key} = ?`).join(", ");
    const values = [...Object.values(updates), id];

    const stmt = db.prepare(`UPDATE entries SET ${setClause} WHERE id = ?`);
    stmt.run(...values);

    res.json({ success: true });
  });

  app.get("/api/stock-summary", (req, res) => {
    const summary = db.prepare(`
      SELECT 
        fornecedor,
        SUM(CASE WHEN status IN ('Estoque', 'Rejeitado') THEN 1 ELSE 0 END) as in_stock,
        SUM(CASE WHEN status IN ('Embarcado', 'Devolvido') THEN 1 ELSE 0 END) as exited
      FROM entries
      GROUP BY fornecedor
    `).all();
    res.json(summary);
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
    console.log(`API 404: ${req.method} ${req.url}`);
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
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`DATABASE_PATH: ${path.join(process.cwd(), "stock.db")}`);
  });
}

startServer();
