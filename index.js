const express = require('express');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
require('dotenv').config(); // Load environment variables

const app = express();
const port = 3000;

const webhookId = process.env.WEBHOOK_ID;
const webhookCode = process.env.WEBHOOK_CODE;
const webhookUrl = `https://discord.com/api/webhooks/${webhookId}/${webhookCode}`;

app.use(express.json());
app.use(cors()); // Enable CORS for all routes

// Rate limiting configuration
const rateLimitMiddleware = rateLimit({
  windowMs: 45 * 1000, // 45 seconds
  max: 2, // limit each IP to 2 requests per IP
  message: 'Too many requests, please try again later.'
});

// Middleware to log requests and check rate limiting
app.use((req, res, next) => {
  console.log(`Request from IP: ${req.ip}`);
  console.log(`Request Method: ${req.method}`);
  
  // Log if rate limiting is applied
  if (req.rateLimit) {
    console.log(`Rate Limit Remaining: ${req.rateLimit.remaining}`);
    console.log(`Rate Limit Reset Time: ${new Date(req.rateLimit.resetTime).toLocaleString()}`);
  }
  
  next();
});

app.use(rateLimitMiddleware);

// Middleware to block DELETE requests
app.use((req, res, next) => {
  if (req.method === 'DELETE') {
    return res.status(405).send('Method Not Allowed');
  }
  next();
});

// Handle incoming webhook requests
app.post('*', async (req, res) => {
  try {
    const payload = {
      content: req.body.content || '',
      username: req.body.username || undefined,
      avatar_url: req.body.avatar_url || undefined,
      embeds: req.body.embeds || []
    };

    // Remove undefined fields
    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

    await axios.post(webhookUrl, payload);
    res.status(200).send('Webhook sent successfully');
  } catch (error) {
    console.error('Error sending webhook:', error);
    res.status(500).send('Error sending webhook');
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
