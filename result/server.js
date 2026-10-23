/**
 * Voting App - servicio "result" (Node.js + Express + socket.io + PostgreSQL).
 *
 * Lee los votos ya procesados por el worker desde PostgreSQL y los publica
 * en tiempo real en el navegador mediante WebSockets (socket.io).
 */

const fs = require("fs");
const http = require("http");
const path = require("path");

const express = require("express");
const { Pool } = require("pg");
const { Server } = require("socket.io");

const PORT = parseInt(process.env.PORT || "80", 10);
const DB_HOST = process.env.DB_HOST || "db";
const DB_PORT = parseInt(process.env.DB_PORT || "5432", 10);
const DB_USER = process.env.DB_USER || "postgres";
const DB_PASSWORD = process.env.DB_PASSWORD || "postgres";
const DB_NAME = process.env.DB_NAME || "postgres";
const OPTION_A = process.env.OPTION_A || "Café";
const OPTION_B = process.env.OPTION_B || "Té";
const LOG_DIR = process.env.LOG_DIR || "/var/log/app";
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || "1000", 10);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const pool = new Pool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  max: 10,
});

// --- log a fichero (volumen) + consola -----------------------------------
let accessLog = null;
try {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  accessLog = fs.createWriteStream(path.join(LOG_DIR, "result.log"), { flags: "a" });
} catch (err) {
  console.warn("No se pudo abrir el log en fichero:", err.message);
}

app.use((req, res, next) => {
  const line = `${new Date().toISOString()} ${req.method} ${req.originalUrl} -> ${res.statusCode}\n`;
  console.log(line.trim());
  if (accessLog) accessLog.write(line);
  next();
});

app.use(express.static(path.join(__dirname, "views")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

app.get("/api/results", async (req, res) => {
  try {
    const votes = await readVotes();
    res.json(votes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Cuenta los votos guardados en PostgreSQL. */
async function readVotes() {
  const result = await pool.query(
    "SELECT vote, COUNT(id) AS count FROM votes GROUP BY vote"
  );

  const counts = { a: 0, b: 0 };
  for (const row of result.rows) {
    const key = String(row.vote).toLowerCase();
    counts[key] = parseInt(row.count, 10) || 0;
  }

  const total = counts.a + counts.b;
  const percent = {
    a: total === 0 ? 0 : (counts.a / total) * 100,
    b: total === 0 ? 0 : (counts.b / total) * 100,
  };

  return { labels: { a: OPTION_A, b: OPTION_B }, counts, total, percent };
}

/** Espera a que PostgreSQL esté disponible (tarda un poco en arrancar). */
async function waitForDatabase(attempts = 60) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await pool.query("SELECT 1");
      console.log(`Conectado a PostgreSQL en ${DB_HOST}:${DB_PORT}`);
      return true;
    } catch (err) {
      console.warn(`Esperando a PostgreSQL (intento ${i}/${attempts}): ${err.message}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  return false;
}

/** Consulta los votos cada segundo y los emite a todos los navegadores. */
async function pollVotes() {
  try {
    const votes = await readVotes();
    io.emit("scores", votes);
  } catch (err) {
    console.error("Error consultando los votos:", err.message);
  }
}

io.on("connection", (socket) => {
  console.log(`Cliente conectado: ${socket.id}`);
  socket.emit("labels", { a: OPTION_A, b: OPTION_B });
  pollVotes();
});

app.get("/healthz", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", service: "result" });
  } catch (err) {
    res.status(503).json({ status: "degraded", error: err.message });
  }
});

server.listen(PORT, async () => {
  console.log(`Servicio de resultados escuchando en el puerto ${PORT}`);
  const connected = await waitForDatabase();
  if (connected) {
    pollVotes();
    setInterval(pollVotes, POLL_INTERVAL_MS);
  } else {
    console.error("No se pudo conectar a la base de datos.");
    process.exit(1);
  }
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, async () => {
    console.log(`Cerrando por ${signal}...`);
    await pool.end();
    server.close(() => process.exit(0));
  });
}
