import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { TradingBot } from "./src/lib/trading/TradingBot";
import { BacktestEngine } from "./src/lib/trading/BacktestEngine";

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = 3000;

  const userBots = new Map<string, TradingBot>();
  const userBacktestEngines = new Map<string, BacktestEngine>();

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
    let currentUserId: string | null = null;

    socket.on('auth', (userId: string) => {
      if (currentUserId && currentUserId !== userId) {
        socket.leave(currentUserId);
      }
      currentUserId = userId;
      socket.join(userId);
      console.log(`User ${userId} authenticated`);

      if (!userBots.has(userId)) {
        const newBot = new TradingBot(io, userId);
        newBot.start();
        userBots.set(userId, newBot);
        userBacktestEngines.set(userId, new BacktestEngine(newBot.getDataEngine()));
      }

      const bot = userBots.get(userId)!;
      // Send initial status
      bot.broadcastStatus();
    });

    socket.on('set_mode', (mode: 'demo' | 'real') => {
      if (currentUserId) userBots.get(currentUserId)?.setMode(mode);
    });

    socket.on('toggle_bot', () => {
      if (currentUserId) userBots.get(currentUserId)?.toggleBot();
    });

    socket.on('update_credentials', (creds: { apiKey: string, secret: string }) => {
      if (currentUserId) userBots.get(currentUserId)?.updateCredentials(creds.apiKey, creds.secret);
    });

    socket.on('update_ai_settings', (settings: any) => {
      if (currentUserId) userBots.get(currentUserId)?.updateAiSettings(settings);
    });

    socket.on('close_position', (id: string) => {
      if (currentUserId) userBots.get(currentUserId)?.closePosition(id);
    });

    socket.on('refresh_data', () => {
      if (currentUserId) userBots.get(currentUserId)?.refreshData();
    });

    socket.on('run_backtest', async (params: { symbol: string, timeframe: string, limit: number }) => {
      if (!currentUserId) return;
      try {
        socket.emit('backtest_started');
        const engine = userBacktestEngines.get(currentUserId);
        if (engine) {
          const results = await engine.run(params.symbol, params.timeframe, params.limit);
          socket.emit('backtest_result', results);
        }
      } catch (error: any) {
        socket.emit('backtest_error', error.message || 'Failed to run backtest');
      }
    });

    socket.on("disconnect", () => {
      console.log(`Client disconnected ${currentUserId || ''}`);
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
