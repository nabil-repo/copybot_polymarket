'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUserProfile, updateExecutionWallet, getBotStatus } from '@/lib/api-client';
import GlassCard from '@/components/ui/GlassCard';

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<{ id: number; email: string; execution_wallet: string | null } | null>(null);
  const [executionWallet, setExecutionWallet] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [botStatus, setBotStatus] = useState<{ status: string; started_at: string | null; stopped_at: string | null } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      router.push('/auth');
      return;
    }

    loadProfile();
    loadBotStatus();
  }, [router]);

  const loadProfile = async () => {
    try {
      const data = await getUserProfile();
      setProfile(data);
      setExecutionWallet(data.execution_wallet || '');
      setLoading(false);
    } catch (err: any) {
      console.error('Failed to load profile:', err);
      if (err.response?.status === 401) {
        router.push('/auth');
      } else {
        setError('Failed to load profile');
        setLoading(false);
      }
    }
  };

  const loadBotStatus = async () => {
    try {
      const status = await getBotStatus();
      setBotStatus(status);
    } catch (err) {
      setBotStatus(null);
    }
  };

  const handleSave = async () => {
    if (!executionWallet.trim()) {
      setError('Please enter a wallet address');
      return;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(executionWallet)) {
      setError('Invalid Ethereum address format');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await updateExecutionWallet(executionWallet);
      setSuccess('Execution wallet updated successfully!');
      await loadProfile();
    } catch (err: any) {
      console.error('Failed to update execution wallet:', err);
      setError(err.response?.data?.error || 'Failed to update execution wallet');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/')}
            className="text-white/80 hover:text-white mb-4 flex items-center"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-white">Settings</h1>
          <p className="mt-2 text-white/70">Manage your account and trading preferences</p>
        </div>

        {/* Profile Info & Bot Status */}
        <GlassCard className="p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">Profile Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/80">Email</label>
              <p className="mt-1 text-white">{profile?.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/80">User ID</label>
              <p className="mt-1 text-white/80 text-sm">{profile?.id}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/80">Bot Status</label>
              <p className="mt-1 text-white">
                {botStatus ? (
                  <>
                    <span className={
                      botStatus.status === 'running'
                        ? 'text-emerald-400 font-semibold'
                        : 'text-rose-400 font-semibold'
                    }>
                      {botStatus.status === 'running' ? 'Active' : 'Stopped'}
                    </span>
                    {botStatus.started_at && (
                      <span className="ml-2 text-xs text-white/60">Started: {new Date(botStatus.started_at).toLocaleString()}</span>
                    )}
                    {botStatus.stopped_at && (
                      <span className="ml-2 text-xs text-white/60">Stopped: {new Date(botStatus.stopped_at).toLocaleString()}</span>
                    )}
                  </>
                ) : (
                  <span className="text-white/70">Unknown</span>
                )}
              </p>
            </div>
          </div>
        </GlassCard>

        {/* Execution Wallet */}
        <GlassCard className="p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Execution Wallet</h2>
          <p className="text-sm text-white/70 mb-4">
            This is the wallet address that will be used to execute copy trades. Make sure you have sufficient USDC balance.
          </p>

          <div className="space-y-4">
            <div>
              <label htmlFor="execution-wallet" className="block text-sm font-medium text-gray-700 mb-2">
                Wallet Address
              </label>
              <input
                type="text"
                id="execution-wallet"
                value={executionWallet}
                onChange={(e) => setExecutionWallet(e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/60 focus:ring-2 focus:ring-white/30 focus:border-transparent"
              />
              <p className="mt-2 text-xs text-white/60">
                For local testing, use: <code className="bg-white/10 px-2 py-1 rounded">0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266</code>
              </p>
            </div>

            {error && (
              <div className="bg-rose-500/10 border border-rose-400/30 text-rose-200 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-emerald-500/10 border border-emerald-400/30 text-emerald-200 px-4 py-3 rounded-lg">
                {success}
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white disabled:bg-white/10 disabled:text-white/50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </GlassCard>

        {/* Info Box */}
        <GlassCard className="mt-6 p-4">
          <h3 className="text-sm font-semibold text-white mb-2">💡 Important Notes</h3>
          <ul className="text-sm text-white/80 space-y-1 list-disc list-inside">
            <li>Your execution wallet must have sufficient USDC balance for copy trading</li>
            <li>For local Hardhat testing, use one of the test accounts</li>
            <li>Never share your private keys with anyone</li>
            <li>Your private keys are NOT stored on our servers</li>
          </ul>
        </GlassCard>
      </div>
    </div>
  );
}
