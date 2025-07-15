const express = require('express');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const validator = require('validator');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Environment variables with validation
const WEBHOOK_ID = process.env.WEBHOOK_ID;
const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN;
const BEHIND_PROXY = process.env.BEHIND_PROXY === 'true';
const API_KEY = process.env.API_KEY; // Optional - if not set, no authentication required
const MAX_CONTENT_LENGTH = parseInt(process.env.MAX_CONTENT_LENGTH) || 2000;
const MAX_EMBEDS = parseInt(process.env.MAX_EMBEDS) || 10;
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW) || 60000; // 1 minute
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX) || 5;

// Validate required environment variables
if (!WEBHOOK_ID || !WEBHOOK_TOKEN) {
  console.error('FATAL: WEBHOOK_ID and WEBHOOK_TOKEN must be set in environment variables');
  process.exit(1);
}

// Validate webhook ID format (Discord snowflake)
if (!/^\d{17,19}$/.test(WEBHOOK_ID)) {
  console.error('FATAL: Invalid WEBHOOK_ID format');
  process.exit(1);
}

// Validate webhook token format
if (!/^[A-Za-z0-9_-]{68}$/.test(WEBHOOK_TOKEN)) {
  console.error('FATAL: Invalid WEBHOOK_TOKEN format');
  process.exit(1);
}

const WEBHOOK_URL = `https://discord.com/api/webhooks/${WEBHOOK_ID}/${WEBHOOK_TOKEN}`;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      scriptSrc: ["'none'"],
      styleSrc: ["'none'"],
      imgSrc: ["'none'"],
      connectSrc: ["'none'"],
      fontSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'none'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// Trust proxy if behind one
if (BEHIND_PROXY) {
  app.set('trust proxy', true);
}

// Body parsing with strict limits
app.use(express.json({ 
  limit: '10kb',
  strict: true,
  type: 'application/json'
}));

// Disable unnecessary headers
app.disable('x-powered-by');
app.disable('etag');

// Get real IP address
function getRealIP(req) {
  if (BEHIND_PROXY) {
    return req.headers['cf-connecting-ip'] || 
           req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
           req.headers['x-real-ip'] || 
           req.connection.remoteAddress;
  }
  return req.connection.remoteAddress || req.ip;
}

// Enhanced rate limiting with different limits for authenticated vs unauthenticated
const createRateLimit = rateLimit({
  windowMs: RATE_LIMIT_WINDOW,
  max: (req) => {
    // More generous limits for authenticated users
    return req.isAuthenticated ? RATE_LIMIT_MAX * 3 : RATE_LIMIT_MAX;
  },
  keyGenerator: (req) => {
    const ip = getRealIP(req);
    const suffix = req.isAuthenticated ? '_auth' : '_unauth';
    const salt = API_KEY || 'no-api-key-fallback';
    return crypto.createHash('sha256').update(ip + salt + suffix).digest('hex');
  },
  message: (req) => ({
    error: 'Rate limit exceeded',
    retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000),
    hint: req.isAuthenticated ? 'Authenticated rate limit reached' : 'Use API key for higher limits'
  }),
  standardHeaders: false,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  }
});

// Optional API key validation middleware (must run before rate limiting)
app.use((req, res, next) => {
  if (req.path === '/health') {
    req.isAuthenticated = false;
    return next();
  }
  
  const providedKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  
  // If no API key is configured, all requests are unauthenticated
  if (!API_KEY) {
    req.isAuthenticated = false;
    return next();
  }
  
  // If API key is provided, validate it
  if (providedKey && providedKey !== API_KEY) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Invalid API key provided'
    });
  }
  
  // Store whether request is authenticated for enhanced features
  req.isAuthenticated = !!providedKey && providedKey === API_KEY;
  
  next();
});

