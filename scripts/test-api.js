const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/links',
  method: 'GET',
  headers: { 'Accept': 'application/json' }
};

const req = http.request(options, (res) => {
  console.log('status', res.statusCode);
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('body:', data);
  });
});

req.on('error', (e) => console.error('request error', e));
req.end();
