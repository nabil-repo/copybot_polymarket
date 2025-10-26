# Polymarket Copy Trading Bot 🤖💹

A production-grade copy trading bot for Polymarket with real-time WebSocket feeds, secure wallet management via Lit Protocol, and on-chain vault with profit sharing.

## 🚀 Quick Start

### Local Setup:

```bash
#for frontend
npm run dev

#for backend 
cd backend
node server.js
```

📖 **See [QUICKSTART.md](./QUICKSTART.md) for detailed setup guide**

### Production Deployment
See [SETUP.md](./SETUP.md) for deploying to  mainnet.

## 🎯 Features

- ⚡ **Real-time monitoring** of whale trader wallets
- 🔒 **Secure wallet management** with Lit Protocol encryption
- 📊 **Live market data** via Polymarket WebSocket & Pyth Network
- 💰 **Smart vault** with share-based profit distribution
- 📈 **Risk management** with position limits and slippage control
- 🌐 **Web dashboard** for monitoring and configuration
- 🔗 **Blockchain indexing** via Envio
- 💳 **PayPal USD** settlement integration

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

### Blockchain
- Lit Protocol (wallet security)
- ethers.js v6
- Hardhat (Solidity 0.8.20)
- ETH network

### Infrastructure
- Envio (indexing)
- Blockscout (explorer)
- Avail DA (proofs)
- PayPal USD (settlements)

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
├── contracts/             # Smart contracts
│   ├── contracts/
│   │   └── CopyTradingVault.sol
│   ├── scripts/
│   │   └── deploy.js
│   └── hardhat.config.js
├── lib/                   # Shared TypeScript libs
│   ├── socket-client.ts
│   └── api-client.ts
└── logs/                  # Trade logs (auto-created)
```

## Quick Start## 🛠 Development

### Local Hardhat Testing

For local development and testing:

```bash
# Start local blockchain
npm run contracts:start

# Deploy contracts (new terminal)
npm run contracts:deploy

# Check status
npm run contracts:check

# Mint test USDC
npm run contracts:mint

