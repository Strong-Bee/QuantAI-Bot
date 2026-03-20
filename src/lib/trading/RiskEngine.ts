export interface RiskConfig {
  maxRiskPerTrade: number; // e.g. 0.02 for 2%
  maxDailyDrawdown: number;
  riskRewardRatio: number;
}

export class RiskEngine {
  private config: RiskConfig;

  constructor(config: RiskConfig) {
    this.config = config;
  }

  calculatePositionSize(balance: number, entryPrice: number, stopLossPrice: number) {
    const riskAmount = balance * this.config.maxRiskPerTrade;
    const riskPerUnit = Math.abs(entryPrice - stopLossPrice);
    
    if (riskPerUnit === 0) return 0;
    
    return riskAmount / riskPerUnit;
  }

  calculateSLTP(side: 'buy' | 'sell', entryPrice: number, atr: number) {
    const multiplier = 2; // 2x ATR for SL
    const sl = side === 'buy' ? entryPrice - (atr * multiplier) : entryPrice + (atr * multiplier);
    const tp = side === 'buy' ? entryPrice + (atr * multiplier * this.config.riskRewardRatio) : entryPrice - (atr * multiplier * this.config.riskRewardRatio);
    
    return { sl, tp };
  }
}
