'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { initializeSocket, onTradeExecuted, onWalletTrade, subscribeToWallet, subscribeToUser } from '@/lib/socket-client';
import { getTradeHistory, getUserWallets, addUserWallet, removeUserWallet, loadAuthTokenFromStorage, getBotStatus, getUserProfile, startBot, stopBot } from '@/lib/api-client';
import Leaderboard from "./leaderboard";

 

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
  const router = useRouter();

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
        try { subscribeToUser(prof.id); } catch {}
      }
    }).catch(() => {});

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
        // Calculate stats
        const today = new Date();
        const todayTrades = tradeData.filter((t: any) => {
          const tradeDate = new Date(t.timestamp || t.createdAt);
          return tradeDate.toDateString() === today.toDateString();
        }).length;
        const totalPnl = tradeData.reduce((acc: number, t: any) => acc + (t.pnl || 0), 0);
  const roi = totalPnl !== 0 && tradeData.length > 0 ? Number(((totalPnl / tradeData.length) * 100).toFixed(2)) : 0;
  setStats({ todayTrades, totalPnl, roi });
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
      // Update global trades table if exists
      setTrades((prev) => [
        { ...result, executed: true, status: 'executed', timestamp: result.timestamp || Date.now() / 1000 },
        ...prev
      ].slice(0, 50));
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
      await addUserWallet(inputWallet);
      setUserWallets([...userWallets, inputWallet.toLowerCase()]);
      setSelectedWallet(inputWallet);
      setInputWallet("");
      try { subscribeToWallet(inputWallet); } catch {}
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
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Polymarket Copy Trading Bot
            </h1>
            <p className="text-gray-600">
              Monitor and replicate trades from top Polymarket traders
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/settings')}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              ⚙️ Settings
            </button>
            <button
              onClick={() => {
                localStorage.removeItem('auth_token');
                router.push('/auth');
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* My Wallets Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">My Copy Trade Wallets</h2>
          {userWallets.length === 0 ? (
            <p className="text-gray-500">No wallets added yet. Add a wallet below to start copy trading.</p>
          ) : (
            <div className="space-y-2">
              {userWallets.map(wallet => (
                <div key={wallet} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="font-mono text-sm">{wallet}</span>
                  <button
                    onClick={() => handleRemoveWallet(wallet)}
                    className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Leaderboard Section */}
        <Leaderboard onSelect={(w) => {
          setSelectedWallet(w);
          try { subscribeToWallet(w); } catch {}
        }} />
        {/* Wallet Input Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Add Trader Wallet</h2>
          <div className="flex gap-4 items-center">
            <input
              type="text"
              placeholder="Enter wallet address"
              value={inputWallet}
              onChange={e => setInputWallet(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              onClick={handleAddWallet}
            >
              Add
            </button>
          </div>
          {selectedWallet && (
            <div className="mt-4 text-green-700 font-mono">
              Copy trading enabled for: {selectedWallet}
            </div>
          )}
        </div>

   

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Status Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Bot Status</h3>
            <p className={
              botStatus && botStatus.status === 'running'
                ? 'text-2xl font-bold text-green-600'
                : 'text-2xl font-bold text-red-600'
            }>
              {botStatus
                ? botStatus.status === 'running'
                  ? 'Active'
                  : 'Stopped'
                : 'Unknown'}
            </p>
            {botStatus && botStatus.started_at && (
              <p className="text-sm text-gray-500 mt-2">Started: {new Date(botStatus.started_at).toLocaleString()}</p>
            )}
            {botStatus && botStatus.stopped_at && (
              <p className="text-sm text-gray-500 mt-2">Stopped: {new Date(botStatus.stopped_at).toLocaleString()}</p>
            )}
            <p className="text-sm text-gray-500 mt-2">Monitoring {userWallets.length} wallet{userWallets.length !== 1 ? 's' : ''}</p>
          </div>

            {/* Bot Controls Card */}
            <div className="bg-white rounded-lg shadow p-6 flex flex-col justify-between">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Bot Controls</h3>
              <div className="flex gap-3 mb-2">
                <button
                  className={`px-4 py-2 rounded-md font-semibold transition-colors ${botStatus && botStatus.status === 'running' ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
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
                  className={`px-4 py-2 rounded-md font-semibold transition-colors ${botStatus && botStatus.status !== 'running' ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700'}`}
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
              <div className="text-xs text-gray-500">
                {botStatus && botStatus.status === 'running' ? 'Bot is currently running.' : 'Bot is stopped.'}
              </div>
            </div>

          {/* Today's Trades */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Today's Trades</h3>
            <p className="text-2xl font-bold text-gray-900">{stats.todayTrades}</p>
          </div>

          {/* P&L */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Total P&L</h3>
            <p className="text-2xl font-bold text-green-600">${stats.totalPnl}</p>
            <p className="text-sm text-gray-500 mt-2">{stats.roi}% ROI</p>
          </div>
        </div>

        {/* My Recent Activity (current user) */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">My Recent Activity</h2>
          {myTrades.length === 0 ? (
            <p className="text-gray-500">No activity yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Market</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Outcome</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Side</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {myTrades.map((t, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(t.time).toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${t.type === 'executed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {t.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{t.market || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{t.outcome || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{t.side || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{t.size !== undefined ? Number(t.size).toFixed(3) : '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{t.price !== undefined ? Number(t.price).toFixed(3) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Trades Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Recent Trades</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Market</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Outcome</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {trades.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">No trades found.</td>
                  </tr>
                ) : (
                  trades.map((trade, idx) => (
                    <tr key={trade.id || trade.transactionHash || idx}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {trade.timestamp ? new Date(trade.timestamp * (trade.timestamp > 1e12 ? 1 : 1000)).toLocaleString() : (trade.createdAt ? new Date(trade.createdAt).toLocaleString() : '')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {trade.market || trade.title || trade.slug || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {trade.outcome || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {trade.size ? `$${trade.size}` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {trade.price ? `$${trade.price}` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={
                          trade.status === 'executed' || trade.executed
                            ? "px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800"
                            : "px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800"
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
        </div>

        {/* Configuration Section */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Copy Ratio
              </label>
              <input
                type="number"
                step="0.01"
                defaultValue="0.10"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                Position size multiplier (0.1 = 10% of whale's position)
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Position Size
              </label>
              <input
                type="number"
                defaultValue="100"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                Maximum USD amount per position
              </p>
            </div>
          </div>
          <button className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
            Save Changes
          </button>
        </div>
      </div>
    </main>
  );
}
