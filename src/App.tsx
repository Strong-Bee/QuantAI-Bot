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
  const { address: walletAddress, isConnected } = useAccount();
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [balance, setBalance] = useState(1000.00);
  const [pnl, setPnl] = useState(0.00);
  const [selectedSymbol, setSelectedSymbol] = useState('BINANCE:BTCUSDT.P');
  const [activeTab, setActiveTab] = useState<'scanner' | 'dex' | 'positions' | 'history'>('scanner');
  const logEndRef = useRef<HTMLDivElement>(null);

  const [aiConfidence, setAiConfidence] = useState(84);

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

    newSocket.on('bot_status', (status: { isRunning: boolean, isDemoMode: boolean }) => {
      setIsRunning(status.isRunning);
      setIsDemoMode(status.isDemoMode);
    });

    return () => {
      newSocket.close();
    };
  }, []);

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
    if (!apiKey || !apiSecret) return;
    socket?.emit('update_credentials', { apiKey, secret: apiSecret });
    socket?.emit('set_mode', 'real');
    setShowApiModal(false);
  };

  const stats = [
    { label: 'Total Balance', value: `$${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: Wallet, color: 'text-emerald-400', trend: '+2.4%' },
    { label: '24h PnL', value: `${pnl >= 0 ? '+' : ''}$${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: TrendingUp, color: pnl >= 0 ? 'text-emerald-400' : 'text-rose-400', trend: pnl >= 0 ? '+5.2%' : '-1.1%' },
    { label: 'Active Pairs', value: topPairs.length.toString(), icon: Activity, color: 'text-blue-400', trend: 'Stable' },
    { label: 'AI Confidence', value: `${aiConfidence}%`, icon: Brain, color: 'text-purple-400', trend: 'High' },
  ];

  return (
    <div className="min-h-screen bg-[#050506] text-zinc-100 font-sans selection:bg-emerald-500/30">
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
            <ConnectButton />

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
            <button className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-400 hover:text-white">
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
            
            <ConnectButton />
            
            <button className="w-full py-4 bg-white/5 border border-white/10 text-zinc-300 text-sm font-bold rounded-xl flex items-center justify-center gap-2">
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
                <button className="text-[10px] font-bold text-zinc-500 hover:text-white px-4 py-2 transition-colors flex items-center justify-center gap-2">
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
                              <button className="px-3 py-1.5 bg-rose-500/10 text-rose-400 text-[10px] font-bold rounded-lg hover:bg-rose-500/20 transition-all border border-rose-500/20">
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-rose-500" />
              <h2 className="text-xl font-bold">Connect Real Account</h2>
            </div>
            <p className="text-sm text-zinc-400">
              Enter your Exchange API credentials to enable real trading. Your keys are sent securely to the backend and are not stored in the browser.
            </p>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">API Key</label>
                <input 
                  type="password" 
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-rose-500/50 transition-colors"
                  placeholder="Enter API Key"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">API Secret</label>
                <input 
                  type="password" 
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-rose-500/50 transition-colors"
                  placeholder="Enter API Secret"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowApiModal(false)}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={saveCredentials}
                className="flex-1 py-3 bg-rose-500 hover:bg-rose-400 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-rose-500/20"
              >
                Connect & Enable
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
