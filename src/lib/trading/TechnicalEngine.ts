import { RSI, MACD, EMA, ATR } from 'technicalindicators';

export interface IndicatorResult {
  rsi: number;
  macd: { macd: number; signal: number; histogram: number };
  ema20: number;
  ema50: number;
  ema200: number;
  atr: number;
}

export function calculateIndicators(ohlcv: any[]): IndicatorResult | null {
  if (ohlcv.length < 200) return null;

  const closes = ohlcv.map(d => d[4]);
  const highs = ohlcv.map(d => d[2]);
  const lows = ohlcv.map(d => d[3]);

  const rsiValues = RSI.calculate({ values: closes, period: 14 });
  const macdValues = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  });
  const ema20 = EMA.calculate({ values: closes, period: 20 });
  const ema50 = EMA.calculate({ values: closes, period: 50 });
  const ema200 = EMA.calculate({ values: closes, period: 200 });
  const atrValues = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 });

  return {
    rsi: rsiValues[rsiValues.length - 1],
    macd: macdValues[macdValues.length - 1] as any,
    ema20: ema20[ema20.length - 1],
    ema50: ema50[ema50.length - 1],
    ema200: ema200[ema200.length - 1],
    atr: atrValues[atrValues.length - 1]
  };
}

export function getTechnicalScore(indicators: IndicatorResult, lastPrice: number): number {
  let score = 0.5; // Neutral

  // RSI logic
  if (indicators.rsi < 30) score += 0.2; // Oversold
  if (indicators.rsi > 70) score -= 0.2; // Overbought

  // Trend logic
  if (lastPrice > indicators.ema200) score += 0.1; // Bullish trend
  else score -= 0.1;

  if (indicators.ema20 > indicators.ema50) score += 0.1; // Short term bullish

  // MACD logic
  if (indicators.macd.histogram > 0) score += 0.1;

  return Math.max(0, Math.min(1, score));
}
