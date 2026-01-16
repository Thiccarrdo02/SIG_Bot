# SIG Chatbot - Shariah Investments Global

An AI-powered conversational lead generation system for Shariah Investments Global, built with Node.js/Express and OpenAI GPT-4o.

## 🚀 Features

- **Intelligent Lead Qualification**: Automatically triages users into 5 paths (Sourcing, FBA, Trading, Hudood, General)
- **Multi-language Support**: Hindi/Urdu transliteration support
- **Lead Extraction**: Automatically extracts user data (name, location, budget, occupation) from conversations
- **Shariah-compliant**: Built-in rules for ethical guidance and compliance checks
- **Real-time Dashboard**: Modern Apple-style frontend for lead management
- **ManyChat Integration**: Webhook-ready for WhatsApp/Instagram automation

## 📁 Project Structure

```
├── src/
│   ├── app.ts              # Express app setup
│   ├── config/             # Configuration & model settings
│   ├── controllers/        # Route handlers
│   ├── routes/             # API routes
│   ├── services/           # Business logic
│   │   ├── responder.service.ts  # Chat response generation
│   │   ├── extractor.service.ts  # Lead data extraction
│   │   ├── session.service.ts    # Session management
│   │   └── lead.service.ts       # Lead database operations
│   ├── prompts/            # System prompts
│   └── utils/              # Utilities (logger, redis)
├── public/                 # Frontend dashboard
├── scripts/                # CLI tools
└── prisma/                 # Database schema
```

## 🛠️ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your API keys
```

### 3. Run Locally
```bash
# Development mode (no Redis/DB required)
npm run dev

# Test chat in terminal
npm run chat
```

## ⚙️ Configuration

All settings are configurable via environment variables:

### Required
| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key for GPT-4o |

### Model Settings (Optional)
| Variable | Default | Description |
|----------|---------|-------------|
| `RESPONDER_MODEL` | gpt-4o-mini | Model for chat responses |
| `EXTRACTOR_MODEL` | gpt-4o-mini | Model for data extraction |
| `RESPONDER_MAX_TOKENS` | 1500 | Max tokens for responses |
| `CHAT_HISTORY_LIMIT` | 12 | Messages kept in context |

### Database & Redis (Production)
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |

## 📡 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/webhook/manychat` | POST | ManyChat webhook |
| `/api/leads` | GET | List all leads |
| `/api/leads/:id` | GET | Get lead by ID |

## 🚀 Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions:
- Backend: Render.com Web Service
- Database: Supabase PostgreSQL
- Redis: Upstash
- Frontend: Netlify/Vercel

## 🧪 Local Testing

```bash
# Start chat CLI
npm run chat

# Available commands:
# - Type messages to chat
# - "extract" - Extract data from session
# - "debug" - Show session info
# - "clear" - Reset session
# - "exit" - Quit
```

## 📝 License

Proprietary - Shariah Investments Global
