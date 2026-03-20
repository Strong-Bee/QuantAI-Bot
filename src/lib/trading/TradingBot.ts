import { DataEngine } from './DataEngine';
import { ScannerEngine } from './ScannerEngine';
import { calculateIndicators, getTechnicalScore } from './TechnicalEngine';
import { getAIAnalysis } from './AnalysisEngine';
import { RiskEngine } from './RiskEngine';
import { Server } from 'socket.io';

export class TradingBot {
  private dataEngine: DataEngine;
  private scanner: ScannerEngine;
  private riskEngine: RiskEngine;
  private io: Server;
  private userId: string;
  private isRunning: boolean = false;
  private isDemoMode: boolean = true;
  private logs: any[] = [];
  private activePositions: any[] = [];
  private tradeHistory: any[] = [];
  private aiSettings: any = {
    geminiKey: process.env.GEMINI_API_KEY || '',
    useGemini: true,
  };

  constructor(io: Server, userId: string) {
    this.io = io;
    this.userId = userId;
    this.dataEngine = new DataEngine();
    this.scanner = new ScannerEngine(this.dataEngine);
    this.riskEngine = new RiskEngine({
      maxRiskPerTrade: Number(process.env.MAX_RISK_PER_TRADE) || 0.02,
      maxDailyDrawdown: Number(process.env.MAX_DAILY_DRAWDOWN) || 0.05,
      riskRewardRatio: 2
    });
    
    // Initial logs
    this.log("QuantAI Trading System Initialized", 'info');
    this.log("Engines: Data, Scanner, Technical, AI, Risk - ONLINE", 'info');
    this.log("Ready for autonomous execution", 'info');
  }

  public updateAiSettings(settings: any) {
    this.aiSettings = { ...this.aiSettings, ...settings };
    this.log("AI Settings updated", 'info');
  }