// logging middleware
app.use((req, res, next) => {
  const ip = getRealIP(req);
  const timestamp = new Date().toISOString();
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const authStatus = req.isAuthenticated ? 'AUTH' : 'UNAUTH';
  
  console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${ip.substring(0, 8)}... - ${authStatus} - UA: ${userAgent.substring(0, 50)}`);
  
  // security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  next();
});

// Apply rate limiting
app.use(createRateLimit);

// Handle DELETE requests with 418 I'm a teapot
app.delete('/', (req, res) => {
  res.status(418).json({
    error: "I'm a teapot",
    message: "sorry!",
    code: 418
  });
});

// block all non-POST requests (except health check and root GET)
app.use((req, res, next) => {
  if ((req.path === '/health' || req.path === '/') && req.method === 'GET') {
    return next();
  }
  
  if (req.path === '/' && req.method === 'DELETE') {
    return next();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      allowed: ['POST']
    });
  }
  
  next();
});

// input validation functions
function validateWebhookPayload(payload) {
  const errors = [];
  
  // validate content
  if (payload.content !== undefined) {
    if (typeof payload.content !== 'string') {
      errors.push('Content must be a string');
    } else if (payload.content.length > MAX_CONTENT_LENGTH) {
      errors.push(`Content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters`);
    }
  }
  
  // validate username
  if (payload.username !== undefined) {
    if (typeof payload.username !== 'string') {
      errors.push('Username must be a string');
    } else if (payload.username.length > 80 || payload.username.length < 1) {
      errors.push('Username must be between 1 and 80 characters');
    } else if (!/^[\w\s-]+$/.test(payload.username)) {
      errors.push('Username contains invalid characters');
    }
  }
  
  // validate avatar URL
  if (payload.avatar_url !== undefined) {
    if (typeof payload.avatar_url !== 'string') {
      errors.push('Avatar URL must be a string');
    } else if (!validator.isURL(payload.avatar_url, { 
      protocols: ['https'], 
      require_protocol: true,
      host_whitelist: ['cdn.discordapp.com', 'media.discordapp.net', 'i.imgur.com']
    })) {
      errors.push('Invalid avatar URL or unsupported domain');
    }
  }
  
  // validate embeds
  if (payload.embeds !== undefined) {
    if (!Array.isArray(payload.embeds)) {
      errors.push('Embeds must be an array');
    } else if (payload.embeds.length > MAX_EMBEDS) {
      errors.push(`Too many embeds (max: ${MAX_EMBEDS})`);
    } else {
      payload.embeds.forEach((embed, index) => {
        if (typeof embed !== 'object' || embed === null) {
          errors.push(`Embed ${index} must be an object`);
          return;
        }
        
        // validate embed fields
        if (embed.title && (typeof embed.title !== 'string' || embed.title.length > 256)) {
          errors.push(`Embed ${index} title must be a string with max 256 characters`);
        }
        
        if (embed.description && (typeof embed.description !== 'string' || embed.description.length > 4096)) {
          errors.push(`Embed ${index} description must be a string with max 4096 characters`);
        }
        
        if (embed.url && !validator.isURL(embed.url, { protocols: ['https'], require_protocol: true })) {
          errors.push(`Embed ${index} URL must be a valid HTTPS URL`);
        }
        
        if (embed.color && (!Number.isInteger(embed.color) || embed.color < 0 || embed.color > 16777215)) {
          errors.push(`Embed ${index} color must be an integer between 0 and 16777215`);
        }
      });
    }
  }
  
  return errors;
}

// sanitize payload
function sanitizePayload(payload) {
  const sanitized = {};
  
  // only allow specific fields
  const allowedFields = ['content', 'username', 'avatar_url', 'embeds'];
  
  allowedFields.forEach(field => {
    if (payload[field] !== undefined && payload[field] !== null) {
      sanitized[field] = payload[field];
    }
  });
  
  // sanitize content
  if (sanitized.content) {
    sanitized.content = sanitized.content.trim();
  }
  
  // sanitize username
  if (sanitized.username) {
    sanitized.username = sanitized.username.trim();
  }
  
  return sanitized;
}

// health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0-secure'
  });
});

// Discord webhook info endpoint (GET /) - returns real webhook data with scrambled IDs
app.get('/', async (req, res) => {
  try {
    const webhookUrl = `https://discord.com/api/webhooks/${WEBHOOK_ID}/${WEBHOOK_TOKEN}`;
    
    const response = await axios.get(webhookUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'DiscordWebhookProxy/2.0.0 (by minoa.cat)'
      }
    });
    
    const webhookData = response.data;
    
    // Function to scramble IDs while keeping them valid-looking
    const scrambleId = (id) => {
      if (!id) return id;
      const chars = id.toString().split('');
      for (let i = chars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [chars[i], chars[j]] = [chars[j], chars[i]];
      }
      return chars.join('');
    };
    
    // Function to scramble token while keeping it valid-looking
    const scrambleToken = (token) => {
      if (!token) return token;
      const chars = token.split('');
      for (let i = chars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [chars[i], chars[j]] = [chars[j], chars[i]];
      }
      return chars.join('');
    };
    
    const scrambledId = scrambleId(webhookData.id);
    const scrambledToken = scrambleToken(webhookData.token);
    
    // Return webhook data with scrambled sensitive information
    const obfuscatedData = {
      application_id: webhookData.application_id, // Keep original
      avatar: webhookData.avatar, // Keep original
      channel_id: scrambleId(webhookData.channel_id),
      guild_id: scrambleId(webhookData.guild_id),
      id: scrambledId,
      name: webhookData.name, // Keep original
      type: webhookData.type, // Keep original
      token: scrambledToken,
      url: `https://discord.com/api/webhooks/${scrambledId}/${scrambledToken}`
    };
    
    res.status(200).json(obfuscatedData);
    
  } catch (error) {
    console.error('Error fetching webhook info:', error.message);
    
    // Fallback to mock data if webhook fetch fails
    const fallbackData = {
      application_id: null,
      avatar: null,
      channel_id: "9876543210123456789",
      guild_id: "1234567890987654321",
      id: "5647382910384756291",
      name: "Webhook Proxy (Fallback)",
      type: 1,
      token: "AbC123XyZ789MnOpQrStUvWxYz456DeF789GhIjKlMnOpQrStUvWxYzAbC123XyZ",
      url: "https://discord.com/api/webhooks/5647382910384756291/AbC123XyZ789MnOpQrStUvWxYz456DeF789GhIjKlMnOpQrStUvWxYzAbC123XyZ"
    };
    
    res.status(200).json(fallbackData);
  }
});