# Hardhat console
npm run contracts:console
```

📖 **Full guide: [HARDHAT_LOCAL.md](./HARDHAT_LOCAL.md)**

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js frontend |
| `npm run backend` | Start Express backend |
| `npm run contracts:start` | Start local Hardhat node |
| `npm run contracts:deploy` | Deploy to local network |
| `npm run contracts:check` | Check contract status |
| `npm run contracts:mint` | Mint test USDC |
| `npm run contracts:console` | Open Hardhat console |

### Environment Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   
   **For Local Testing:**
   ```bash
   EVM_RPC_URL=http://127.0.0.1:8545
   USDC_CONTRACT_ADDRESS=<from deployment>
   PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
   ```
   
   **For Production:**
   ```bash
   EVM_RPC_URL=
   USDC_CONTRACT_ADDRESS=0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174
   PRIVATE_KEY=<your_real_private_key>
   POLYMARKET_API_KEY=<your_api_key>
   ```

3. **Run all services** (3 terminals):

   **Terminal 1 - Frontend:**
   ```bash
   npm run dev
   ```
   Opens at http://localhost:3000

   **Terminal 2 - Backend:**
   ```bash
   npm run backend
   ```
   API at http://localhost:4000

   **Terminal 3 - Hardhat (optional):**
   ```bash
   npm run contracts:start
   ```

## 🚀 Deployment

### Frontend (Vercel)
```bash
vercel --prod
```

### Backend (Railway/Render)
```bash
# Push to GitHub, connect to Railway/Render
# Set environment variables in platform dashboard
```

### Smart Contracts (ETH)
```bash
cd contracts
npx hardhat run scripts/deploy.js --network ETH
```

Contract will be verified on Blockscout automatically.

### Ethereum Testnet (Sepolia)

See `ETH_TESTNET.md` for running the backend and contracts on Ethereum testnets. Note that Polymarket market/trade data is on ETH, so Ethereum testnet is for dev flow testing (vault + execution + price feeds).

## 📊 How It Works

### Data Flow

1. **Polymarket WebSocket** streams live market data to backend
2. **Wallet Monitor** polls API every 5s for target wallet trades
3. On new trade → **Trade Executor** calculates copy size based on ratio
4. Balance checked → Order submitted to Polymarket
5. **Socket.io** broadcasts result to frontend dashboard
6. **Pyth Network** provides price feeds for risk calculations

### Risk Management

- **Position Sizing**: `copySize = originalSize × COPY_RATIO`
- **Limits**: Clamped between `MIN_POSITION_SIZE` and `MAX_POSITION_SIZE`
- **Balance Check**: Queries USDC balance on ETH before trade
- **Slippage**: Tolerance applied to limit price
- **Stop Loss**: Optional per-position stop loss

### Wallet Security

- Private keys encrypted with **Lit Protocol**
- Access control conditions enforced on-chain
- Keys decrypted only when signing transactions
- Never stored unencrypted

## 🔧 Configuration

### Environment Variables (`.env`)

**Required:**
- `POLYMARKET_API_KEY` - Polymarket API access
- `PRIVATE_KEY` - Wallet for executing trades ⚠️ KEEP SECRET
- `TARGET_WALLETS` - Comma-separated whale addresses
- `ETH_RPC_URL` - ETH RPC endpoint

**Optional:**
- `COPY_RATIO=0.1` - Copy 10% of whale position
- `MAX_POSITION_SIZE=100` - Max 100 USDC per trade
- `MIN_POSITION_SIZE=1` - Min 1 USDC per trade
- `SLIPPAGE_TOLERANCE=0.01` - 1% slippage
- `POLL_INTERVAL=5000` - Check wallets every 5s

## 🧪 Testing

⚠️ **Start with small values:**
```bash
COPY_RATIO=0.01  # 1% of whale position
MAX_POSITION_SIZE=10  # Max $10 per trade
```

Monitor logs:
```bash
tail -f logs/trades-2025-10-15.json
```

## 📚 API Documentation

### REST Endpoints (Backend)
- `GET /api/markets` - Get active markets
- `GET /api/markets/:id` - Get market details
- `GET /api/markets/:id/orderbook` - Get orderbook
- `GET /api/trades` - Get recent trades
- `GET /api/trades/history` - Get trade logs
- `POST /api/trades/execute` - Manual trade execution
- `GET /api/trades/positions` - Get current positions

### WebSocket Events
- `market:trade` - New trade on market
- `market:orderbook` - Orderbook update
- `wallet:trade` - New trade from monitored wallet
- `trade:executed` - Copy trade result
- `price:update` - Pyth price feed update

## 🔒 Security Best Practices

1. **Never commit `.env`** - Add to `.gitignore`
2. **Use `.env.local`** for secrets in development
3. **Rotate API keys** regularly
4. **Enable Lit Protocol** for production wallet management
5. **Test with testnet** (Mumbai) before mainnet
6. **Monitor logs** for suspicious activity
7. **Set conservative limits** initially

## 🐛 Troubleshooting

**Backend won't start:**
- Check `.env` has all required variables
- Ensure port 4000 is available

**Frontend can't connect:**
- Verify `NEXT_PUBLIC_BACKEND_URL=http://localhost:4000`
- Check backend is running

**Trades not executing:**
- Check wallet has USDC balance
- Verify `TARGET_WALLETS` are correct
- Check Polymarket API key is valid

**TailwindCSS errors:**
- Ensure using `@import "tailwindcss"` not `@tailwind` directives
- Verify `@tailwindcss/postcss` is installed


## ⚠️ Disclaimer

This software is for educational purposes. Use at your own risk. Always test with small amounts. Cryptocurrency trading carries significant risk.
