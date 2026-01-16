# SIG Chatbot Deployment Guide

Complete step-by-step guide to deploy the SIG Chatbot system.

## 📋 Prerequisites

- GitHub account
- OpenAI API key
- [Render.com](https://render.com) account (free tier available)
- [Supabase](https://supabase.com) account (free tier available)
- [Upstash](https://upstash.com) account (free tier available)
- [Netlify](https://netlify.com) or [Vercel](https://vercel.com) account (for frontend)

---

## Phase 1: Database Setup (Supabase)

### Step 1: Create Project
1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Name it `sig-chatbot`
4. Choose a secure password (save it!)
5. Select region closest to your users

### Step 2: Get Connection String
1. Go to **Settings → Database**
2. Copy the **Connection string (URI)**
3. Replace `[YOUR-PASSWORD]` with your database password
4. Save as your `DATABASE_URL`

Example:
```
postgresql://postgres:YourPassword@db.xxxx.supabase.co:5432/postgres
```

### Step 3: Initialize Database
After backend is deployed, run migrations (see Phase 4).

---

## Phase 2: Redis Setup (Upstash)

### Step 1: Create Database
1. Go to [upstash.com](https://upstash.com) and sign in
2. Click "Create Database"
3. Name it `sig-chatbot-redis`
4. Select region (match your Render region)
5. Click "Create"

### Step 2: Get Redis URL
1. In the database dashboard, find **UPSTASH_REDIS_REST_URL**
2. Or use the "Redis" tab for standard Redis URL
3. Save as your `REDIS_URL`

Example:
```
redis://default:xxxx@xxx-xxx.upstash.io:6379
```

---

## Phase 3: Backend Deployment (Render)

### Step 1: Push to GitHub
```bash
# Initialize git if not already
git init

# Add all files
git add .

# Commit
git commit -m "Initial deployment"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/sig-chatbot.git
git push -u origin main
```

### Step 2: Create Render Web Service
1. Go to [render.com](https://render.com) and sign in
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `sig-chatbot`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free (or Starter for better performance)

### Step 3: Add Environment Variables
In Render dashboard, go to **Environment** and add:

| Key | Value |
|-----|-------|
| `NODE_ENV` | production |
| `OPENAI_API_KEY` | sk-your-key-here |
| `DATABASE_URL` | Your Supabase URL |
| `REDIS_URL` | Your Upstash URL |
| `WEBHOOK_SECRET` | Generate a random string |
| `RESPONDER_MODEL` | gpt-4o-mini |
| `EXTRACTOR_MODEL` | gpt-4o-mini |
| `CHAT_HISTORY_LIMIT` | 12 |

### Step 4: Deploy
1. Click "Create Web Service"
2. Wait for build to complete
3. Note your service URL: `https://sig-chatbot.onrender.com`

### Step 5: Verify
Visit `https://your-app.onrender.com/api/health` - should return:
```json
{ "status": "ok", "timestamp": "..." }
```

---

## Phase 4: Database Migration

After backend is deployed:

### Option A: Via Render Shell
1. In Render dashboard, go to your service
2. Click "Shell" tab
3. Run:
```bash
npx prisma migrate deploy
```

### Option B: Via Local
```bash
# Set DATABASE_URL locally
export DATABASE_URL="your-supabase-url"

# Run migration
npx prisma migrate deploy
```

---

## Phase 5: Frontend Deployment (Netlify)

The frontend is a static HTML file that connects to your backend API.

### Step 1: Option A - Netlify Drop
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag and drop the `public` folder
3. Done! Get your URL.

### Step 2: Option B - Netlify CLI
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy --prod --dir=public
```

### Step 3: Option C - Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd public
vercel --prod
```

### Step 4: Configure API URL
The frontend automatically uses `window.location.origin` for API calls.

**If deploying frontend separately from backend:**
Edit `public/index.html` line:
```javascript
const API_BASE_URL = 'https://your-backend.onrender.com';
```

---

## Phase 6: ManyChat Integration

### Step 1: Create External Request
1. In ManyChat, go to **Automation → Flows**
2. Add an "External Request" action
3. Configure:
   - **URL**: `https://your-app.onrender.com/api/webhook/manychat`
   - **Method**: POST
   - **Headers**: `Content-Type: application/json`
   - **Body**:
   ```json
   {
     "manychat_id": "{{user_id}}",
     "user_message": "{{last_user_message}}",
     "user_name": "{{first_name}} {{last_name}}"
   }
   ```

### Step 2: Handle Response
1. Add a "Send Message" action after the External Request
2. Use `{{response.reply}}` for the bot message

---

## 📊 Monitoring

### Health Check
- Endpoint: `GET /api/health`
- Shows: Status, database connection, Redis connection

### Logs
- Render: Dashboard → Logs
- Filter by "error" for issues

### Lead Dashboard
- Visit your frontend URL
- Connection indicator shows green when connected

---

## 🔧 Configuration Changes

### Change AI Model
Update in Render Environment Variables:
```
RESPONDER_MODEL=gpt-4o
EXTRACTOR_MODEL=gpt-4o-mini
```

### Change History Limit
```
CHAT_HISTORY_LIMIT=20
```

### Adjust Session Timeout
```
INACTIVITY_MINUTES=30
SESSION_TTL_HOURS=48
```

---

## 🚨 Troubleshooting

### "Connection Offline" in Frontend
1. Check backend is running: visit `/api/health`
2. Check CORS - backend allows all origins by default
3. Check browser console for errors

### "No leads showing"
1. Database may be empty - real leads appear after chat interactions
2. Check database connection in Render logs
3. Run migration if tables don't exist

### "OpenAI API Error"
1. Check API key is correct
2. Check account has credits
3. Try different model: `gpt-4o-mini` is cheaper

---

## 📝 Quick Reference

| Component | URL |
|-----------|-----|
| Backend | `https://your-app.onrender.com` |
| Health Check | `https://your-app.onrender.com/api/health` |
| Dashboard | `https://your-frontend.netlify.app` |
| Webhook | `https://your-app.onrender.com/api/webhook/manychat` |

---

## 🔒 Security Notes

1. **Never commit `.env` file** - it's in `.gitignore`
2. **Rotate API keys** regularly
3. **Use WEBHOOK_SECRET** for production ManyChat integration
4. **Monitor usage** in OpenAI and Upstash dashboards
