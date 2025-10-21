"use client";
import { useState, useEffect } from "react";
import { getLeaderboard } from "@/lib/api-client";

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
  }, []); return (
    <div className="bg-white rounded-lg shadow p-6 mb-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Leaderboard</h2>
      {loading ? (
        <p>Loading...</p>
      ) : leaders.length === 0 ? (
        <p className="text-gray-500">No leaderboard data available.</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left px-4 py-2">Rank</th>
              <th className="text-left px-4 py-2">User Name</th>
              <th className="text-left px-4 py-2">Wallet</th>
              <th className="text-left px-4 py-2">P&L</th>

              <th className="text-left px-4 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {leaders.map((leader, i) => (
              <tr key={leader.wallet}>
                <td className="px-4 py-2">{i + 1}</td>

                <td className="px-4 py-2 font-mono">{leader.username}</td>
                <td className="px-4 py-2 font-mono">{leader.wallet}</td>
                <td className="px-4 py-2 text-green-600">${leader.pnl}</td>

                <td className="px-4 py-2">
                  <button
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                    onClick={() => onSelect(leader.wallet)}
                  >
                    Copy Trade
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
