import { DataEngine } from './DataEngine';

export class ScannerEngine {
  private dataEngine: DataEngine;
  private readonly DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex';

  constructor(dataEngine: DataEngine) {
    this.dataEngine = dataEngine;
  }

  async scanDexPairs(chainId: string = 'solana') {
    try {
      // Fetch trending pairs from Dexscreener for a specific chain
      // Note: Dexscreener doesn't have a direct "trending" endpoint in their public API, 
      // but we can search for specific tokens or use their search/pairs endpoints.
      // For this implementation, we'll fetch some known high-volume pairs or search.
      const response = await fetch(`${this.DEXSCREENER_API}/search?q=${chainId}`);
      if (!response.ok) throw new Error('Dexscreener API error');
      
      const data = await response.json();
      if (!data.pairs) return [];

      return data.pairs
        .slice(0, 10)
        .map((p: any) => ({
          symbol: p.baseToken.symbol + '/' + p.quoteToken.symbol,
          dexId: p.dexId,
          pairAddress: p.pairAddress,
          priceUsd: parseFloat(p.priceUsd),
          volume24h: p.volume?.h24 || 0,
          priceChange24h: p.priceChange?.h24 || 0,
          liquidity: p.liquidity?.usd || 0,
          url: p.url
        }));
    } catch (error) {
      console.error('Error scanning Dexscreener:', error);
      return [];
    }
  }

  async scanTopPairs(limit: number = 5) {
    const markets = await this.dataEngine.fetchMarkets();
    const futuresMarkets = Object.values(markets).filter((m: any) => m.future && m.active && m.quote === 'USDT');
    
    // In a real system, we would fetch tickers for all and rank them.
    // For this demo, we'll pick some popular ones and simulate ranking.
    const popularSymbols = ['BTC/USDT:USDT', 'ETH/USDT:USDT', 'SOL/USDT:USDT', 'BNB/USDT:USDT', 'ADA/USDT:USDT', 'DOGE/USDT:USDT', 'XRP/USDT:USDT'];
    
    const tickers = await Promise.all(
      popularSymbols.map(s => this.dataEngine.fetchTicker(s))
    );

    const ranked = tickers
      .filter(t => t !== null)
      .map(t => ({
        symbol: t!.symbol,
        volume: t!.quoteVolume || 0,
        change: t!.percentage || 0,
        last: t!.last || 0,
        volatility: Math.abs(t!.percentage || 0) // Simple volatility proxy
      }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, limit);

    return ranked;
  }
}
