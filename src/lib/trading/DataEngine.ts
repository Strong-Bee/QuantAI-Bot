import ccxt from 'ccxt';

export class DataEngine {
  private exchange: any;

  constructor(exchangeId: string = 'binance') {
    try {
      // @ts-ignore
      this.exchange = new ccxt[exchangeId]({
        apiKey: process.env.EXCHANGE_API_KEY,
        secret: process.env.EXCHANGE_API_SECRET,
        options: { defaultType: 'future' },
      });
    } catch (e) {
      console.error("Failed to initialize exchange:", e);
      // Fallback to binance if possible
      this.exchange = new ccxt.binance({ options: { defaultType: 'future' } });
    }
  }

  async fetchOHLCV(symbol: string, timeframe: string = '1h', limit: number = 100) {
    try {
      if (!this.exchange) return [];
      return await this.exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
    } catch (error) {
      console.error(`Error fetching OHLCV for ${symbol}:`, error);
      return [];
    }
  }

  async fetchTicker(symbol: string) {
    try {
      if (!this.exchange) return null;
      return await this.exchange.fetchTicker(symbol);
    } catch (error) {
      console.error(`Error fetching ticker for ${symbol}:`, error);
      return null;
    }
  }

  async fetchMarkets() {
    try {
      if (!this.exchange) return {};
      await this.exchange.loadMarkets();
      return this.exchange.markets;
    } catch (error) {
      console.error("Error loading markets:", error);
      return {};
    }
  }

  async fetchBalance() {
    try {
      if (!this.exchange || !this.exchange.apiKey) return null;
      return await this.exchange.fetchBalance();
    } catch (error) {
      console.error("Error fetching balance:", error);
      return null;
    }
  }

  updateCredentials(apiKey: string, secret: string) {
    this.exchange.apiKey = apiKey;
    this.exchange.secret = secret;
  }
}
