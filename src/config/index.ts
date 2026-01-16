import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // API Keys
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
  google: {
    apiKey: process.env.GOOGLE_AI_API_KEY || '',
  },

  // Database
  database: {
    url: process.env.DATABASE_URL || '',
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || '',
  },

  // Webhook
  webhook: {
    secret: process.env.WEBHOOK_SECRET || '',
  },

  // Session settings (configurable via env)
  session: {
    ttlSeconds: parseInt(process.env.SESSION_TTL_HOURS || '24') * 60 * 60,
    inactivityMinutes: parseInt(process.env.INACTIVITY_MINUTES || '15'),
    historyLimit: parseInt(process.env.CHAT_HISTORY_LIMIT || '12'),
  },

  // Model settings (configurable via env)
  models: {
    responderModel: process.env.RESPONDER_MODEL || 'gpt-4o-mini',
    extractorModel: process.env.EXTRACTOR_MODEL || 'gpt-4o-mini',
    responderMaxTokens: parseInt(process.env.RESPONDER_MAX_TOKENS || '1500'),
    extractorMaxTokens: parseInt(process.env.EXTRACTOR_MAX_TOKENS || '1000'),
    responderTemperature: parseFloat(process.env.RESPONDER_TEMPERATURE || '0.7'),
    extractorTemperature: parseFloat(process.env.EXTRACTOR_TEMPERATURE || '0.2'),
  },
};

// Validate required env vars
export function validateConfig(): void {
  const required = ['OPENAI_API_KEY'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0 && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Check if database is configured
export function isDatabaseConfigured(): boolean {
  const url = process.env.DATABASE_URL;
  return !!(url && url.length > 10 && !url.includes('your_project'));
}

// Check if Redis is configured
export function isRedisConfigured(): boolean {
  const url = process.env.REDIS_URL;
  return !!(url && url.length > 5);
}

// ============================================
// MODEL CONFIGURATION
// ============================================

/**
 * Model Configuration - Centralized LLM Settings
 * 
 * Override via environment variables:
 * - RESPONDER_MODEL (default: gpt-4o-mini)
 * - EXTRACTOR_MODEL (default: gpt-4o-mini)
 * - RESPONDER_MAX_TOKENS (default: 1500)
 * - EXTRACTOR_MAX_TOKENS (default: 1000)
 * - CHAT_HISTORY_LIMIT (default: 12)
 */
export const MODEL_CONFIG = {
  responder: {
    provider: 'openai' as const,
    model: config.models.responderModel,
    maxOutputTokens: config.models.responderMaxTokens,
    temperature: config.models.responderTemperature,
  },
  extractor: {
    provider: 'openai' as const,
    model: config.models.extractorModel,
    maxTokens: config.models.extractorMaxTokens,
    temperature: config.models.extractorTemperature,
  }
};

// Banned patterns for pre-processing (Red Lines)
export const BANNED_PATTERNS = [
  /\breplica\b/i,
  /\bfirst\s*copy\b/i,
  /\bfake\b/i,
  /\bcounterfeit\b/i,
  /\bduplicate\s*(brand|product)\b/i,
  /\bbuy\s+(this\s+)?stock\b/i,
  /\bshould\s+i\s+invest\s+in\b/i,
  /\bgive\s+(me\s+)?(a\s+)?tip\b/i,
  /\bstock\s+tip\b/i,
  /\btrade\s+call\b/i,
];

// Intent detection patterns
export const INTENT_PATTERNS = {
  readyToPay: [
    /\bready\s+to\s+pay\b/i,
    /\bhow\s+(do\s+i\s+|to\s+)?pay\b/i,
    /\blet('s|us)?\s+start\b/i,
    /\bi\s+want\s+to\s+join\b/i,
    /\benroll\s+me\b/i,
    /\bpayment\s+(link|process)\b/i,
  ],
  wantsCall: [
    /\bcall\s+me\b/i,
    /\bspeak\s+to\s+(someone|you|team)\b/i,
    /\btalk\s+to\s+(someone|mentor|expert)\b/i,
    /\bphone\s+(call|consultation)\b/i,
    /\bbook\s+(a\s+)?call\b/i,
  ],
  salam: [
    /\bsalam\b/i,
    /\bassalam(u)?\s*alaikum\b/i,
    /\bwalaikum\b/i,
  ],
  hindiUrdu: [
    /\bkya\b/i,
    /\bhai\b/i,
    /\bhain\b/i,
    /\bkaise\b/i,
    /\bkitna\b/i,
    /\bmujhe\b/i,
    /\baapka\b/i,
    /\bsikhna\b/i,
    /\bmangana\b/i,
  ],
};

// Refusal responses for banned content
export const REFUSAL_RESPONSES = {
  replica: "Our mission is to help the Ummah build Barakah-filled, legal businesses. Sourcing replicas is illegal and violates Shariah principles of honesty. We only source original, high-quality products for your own brand.",
  tradingTip: "We believe in 'Teaching a man to fish rather than giving him a fish.' Giving calls makes you dependent; learning technical analysis makes you free. Our Halal Trading Mentorship teaches you the skills to make independent decisions. For Halal/Haram status of any stock, check our Hudood App (@hudood.official).",
};

// Official contact
export const OFFICIAL_CONTACT = '+91 8828888664';