  public getDataEngine(): DataEngine {
    return this.dataEngine;
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  public getIsDemoMode(): boolean {
    return this.isDemoMode;
  }

  setMode(mode: 'demo' | 'real') {
    this.isDemoMode = mode === 'demo';
    this.log(`Switched to ${mode.toUpperCase()} mode`, 'info');
    this.broadcastStatus();
  }

  toggleBot() {
    if (this.isRunning) {
      this.stop();
    } else {
      this.start();
    }
    this.broadcastStatus();
  }

  public broadcastStatus() {
    this.io.to(this.userId).emit('bot_status', { 
      isRunning: this.isRunning, 
      isDemoMode: this.isDemoMode 
    });
    this.io.to(this.userId).emit('active_positions', this.activePositions);
    this.io.to(this.userId).emit('trade_history', this.tradeHistory);
    
    // Calculate demo PnL
    const pnl = this.tradeHistory.reduce((acc, curr) => acc + (curr.pnl || 0), 0);
    this.io.to(this.userId).emit('account_stats', {
      balance: this.isDemoMode ? 10000 + pnl : 0, // In a real app, fetch real balance here
      pnl: pnl
    });
  }

  updateCredentials(apiKey: string, secret: string) {
    this.dataEngine.updateCredentials(apiKey, secret);
    this.log("Exchange API credentials updated", 'info');
  }

  private log(message: string, type: 'info' | 'trade' | 'error' = 'info', data?: any) {
    const logEntry = { timestamp: new Date(), message, type, data };
    this.logs.push(logEntry);
    if (this.logs.length > 100) this.logs.shift();
    this.io.to(this.userId).emit('trading_log', logEntry);
    console.log(`[${type.toUpperCase()}] ${message}`);
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.log("Trading Bot Started", 'info');
    this.broadcastStatus();
    this.loop();
  }

  stop() {
    this.isRunning = false;
    this.log("Trading Bot Stopped", 'info');
    this.broadcastStatus();
  }

  private async loop() {
    while (this.isRunning) {
      try {
        this.log("Scanning market for opportunities...", 'info');
        const topPairs = await this.scanner.scanTopPairs(5);
        this.io.to(this.userId).emit('top_pairs', topPairs);

        // Fetch Dexscreener trending pairs
        const dexPairs = await this.scanner.scanDexPairs('solana');
        this.io.to(this.userId).emit('dex_pairs', dexPairs);

        for (const pair of topPairs) {
          await this.analyzeAndTrade(pair.symbol);
        }

        // Wait 5 minutes before next scan
        await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
      } catch (error) {
        this.log(`Loop error: ${error}`, 'error');
        await new Promise(resolve => setTimeout(resolve, 60 * 1000));
      }
    }
  }

  private async analyzeAndTrade(symbol: string) {
    this.log(`Analyzing ${symbol}...`, 'info');
    const ohlcv = await this.dataEngine.fetchOHLCV(symbol, '1h', 200);
    if (ohlcv.length < 200) return;

    const indicators = calculateIndicators(ohlcv);
    if (!indicators) return;

    const lastPrice = ohlcv[ohlcv.length - 1][4];
    const techScore = getTechnicalScore(indicators, lastPrice);

    // AI Analysis
    const aiResult = await getAIAnalysis({
      symbol,
      indicators,
      lastPrice,
      ohlcv: ohlcv.slice(-10) // Last 10 candles for context
    }, this.aiSettings);

    const finalScore = (techScore * 0.6) + (aiResult.score * 0.4);
    this.log(`${symbol} Score: ${finalScore.toFixed(2)} (Tech: ${techScore.toFixed(2)}, AI: ${aiResult.score.toFixed(2)})`, 'info');

    if (finalScore > 0.75) {
      await this.executeTrade('buy', symbol, lastPrice, indicators.atr);
    } else if (finalScore < 0.25) {
      await this.executeTrade('sell', symbol, lastPrice, indicators.atr);
    }
  }

  async refreshData() {
    this.log("Manual data refresh requested...", 'info');
    try {
      const topPairs = await this.scanner.scanTopPairs(5);
      this.io.to(this.userId).emit('top_pairs', topPairs);

      const dexPairs = await this.scanner.scanDexPairs('solana');
      this.io.to(this.userId).emit('dex_pairs', dexPairs);
      this.log("Data refresh complete", 'info');
    } catch (error) {
      this.log(`Refresh error: ${error}`, 'error');
    }
  }

  async closePosition(id: string) {
    const index = this.activePositions.findIndex(p => p.id === id);
    if (index === -1) return;

    const pos = this.activePositions[index];
    this.log(`Manual close requested for ${pos.symbol}`, 'info');

    if (this.isDemoMode) {
      const closedPos = this.activePositions.splice(index, 1)[0];
      // Mock current price as entry price + random small change for demo
      const exitPrice = closedPos.entryPrice * (1 + (Math.random() * 0.02 - 0.01));
      const pnl = (exitPrice - closedPos.entryPrice) * closedPos.size * (closedPos.side === 'buy' ? 1 : -1);
      
      const historyEntry = {
        ...closedPos,
        exitPrice,
        pnl,
        status: 'closed',
        closedAt: new Date(),
        closeReason: 'Manual Close'
      };
      
      this.tradeHistory.unshift(historyEntry);
      if (this.tradeHistory.length > 50) this.tradeHistory.pop();
      
      this.broadcastStatus();
      this.io.to(this.userId).emit('trade_alert', {
        symbol: closedPos.symbol,
        type: 'Manual Close',
        pnl,
        side: closedPos.side
      });
      this.log(`[DEMO] Position manually closed for ${pos.symbol} | PnL: $${pnl.toFixed(2)}`, 'trade');
      return;
    }

    try {
      // @ts-ignore
      await this.dataEngine.exchange.createOrder(pos.symbol, 'market', pos.side === 'buy' ? 'sell' : 'buy', pos.size);
      
      const closedPos = this.activePositions.splice(index, 1)[0];
      // In a real scenario, we'd fetch the actual fill price. Using entry for placeholder.
      const historyEntry = {
        ...closedPos,
        exitPrice: closedPos.entryPrice, 
        pnl: 0,
        status: 'closed',
        closedAt: new Date(),
        closeReason: 'Manual Close'
      };
      
      this.tradeHistory.unshift(historyEntry);
      this.broadcastStatus();
      this.log(`[REAL] Position manually closed for ${pos.symbol}`, 'trade');
    } catch (error) {
      this.log(`[REAL] Failed to close position: ${error}`, 'error');
    }
  }

  private async executeTrade(side: 'buy' | 'sell', symbol: string, price: number, atr: number) {
    const balance = await this.dataEngine.fetchBalance();
    if (!balance) return;

    const usdtBalance = balance.total.USDT || 1000; // Default 1000 for demo if no balance
    const { sl, tp } = this.riskEngine.calculateSLTP(side, price, atr);
    const size = this.riskEngine.calculatePositionSize(usdtBalance, price, sl);

    const tradeId = Math.random().toString(36).substring(7);
    const position = {
      id: tradeId,
      symbol,
      side,
      entryPrice: price,
      size,
      sl,
      tp,
      timestamp: new Date(),
      pnl: 0,
      status: 'open'
    };

    this.log(`EXECUTE ${side.toUpperCase()} ${symbol} @ ${price} | Size: ${size.toFixed(4)} | SL: ${sl.toFixed(2)} | TP: ${tp.toFixed(2)}`, 'trade', position);

    if (this.isDemoMode) {
      this.activePositions.push(position);
      this.io.to(this.userId).emit('active_positions', this.activePositions);
      this.log(`[DEMO] Trade simulated for ${symbol}`, 'info');
      
      // Simulate closing trade after some time for demo
      setTimeout(() => {
        const index = this.activePositions.findIndex(p => p.id === tradeId);
        if (index !== -1) {
          const closedPos = this.activePositions.splice(index, 1)[0];
          const exitPrice = closedPos.side === 'buy' ? closedPos.tp : closedPos.sl; // Mock exit
          const pnl = (exitPrice - closedPos.entryPrice) * closedPos.size * (closedPos.side === 'buy' ? 1 : -1);
          
          const historyEntry = {
            ...closedPos,
            exitPrice,
            pnl,
            status: 'closed',
            closedAt: new Date(),
            closeReason: closedPos.side === 'buy' ? 'Take Profit' : 'Stop Loss' // Mock reason
          };
          
          this.tradeHistory.unshift(historyEntry);
          if (this.tradeHistory.length > 50) this.tradeHistory.pop();
          
          this.broadcastStatus();
          this.io.to(this.userId).emit('trade_alert', {
            symbol: closedPos.symbol,
            type: historyEntry.closeReason,
            pnl,
            side: closedPos.side
          });
          this.log(`[DEMO] Trade closed for ${symbol} | PnL: $${pnl.toFixed(2)}`, 'trade');
        }
      }, 30000); // Close after 30s for demo visibility
      
      return;
    }

    try {
      // @ts-ignore
      const order = await this.dataEngine.exchange.createOrder(symbol, 'market', side, size, price, {
        stopLoss: sl,
        takeProfit: tp
      });
      this.activePositions.push({ ...position, orderId: order.id });
      this.broadcastStatus();
      this.log(`[REAL] Order placed: ${order.id}`, 'trade', order);
    } catch (error) {
      this.log(`[REAL] Order failed: ${error}`, 'error');
    }
  }
}
