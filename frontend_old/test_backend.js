const https = require('https');

const data = JSON.stringify({
  title: "Test",
  description: "Test",
  category: "General",
  status: "Draft",
  settings: {},
  questions: []
});

const req = https.request({
  hostname: 'spark-innovation.onrender.com',
  port: 443,
  path: '/api/forms',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  },
  timeout: 10000 // 10 seconds timeout
}, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', (d) => process.stdout.write(d));
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.on('timeout', () => {
  console.error('Request timed out');
  req.destroy();
});

req.write(data);
req.end();
