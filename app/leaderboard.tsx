"use client";
import { useState, useEffect } from "react";
import { getLeaderboard } from "@/lib/api-client";
import GlassCard from "@/components/ui/GlassCard";

export default function Leaderboard({ onSelect }: { onSelect: (wallet: string) => void }) {
  const [leaders, setLeaders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const res = await getLeaderboard();
        setLeaders(res);
      } catch (err) {
        setLeaders([]);
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard();
  }, []);
  return (
    <GlassCard className="p-6 mb-8">
      <h2 className="text-xl font-semibold text-white mb-4">Leaderboard</h2>
      {loading ? (
        <p className="text-white/70">Loading...</p>
      ) : leaders.length === 0 ? (
        <p className="text-white/70">No leaderboard data available.</p>
      ) : (
        <table className="w-full">
          <thead className="bg-white/5">
            <tr>
              <th className="text-left px-4 py-2 text-white/70">Rank</th>
              <th className="text-left px-4 py-2 text-white/70">User Name</th>
              <th className="text-left px-4 py-2 text-white/70">Wallet</th>
              <th className="text-left px-4 py-2 text-white/70">P&L</th>
              <th className="text-left px-4 py-2 text-white/70">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {leaders.map((leader, i) => (
              <tr key={leader.wallet}>
                <td className="px-4 py-2 text-white/80">{i + 1}</td>
                <td className="px-4 py-2 font-mono text-white">{leader.username}</td>
                <td className="px-4 py-2 font-mono text-white/90">{leader.wallet}</td>
                <td className="px-4 py-2 text-emerald-300">${leader.pnl}</td>
                <td className="px-4 py-2">
                  <button
                    className="px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-500 text-white"
                    onClick={() => onSelect(leader.wallet)}
                  >
                    Copy
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </GlassCard>
  );
}
