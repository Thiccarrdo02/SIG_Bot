# 🚀 SIG Chatbot - Production Deployment Guide

This guide details how to deploy the **Shariah Investments Global (SIG)** Chatbot using a robust split architecture:
- **Frontend**: Vercel (Global CDN, fast loading)
- **Backend API**: Render (Node.js Service)
- **Database**: Supabase / Neon (PostgreSQL)
- **Cache**: Render Redis (Session management)
- **Automation**: ManyChat (Instagram DM integration)

---

## ✅ Prerequisites
1.  **GitHub Repo**: Ensure your code is pushed to GitHub.
2.  **Database**: A PostgreSQL database URL (e.g., from Supabase or Render PostgreSQL).
3.  **API Keys**: OpenAI API Key.
4.  **ManyChat Account**: Pro account for External Request actions.

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
3.  **Name**: `sig-bot`
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
    -   `WEBHOOK_SECRET`: `(Create a secure password, e.g., "mysecretkey123")`
    -   `SESSION_TTL_HOURS`: `24`
10. Click **Create Web Service**.
11. **Wait for deployment** to finish.
12. **Copy your Backend URL** (e.g., `https://sig-bot.onrender.com`).

---

## 3️⃣ Deploy Frontend (on Vercel) 🎨
1.  **PRE-DEPLOYMENT STEP**:
    -   Open `vercel.json` in your code.
    -   Replace `https://YOUR_RENDER_BACKEND_URL` with your **actual Render Backend URL** (from Step 2).
    -   *Example*: `"destination": "https://sig-bot.onrender.com/api/:path*"`
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

## 5️⃣ ManyChat Webhook Integration 📱

This is the **CRITICAL** step to connect your Instagram DMs to the SIG Bot.

### 5.1 Understanding the Flow

```
Instagram User → ManyChat → Your Backend Webhook → AI Response → ManyChat → Instagram User
```

### 5.2 Create the Webhook Flow in ManyChat

1.  **Log in to ManyChat** → Go to your **Instagram** channel.
2.  **Create a New Flow** (or edit your main automation):
    -   **Automation** → **New Automation** → **Start from Scratch**
    -   Name it: `SIG Bot AI Handler`

3.  **Add a Trigger**:
    -   Choose **"Message"** trigger (or use an existing trigger like a keyword).
    -   This will capture user messages.

4.  **Add "External Request" Action**:
    -   Drag an **"External Request"** block after your trigger.
    -   Configure as follows:

### 5.3 External Request Configuration

| Setting | Value |
|---------|-------|
| **Request Type** | `POST` |
| **URL** | `https://sig-bot.onrender.com/api/webhook/manychat` |
| **Headers** | See below |
| **Body** | JSON (see below) |

#### Headers:
```
Content-Type: application/json
X-Webhook-Secret: mysecretkey123
```
> ⚠️ Replace `mysecretkey123` with the actual value you set in `WEBHOOK_SECRET` env variable on Render.

#### Body (JSON):
```json
{
    "subscriber_id": "{{user id}}",
    "first_name": "{{first name}}",
    "last_name": "{{last name}}",
    "message": "{{last input text}}",
    "phone": "{{phone}}",
    "email": "{{email}}",
    "trigger": "{{trigger}}"
}
```

> 💡 **Important**: The `{{...}}` are ManyChat system variables. Click inside the field to see autocomplete options.

#### Response Mapping:
After the External Request, ManyChat receives a JSON response. Map it like this:

| Response Path | Save to Custom Field |
|---------------|---------------------|
| `response.reply` | `bot_reply` (Create this custom field) |
| `response.path` | `user_path` (Optional) |

### 5.4 Send the Bot's Reply

1.  **Add a "Send Message" Block** after External Request.
2.  Use the custom field: `{{bot_reply}}`
3.  This sends the AI-generated response back to the user.

### 5.5 Complete Flow Diagram

```
[Trigger: User Message]
          │
          ▼
[External Request: POST to /api/webhook/manychat]
          │
          ▼
[Save Response: bot_reply = response.reply]
          │
          ▼
[Send Message: {{bot_reply}}]
```

### 5.6 Testing the Integration

1.  **Publish your flow** in ManyChat.
2.  **Send a test DM** to your Instagram account from a personal account.
3.  **Expected Behavior**:
    -   ManyChat receives the message.
    -   Calls your backend with subscriber info.
    -   Backend returns AI response.
    -   ManyChat sends the reply.
4.  **Check Render Logs** if something fails (Dashboard → Your Service → Logs).

---

## 6️⃣ ManyChat System Fields Reference

Here are the ManyChat variables you can use in the webhook body:

| Variable | Description |
|----------|-------------|
| `{{user id}}` | Unique ManyChat subscriber ID |
| `{{first name}}` | User's first name from Instagram |
| `{{last name}}` | User's last name |
| `{{last input text}}` | The message the user just sent |
| `{{phone}}` | Phone number (if collected) |
| `{{email}}` | Email (if collected) |
| `{{trigger}}` | What triggered this flow |
| `{{ig username}}` | Instagram username |
| `{{profile pic url}}` | Profile picture URL |

---

## 7️⃣ Backend Response Format

The backend (`/api/webhook/manychat`) returns JSON in this format:

```json
{
    "response": {
        "reply": "Walaikum Assalam! Welcome to Shariah Investments Global...",
        "quick_replies": ["Tell me about Sourcing", "Amazon FBA", "Trading"],
        "path": "Path E"
    }
}
```

You can optionally use `quick_replies` to configure Quick Reply buttons in ManyChat.

---

## 🛠️ Troubleshooting

### Frontend shows "Offline"
-   Check `vercel.json` destination URL. It must match your Render Backend URL exactly.

### ManyChat External Request Fails (401 Unauthorized)
-   Ensure `X-Webhook-Secret` header matches `WEBHOOK_SECRET` env variable on Render.

### ManyChat External Request Fails (500 Error)
-   Check Render logs for error details.
-   Ensure `DATABASE_URL` and `REDIS_URL` are correct.

### Bot doesn't respond
-   Verify `OPENAI_API_KEY` is valid and has credits.
-   Check if the flow is published in ManyChat.

### Backend Render Build Failed
-   Check logs. Ensure `@types` packages are in `dependencies` in `package.json`.

### Redis Error
-   Ensure Backend and Redis are in the same Render region.

---

## 📊 Dashboard Access

Your SIG Command Center is protected by login:
-   **URL**: Your Vercel App URL
-   **Email**: `shariahinvestmentsindia@gmail.com`
-   **Password**: `Pa$$w0rd8864`

---

## 🎉 Summary

| Component | Platform | URL |
|-----------|----------|-----|
| Frontend | Vercel | `https://your-app.vercel.app` |
| Backend | Render | `https://sig-bot.onrender.com` |
| Database | Supabase/Neon | (Your PostgreSQL URL) |
| Cache | Render Redis | (Internal URL) |
| Webhook | ManyChat | POST to `/api/webhook/manychat` |

Your SIG Chatbot is now fully deployed and connected! 🚀
