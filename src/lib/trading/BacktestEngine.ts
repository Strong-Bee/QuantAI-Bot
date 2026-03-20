import { DataEngine } from './DataEngine';
import { calculateIndicators, getTechnicalScore } from './TechnicalEngine';
import { RiskEngine } from './RiskEngine';

export class BacktestEngine {
  private dataEngine: DataEngine;
  private riskEngine: RiskEngine;

  constructor(dataEngine: DataEngine) {
    this.dataEngine = dataEngine;
    this.riskEngine = new RiskEngine({
      maxRiskPerTrade: 0.02,
      maxDailyDrawdown: 0.05,
      riskRewardRatio: 2
    });
  }

  async run(symbol: string, timeframe: string = '1h', limit: number = 1000) {
    console.log(`Starting backtest for ${symbol} on ${timeframe} timeframe (${limit} candles)`);
    const ohlcv = await this.dataEngine.fetchOHLCV(symbol, timeframe, limit);
    
    if (ohlcv.length < 200) {
      throw new Error("Not enough historical data to run backtest (minimum 200 candles required).");
    }

    const initialBalance = 10000;
    let balance = initialBalance;
    let peakBalance = initialBalance;
    let maxDrawdown = 0;
    let wins = 0;
    let losses = 0;
    const trades: any[] = [];
    let openPosition: any = null;

    // We need at least 200 candles for the SMA200 indicator
    for (let i = 200; i < ohlcv.length; i++) {
      const currentCandle = ohlcv[i];
      const timestamp = currentCandle[0];
      const high = currentCandle[2];
      const low = currentCandle[3];
      const close = currentCandle[4];

      // 1. Check if we have an open position and if it hit SL or TP
      if (openPosition) {
        let closed = false;
        let exitPrice = 0;

        if (openPosition.side === 'buy') {
          if (low <= openPosition.sl) {
            exitPrice = openPosition.sl;
            closed = true;
          } else if (high >= openPosition.tp) {
            exitPrice = openPosition.tp;
            closed = true;
          }
        } else if (openPosition.side === 'sell') {
          if (high >= openPosition.sl) {
            exitPrice = openPosition.sl;
            closed = true;
          } else if (low <= openPosition.tp) {
            exitPrice = openPosition.tp;
            closed = true;
          }
        }

        if (closed) {
          const pnl = (exitPrice - openPosition.entryPrice) * openPosition.size * (openPosition.side === 'buy' ? 1 : -1);
          balance += pnl;
          
          if (pnl > 0) wins++;
          else losses++;

          trades.push({
            ...openPosition,
            exitPrice,
            pnl,
            exitTime: timestamp,
            status: 'closed',
            closeReason: pnl > 0 ? 'Take Profit' : 'Stop Loss'
          });

          openPosition = null;

          // Update Max Drawdown
          if (balance > peakBalance) {
            peakBalance = balance;
          }
          const currentDrawdown = ((peakBalance - balance) / peakBalance) * 100;
          if (currentDrawdown > maxDrawdown) {
            maxDrawdown = currentDrawdown;
          }
        }
        
        // If we still have an open position, we don't open a new one in this simple backtester
        if (openPosition) continue;
      }

      // 2. Evaluate entry conditions if no open position
      const slice = ohlcv.slice(i - 200, i + 1);
      const indicators = calculateIndicators(slice);
      
      if (!indicators) continue;

      const techScore = getTechnicalScore(indicators, close);
      
      // Mock AI score for backtest speed (randomized slightly around neutral to simulate variance)
      // In a real scenario, you'd run the AI model on historical data, but that's too slow/costly for a quick backtest
      const aiScore = 0.5 + (Math.random() * 0.4 - 0.2); 
      
      const finalScore = (techScore * 0.6) + (aiScore * 0.4);

      if (finalScore > 0.75) {
        // Buy Signal
        const { sl, tp } = this.riskEngine.calculateSLTP('buy', close, indicators.atr);
        const size = this.riskEngine.calculatePositionSize(balance, close, sl);
        
        openPosition = {
          id: `bt_${timestamp}`,
          symbol,
          side: 'buy',
          entryPrice: close,
          size,
          sl,
          tp,
          entryTime: timestamp,
          status: 'open'
        };
      } else if (finalScore < 0.25) {
        // Sell Signal
        const { sl, tp } = this.riskEngine.calculateSLTP('sell', close, indicators.atr);
        const size = this.riskEngine.calculatePositionSize(balance, close, sl);
        
        openPosition = {
          id: `bt_${timestamp}`,
          symbol,
          side: 'sell',
          entryPrice: close,
          size,
          sl,
          tp,
          entryTime: timestamp,
          status: 'open'
        };
      }
    }

    // Close any remaining open position at the end of the backtest
    if (openPosition) {
      const lastClose = ohlcv[ohlcv.length - 1][4];
      const pnl = (lastClose - openPosition.entryPrice) * openPosition.size * (openPosition.side === 'buy' ? 1 : -1);
      balance += pnl;
      if (pnl > 0) wins++; else losses++;
      
      trades.push({
        ...openPosition,
        exitPrice: lastClose,
        pnl,
        exitTime: ohlcv[ohlcv.length - 1][0],
        status: 'closed',
        closeReason: 'End of Backtest'
      });
    }

    const totalTrades = wins + losses;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const totalReturn = ((balance - initialBalance) / initialBalance) * 100;
    const profitFactor = losses > 0 ? (wins * 2) / losses : wins; // Simplified profit factor assuming RR is 2:1

    return {
      symbol,
      timeframe,
      initialBalance,
      finalBalance: balance,
      totalReturn,
      maxDrawdown,
      winRate,
      totalTrades,
      wins,
      losses,
      profitFactor,
      trades: trades.reverse() // Newest first
    };
  }
}
