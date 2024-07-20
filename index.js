const express = require('express');
const axios = require('axios');
const rateLimit = require('express-rate-limit');

const app = express();
const port = 3000;

app.use(express.json());

// Rate limiting configuration
const rateLimitMiddleware = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 2, // limit each IP to 2 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use(rateLimitMiddleware);

const WEBHOOK_URL = 'https://discord.com/api/webhooks/1264349706557984841/lr5fa1XP4e80Ycf69wO_1p8tlbk-EW428TsIqRUrk9AmwVtP5n0y_J6M-XGIkjCnAfe1';

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

    await axios.post(WEBHOOK_URL, payload);
    res.status(200).send('Webhook sent successfully');
  } catch (error) {
    console.error('Error sending webhook:', error);
    res.status(500).send('Error sending webhook');
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
