"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, register, setAuthToken, getWalletNonce, verifyWalletSignature } from "@/lib/api-client";
import GlassCard from "@/components/ui/GlassCard";
import { useAccount, useSignMessage } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = isLogin
        ? await login(email, password)
        : await register(email, password);

      setAuthToken(result.token);
      router.push("/");
    } catch (err: any) {
      setError(
        err?.response?.data?.error || "Authentication failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <GlassCard className="max-w-md w-full p-8">
        <h1 className="text-3xl font-bold text-center text-white mb-2">Polymarket Copy Trading</h1>
        <p className="text-center text-white/70 mb-8">{isLogin ? "Sign in to your account" : "Create a new account"}</p>

        {/* Wallet Connect Auth */}
        <div className="mb-6">
          <div className="flex items-center justify-center mb-3">
            <ConnectButton label="Connect Wallet" />
          </div>
          <button
            disabled={!isConnected || !address}
            onClick={async () => {
              setError("");
              setLoading(true);
              try {
                const { nonce } = await getWalletNonce(address!);
                const message = `Sign in to Polymarket Copy Bot\nAddress: ${address}\nNonce: ${nonce}`;
                const signature = await signMessageAsync({ message });
                const { token } = await verifyWalletSignature(address!, signature);
                setAuthToken(token);
                router.push("/");
              } catch (e: any) {
                setError(e?.response?.data?.error || "Wallet auth failed");
              } finally {
                setLoading(false);
              }
            }}
            className="w-full rounded-xl bg-white/10 hover:bg-white/20 text-white py-2 px-4 disabled:bg-white/5 disabled:text-white/40 disabled:cursor-not-allowed transition-colors"
          >
            {isConnected ? "Sign in with Wallet" : "Connect a wallet to sign in"}
          </button>
        </div>
{/* 
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-white/80 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-white/80 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-400/30 text-rose-200 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 text-white py-2 px-4 disabled:bg-white/10 disabled:text-white/50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Processing..." : isLogin ? "Sign In" : "Sign Up"}
          </button>
        </form> */}

        {/* <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
            }}
            className="text-white/80 hover:text-white text-sm"
          >
            {isLogin
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
        </div> */}
      </GlassCard>
    </div>
  );
}
