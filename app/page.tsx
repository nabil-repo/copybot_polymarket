'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { initializeSocket, onTradeExecuted, onWalletTrade, onTradeWarning, subscribeToWallet, subscribeToUser } from '@/lib/socket-client';
import { getTradeHistory, getUserWallets, addUserWallet, removeUserWallet, loadAuthTokenFromStorage, getBotStatus, getUserProfile, startBot, stopBot } from '@/lib/api-client';
import Leaderboard from "./leaderboard";
import GlassCard from "@/components/ui/GlassCard";



export default function Home() {
  const [botStatus, setBotStatus] = useState<{ status: string; started_at: string | null; stopped_at: string | null } | null>(null);
  const [trades, setTrades] = useState<any[]>([]);
  const [myTrades, setMyTrades] = useState<any[]>([]);
  const seenDetectionsRef = useRef<Set<string>>(new Set());
  const [stats, setStats] = useState({
    todayTrades: 0,
    totalPnl: 0,
    roi: 0,
  });
  const [selectedWallet, setSelectedWallet] = useState("");
  const [inputWallet, setInputWallet] = useState("");
  const [userWallets, setUserWallets] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ type: 'warning' | 'error' | 'success'; message: string } | null>(null);
  const router = useRouter();

  // Show notification with auto-dismiss
  const showNotification = (type: 'warning' | 'error' | 'success', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 8000); // Auto-dismiss after 8 seconds
  };

  // Compute realized P&L and ROI from executed trades using a simple FIFO inventory model per market/outcome
  const computeStats = (allTrades: any[]) => {
    // Helper: normalize timestamp to ms
    const toMs = (t: any) => t?.timestamp ? (t.timestamp > 1e12 ? t.timestamp : t.timestamp * 1000) : (t?.createdAt ? Date.parse(t.createdAt) : 0);

    // All executed trades (for counting), regardless of size/price
    const executedAll = allTrades.filter((t) => (t.status === 'executed' || t.executed));

    // Executed trades with valid size/price/side (for P&L only)
    const executed = executedAll.filter((t) => t.size && t.price && t.side);
    // positions map per key
    type Pos = { qty: number; cost: number; invested: number };
    const positions = new Map<string, Pos>();
    let realized = 0;
    let investedTotal = 0;

    // sort by time asc for correct FIFO processing
    const sorted = [...executed].sort((a, b) => toMs(a) - toMs(b));

    for (const tr of sorted) {
      const size = Number(tr.size) || 0;
      const price = Number(tr.price) || 0;
      const side = String(tr.side || '').toLowerCase();
      const key = tr.conditionId || `${tr.market || tr.title || 'unknown'}::${tr.outcome || ''}`;
      if (!positions.has(key)) positions.set(key, { qty: 0, cost: 0, invested: 0 });
      const pos = positions.get(key)!;

      if (side === 'buy') {
        pos.qty += size;
        pos.cost += size * price;
        pos.invested += size * price;
        investedTotal += size * price;
      } else if (side === 'sell') {
        const closeQty = Math.min(size, pos.qty);
        const avgCost = pos.qty > 0 ? pos.cost / pos.qty : 0;
        realized += (price - avgCost) * closeQty;
        pos.qty -= closeQty;
        pos.cost -= avgCost * closeQty;
        // Selling beyond position is ignored in this simple model (no shorts)
      }
    }

    const today = new Date();
    const todayTrades = executedAll.filter((t) => {
      const tsMs = toMs(t);
      if (!tsMs) return false;
      const d = new Date(tsMs);
      return d.toDateString() === today.toDateString();
    }).length;

    const totalPnl = Number(realized.toFixed(2));
    const roi = investedTotal > 0 ? Number(((realized / investedTotal) * 100).toFixed(2)) : 0;
    return { todayTrades, totalPnl, roi };
  };

  useEffect(() => {
    // Check auth and load user data
    loadAuthTokenFromStorage();
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

    if (!token) {
      router.push('/auth');
      return;
    }

    // Load user profile then subscribe to user room
    getUserProfile().then((prof) => {
      if (prof?.id) {
        try { subscribeToUser(prof.id); } catch { }
      }
    }).catch(() => { });

    // Load user wallets
    getUserWallets()
      .then(wallets => {
        setUserWallets(wallets);
        setLoading(false);
      })
      .catch(() => {
        // If unauthorized, redirect to auth
        router.push('/auth');
      });

    // Load bot status
    getBotStatus()
      .then(status => setBotStatus(status))
      .catch(() => setBotStatus(null));

    // Load trade history and stats
    getTradeHistory()
      .then(tradeData => {
        setTrades(tradeData);
        setStats(computeStats(tradeData));
      })
      .catch(() => {
        setTrades([]);
        setStats({ todayTrades: 0, totalPnl: 0, roi: 0 });
      });

    const socket = initializeSocket();
    console.log('[SOCKET] Initialized:', socket);
    console.log('[SOCKET] Connected?', socket.connected);
    console.log('[SOCKET] Connecting to:', process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000');

    // Remove any existing listeners to prevent duplicates
    socket.off('connect');
    socket.off('disconnect');
    socket.off('connect_error');
    socket.off('error');

    socket.on('connect', () => {
      console.log('✅ [SOCKET] Connected! Socket ID:', socket.id);
      console.log('[SOCKET] Transport:', socket.io.engine?.transport?.name);
    });

    socket.on('disconnect', (reason: any) => {
      console.warn('❌ [SOCKET] Disconnected. Reason:', reason);
    });

    socket.on('connect_error', (err: any) => {
      console.error('🔴 [SOCKET] Connection error:', err.message);
      console.error('[SOCKET] Error details:', err);
    });

    socket.on('error', (err: any) => {
      console.error('🔴 [SOCKET] Socket error:', err);
    });

    onTradeExecuted((result: any) => {
      console.log('[SOCKET] trade:executed event received', result);
      // Update global trades table and recompute stats
      setTrades((prev) => {
        const updated = [
          { ...result, executed: true, status: 'executed', timestamp: result.timestamp || Date.now() / 1000 },
          ...prev
        ].slice(0, 200); // keep a bit more history for better stats
        setStats(computeStats(updated));
        return updated;
      });
      // Update my activity list
      setMyTrades((prev) => [
        {
          type: 'executed',
          time: Date.now(),
          market: result.market || result.title,
          outcome: result.outcome,
          side: result.side,
          size: result.size || result.copySize,
          price: result.price,
        },
        ...prev
      ].slice(0, 25));
    });
    onWalletTrade((evt: any) => {
      console.log('Received wallet:trade', evt);
      console.log('[SOCKET] wallet:trade event received', evt);
      const key = evt?.trade?.transactionHash || `${evt.trade?.conditionId}-${evt.trade?.timestamp}-${evt.trade?.size}-${evt.trade?.side}`;
      if (key && seenDetectionsRef.current.has(key)) {
        return;
      }
      if (key) seenDetectionsRef.current.add(key);
      // Detected trade from monitored wallet
      setMyTrades((prev) => [
        {
          type: 'detected',
          time: (evt.trade?.timestamp ? evt.trade.timestamp * 1000 : Date.now()),
          market: evt.trade?.title,
          outcome: evt.trade?.outcome,
          side: evt.trade?.side,
          size: evt.trade?.size,
          price: evt.trade?.price,
        },
        ...prev
      ].slice(0, 25));
    });

    // Listen for trade warnings (e.g., missing API credentials)
    onTradeWarning((warning: any) => {
      console.log('[SOCKET] trade:warning event received', warning);
      if (warning.type === 'missing_api_credentials') {
        showNotification('warning', warning.message || 'Please configure your Polymarket API credentials');
      }
    });

    // Don't disconnect in cleanup - socket is a singleton that should persist
    // Only remove our event listeners to prevent duplicates on remount
    return () => {
      // Keep socket connected, just clean up this component's listeners
      console.log('[SOCKET] Cleaning up component listeners (keeping socket connected)');
    };
  }, [router]);

  const handleAddWallet = async () => {
    if (!inputWallet) return;
    try {
      const wLc = inputWallet.toLowerCase();
      if (userWallets.includes(wLc)) {
        setInputWallet("");
        setSelectedWallet(wLc);
        try { subscribeToWallet(wLc); } catch {}
        return;
      }
      await addUserWallet(wLc);
      setUserWallets([...userWallets, wLc]);
      setSelectedWallet(wLc);
      setInputWallet("");
      try { subscribeToWallet(wLc); } catch { }
    } catch (err) {
      console.error('Failed to add wallet:', err);
    }
  };

  const handleRemoveWallet = async (wallet: string) => {
    try {
      await removeUserWallet(wallet);
      setUserWallets(userWallets.filter(w => w !== wallet));
      if (selectedWallet === wallet) setSelectedWallet("");
    } catch (err) {
      console.error('Failed to remove wallet:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen py-6">
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className={`
            px-6 py-4 rounded-xl backdrop-blur border shadow-lg max-w-md
            ${notification.type === 'warning' ? 'bg-amber-500/90 border-amber-400/50 text-white' : ''}
            ${notification.type === 'error' ? 'bg-rose-500/90 border-rose-400/50 text-white' : ''}
            ${notification.type === 'success' ? 'bg-emerald-500/90 border-emerald-400/50 text-white' : ''}
          `}>
            <div className="flex items-start gap-3">
              <span className="text-2xl">
                {notification.type === 'warning' ? '⚠️' : ''}
                {notification.type === 'error' ? '❌' : ''}
                {notification.type === 'success' ? '✅' : ''}
              </span>
              <div className="flex-1">
                <p className="font-semibold mb-1">
                  {notification.type === 'warning' ? 'Configuration Required' : ''}
                  {notification.type === 'error' ? 'Error' : ''}
                  {notification.type === 'success' ? 'Success' : ''}
                </p>
                <p className="text-sm">{notification.message}</p>
                {notification.type === 'warning' && (
                  <button
                    onClick={() => router.push('/settings')}
                    className="mt-2 px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm font-medium transition"
                  >
                    Go to Settings
                  </button>
                )}
              </div>
              <button
                onClick={() => setNotification(null)}
                className="text-white/80 hover:text-white text-xl leading-none"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white drop-shadow">Polymarket Copy Trading Bot</h1>
            <p className="text-white/80">Monitor and replicate trades from top Polymarket traders</p>
          </div>
          <div className="flex gap-3">
            {/* <button
              onClick={() => router.push('/settings')}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur border border-white/20 transition"
            >
              ⚙️ Settings
            </button> */}
            <button
              onClick={() => {
                localStorage.removeItem('auth_token');
                router.push('/auth');
              }}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur border border-white/20 transition"
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* My Wallets Section */}
        <GlassCard className="p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">My Copy Trade Target Wallets</h2>
          {userWallets.length === 0 ? (
            <p className="text-white/70">No wallets added yet. Add a wallet below to start copy trading.</p>
          ) : (
            <div className="space-y-2">
              {userWallets.map(wallet => (
                <div key={wallet} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl">
                  <span className="font-mono text-sm text-white/90">{wallet}</span>
                  <button
                    onClick={() => handleRemoveWallet(wallet)}
                    className="px-3 py-1 rounded-lg bg-red-500/80 hover:bg-red-500 text-white text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Leaderboard Section */}
        <Leaderboard onSelect={async (w) => {
          const wLc = (w || '').toLowerCase();
          if (!wLc) return;
          if (!/^0x[a-f0-9]{40}$/.test(wLc)) return;
          // Avoid duplicates locally
          if (!userWallets.includes(wLc)) {
            try { await addUserWallet(wLc); } catch (e) { console.error('addUserWallet failed', e); }
            setUserWallets([...userWallets, wLc]);
          }
          setSelectedWallet(wLc);
          try { subscribeToWallet(wLc); } catch { }
        }} />
        {/* Wallet Input Section */}
        <GlassCard className="p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Add Trader Wallet</h2>
          <div className="flex gap-4 items-center">
            <input
              type="text"
              placeholder="Enter wallet address"
              value={inputWallet}
              onChange={e => setInputWallet(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/30 font-mono"
            />
            <button
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white"
              onClick={handleAddWallet}
            >
              Add
            </button>
          </div>
          {selectedWallet && (
            <div className="mt-4 text-emerald-300 font-mono">
              Copy trading enabled for: {selectedWallet}
            </div>
          )}
        </GlassCard>



        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Status Card */}
          <GlassCard className="p-6">
            <h3 className="text-sm font-medium text-white/70 mb-2">Bot Status</h3>
            <p className={
              botStatus && botStatus.status === 'running'
                ? 'text-2xl font-bold text-emerald-400'
                : 'text-2xl font-bold text-rose-400'
            }>
              {botStatus
                ? botStatus.status === 'running'
                  ? 'Active'
                  : 'Stopped'
                : 'Unknown'}
            </p>
            {botStatus && botStatus.started_at && (
              <p className="text-sm text-white/70 mt-2">Started: {new Date(botStatus.started_at).toLocaleString()}</p>
            )}
            {botStatus && botStatus.stopped_at && (
              <p className="text-sm text-white/70 mt-2">Stopped: {new Date(botStatus.stopped_at).toLocaleString()}</p>
            )}
            <p className="text-sm text-white/70 mt-2">Monitoring {userWallets.length} wallet{userWallets.length !== 1 ? 's' : ''}</p>
          </GlassCard>

          {/* Bot Controls Card */}
          <GlassCard className="p-6 flex flex-col justify-between">
            <h3 className="text-sm font-medium text-white/70 mb-2">Bot Controls</h3>
            <div className="flex gap-3 mb-2">
              <button
                className={`px-4 py-2 rounded-xl font-semibold transition-colors ${botStatus && botStatus.status === 'running' ? 'bg-white/10 text-white/50 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-500'}`}
                disabled={!!(botStatus && botStatus.status === 'running')}
                onClick={async () => {
                  await startBot();
                  const status = await getBotStatus();
                  setBotStatus(status);
                }}
              >
                Start Bot
              </button>
              <button
                className={`px-4 py-2 rounded-xl font-semibold transition-colors ${botStatus && botStatus.status !== 'running' ? 'bg-white/10 text-white/50 cursor-not-allowed' : 'bg-rose-600 text-white hover:bg-rose-500'}`}
                disabled={!!(botStatus && botStatus.status !== 'running')}
                onClick={async () => {
                  await stopBot();
                  const status = await getBotStatus();
                  setBotStatus(status);
                }}
              >
                Stop Bot
              </button>
            </div>
            <div className="text-xs text-white/70">
              {botStatus && botStatus.status === 'running' ? 'Bot is currently running.' : 'Bot is stopped.'}
            </div>
          </GlassCard>

          {/* Today's Trades */}
          <GlassCard className="p-6">
            <h3 className="text-sm font-medium text-white/70 mb-2">Today's Trades</h3>
            <p className="text-2xl font-bold text-white">{stats.todayTrades}</p>
          </GlassCard>

          {/* P&L */}
          <GlassCard className="p-6">
            <h3 className="text-sm font-medium text-white/70 mb-2">Total P&L</h3>
            <p className="text-2xl font-bold text-emerald-400">${stats.totalPnl}</p>
            <p className="text-sm text-white/70 mt-2">{stats.roi}% ROI</p>
          </GlassCard>
        </div>

        {/* My Recent Activity (current user) */}
        <GlassCard className="p-6 mb-8 overflow-hidden">
          <h2 className="text-xl font-semibold text-white mb-4">My Recent Activity</h2>
          {myTrades.length === 0 ? (
            <p className="text-white/70">No activity yet.</p>
          ) : (
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-white/10 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">Market</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">Outcome</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">Side</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">Size</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {myTrades.map((t, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80">{new Date(t.time).toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${t.type === 'executed' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                          {t.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{t.market || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{t.outcome || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{t.side || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{t.size !== undefined ? Number(t.size).toFixed(3) : '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{t.price !== undefined ? Number(t.price).toFixed(3) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>

        {/* Recent Trades Table */}
        <GlassCard className="">
          <div className="px-6 py-4 border-b border-white/10">
            <h2 className="text-xl font-semibold text-white">Recent Trades</h2>
          </div>
          <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-white/10 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">Market</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">Outcome</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">Size</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {trades.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-white/70">No trades found.</td>
                  </tr>
                ) : (
                  trades.map((trade, idx) => (
                    <tr key={trade.id || trade.transactionHash || idx}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80">
                        {trade.timestamp ? new Date(trade.timestamp * (trade.timestamp > 1e12 ? 1 : 1000)).toLocaleString() : (trade.createdAt ? new Date(trade.createdAt).toLocaleString() : '')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {trade.market || trade.title || trade.slug || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {trade.outcome || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {trade.size ? `$${trade.size}` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {trade.price ? `$${trade.price}` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={
                          trade.status === 'executed' || trade.executed
                            ? "px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-emerald-500/20 text-emerald-300"
                            : "px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-white/10 text-white/80"
                        }>
                          {trade.status === 'executed' || trade.executed ? 'Executed' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>

        {/* Configuration Section */}
        <GlassCard className="mt-8 p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Copy Ratio
              </label>
              <input
                type="number"
                step="0.01"
                defaultValue="0.10"
                className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
              />
              <p className="mt-1 text-sm text-white/70">
                Position size multiplier (0.1 = 10% of whale's position)
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Max Position Size
              </label>
              <input
                type="number"
                defaultValue="100"
                className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
              />
              <p className="mt-1 text-sm text-white/70">
                Maximum USD amount per position
              </p>
            </div>
          </div>
          <button className="mt-6 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors">
            Save Changes
          </button>
        </GlassCard>
      </div>
    </main>
  );
}
