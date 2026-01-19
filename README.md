# SIG Chatbot - Shariah Investments Global

An AI-powered conversational lead generation system for Shariah Investments Global, built with Node.js/Express and OpenAI GPT-4o.

## 🚀 Features

- **Intelligent Lead Qualification**: Automatically triages users into 5 paths (Sourcing, FBA, Trading, Hudood, General)
- **Lead Categorization**: Only saves qualified leads (3+ messages, name/location collected)
- **Important Lead Flagging**: Marks high-value leads who provided phone numbers
- **Multi-language Support**: Hindi/Urdu transliteration support
- **Lead Extraction**: Automatically extracts 20+ data points from conversations
- **Shariah-compliant**: Built-in rules for ethical guidance and compliance checks
- **Real-time Dashboard**: Modern Apple-style frontend for lead management
- **Customers Page**: View all saved leads with Instagram handles, sortable by location
- **ManyChat Integration**: Webhook-ready for WhatsApp/Instagram automation

---

## 📁 Architecture

```
📦 SIG_CHATBOT
├── 📁 src/
│   ├── 📄 app.ts                 # Express app + Cron job
│   ├── 📁 config/index.ts        # Configuration & env vars
│   ├── 📁 controllers/           # API handlers
│   ├── 📁 routes/                # Route definitions
│   ├── 📁 services/              # Core business logic
│   │   ├── responder.service.ts  # Chat response generation
│   │   ├── extractor.service.ts  # Lead data extraction (AI)
│   │   ├── session.service.ts    # Session/cache management
│   │   ├── lead.service.ts       # Lead CRUD operations
│   │   └── db.ts                 # Prisma client
│   ├── 📁 prompts/index.ts       # All LLM prompts (CORE + Path-specific)
│   └── 📁 utils/                 # Logger, Redis cache
├── 📁 public/index.html          # Dashboard frontend
├── 📁 prisma/schema.prisma       # Database schema
└── 📁 scripts/chat.ts            # Local testing CLI
```

---

## 🔄 Data Flow

```
User Message (Instagram/WhatsApp)
         ↓
    ManyChat Webhook
         ↓
 ┌───────┴───────┐
 │ Webhook       │ → Duplicate check → Session load
 │ Controller    │ → Responder service → Generate response
 └───────┬───────┘
         ↓
   Session Updated (in cache + DB)
         ↓
    [After 10 min inactivity]
         ↓
 ┌───────┴───────┐
 │ Cron Job      │ → Lead Qualification Check:
 │               │   - Skip if <3 messages
 │               │   - Skip if no name/location
 └───────┬───────┘
         ↓
   Extractor AI (GPT-4o-mini)
         ↓
   Lead saved to PostgreSQL
         ↓
   Dashboard displays leads
```

---

## ⚙️ Environment Variables

### Required
| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key for GPT-4o |
| `DATABASE_URL` | PostgreSQL connection string (Supabase) |

### Optional - Model Settings
| Variable | Default | Description |
|----------|---------|-------------|
| `RESPONDER_MODEL` | gpt-4o-mini | Model for chat responses |
| `EXTRACTOR_MODEL` | gpt-4o-mini | Model for data extraction |
| `RESPONDER_MAX_TOKENS` | 1500 | Max tokens for responses |
| `EXTRACTOR_MAX_TOKENS` | 1000 | Max tokens for extraction |
| `RESPONDER_TEMPERATURE` | 0.7 | Creativity level (0-1) |
| `EXTRACTOR_TEMPERATURE` | 0.2 | Extraction precision (0-1) |

### Optional - Session Settings
| Variable | Default | Description |
|----------|---------|-------------|
| `SESSION_TTL_HOURS` | 72 | How long sessions are cached |
| `INACTIVITY_MINUTES` | 10 | Minutes before extraction triggers |
| `CHAT_HISTORY_LIMIT` | 100 | Messages stored in DB |
| `CONTEXT_LIMIT` | 10 | Messages sent to LLM (token efficiency) |
| `EXTRACTION_CRON_MINUTES` | 5 | How often cron checks for inactive sessions |

### Optional - Redis (Production)
| Variable | Description |
|----------|-------------|
| `REDIS_URL` | Redis connection string (Upstash) |

---

## 🚀 Render Deployment

### Step 1: Create Web Service
1. Go to [render.com](https://render.com) → New → Web Service
2. Connect your GitHub repo
3. Settings:
   - **Name**: `sig-chatbot`
   - **Region**: Singapore or nearest
   - **Branch**: `main`
   - **Build Command**: `npm install && npx prisma db push && npm run build`
   - **Start Command**: `npm start`

### Step 2: Set Environment Variables
In Render Dashboard → Environment:

```
OPENAI_API_KEY     = sk-proj-xxxxxx
DATABASE_URL       = postgresql://user:pass@host:5432/db
REDIS_URL          = redis://user:pass@host:6379 (optional)
NODE_ENV           = production
```

### Step 3: Configure ManyChat Webhook
In ManyChat → Settings → Webhooks:
```
https://your-app.onrender.com/api/webhook/manychat
```

### Step 4: Access Dashboard
```
https://your-app.onrender.com
```
Default login: `admin@sig.com` / `sig@2024`

---

## 🔧 Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your OPENAI_API_KEY
```

### 3. Run Locally
```bash
# Development mode (no DB required)
npm run dev

# Test chat in terminal
npm run chat
```

### 4. Chat CLI Commands
| Command | Description |
|---------|-------------|
| `extract` | Manually trigger extraction |
| `debug` | Show session info |
| `clear` | Reset session |
| `exit` | Quit |

---

## 📊 Lead Categories

| Category | Criteria | Action |
|----------|----------|--------|
| **1. Don't Save** | <3 messages | Skipped entirely |
| **2. Save** | 3+ messages + name OR location | Saved to DB |
| **3. Important** | Phone collected | Saved + `is_important=true` |

---

## 📡 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/webhook/manychat` | POST | ManyChat webhook |
| `/api/leads` | GET | List all leads |
| `/api/leads/:id` | GET | Get lead by ID |
| `/api/leads/:id` | PATCH | Update lead |
| `/api/leads/:id` | DELETE | Delete lead |
| `/api/leads/reset` | DELETE | Delete ALL leads |
| `/api/stats` | GET | Dashboard statistics |
| `/api/demographics` | GET | Demographics data |
| `/api/export/leads` | GET | Export leads as CSV |

---

## 🛡️ Budget Thresholds

| Tier | Amount | Description |
|------|--------|-------------|
| VIP | ₹5 Lakh+ | High-value lead |
| Mid | ₹1-5 Lakh | Medium budget |
| Low Cap | <₹1 Lakh | Entry level |

---

## 📝 License

Proprietary - Shariah Investments Global
