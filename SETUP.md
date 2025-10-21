# Polymarket Copy Trading Bot - Setup Guide

## Prerequisites

- Node.js 18+ installed
- A Polymarket account and API key
- A ETH wallet with USDC
- (Optional) ETHscan API key for contract verification

## Step-by-Step Setup

### 1. Clone & Install

```bash
git clone <your-repo>
cd copybot_poly
npm install
```

### 2. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your details:

```bash
# 🔑 REQUIRED CONFIGURATION

# Get from https://polymarket.com/settings/api
POLYMARKET_API_KEY=your_polymarket_api_key_here

# Your wallet private key (keep secret!)
PRIVATE_KEY=0x...your_private_key...

# Your wallet address
WALLET_ADDRESS=0x...your_wallet_address...

# Whale wallets to copy (comma-separated)
TARGET_WALLETS=0x...whale1...,0x...whale2...,0x...whale3...

# ETH RPC (get from https://chainlist.org)
ETH_RPC_URL=https://ETH-rpc.com

# ⚙️ OPTIONAL CONFIGURATION (defaults are safe)

COPY_RATIO=0.01              # Start with 1% of whale position
MAX_POSITION_SIZE=10         # Max $10 per trade for testing
MIN_POSITION_SIZE=1          # Min $1 per trade
SLIPPAGE_TOLERANCE=0.01      # 1% slippage tolerance
POLL_INTERVAL=5000           # Check wallets every 5 seconds

# Backend configuration
PORT=4000
FRONTEND_URL=http://localhost:3000

# Frontend configuration
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_WALLET_ADDRESS=your_wallet_address_here
NEXT_PUBLIC_TARGET_WALLETS=0x...whale1...,0x...whale2...
```

### 3. Get Your Polymarket API Key

1. Go to https://polymarket.com
2. Sign in to your account
3. Navigate to Settings → API
4. Create a new API key
5. Copy the key to your `.env` file

### 4. Fund Your Wallet

Make sure your ETH wallet has:
- **USDC** for trading (minimum $10-50 recommended for testing)
- **MATIC** for gas fees (around 0.1 MATIC is enough)

You can bridge USDC to ETH using:
- https://wallet.ETH.technology/
- https://bridge.arbitrum.io/

### 5. Run the Services

Open **3 terminal windows**:

#### Terminal 1: Frontend Dashboard
```bash
npm run dev
```
Visit http://localhost:3000

#### Terminal 2: Backend API
```bash
npm run backend
```
API runs on http://localhost:4000

#### Terminal 3: View Logs (Optional)
```bash
# Windows PowerShell
Get-Content logs\trades-*.json -Wait
```

### 6. Test the Bot

1. Open the dashboard at http://localhost:3000
2. You should see:
   - Bot status: Active
   - Number of wallets monitored
   - Real-time trade updates
3. Monitor the backend terminal for trade detection logs
4. Check the logs folder for detailed trade records

## Advanced Setup

### Deploy Smart Contracts (Optional)

If you want to use the vault for profit sharing:

```bash
cd contracts
npx hardhat run scripts/deploy.js --network ETH
```

Copy the deployed contract address to `.env`:
```bash
VAULT_CONTRACT_ADDRESS=0x...deployed_address...
```

### Enable Lit Protocol (Production)

For enhanced wallet security in production:

```bash
LIT_NETWORK=mainnet  # Change from 'cayenne'
```

Follow Lit Protocol docs for key management:
https://developer.litprotocol.com/

### Setup Envio Indexer (Optional)

For blockchain event indexing:

1. Create account at https://envio.dev/
2. Configure your indexer for ETH
3. Set webhook URL: `https://your-backend.com/api/webhooks/envio`
4. Add webhook secret to `.env`:
```bash
ENVIO_WEBHOOK_SECRET=your_secret_here
```

### PayPal USD Integration (Optional)

For settlement with PayPal USD:

