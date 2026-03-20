import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { TradingBot } from "./src/lib/trading/TradingBot";

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = 3000;

  // Initialize Trading Bot
  const bot = new TradingBot(io);
  bot.start();

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/status", (req, res) => {
    res.json({ running: true, uptime: process.uptime() });
  });

  // Socket.io connection
  io.on("connection", (socket) => {
    console.log("Client connected to dashboard");
    
    // Send initial status
    socket.emit('bot_status', { isRunning: bot['isRunning'], isDemoMode: bot['isDemoMode'] });

    socket.on('set_mode', (mode: 'demo' | 'real') => {
      bot.setMode(mode);
    });

    socket.on('toggle_bot', () => {
      bot.toggleBot();
    });

    socket.on('update_credentials', (creds: { apiKey: string, secret: string }) => {
      bot.updateCredentials(creds.apiKey, creds.secret);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected");
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
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`QuantAI Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
