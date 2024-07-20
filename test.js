const axios = require('axios');
require('dotenv').config(); // Load environment variables from .env file

// Get the webhook URL from environment variable
const webhookUrl = process.env.WEBHOOK_URL;

// Test message payload
const payload = {
  content: 'This is a test message from the Node.js script!',
};

// Send the POST request to the webhook URL
axios.post(webhookUrl, payload)
  .then(response => {
    console.log('Message sent successfully:', response.data);
  })
  .catch(error => {
    console.error('Error sending message:', error.response ? error.response.data : error.message);
  });