// main webhook proxy endpoint
app.post('*', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // validate request body exists
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        error: 'Invalid request body',
        message: 'Request body must be a valid JSON object'
      });
    }
    
    // validate payload
    const validationErrors = validateWebhookPayload(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationErrors
      });
    }
    
    // sanitize
    const sanitizedPayload = sanitizePayload(req.body);
    
    // ensure at least content or embeds exist
    if (!sanitizedPayload.content && (!sanitizedPayload.embeds || sanitizedPayload.embeds.length === 0)) {
      return res.status(400).json({
        error: 'Invalid payload',
        message: 'Either content or embeds must be provided'
      });
    }
    
    // send to the cord with timeout and retry logic
    const axiosConfig = {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DiscordWebhookProxy/2.0.0 (by Minoa)'
      },
      maxRedirects: 0
    };
    
    let response;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        response = await axios.post(WEBHOOK_URL, sanitizedPayload, axiosConfig);
        break;
      } catch (error) {
        attempts++;
        
        if (error.response?.status === 429 && attempts < maxAttempts) {
          // rate limited by dc = wait and retry
          const retryAfter = error.response.headers['retry-after'] || 1;
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          continue;
        }
        
        throw error;
      }
    }
    
    const processingTime = Date.now() - startTime;
     
     res.status(200).json({
       success: true,
       message: 'Webhook delivered successfully',
       processingTime: `${processingTime}ms`,
       authenticated: req.isAuthenticated,
       ...(req.isAuthenticated ? {} : { hint: 'Add X-API-Key header for enhanced features and higher rate limits' })
     });
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    console.error(`[ERROR] Webhook delivery failed (${processingTime}ms):`, {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    // dont expose internal errors
    if (error.response?.status === 400) {
      return res.status(400).json({
        error: 'Discord webhook error',
        message: 'Invalid webhook payload or webhook not found'
      });
    }
    
    if (error.response?.status === 429) {
      return res.status(429).json({
        error: 'Rate limited',
        message: 'Discord API rate limit exceeded'
      });
    }
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to deliver webhook'
    });
  }
});

// global error handler
app.use((error, req, res, next) => {
  console.error('[FATAL ERROR]:', error);
  
  res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'Endpoint does not exist'
  });
});

// graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
app.listen(port, () => {
  console.log(`running on port ${port}`);
});
