const axios = require('axios');
require('dotenv').config();

// Configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error('❌ API_KEY not found in environment variables');
  process.exit(1);
}

// Test utilities
const makeRequest = async (method, path, data = null, headers = {}) => {
  try {
    const config = {
      method,
      url: `${BASE_URL}${path}`,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
        ...headers
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return { success: true, status: response.status, data: response.data };
  } catch (error) {
    return {
      success: false,
      status: error.response?.status || 0,
      data: error.response?.data || error.message
    };
  }
};

const runTest = async (name, testFn) => {
  try {
    console.log(`\n🧪 Testing: ${name}`);
    const result = await testFn();
    if (result.success) {
      console.log(`✅ PASS: ${name}`);
    } else {
      console.log(`❌ FAIL: ${name} - ${JSON.stringify(result.data)}`);
    }
    return result;
  } catch (error) {
    console.log(`❌ ERROR: ${name} - ${error.message}`);
    return { success: false, error: error.message };
  }
};

// Test cases
const tests = {
  // Health check test
  healthCheck: async () => {
    const result = await makeRequest('GET', '/health', null, { 'X-API-Key': undefined });
    return {
      success: result.success && result.status === 200,
      ...result
    };
  },

  // Valid webhook test (authenticated)
  validWebhookAuth: async () => {
    const payload = {
      content: '🧪 Test message from secure webhook proxy (authenticated)!',
      username: 'TestBot'
    };
    const result = await makeRequest('POST', '/', payload);
    return {
      success: result.success && result.status === 200 && result.data?.authenticated === true,
      ...result
    };
  },

  // Valid webhook test (unauthenticated)
  validWebhookUnauth: async () => {
    const payload = {
      content: '🧪 Test message from secure webhook proxy (unauthenticated)!',
      username: 'TestBot'
    };
    const result = await makeRequest('POST', '/', payload, { 'X-API-Key': undefined });
    return {
      success: result.success && result.status === 200 && result.data?.authenticated === false,
      ...result
    };
  },

  // Test without API key
  noApiKey: async () => {
    const payload = { content: 'This should fail' };
    const result = await makeRequest('POST', '/', payload, { 'X-API-Key': undefined });
    return {
      success: !result.success && result.status === 401,
      ...result
    };
  },

  // Test with invalid API key
  invalidApiKey: async () => {
    const payload = { content: 'This should fail' };
    const result = await makeRequest('POST', '/', payload, { 'X-API-Key': 'invalid-key' });
    return {
      success: !result.success && result.status === 401,
      ...result
    };
  },

  // DELETE method test (should return 418)
  deleteMethod: async () => {
    const result = await makeRequest('DELETE', '/');
    return {
      success: result.status === 418 && result.data?.error === "I'm a teapot",
      ...result
    };
  },

  // GET root endpoint test (mock webhook info)
  getRootEndpoint: async () => {
    const result = await makeRequest('GET', '/');
    return {
      success: result.status === 200 && result.data?.name === "Secure Webhook Proxy" && result.data?.id,
      ...result
    };
  },

  // Invalid method test (PUT should still be blocked)
  invalidMethod: async () => {
    const result = await makeRequest('PUT', '/');
    return {
      success: result.status === 405,
      ...result
    };
  },

  // Test empty payload
  emptyPayload: async () => {
    const result = await makeRequest('POST', '/', {});
    return {
      success: !result.success && result.status === 400,
      ...result
    };
  },

  // Test content too long
  contentTooLong: async () => {
    const payload = {
      content: 'A'.repeat(3000) // Exceeds MAX_CONTENT_LENGTH
    };
    const result = await makeRequest('POST', '/', payload);
    return {
      success: !result.success && result.status === 400,
      ...result
    };
  },

  // Test invalid username
  invalidUsername: async () => {
    const payload = {
      content: 'Test',
      username: 'invalid@username!' // Contains invalid characters
    };
    const result = await makeRequest('POST', '/', payload);
    return {
      success: !result.success && result.status === 400,
      ...result
    };
  },

  // Test invalid avatar URL
  invalidAvatarUrl: async () => {
    const payload = {
      content: 'Test',
      avatar_url: 'http://malicious-site.com/avatar.png' // HTTP instead of HTTPS
    };
    const result = await makeRequest('POST', '/', payload);
    return {
      success: !result.success && result.status === 400,
      ...result
    };
  },

  // Test valid embed
  validEmbed: async () => {
    const payload = {
      embeds: [{
        title: 'Test Embed',
        description: 'This is a test embed from the secure proxy',
        color: 0x00ff00,
        url: 'https://example.com'
      }]
    };
    const result = await makeRequest('POST', '/', payload);
    return {
      success: result.success && result.status === 200,
      ...result
    };
  },

  // Test too many embeds
  tooManyEmbeds: async () => {
    const embeds = Array(15).fill({ title: 'Test', description: 'Test' }); // Exceeds MAX_EMBEDS
    const payload = { embeds };
    const result = await makeRequest('POST', '/', payload);
    return {
      success: !result.success && result.status === 400,
      ...result
    };
  },

  // Test malformed JSON
  malformedJson: async () => {
    try {
      const response = await axios.post(`${BASE_URL}/`, 'invalid json', {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        }
      });
      return { success: false, status: response.status };
    } catch (error) {
      return {
        success: error.response?.status === 400,
        status: error.response?.status || 0,
        data: error.response?.data
      };
    }
  }
};

// Rate limiting test
const testRateLimit = async () => {
  console.log('\n🧪 Testing: Rate Limiting');
  const payload = { content: 'Rate limit test' };
  
  let successCount = 0;
  let rateLimitedCount = 0;
  
  // Send 10 requests rapidly
  const promises = Array(10).fill().map(async (_, i) => {
    const result = await makeRequest('POST', '/', { ...payload, content: `Rate limit test ${i}` });
    if (result.success) {
      successCount++;
    } else if (result.status === 429) {
      rateLimitedCount++;
    }
    return result;
  });
  
  await Promise.all(promises);
  
  console.log(`✅ Rate limiting working: ${successCount} successful, ${rateLimitedCount} rate limited`);
  return { success: rateLimitedCount > 0 };
};

// Main test runner
const runAllTests = async () => {
  console.log('🚀 Starting Discord Webhook Proxy Security Tests\n');
  console.log(`📡 Testing against: ${BASE_URL}`);
  console.log(`🔑 Using API Key: ${API_KEY.substring(0, 8)}...\n`);
  
  let passed = 0;
  let failed = 0;
  
  // Run individual tests
  for (const [testName, testFn] of Object.entries(tests)) {
    const result = await runTest(testName, testFn);
    if (result.success) {
      passed++;
    } else {
      failed++;
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Run rate limiting test
  const rateLimitResult = await testRateLimit();
  if (rateLimitResult.success) {
    passed++;
  } else {
    failed++;
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Your webhook proxy is secure and working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the configuration and try again.');
    process.exit(1);
  }
};

// Run tests
runAllTests().catch(error => {
  console.error('❌ Test runner failed:', error.message);
  process.exit(1);
});
