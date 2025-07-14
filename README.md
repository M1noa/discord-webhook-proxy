# Discord Webhook Proxy
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FM1noa%2Fdiscord-webhook-proxy&env=WEBHOOK_ID,WEBHOOK_CODE&envDescription=discord.com%2Fapi%2Fwebhooks%2F%7BTHIS%20IS%20THE%20ID!!%7D%2F%7BTHIS%20IS%20THE%20CODE!!!%7D&project-name=webhookproxy&repository-name=Webhook-Proxy)

## ✨ Features

### Features
- Rate Limiting
- Method Filtering - POST for webhooks, GET for info, DELETE returns 418 (teapot)
- Retry Logic
- Timeout
- Health Check Endpoint
- Content Length Limits

## Quick Start

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/M1noa/discord-webhook-proxy.git
cd discord-webhook-proxy

# Install dependencies
npm install
```

### 2. Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Discord Webhook Configuration (REQUIRED)
WEBHOOK_ID=your_webhook_id_here
WEBHOOK_TOKEN=your_webhook_token_here

# Security Configuration (OPTIONAL)
# Leave empty or remove for no authentication (drop-in Discord webhook replacement)
# Set to enable enhanced security features and higher rate limits
API_KEY=your_secure_api_key_here

# Proxy Configuration (set to true if behind Cloudflare/Vercel)
BEHIND_PROXY=false

# Optional: Customize limits
RATE_LIMIT_MAX=5
MAX_CONTENT_LENGTH=2000
```

### 3. Get Your Discord Webhook

1. Go to your Discord server settings
2. Navigate to **Integrations** → **Webhooks**
3. Create a new webhook or edit an existing one
4. Copy the webhook URL: `https://discord.com/api/webhooks/WEBHOOK_ID/WEBHOOK_TOKEN`
5. Extract the `WEBHOOK_ID` and `WEBHOOK_TOKEN` from the URL

### 4. Generate API Key

```bash
# Generate a secure API key (OPTIONAL)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Start the Server

```bash
# Development
npm run dev

# Production
npm start
```

## Usage

### Drop-in Discord Webhook Replacement (No API Key)

Replace your Discord webhook URL with the proxy URL for instant spam protection:

```bash
# Instead of: https://discord.com/api/webhooks/ID/TOKEN
# Use: http://localhost:3000/

curl -X POST http://localhost:3000/ \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Give us a star :D",
    "username": "ProxyBot"
  }'
```

### 🔐 Enhanced Security with API Key

Add an API key for higher rate limits and enhanced features:

```bash
curl -X POST http://localhost:3000/ \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key_here" \
  -d '{
    "content": "PLEASEE I NEED THE STARS!",
    "username": "SecureBot"
  }'
```

### With Embeds

```bash
curl -X POST http://localhost:3000/ \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key_here" \
  -d '{
    "embeds": [{
      "title": "Secure Notification",
      "description": "IM BEGGING I NEED STARS SO BADLY",
      "color": 65280,
      "url": "https://example.com"
    }]
  }'
```

### JavaScript Example

```javascript
const axios = require('axios');

const sendWebhook = async () => {
  try {
    const response = await axios.post('http://localhost:3000/', {
      content: 'IM BEGGING YOU!',
      username: 'JSBot',
      avatar_url: 'https://cdn.discordapp.com/avatars/123/avatar.png'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'your_api_key_here'
      }
    });
    
    console.log('✅ Webhook sent:', response.data);
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
};

sendWebhook();
```

### Alternative: Bearer Token (Authenticated Only)

```bash
curl -X POST http://localhost:3000/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_api_key_here" \
  -d '{"content": "Hello World!"}'
