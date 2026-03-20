/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Shield, 
  Brain, 
  Terminal, 
  BarChart3, 
  Settings, 
  Play, 
  Square,
  RefreshCw,
  Wallet,
  Zap,
  History,
  LayoutList,
  User,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Clock,
  DollarSign
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { AdvancedRealTimeChart } from 'react-ts-tradingview-widgets';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Toaster, toast } from 'sonner';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TradeLog {
  timestamp: string;
  message: string;
  type: 'info' | 'trade' | 'error';
  data?: any;
}

interface TopPair {
  symbol: string;
  volume: number;
  change: number;
  last: number;
  volatility: number;
}

interface Position {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  entryPrice: number;
  size: number;
  sl: number;
  tp: number;
  timestamp: string;
  pnl: number;
  status: 'open' | 'closed';
}

interface DexPair {
  symbol: string;
  dexId: string;
  pairAddress: string;
  priceUsd: number;
  volume24h: number;
  priceChange24h: number;
  liquidity: number;
  url: string;
}

export default function App() {
  const { address, isConnected } = useAccount();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [logs, setLogs] = useState<TradeLog[]>([]);
  const [topPairs, setTopPairs] = useState<TopPair[]>([]);
  const [dexPairs, setDexPairs] = useState<DexPair[]>([]);
  const [activePositions, setActivePositions] = useState<Position[]>([]);
  const [tradeHistory, setTradeHistory] = useState<Position[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [showApiModal, setShowApiModal] = useState(false);
  
  // Settings State
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [useGemini, setUseGemini] = useState(true);
  const [openAiKey, setOpenAiKey] = useState('');
  const [useOpenAi, setUseOpenAi] = useState(false);

  const [balance, setBalance] = useState(1000.00);
  const [pnl, setPnl] = useState(0.00);
  const [selectedSymbol, setSelectedSymbol] = useState('BINANCE:BTCUSDT.P');
  const [activeTab, setActiveTab] = useState<'scanner' | 'dex' | 'positions' | 'history' | 'backtest'>('scanner');
  const logEndRef = useRef<HTMLDivElement>(null);

  const [aiConfidence, setAiConfidence] = useState(84);
  
  // Backtest State
  const [backtestParams, setBacktestParams] = useState({ symbol: 'BTC/USDT', timeframe: '1h', limit: 1000 });
  const [backtestResults, setBacktestResults] = useState<any>(null);
  const [isBacktesting, setIsBacktesting] = useState(false);
  const sessionIdRef = useRef(`session_${Math.random().toString(36).substring(7)}`);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('trading_log', (log: TradeLog) => {
      setLogs(prev => [log, ...prev].slice(0, 50));
      
      const aiMatch = log.message.match(/AI: (0\.\d+)/);
      if (aiMatch) {
        setAiConfidence(Math.round(parseFloat(aiMatch[1]) * 100));
      }
    });

    newSocket.on('top_pairs', (pairs: TopPair[]) => {
      setTopPairs(pairs);
    });

    newSocket.on('dex_pairs', (pairs: DexPair[]) => {
      setDexPairs(pairs);
    });

    newSocket.on('active_positions', (positions: Position[]) => {
      setActivePositions(positions);
    });

    newSocket.on('trade_history', (history: Position[]) => {
      setTradeHistory(history);
      // Update PnL based on history
      const totalPnl = history.reduce((acc, curr) => acc + (curr.pnl || 0), 0);
      setPnl(totalPnl);
    });

    newSocket.on('trade_alert', (alert: { symbol: string, type: string, pnl: number, side: string }) => {
      const isProfit = alert.pnl >= 0;
      toast.custom((t) => (
        <div className={cn(
          "flex items-start gap-4 p-4 rounded-xl border shadow-2xl w-[350px]",
          isProfit ? "bg-emerald-950/80 border-emerald-500/30" : "bg-rose-950/80 border-rose-500/30"
        )}>
          <div className={cn(
            "p-2 rounded-lg shrink-0",
            isProfit ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
          )}>
            {isProfit ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-white">{alert.type} Hit</p>
              <span className={cn(
                "text-xs font-bold px-2 py-0.5 rounded-full",
                isProfit ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
              )}>
                {alert.side.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-medium">{alert.symbol}</p>
            <p className={cn(
              "text-lg font-bold tracking-tight",
              isProfit ? "text-emerald-400" : "text-rose-400"
            )}>
              {isProfit ? '+' : ''}${alert.pnl.toFixed(2)}
            </p>
          </div>
          <button onClick={() => toast.dismiss(t)} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      ), { duration: 5000 });
    });

    newSocket.on('bot_status', (status: { isRunning: boolean, isDemoMode: boolean }) => {
      setIsRunning(status.isRunning);
      setIsDemoMode(status.isDemoMode);
    });

    newSocket.on('account_stats', (stats: { balance: number, pnl: number }) => {
      if (stats.balance > 0) setBalance(stats.balance);
      setPnl(stats.pnl);
    });

    newSocket.on('backtest_started', () => {
      setIsBacktesting(true);
      setBacktestResults(null);
    });

    newSocket.on('backtest_result', (results: any) => {
      setIsBacktesting(false);
      setBacktestResults(results);
    });

    newSocket.on('backtest_error', (error: string) => {
      setIsBacktesting(false);
      toast.error(`Backtest Error: ${error}`);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    if (socket) {
      const sessionId = (isConnected && address) ? address : sessionIdRef.current;
      socket.emit('auth', sessionId);
    }
  }, [isConnected, address, socket]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleSymbolSelect = (symbol: string) => {
    // Convert CCXT symbol (BTC/USDT:USDT) to TradingView symbol (BINANCE:BTCUSDT.P)
    const base = symbol.split('/')[0];
    const quote = symbol.split('/')[1].split(':')[0];
    const tvSymbol = `BINANCE:${base}${quote}.P`;
    setSelectedSymbol(tvSymbol);
  };

  const toggleBot = () => {
    socket?.emit('toggle_bot');
  };

  const toggleMode = () => {
    const newMode = isDemoMode ? 'real' : 'demo';
    if (newMode === 'real' && !apiKey) {
      setShowApiModal(true);
      return;
    }
    socket?.emit('set_mode', newMode);
  };

  const saveCredentials = () => {
    if (apiKey && apiSecret) {
      socket?.emit('update_credentials', { apiKey, secret: apiSecret });
    }
    
    socket?.emit('update_ai_settings', {
      geminiKey,
      useGemini,
      openAiKey,
      useOpenAi
    });

    if (apiKey && apiSecret) {
      socket?.emit('set_mode', 'real');
    }
    
    setShowApiModal(false);
    toast.success('Settings updated successfully');
  };

  const stats = [
    { label: 'Total Balance', value: `$${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: Wallet, color: 'text-emerald-400', trend: '+2.4%' },
    { label: '24h PnL', value: `${pnl >= 0 ? '+' : ''}$${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: TrendingUp, color: pnl >= 0 ? 'text-emerald-400' : 'text-rose-400', trend: pnl >= 0 ? '+5.2%' : '-1.1%' },
    { label: 'Active Pairs', value: topPairs.length.toString(), icon: Activity, color: 'text-blue-400', trend: 'Stable' },
    { label: 'AI Confidence', value: `${aiConfidence}%`, icon: Brain, color: 'text-purple-400', trend: 'High' },
  ];

  return (
    <div className="min-h-screen bg-[#050506] text-zinc-100 font-sans selection:bg-emerald-500/30">
      <Toaster position="top-right" />
      {/* Navigation */}
      <nav className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)] shrink-0">
              <Zap className="w-5 h-5 text-black fill-black" />
            </div>
            <span className="text-lg sm:text-xl font-bold tracking-tight whitespace-nowrap">QuantAI <span className="text-emerald-500">Bot</span></span>
          </div>
          
          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-6">
            <ConnectButton showBalance={false} chainStatus="icon" />

            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full">
              <button 
                onClick={toggleMode}
                className={cn(
                  "px-3 py-1 text-[10px] font-bold rounded-full transition-all",
                  isDemoMode ? "bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                DEMO
              </button>
              <button 
                onClick={toggleMode}
                className={cn(
                  "px-3 py-1 text-[10px] font-bold rounded-full transition-all",
                  !isDemoMode ? "bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)]" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                REAL
              </button>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Live Market</span>
            </div>
            <button 
              onClick={() => setShowApiModal(true)}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-400 hover:text-white"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="lg:hidden p-2 text-zinc-400 hover:text-white transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-white/5 bg-black/90 backdrop-blur-2xl p-4 space-y-4 animate-in slide-in-from-top duration-300">
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={toggleMode}
                className={cn(
                  "py-3 rounded-xl text-xs font-bold transition-all border",
                  isDemoMode ? "bg-blue-500/20 border-blue-500/50 text-blue-400" : "bg-white/5 border-white/10 text-zinc-500"
                )}
              >
                DEMO MODE
              </button>
              <button 
                onClick={toggleMode}
                className={cn(
                  "py-3 rounded-xl text-xs font-bold transition-all border",
                  !isDemoMode ? "bg-rose-500/20 border-rose-500/50 text-rose-400" : "bg-white/5 border-white/10 text-zinc-500"
                )}
              >
                REAL MODE
              </button>
            </div>
            
            <div className="flex justify-center py-2">
              <ConnectButton showBalance={false} chainStatus="icon" />
            </div>
            
            <button 
              onClick={() => setShowApiModal(true)}
              className="w-full py-4 bg-white/5 border border-white/10 text-zinc-300 text-sm font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-white/10 transition-colors"
            >
              <Settings className="w-5 h-5" /> SETTINGS
            </button>
          </div>
        )}
      </nav>

      <main className="max-w-[1600px] mx-auto p-4 sm:p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/[0.08] transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/10 to-transparent blur-2xl -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-500" />
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className={cn("p-2.5 rounded-xl bg-white/5 group-hover:scale-110 transition-transform", stat.color)}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Live</span>
                  <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white/5", 
                    stat.trend.startsWith('+') ? 'text-emerald-400' : 
                    stat.trend === 'Stable' ? 'text-blue-400' : 'text-rose-400'
                  )}>
                    {stat.trend}
                  </span>
                </div>
              </div>
              <div className="space-y-1 relative z-10">
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-bold tracking-tight text-white">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chart Area */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-2 h-[500px] overflow-hidden">
              <AdvancedRealTimeChart 
                theme="dark"
                symbol={selectedSymbol}
                autosize
                interval="60"
                timezone="Etc/UTC"
                style="1"
                locale="en"
                toolbar_bg="#0a0a0b"
                enable_publishing={false}
                hide_side_toolbar={false}
                allow_symbol_change={true}
                container_id="tradingview_chart"
              />
            </div>

            {/* Tabbed Content: Scanner, Positions, History */}
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden flex flex-col">
              <div className="p-2 border-b border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between bg-black/40 gap-2">
                <div className="flex overflow-x-auto no-scrollbar gap-1 p-1">
                  {[
                    { id: 'scanner', label: 'MARKET SCANNER', icon: Activity },
                    { id: 'dex', label: 'DEX TRENDING', icon: Zap },
                    { id: 'positions', label: `ACTIVE POSITIONS (${activePositions.length})`, icon: LayoutList },
                    { id: 'history', label: 'TRADE HISTORY', icon: History },
                    { id: 'backtest', label: 'BACKTEST', icon: BarChart3 },
                  ].map((tab) => (
                    <button 
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={cn(
                        "px-4 py-2 text-[10px] font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap",
                        activeTab === tab.id ? "bg-white/10 text-white shadow-inner" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                      )}
                    >
                      <tab.icon className="w-3.5 h-3.5" /> {tab.label}
                    </button>
                  ))}
                </div>
                <button 
                  onClick={() => socket?.emit('refresh_data')}
                  className="text-[10px] font-bold text-zinc-500 hover:text-white px-4 py-2 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-3 h-3" /> REFRESH DATA
                </button>
              </div>

              <div className="overflow-x-auto min-h-[400px] relative">
                {activeTab === 'scanner' && (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] border-b border-white/5 bg-white/[0.02]">
                        <th className="px-6 py-4">Symbol</th>
                        <th className="px-6 py-4">Price</th>
                        <th className="px-6 py-4">24h Change</th>
                        <th className="px-6 py-4">Volume</th>
                        <th className="px-6 py-4">Volatility</th>
                        <th className="px-6 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {topPairs.map((pair, i) => (
                        <tr 
                          key={i} 
                          onClick={() => handleSymbolSelect(pair.symbol)}
                          className="hover:bg-white/[0.04] transition-all group cursor-pointer"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-bold text-zinc-400 group-hover:bg-emerald-500/20 group-hover:text-emerald-400 transition-colors">
                                {pair.symbol.substring(0, 2)}
                              </div>
                              <span className="font-bold text-zinc-200">{pair.symbol}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono text-sm">${pair.last.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-2 py-1 rounded-md text-xs font-bold",
                              pair.change >= 0 ? "text-emerald-400 bg-emerald-400/10" : "text-rose-400 bg-rose-400/10"
                            )}>
                              {pair.change >= 0 ? '↑' : '↓'} {Math.abs(pair.change).toFixed(2)}%
                            </span>
                          </td>
                          <td className="px-6 py-4 text-zinc-400 text-sm font-medium">${(pair.volume / 1000000).toFixed(2)}M</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden w-24">
                                <div 
                                  className={cn("h-full rounded-full transition-all duration-1000", 
                                    pair.volatility > 7 ? "bg-rose-500" : pair.volatility > 4 ? "bg-amber-500" : "bg-emerald-500"
                                  )} 
                                  style={{ width: `${Math.min(100, pair.volatility * 10)}%` }} 
                                />
                              </div>
                              <span className="text-[10px] font-bold text-zinc-500">{pair.volatility.toFixed(1)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {activeTab === 'dex' && (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] border-b border-white/5 bg-white/[0.02]">
                        <th className="px-6 py-4">Pair</th>
                        <th className="px-6 py-4">DEX</th>
                        <th className="px-6 py-4">Price</th>
                        <th className="px-6 py-4">24h Change</th>
                        <th className="px-6 py-4">Liquidity</th>
                        <th className="px-6 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {dexPairs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-20 text-center">
                            <div className="flex flex-col items-center gap-3 opacity-20">
                              <Zap className="w-12 h-12" />
                              <p className="text-sm font-bold tracking-widest uppercase">Scanning DEX pairs...</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        dexPairs.map((pair, i) => (
                          <tr key={i} className="hover:bg-white/[0.04] transition-all group">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                  <Zap className="w-4 h-4 text-emerald-500" />
                                </div>
                                <span className="font-bold text-zinc-200">{pair.symbol}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-[10px] font-bold px-2 py-1 bg-white/5 rounded-md text-zinc-400 uppercase tracking-wider border border-white/5">
                                {pair.dexId}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-mono text-sm text-zinc-300">${pair.priceUsd.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "px-2 py-1 rounded-md text-xs font-bold",
                                pair.priceChange24h >= 0 ? "text-emerald-400 bg-emerald-400/10" : "text-rose-400 bg-rose-400/10"
                              )}>
                                {pair.priceChange24h >= 0 ? '↑' : '↓'} {Math.abs(pair.priceChange24h).toFixed(2)}%
                              </span>
                            </td>
                            <td className="px-6 py-4 text-zinc-400 text-sm font-medium">${(pair.liquidity / 1000).toFixed(1)}K</td>
                            <td className="px-6 py-4 text-right">
                              <a 
                                href={pair.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors inline-block"
                              >
                                <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                              </a>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}

                {activeTab === 'positions' && (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] border-b border-white/5 bg-white/[0.02]">
                        <th className="px-6 py-4">Symbol</th>
                        <th className="px-6 py-4">Side</th>
                        <th className="px-6 py-4">Entry</th>
                        <th className="px-6 py-4">Size</th>
                        <th className="px-6 py-4">PnL</th>
                        <th className="px-6 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {activePositions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-20 text-center">
                            <div className="flex flex-col items-center gap-3 opacity-20">
                              <LayoutList className="w-12 h-12" />
                              <p className="text-sm font-bold tracking-widest uppercase">No active positions</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        activePositions.map((pos, i) => (
                          <tr key={i} className="hover:bg-white/[0.04] transition-all group">
                            <td className="px-6 py-4 font-bold text-zinc-200">{pos.symbol}</td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider",
                                pos.side === 'buy' ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                              )}>
                                {pos.side}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-mono text-sm text-zinc-300">${pos.entryPrice.toLocaleString()}</td>
                            <td className="px-6 py-4 text-zinc-400 text-sm font-medium">{pos.size.toFixed(4)}</td>
                            <td className={cn("px-6 py-4 font-bold text-sm", pos.pnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                              {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button 
                                onClick={() => socket?.emit('close_position', pos.id)}
                                className="px-3 py-1.5 bg-rose-500/10 text-rose-400 text-[10px] font-bold rounded-lg hover:bg-rose-500/20 transition-all border border-rose-500/20"
                              >
                                CLOSE
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}

                {activeTab === 'history' && (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] border-b border-white/5 bg-white/[0.02]">
                        <th className="px-6 py-4">Time</th>
                        <th className="px-6 py-4">Symbol</th>
                        <th className="px-6 py-4">Side</th>
                        <th className="px-6 py-4">PnL</th>
                        <th className="px-6 py-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {tradeHistory.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-20 text-center">
                            <div className="flex flex-col items-center gap-3 opacity-20">
                              <History className="w-12 h-12" />
                              <p className="text-sm font-bold tracking-widest uppercase">No trade history</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        tradeHistory.map((trade, i) => (
                          <tr key={i} className="hover:bg-white/[0.04] transition-all group">
                            <td className="px-6 py-4 text-xs text-zinc-500 font-mono">
                              {format(new Date(trade.timestamp), 'HH:mm:ss')}
                            </td>
                            <td className="px-6 py-4 font-bold text-zinc-200">{trade.symbol}</td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider",
                                trade.side === 'buy' ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                              )}>
                                {trade.side}
                              </span>
                            </td>
                            <td className={cn("px-6 py-4 font-bold text-sm", trade.pnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                              {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">COMPLETED</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}

                {activeTab === 'backtest' && (
                  <div className="p-4 space-y-6">
                    <div className="flex flex-col sm:flex-row gap-4 items-end">
                      <div className="space-y-2 flex-1">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Symbol</label>
                        <input 
                          type="text" 
                          value={backtestParams.symbol}
                          onChange={(e) => setBacktestParams({...backtestParams, symbol: e.target.value})}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
                        />
                      </div>
                      <div className="space-y-2 flex-1">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Timeframe</label>
                        <select 
                          value={backtestParams.timeframe}
                          onChange={(e) => setBacktestParams({...backtestParams, timeframe: e.target.value})}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors appearance-none"
                        >
                          <option value="15m">15m</option>
                          <option value="1h">1h</option>
                          <option value="4h">4h</option>
                          <option value="1d">1d</option>
                        </select>
                      </div>
                      <div className="space-y-2 flex-1">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Candles</label>
                        <input 
                          type="number" 
                          value={backtestParams.limit}
                          onChange={(e) => setBacktestParams({...backtestParams, limit: parseInt(e.target.value) || 1000})}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
                        />
                      </div>
                      <button 
                        onClick={() => socket?.emit('run_backtest', backtestParams)}
                        disabled={isBacktesting}
                        className="px-6 py-2.5 bg-emerald-500 text-black rounded-xl font-bold text-sm hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 h-[42px]"
                      >
                        {isBacktesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        {isBacktesting ? 'RUNNING...' : 'RUN BACKTEST'}
                      </button>
                    </div>

                    {backtestResults && (
                      <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div className="bg-black/40 border border-white/5 rounded-xl p-4">
                            <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider mb-1">Total Return</p>
                            <p className={cn("text-xl font-bold", backtestResults.totalReturn >= 0 ? "text-emerald-400" : "text-rose-400")}>
                              {backtestResults.totalReturn >= 0 ? '+' : ''}{backtestResults.totalReturn.toFixed(2)}%
                            </p>
                          </div>
                          <div className="bg-black/40 border border-white/5 rounded-xl p-4">
                            <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider mb-1">Win Rate</p>
                            <p className="text-xl font-bold text-white">{backtestResults.winRate.toFixed(2)}%</p>
                          </div>
                          <div className="bg-black/40 border border-white/5 rounded-xl p-4">
                            <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider mb-1">Max Drawdown</p>
                            <p className="text-xl font-bold text-rose-400">-{backtestResults.maxDrawdown.toFixed(2)}%</p>
                          </div>
                          <div className="bg-black/40 border border-white/5 rounded-xl p-4">
                            <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider mb-1">Total Trades</p>
                            <p className="text-xl font-bold text-white">{backtestResults.totalTrades}</p>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left">
                            <thead className="text-xs text-zinc-500 uppercase bg-black/40 border-y border-white/5">
                              <tr>
                                <th className="px-4 py-3 font-bold tracking-wider">Time</th>
                                <th className="px-4 py-3 font-bold tracking-wider">Side</th>
                                <th className="px-4 py-3 font-bold tracking-wider">Entry</th>
                                <th className="px-4 py-3 font-bold tracking-wider">Exit</th>
                                <th className="px-4 py-3 font-bold tracking-wider text-right">PnL</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {backtestResults.trades.slice(0, 10).map((trade: any, i: number) => (
                                <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                                  <td className="px-4 py-3 font-mono text-zinc-400">{format(new Date(trade.entryTime), 'MM/dd HH:mm')}</td>
                                  <td className="px-4 py-3">
                                    <span className={cn(
                                      "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest",
                                      trade.side === 'buy' ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                                    )}>
                                      {trade.side}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 font-mono">${trade.entryPrice.toFixed(2)}</td>
                                  <td className="px-4 py-3 font-mono">${trade.exitPrice.toFixed(2)}</td>
                                  <td className={cn(
                                    "px-4 py-3 font-mono text-right font-bold",
                                    trade.pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                                  )}>
                                    {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {backtestResults.trades.length > 10 && (
                            <div className="p-4 text-center text-xs text-zinc-500 font-medium">
                              Showing last 10 of {backtestResults.trades.length} trades
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar: Control & Logs */}
          <div className="space-y-6">
            {/* Bot Control */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold tracking-[0.2em] text-zinc-500 uppercase">Bot Control</h3>
                <div className={cn(
                  "px-2 py-1 rounded text-[10px] font-bold",
                  isRunning ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                )}>
                  {isRunning ? 'ACTIVE' : 'INACTIVE'}
                </div>
              </div>
              
              <button 
                onClick={toggleBot}
                className={cn(
                  "w-full py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-3 shadow-lg",
                  isRunning 
                    ? "bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500 hover:text-white" 
                    : "bg-emerald-500 text-black hover:bg-emerald-400 shadow-emerald-500/20"
                )}
              >
                {isRunning ? (
                  <><Square className="w-5 h-5 fill-current" /> STOP TRADING BOT</>
                ) : (
                  <><Play className="w-5 h-5 fill-current" /> START TRADING BOT</>
                )}
              </button>

              <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-500 font-medium">Risk Management</span>
                  <span className="text-xs font-bold text-emerald-400">Conservative</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-500 font-medium">Max Drawdown</span>
                  <span className="text-xs font-bold text-rose-400">2.5%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-500 font-medium">Auto-Compound</span>
                  <div className="w-8 h-4 bg-emerald-500/20 rounded-full relative">
                    <div className="absolute right-1 top-1 w-2 h-2 bg-emerald-500 rounded-full" />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl flex flex-col h-[500px] overflow-hidden">
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/20">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">System Logs</h3>
                </div>
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] space-y-2 no-scrollbar">
                {logs.map((log, i) => (
                  <div key={i} className={cn(
                    "flex gap-3 p-2 rounded-lg transition-colors",
                    log.type === 'error' ? "bg-rose-500/5 text-rose-400" : 
                    log.type === 'trade' ? "bg-emerald-500/5 text-emerald-400" : "text-zinc-500 hover:bg-white/5"
                  )}>
                    <span className="opacity-40 shrink-0">{format(new Date(log.timestamp), 'HH:mm:ss')}</span>
                    <span className="leading-relaxed">{log.message}</span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-[1600px] mx-auto p-6 border-t border-white/5 text-center">
        <p className="text-xs text-zinc-600 font-medium uppercase tracking-widest">
          QuantAI Autonomous Trading System v1.0.0 • Professional Grade Execution
        </p>
      </footer>

      {/* API Modal */}
      {showApiModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl p-8 max-w-2xl w-full shadow-2xl space-y-8 my-8">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <Settings className="w-6 h-6 text-emerald-500" />
              <h2 className="text-xl font-bold">System Settings</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Exchange Settings */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-rose-500">
                  <Shield className="w-5 h-5" />
                  <h3 className="font-bold">Exchange API (Real Trading)</h3>
                </div>
                <p className="text-xs text-zinc-400">
                  Enter your Exchange API credentials to enable real trading. Keys are sent securely to the backend.
                </p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">API Key</label>
                    <input 
                      type="password" 
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-rose-500/50 transition-colors"
                      placeholder="Enter Exchange API Key"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">API Secret</label>
                    <input 
                      type="password" 
                      value={apiSecret}
                      onChange={(e) => setApiSecret(e.target.value)}
                      className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-rose-500/50 transition-colors"
                      placeholder="Enter Exchange API Secret"
                    />
                  </div>
                </div>
              </div>

              {/* AI Settings */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-purple-500">
                  <Brain className="w-5 h-5" />
                  <h3 className="font-bold">AI Models</h3>
                </div>
                <p className="text-xs text-zinc-400">
                  Activate multiple AI models for maximum profit and accuracy.
                </p>
                
                <div className="space-y-4">
                  {/* Gemini */}
                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">Google Gemini</span>
                      <button 
                        onClick={() => setUseGemini(!useGemini)}
                        className={cn(
                          "w-10 h-5 rounded-full relative transition-colors",
                          useGemini ? "bg-emerald-500" : "bg-zinc-700"
                        )}
                      >
                        <div className={cn(
                          "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform",
                          useGemini ? "translate-x-5" : "translate-x-0"
                        )} />
                      </button>
                    </div>
                    {useGemini && (
                      <input 
                        type="password" 
                        value={geminiKey}
                        onChange={(e) => setGeminiKey(e.target.value)}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500/50 transition-colors"
                        placeholder="Gemini API Key (Optional if in .env)"
                      />
                    )}
                  </div>

                  {/* OpenAI */}
                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">OpenAI (GPT-4)</span>
                      <button 
                        onClick={() => setUseOpenAi(!useOpenAi)}
                        className={cn(
                          "w-10 h-5 rounded-full relative transition-colors",
                          useOpenAi ? "bg-emerald-500" : "bg-zinc-700"
                        )}
                      >
                        <div className={cn(
                          "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform",
                          useOpenAi ? "translate-x-5" : "translate-x-0"
                        )} />
                      </button>
                    </div>
                    {useOpenAi && (
                      <input 
                        type="password" 
                        value={openAiKey}
                        onChange={(e) => setOpenAiKey(e.target.value)}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500/50 transition-colors"
                        placeholder="OpenAI API Key"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-6 border-t border-white/10">
              <button 
                onClick={() => setShowApiModal(false)}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={saveCredentials}
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/20"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
