# 🚀 SIG Chatbot - Production Deployment Guide

This guide details how to deploy the **Shariah Investments Global (SIG)** Chatbot using a robust split architecture:
- **Frontend**: Vercel (Global CDN, fast loading)
- **Backend API**: Render (Node.js Service)
- **Database**: Supabase / Neon (PostgreSQL)
- **Cache**: Render Redis (Session management)

---

## ✅ Prerequisites
1.  **GitHub Repo**: Ensure your code is pushed to GitHub.
2.  **Database**: A PostgreSQL database URL (e.g., from Supabase or Render PostgreSQL).
3.  **API Keys**: OpenAI API Key.

---

## 1️⃣ Deploy Redis (on Render) 🧠
1.  Log in to [Render Dashboard](https://dashboard.render.com/).
2.  Click **New +** -> **Redis**.
3.  **Name**: `sig-redis`
4.  **Region**: Singapore (or nearest to your users).
5.  **Max Memory**: Free Tier is fine for testing; Starter for production.
6.  Click **Create Redis**.
7.  **Copy the `Internal Redis URL`** (e.g., `redis://sig-redis:6379`). You will need this for the Backend.

---

## 2️⃣ Deploy Backend API (on Render) ⚙️
1.  Click **New +** -> **Web Service**.
2.  Connect your **GitHub Repository**.
3.  **Name**: `sig-backend`
4.  **Region**: Same as Redis (Singapore).
5.  **Branch**: `main`
6.  **Runtime**: **Node**
7.  **Build Command**: `npm install && npm run build`
8.  **Start Command**: `npm start`
9.  **Environment Variables**:
    -   `NODE_ENV`: `production`
    -   `PORT`: `10000`
    -   `DATABASE_URL`: `postgres://user:pass@host/db` (Your Postgres URL)
    -   `REDIS_URL`: `redis://...` (The Internal Redis URL from Step 1)
    -   `OPENAI_API_KEY`: `sk-...`
    -   `WEBHOOK_SECRET`: `(Create a secure password)`
    -   `SESSION_TTL_HOURS`: `24`
10. Click **Create Web Service**.
11. **Wait for deployment** to finish.
12. **Copy your Backend URL** (e.g., `https://sig-backend.onrender.com`).

---

## 3️⃣ Deploy Frontend (on Vercel) 🎨
1.  **PRE-DEPLOYMENT STEP**:
    -   Open `vercel.json` in your code.
    -   Replace `https://YOUR_RENDER_BACKEND_URL` with your **actual Render Backend URL** (from Step 2).
    -   *Example*: `"destination": "https://sig-backend.onrender.com/api/:path*"`
    -   Commit and push this change to GitHub.

2.  Log in to [Vercel](https://vercel.com/).
3.  Click **Add New...** -> **Project**.
4.  Import your **GitHub Repository**.
5.  **Project Name**: `sig-chatbot`
6.  **Framework Preset**: Select **Other**.
7.  **Root Directory**: Leave as `./` (Main folder).
8.  **Build and Output Settings** (Expand this):
    -   **Build Command**: *(Leave Empty)*
    -   **Output Directory**: `public`
    -   *(Note: This tells Vercel to serve the `public` folder as the website)*
9.  Click **Deploy**.

---

## 4️⃣ Final Connection Test 🔗
1.  Open your **Vercel App URL** (e.g., `https://sig-chatbot.vercel.app`).
2.  Look at the top-left **Connection Indicator**.
    -   🔴 **Red (Checking...)**: Wait a few seconds.
    -   🟢 **Green (Connected)**: Frontend is successfully talking to Backend via Vercel Proxy.
3.  Test a feature (e.g., "Landed Cost Calculator" or "Add Lead") to confirm API calls work.

---

## 🛠️ Troubleshooting
-   **Frontend shows "Offline"**: Check `vercel.json` destination URL. It must match your Render Backend URL exactly.
-   **Backend Render Build Failed**: Check logs. Ensure `@types` packages are in `dependencies` in `package.json` (we fixed this already).
-   **Redis Error**: Ensure Backend and Redis are in the same Render region.
