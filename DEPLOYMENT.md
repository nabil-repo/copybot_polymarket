# Deploying to Render

This guide walks you through deploying the Polymarket Copy Trading Bot to Render with both the backend API and frontend dashboard.

## Prerequisites

- GitHub repository with your code
- Render account (free tier available at [render.com](https://render.com))
- Polymarket private key or API credentials
- 64-character hex ENCRYPTION_KEY (generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

## Architecture on Render

The app deploys as **two separate services**:

1. **Backend Service** (Node.js)
   - Express API server + Socket.io
   - Wallet monitoring and trade execution
   - SQLite database (persistent disk)
   - Port: 4000

2. **Frontend Service** (Next.js)
   - Dashboard UI
   - WebSocket client
   - Static + SSR pages
   - Port: 3000 (or Render default)

## Deployment Methods

### Option A: Blueprint (Recommended - Automated)

1. **Fork/Push to GitHub**
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/copybot_poly.git
   git push -u origin main
   ```

2. **Deploy via Render Blueprint**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click **New** → **Blueprint**
   - Connect your GitHub repository
   - Render will automatically detect `render.yaml` and create both services

3. **Configure Environment Variables** (see below)

### Option B: Manual Service Creation

#### Deploy Backend

1. Go to Render Dashboard → **New** → **Web Service**
2. Connect your GitHub repository
3. Configure:
   - **Name**: `copybot-backend` (or your choice)
   - **Region**: Oregon (or nearest to you)
   - **Branch**: `main`
   - **Root Directory**: `.` (leave blank)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node backend/server.js`
   - **Plan**: Free or Starter

4. Add environment variables (see section below)

5. Click **Create Web Service**

#### Deploy Frontend

1. Go to Render Dashboard → **New** → **Web Service**
2. Connect your GitHub repository
3. Configure:
   - **Name**: `copybot-frontend`
   - **Region**: Oregon (same as backend)
   - **Branch**: `main`
   - **Root Directory**: `.` (leave blank)
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free or Starter

4. Add environment variables:
   - `NODE_ENV`: `production`
   - `NEXT_PUBLIC_BACKEND_URL`: `https://YOUR-BACKEND-SERVICE.onrender.com` (get from backend service)
   - `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`: Your WalletConnect project ID

5. Click **Create Web Service**

## Environment Variables Configuration

### Backend Service Environment Variables

**Required:**
- `ENCRYPTION_KEY` - 64 hex chars for encrypting API credentials
  - Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `JWT_SECRET` - Secret for JWT tokens (min 32 chars)
  - Generate: `openssl rand -hex 32`
- `FRONTEND_URL` - Your frontend service URL
  - Example: `https://copybot-frontend.onrender.com`

**Optional (Trading):**
- `PRIVATE_KEY` - Your Polymarket private key (0x...) for auto-deriving API keys
- `TARGET_WALLETS` - Comma-separated wallet addresses to copy
  - Example: `0x1234...,0x5678...`
- `COPY_RATIO` - Position size multiplier (default: `0.1`)
- `MAX_POSITION_SIZE` - Max USDC per trade (default: `100`)
- `MIN_POSITION_SIZE` - Min USDC per trade (default: `1`)
- `SLIPPAGE_TOLERANCE` - Slippage % (default: `0.01`)
- `POLL_INTERVAL` - Wallet check interval ms (default: `5000`)

**Defaults (Keep as-is):**
- `NODE_ENV`: `production`
- `PORT`: `4000`
- `SKIP_ONCHAIN_BALANCE_CHECK`: `true`
- `USE_LIT`: `false`
- `AUTO_CREATE_WALLETS`: `false`
- `DB_PATH`: `./data.db`

### Frontend Service Environment Variables

**Required:**
- `NEXT_PUBLIC_BACKEND_URL` - Backend service URL
  - Get from Render backend service: `https://copybot-backend.onrender.com`
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` - WalletConnect project ID
  - Get free at [cloud.walletconnect.com](https://cloud.walletconnect.com)

**Defaults:**
- `NODE_ENV`: `production`

## Persistent Storage (SQLite Database)

Render's free tier has **ephemeral storage**, meaning the database resets on restart. For production:

### Option 1: Add Persistent Disk (Paid Plans Only)

1. Go to your backend service settings
2. Navigate to **Disks**
3. Click **Add Disk**
4. Mount path: `/data`
5. Update `DB_PATH` env var to: `/data/data.db`

### Option 2: Use PostgreSQL (Recommended for Production)

Uncomment the database section in `render.yaml`:

```yaml
databases:
  - name: copybot-db
    plan: starter
    databaseName: copybot
    user: copybot
```

Then migrate your app to use PostgreSQL instead of SQLite. You'll need to:
1. Install `pg` package: `npm install pg`
2. Update `backend/services/db.js` to use PostgreSQL
3. Set `DATABASE_URL` from Render's auto-injected env var

## Post-Deployment Setup

### 1. Configure Polymarket API Credentials

**Option A: Via Settings UI (Recommended)**
1. Open your frontend: `https://YOUR-FRONTEND.onrender.com`
2. Register/Login
3. Go to **Settings**
4. Under "Polymarket CLOB API Credentials":
   - Enter your private key in "Derive from Private Key" section
   - Click **Derive & Save**
   - Your credentials are encrypted and stored

**Option B: Set PRIVATE_KEY on Backend**
- Add `PRIVATE_KEY` environment variable to backend service
- On first trade attempt, credentials will auto-derive

### 2. Configure Target Wallets

**Via Settings UI:**
1. Go to Settings → Monitored Wallets
2. Add wallet addresses to copy

**Via Environment Variable:**
- Set `TARGET_WALLETS` on backend service
- Format: `0xaddress1,0xaddress2,0xaddress3`

### 3. Start the Bot

From your dashboard:
1. Click "Start Bot"
2. Monitor the activity feed for trade detections

## Monitoring & Logs

### View Logs
- Render Dashboard → Your Service → **Logs** tab
- Real-time logs for debugging

### Health Checks
- Backend: `https://YOUR-BACKEND.onrender.com/health`
- Should return: `{"status":"ok"}`

### Check Database
- SQLite: Check logs for database operations
- PostgreSQL: Use Render's database dashboard

## Troubleshooting

### Backend Won't Start
**Symptom:** Service crashes on startup

**Solutions:**
1. Check logs for missing environment variables
2. Verify `ENCRYPTION_KEY` is exactly 64 hex characters
3. Ensure `JWT_SECRET` is set
4. Check Node.js version compatibility (v20+ recommended)

### Frontend Can't Connect to Backend
**Symptom:** Dashboard shows connection errors

**Solutions:**
1. Verify `NEXT_PUBLIC_BACKEND_URL` is correct
2. Check backend service is running (health check)
3. Ensure CORS is configured correctly
4. Check Socket.io connection in browser console

### Database Resets on Restart
**Issue:** Using SQLite on free tier (ephemeral storage)

**Solutions:**
1. Upgrade to paid plan and add persistent disk
2. Migrate to PostgreSQL database
3. Accept that users need to re-configure on restart (dev only)

### Polymarket API Errors
**Symptom:** Trades fail with API errors

**Solutions:**
1. Verify API credentials are correct
2. Check Polymarket API status
3. Ensure your Polymarket account has sufficient balance
4. Review rate limits

### WebSocket Connection Issues
**Symptom:** Real-time updates not working

**Solutions:**
1. Check if WebSocket is enabled (default: yes)
2. Verify `FRONTEND_URL` on backend matches frontend URL
3. Check browser console for WebSocket errors
4. Try switching to polling transport

## Scaling Considerations

### Free Tier Limitations
- Services sleep after 15 minutes of inactivity
- Cold starts take ~30 seconds
- Ephemeral storage (database resets)

### Upgrade Recommendations
- **Starter Plan** ($7/month per service):
  - No sleep
  - Faster deployments
  - Persistent disk option
  - Better performance

- **PostgreSQL** ($7/month):
  - 1GB storage
  - Automatic backups
  - Better for multi-user

## Security Best Practices

### Environment Variables
- ✅ Never commit `.env` files
- ✅ Use Render's secret management
- ✅ Rotate `JWT_SECRET` and `ENCRYPTION_KEY` regularly
- ✅ Use strong, unique passwords

### API Keys
- ✅ Store only encrypted in database
- ✅ Never log sensitive keys
- ✅ Use "Derive from Private Key" feature (key not stored)
- ✅ Monitor for unauthorized access

### Network Security
- ✅ Use HTTPS only (Render provides this)
- ✅ Configure proper CORS origins
- ✅ Enable Helmet security headers (already configured)
- ✅ Rate limit API endpoints if needed

## Cost Estimate

### Free Tier (Testing)
- 2 Web Services (Backend + Frontend): **$0/month**
- Limitations: Sleeping, ephemeral storage
- Good for: Development, testing

### Production Setup (Recommended)
- Backend (Starter): **$7/month**
- Frontend (Starter): **$7/month**
- PostgreSQL (Starter): **$7/month**
- **Total: ~$21/month**

## Additional Resources

- [Render Documentation](https://render.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Node.js on Render](https://render.com/docs/deploy-node-express-app)
- [PostgreSQL Migration Guide](https://render.com/docs/databases)

## Support

For deployment issues:
1. Check Render Status: [status.render.com](https://status.render.com)
2. Review Render Docs: [render.com/docs](https://render.com/docs)
3. Check application logs in Render Dashboard
4. Review this project's GitHub Issues

## Quick Commands

### Generate Secrets
```bash
# ENCRYPTION_KEY (64 hex chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# JWT_SECRET (64 hex chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Test Locally Before Deploy
```bash
# Backend
npm run backend

# Frontend (separate terminal)
npm run dev
```

### Update Deployment
```bash
# Render auto-deploys on git push to main
git add .
git commit -m "Update deployment"
git push origin main
```

---

**Ready to deploy?** Follow Option A (Blueprint) for the fastest setup, or Option B (Manual) for more control.