1. Get PayPal developer credentials
2. Add to `.env`:
```bash
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_SECRET=your_secret
```

## Monitoring & Maintenance

### Check Logs

Trade logs are saved to `logs/trades-{date}.json`:

```bash
# View today's trades
cat logs/trades-2025-10-15.json

# Monitor live (Windows)
Get-Content logs\trades-2025-10-15.json -Wait

# Monitor live (Unix/Mac)
tail -f logs/trades-2025-10-15.json
```

### Health Check

```bash
curl http://localhost:4000/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": "2025-10-15T12:00:00.000Z"
}
```

### View API Responses

```bash
# Get markets
curl http://localhost:4000/api/markets

# Get trades
curl http://localhost:4000/api/trades

# Get trade history
curl http://localhost:4000/api/trades/history
```

## Troubleshooting

### Issue: Backend won't start

**Error**: `Port 4000 already in use`

**Solution**: Kill the process or change port:
```bash
# Windows
netstat -ano | findstr :4000
taskkill /PID <process_id> /F

# Or change port in .env
PORT=4001
```

### Issue: Frontend can't connect to backend

**Error**: `WebSocket connection failed`

**Solution**: 
1. Ensure backend is running on port 4000
2. Check `NEXT_PUBLIC_BACKEND_URL` in `.env`
3. Restart both services

### Issue: No trades detected

**Possible causes**:
1. Target wallets are not active
2. Polymarket API key is invalid
3. Wallet addresses are incorrect

**Solution**:
1. Verify wallet addresses on https://ETHscan.com
2. Check backend logs for API errors
3. Test API key manually:
```bash
curl -H "Authorization: Bearer YOUR_KEY" https://api.polymarket.com/markets
```

### Issue: Trades fail to execute

**Error**: `Insufficient balance`

**Solution**:
1. Check USDC balance: https://ETHscan.com/address/YOUR_ADDRESS
2. Reduce `MAX_POSITION_SIZE` in `.env`
3. Fund wallet with more USDC

**Error**: `Transaction reverted`

**Solution**:
1. Check MATIC balance for gas
2. Increase gas price in code
3. Verify contract addresses

### Issue: TailwindCSS errors

**Error**: `Unknown at rule @tailwind`

**Solution**: This project uses TailwindCSS v4 with new syntax:
- ✅ Use `@import "tailwindcss"`
- ❌ Don't use `@tailwind base`

Already configured correctly in `app/globals.css`.

## Production Checklist

Before going live:

- [ ] Test with small `COPY_RATIO` (0.01-0.05)
- [ ] Test with low `MAX_POSITION_SIZE` ($10-50)
- [ ] Enable Lit Protocol for key management
- [ ] Set up monitoring/alerts
- [ ] Test stop-loss functionality
- [ ] Backup wallet private keys securely
- [ ] Review and understand all risks
- [ ] Deploy backend to Railway/Render
- [ ] Deploy frontend to Vercel
- [ ] Set up domain and SSL
- [ ] Configure production environment variables
- [ ] Test webhook endpoints
- [ ] Monitor for 24 hours with small positions

## Support & Resources

- **Polymarket API**: https://docs.polymarket.com/
- **Lit Protocol**: https://developer.litprotocol.com/
- **Pyth Network**: https://docs.pyth.network/
- **Hardhat**: https://hardhat.org/docs
- **Next.js**: https://nextjs.org/docs

## Security Reminders

⚠️ **NEVER** commit your `.env` file
⚠️ **NEVER** share your private key
⚠️ Use separate wallets for testing and production
⚠️ Start with small amounts
⚠️ Monitor regularly for suspicious activity
⚠️ Keep dependencies updated

## Getting Help

If you encounter issues:

1. Check this guide first
2. Review backend/frontend logs
3. Check the GitHub issues
4. Verify your configuration in `.env`
5. Test API endpoints manually

---

**Happy Trading! 🚀📈**

Remember: This is a trading bot. Always test thoroughly and never risk more than you can afford to lose.
