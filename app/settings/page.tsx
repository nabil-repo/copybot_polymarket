'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUserProfile, updateExecutionWallet, getBotStatus, storePolymarketCredentials, checkPolymarketCredentials, deletePolymarketCredentials, derivePolymarketCredentials } from '@/lib/api-client';
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
  
  // Polymarket API credentials
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [hasCredentials, setHasCredentials] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [credentialsError, setCredentialsError] = useState('');
  const [credentialsSuccess, setCredentialsSuccess] = useState('');
  const [showApiSecret, setShowApiSecret] = useState(false);
  // Derive from Private Key
  const [pk, setPk] = useState('');
  const [deriving, setDeriving] = useState(false);
  const [deriveMsg, setDeriveMsg] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      router.push('/auth');
      return;
    }

    loadProfile();
    loadBotStatus();
    loadCredentialsStatus();
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

  const loadCredentialsStatus = async () => {
    try {
      const status = await checkPolymarketCredentials();
      setHasCredentials(status.configured);
    } catch (err) {
      console.error('Failed to check credentials:', err);
      setHasCredentials(false);
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

  const handleSaveCredentials = async () => {
    if (!apiKey.trim() || !apiSecret.trim()) {
      setCredentialsError('Please enter both API Key and API Secret');
      return;
    }

    setSavingCredentials(true);
    setCredentialsError('');
    setCredentialsSuccess('');

    try {
      await storePolymarketCredentials(apiKey, apiSecret);
      setCredentialsSuccess('Polymarket API credentials saved successfully! 🎉');
      setHasCredentials(true);
      // Clear the input fields for security
      setApiKey('');
      setApiSecret('');
      await loadCredentialsStatus();
    } catch (err: any) {
      console.error('Failed to save credentials:', err);
      setCredentialsError(err.response?.data?.error || 'Failed to save API credentials');
    } finally {
      setSavingCredentials(false);
    }
  };

  const handleDeleteCredentials = async () => {
    if (!confirm('Are you sure you want to delete your Polymarket API credentials? You will need to re-enter them to execute trades.')) {
      return;
    }

    setSavingCredentials(true);
    setCredentialsError('');
    setCredentialsSuccess('');

    try {
      await deletePolymarketCredentials();
      setCredentialsSuccess('API credentials deleted successfully');
      setHasCredentials(false);
      setApiKey('');
      setApiSecret('');
    } catch (err: any) {
      console.error('Failed to delete credentials:', err);
      setCredentialsError(err.response?.data?.error || 'Failed to delete API credentials');
    } finally {
      setSavingCredentials(false);
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

        {/* Polymarket API Credentials */}
        <GlassCard className="p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-white">Polymarket CLOB API Credentials</h2>
              <p className="text-sm text-white/70 mt-1">
                Required for automated trade execution via Polymarket API
              </p>
            </div>
            {hasCredentials && (
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-sm font-medium">
                ✓ Configured
              </span>
            )}
          </div>

          {hasCredentials ? (
            <div className="space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-400/30 text-emerald-200 px-4 py-3 rounded-lg">
                <p className="font-semibold mb-1">✓ API Credentials Configured</p>
                <p className="text-sm">Your Polymarket API credentials are securely stored and encrypted. The bot will use them to execute trades automatically.</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setHasCredentials(false);
                    setApiKey('');
                    setApiSecret('');
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                >
                  Update Credentials
                </button>
                <button
                  onClick={handleDeleteCredentials}
                  disabled={savingCredentials}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white disabled:bg-white/10 disabled:text-white/50 disabled:cursor-not-allowed transition-colors"
                >
                  {savingCredentials ? 'Deleting...' : 'Delete Credentials'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-amber-500/10 border border-amber-400/30 text-amber-200 px-4 py-3 rounded-lg">
                <p className="font-semibold mb-1">⚠️ API Credentials Required</p>
                <p className="text-sm">To execute trades automatically, you need to configure your Polymarket CLOB API credentials. Get them from <a href="https://polymarket.com/settings/api" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-100">polymarket.com/settings/api</a></p>
              </div>

              <div>
                <label htmlFor="api-key" className="block text-sm font-medium text-white/80 mb-2">
                  API Key
                </label>
                <input
                  type="text"
                  id="api-key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your Polymarket API Key"
                  className="w-full px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/60 focus:ring-2 focus:ring-white/30 focus:border-transparent font-mono text-sm"
                />
              </div>

              <div>
                <label htmlFor="api-secret" className="block text-sm font-medium text-white/80 mb-2">
                  API Secret
                </label>
                <div className="relative">
                  <input
                    type={showApiSecret ? 'text' : 'password'}
                    id="api-secret"
                    value={apiSecret}
                    onChange={(e) => setApiSecret(e.target.value)}
                    placeholder="Enter your Polymarket API Secret"
                    className="w-full px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/60 focus:ring-2 focus:ring-white/30 focus:border-transparent font-mono text-sm pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiSecret(!showApiSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition"
                  >
                    {showApiSecret ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {credentialsError && (
                <div className="bg-rose-500/10 border border-rose-400/30 text-rose-200 px-4 py-3 rounded-lg">
                  {credentialsError}
                </div>
              )}

              {credentialsSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-400/30 text-emerald-200 px-4 py-3 rounded-lg">
                  {credentialsSuccess}
                </div>
              )}

              <button
                onClick={handleSaveCredentials}
                disabled={savingCredentials}
                className="w-full sm:w-auto px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white disabled:bg-white/10 disabled:text-white/50 disabled:cursor-not-allowed transition-colors"
              >
                {savingCredentials ? 'Saving...' : 'Save API Credentials'}
              </button>

              <div className="relative my-6">
                <div className="h-px w-full bg-white/10" />
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white/5 px-3 text-xs text-white/60 rounded-full">Or</div>
              </div>

              <div className="space-y-3">
                <label htmlFor="pk" className="block text-sm font-medium text-white/80">Derive from Private Key (never stored)</label>
                <input
                  id="pk"
                  type="password"
                  value={pk}
                  onChange={(e) => setPk(e.target.value)}
                  placeholder="0x... private key"
                  className="w-full px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/60 focus:ring-2 focus:ring-white/30 focus:border-transparent font-mono text-sm"
                />
                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      if (!pk.trim().startsWith('0x') || pk.trim().length < 20) {
                        setDeriveMsg('Enter a valid 0x-prefixed private key');
                        return;
                      }
                      setDeriving(true);
                      setDeriveMsg('');
                      try {
                        await derivePolymarketCredentials(pk, 1);
                        setDeriveMsg('✅ Derived and stored API credentials');
                        setPk('');
                        await loadCredentialsStatus();
                        setHasCredentials(true);
                      } catch (e: any) {
                        setDeriveMsg(e?.response?.data?.message || 'Failed to derive credentials');
                      } finally {
                        setDeriving(false);
                      }
                    }}
                    disabled={deriving}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:bg-white/10 disabled:text-white/50 disabled:cursor-not-allowed transition-colors"
                  >
                    {deriving ? 'Deriving…' : 'Derive & Save'}
                  </button>
                  {deriveMsg && <span className="text-sm text-white/80">{deriveMsg}</span>}
                </div>
                <p className="text-xs text-white/50">Your private key is used once to derive Polymarket API keys and is never stored on the server.</p>
              </div>

              <div className="bg-blue-500/10 border border-blue-400/30 rounded-lg p-4">
                <p className="text-sm text-blue-200 font-semibold mb-2">🔐 Security Note</p>
                <ul className="text-xs text-blue-200/80 space-y-1 list-disc list-inside">
                  <li>Your API credentials are encrypted with AES-256-GCM before storage</li>
                  <li>They are never stored in plain text</li>
                  <li>Only you can access your encrypted credentials</li>
                  <li>Never share your API credentials with anyone</li>
                </ul>
              </div>
            </div>
          )}
        </GlassCard>

        {/* Execution Wallet */}
        <GlassCard className="p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Execution Wallet</h2>
          <p className="text-sm text-white/70 mb-4">
            Used for identity and attribution. Trades settle via your Polymarket account configured by API credentials; on-chain MockUSDC/Vault are not required.
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
              <p className="mt-2 text-xs text-white/60">Provide any EVM address you wish to associate with this profile.</p>
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
            <li><strong>Polymarket API:</strong> Required for automated trade execution. Get your credentials from Polymarket settings.</li>
            <li><strong>Execution Wallet:</strong> Must have sufficient USDC balance for copy trading</li>
            <li>For local Hardhat testing, use one of the test accounts</li>
            <li>Never share your private keys or API credentials with anyone</li>
            <li>All sensitive data is encrypted before storage</li>
          </ul>
        </GlassCard>
      </div>
    </div>
  );
}