```

### 📋 Get Webhook Information

Retrieve mock Discord webhook information (obfuscated for security):

```bash
curl -X GET http://localhost:3000/
```

Response:
```json
{
  "application_id": null,
  "avatar": null,
  "channel_id": "9876543210123456789",
  "guild_id": "1234567890987654321",
  "id": "5647382910384756291",
  "name": "Secure Webhook Proxy",
  "type": 1,
  "token": "AbC123XyZ789MnOpQrStUvWxYz456DeF789GhIjKlMnOpQrStUvWxYzAbC123XyZ",
  "url": "https://discord.com/api/webhooks/5647382910384756291/AbC123XyZ789MnOpQrStUvWxYz456DeF789GhIjKlMnOpQrStUvWxYzAbC123XyZ"
}
```

### ☕ Anti-Deletion Protection

DELETE requests are blocked with a humorous 418 "I'm a teapot" response:

```bash
curl -X DELETE http://localhost:3000/
```

Response:
```json
{
  "error": "I'm a teapot",
  "message": "Cannot brew coffee, I'm a webhook proxy teapot",
  "code": 418
}
```

## 🔄 Authentication Modes

### unauthenticated Mode (Default)
- **Rate Limit**: 3 requests per minute
- **Use Case**: Drop-in replacement for Discord webhooks
- **Setup**: Just replace your Discord webhook URL
- **Response**: Includes hint about API key benefits

### authenticated Mode (With API Key)
- **Rate Limit**: 9 requests per minute (3x higher)
- **Use Case**: Custom applications requiring higher throughput
- **Setup**: Add `X-API-Key` header or `Authorization: Bearer` token
- **Response**: Enhanced features and priority processing

## Testing

```bash
npm test
```

The test suite validates:
- ✅ API key authentication
- ✅ Rate limiting functionality
- ✅ Input validation
- ✅ Method filtering
- ✅ Content length limits
- ✅ Embed validation
- ✅ URL validation
- ✅ Error handling

## 🌐 Deployment

### Vercel

1. Set environment variables in Vercel dashboard
2. Set `BEHIND_PROXY=true`
3. Deploy using the included `vercel.json`

### Cloudflare Workers

1. Set `BEHIND_PROXY=true`
2. Configure environment variables
3. Deploy using Wrangler

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🔧 Configuration Options

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `WEBHOOK_ID` | **Required** | Discord webhook ID |
| `WEBHOOK_TOKEN` | **Required** | Discord webhook token |
| `API_KEY` | Optional | API authentication key (enables enhanced features) |
| `BEHIND_PROXY` | `false` | Enable proxy IP detection |
| `RATE_LIMIT_WINDOW` | `60000` | Rate limit window (ms) |
| `RATE_LIMIT_MAX` | `5` | Max requests per window |
| `MAX_CONTENT_LENGTH` | `2000` | Max content characters |
| `MAX_EMBEDS` | `10` | Max embeds per request |

## Security Features Explained

### Rate Limiting
- IP-based rate limiting with configurable windows
- Hashed IP addresses for privacy
- Separate limits for different endpoints
- Automatic retry-after headers

### Input Validation
- Strict type checking for all fields
- Content length limits
- Username character validation
- URL validation with domain whitelisting
- Embed structure validation

### Authentication
- API key required for all webhook requests
- Support for `X-API-Key` header or `Authorization: Bearer`
- Cryptographically secure key generation

### Proxy Support
- Automatic IP detection behind proxies
- Support for Cloudflare, Vercel, and other CDNs
- Proper handling of forwarded headers

## Monitoring

### Health Check

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "2.0.0-secure"
}
```

### Logs

The proxy logs all requests with:
- Timestamp
- Method and path
- Truncated IP address
- User agent
- Processing time
- Error details (if any)

## Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| `400` | Validation failed | Invalid request payload |
| `401` | Unauthorized | Missing or invalid API key |
| `405` | Method not allowed | Non-POST request to webhook endpoint |
| `429` | Rate limit exceeded | Too many requests |
| `500` | Internal server error | Server or Discord API error |

## 🔒 Security Best Practices

1. **Use HTTPS** - Always deploy with SSL/TLS
2. **Rotate API Keys** - Regularly update your API keys
3. **Monitor Logs** - Watch for suspicious activity
4. **Set Strict Limits** - Configure appropriate rate limits
5. **Use Environment Variables** - Never hardcode secrets
6. **Keep Updated** - Regularly update dependencies

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

Created by **Minoa** - A secure, production-ready Discord webhook proxy.

---

**⚡ Ready to proxy webhooks securely!**
