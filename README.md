# 🤖 PolyArbX — Copy Trading Web Application (Profit Monitoring & Trade Simulation)💹

PolyArbX is a smart copy trading platform built for Polymarket, featuring real-time WebSocket feeds for monitoring and simulating trades.

## ℹ️ Note For full copy trade execution and market aggregation (arbitrage opportunities), use our Telegram Bot — powered by AI agents for real-time arbitrage detection and automated trade execution.

## 🚀 Quick Start

### Local Setup:

```bash
#for frontend
npm run dev

#for backend 
cd backend
node server.js
```

## 🎯 Features

- ⚡ **Real-time monitoring** of whale trader wallets
- 📊 **Live market data** via Polymarket WebSocket & Pyth Network
- 📈 **Risk management** with position limits and slippage control
- 🌐 **Web dashboard** for monitoring and configuration



## 🛠 Tech Stack

### Frontend
- Next.js 14 + TypeScript
- Socket.io-client for real-time updates
- TailwindCSS 4.x
- Vercel deployment

### Backend
- Node.js + Express
- Socket.io WebSocket server
- Polymarket WebSocket client
- Pyth Network price feeds
- Railway/Render deployment

<!-- ### Blockchain
- Lit Protocol (wallet security)
- ethers.js v6
- Hardhat (Solidity 0.8.20)
- ETH network -->
<!-- 
### Infrastructure
- Envio (indexing)
- Blockscout (explorer)
- Avail DA (proofs)
- PayPal USD (settlements) -->

## 📁 Project Structure

```
copybot_poly/
├── app/                    # Next.js frontend
│   ├── page.tsx           # Dashboard UI
│   ├── layout.tsx
│   └── globals.css
├── backend/               # Node.js backend
│   ├── server.js          # Express + Socket.io
│   ├── services/          # Core services
│   │   ├── polymarket-ws.js
│   │   ├── pyth-price.js
│   │   ├── lit-wallet.js
│   │   ├── wallet-monitor.js
│   │   └── trade-executor.js
│   └── routes/            # API endpoints
│       ├── markets.js
│       ├── trades.js
│       └── webhooks.js
├── lib/                   # Shared TypeScript libs
│   ├── socket-client.ts
│   └── api-client.ts
└── logs/                  # Trade logs (auto-created)
```


## ⚠️ Disclaimer

This software is for educational purposes. Use at your own risk. Always test with small amounts. Cryptocurrency trading carries significant risk.
