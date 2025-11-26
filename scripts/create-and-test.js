const http = require('http');

function request(opts, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

(async ()=>{
  try{
    // 1) Create a link
    const postBody = JSON.stringify({ target_url: 'https://example.com/test', code: 'abc123' });
    const post = await request({ hostname:'localhost', port:3000, path:'/api/links', method:'POST', headers:{ 'Content-Type':'application/json','Content-Length': Buffer.byteLength(postBody)} }, postBody);
    console.log('POST /api/links ->', post.status, post.body);

    // 2) GET /api/links
    const get1 = await request({ hostname:'localhost', port:3000, path:'/api/links', method:'GET' });
    console.log('GET /api/links ->', get1.status, get1.body);

    // 3) DELETE the code
    const del = await request({ hostname:'localhost', port:3000, path:'/api/links/abc123', method:'DELETE' });
    console.log('DELETE /api/links/abc123 ->', del.status, del.body);

    // 4) GET again
    const get2 = await request({ hostname:'localhost', port:3000, path:'/api/links', method:'GET' });
    console.log('GET /api/links ->', get2.status, get2.body);

    // 5) Create again to test redirect click increment
    const post2Body = JSON.stringify({ target_url: 'https://example.com/clicktest', code: 'click1' });
    await request({ hostname:'localhost', port:3000, path:'/api/links', method:'POST', headers:{ 'Content-Type':'application/json','Content-Length': Buffer.byteLength(post2Body)} }, post2Body);
    console.log('Created click1');

    // 6) Simulate redirect GET /click1
    const redirect = await request({ hostname:'localhost', port:3000, path:'/click1', method:'GET' });
    console.log('GET /click1 ->', redirect.status, redirect.body);

    // 7) GET /api/links to see clicks
    const get3 = await request({ hostname:'localhost', port:3000, path:'/api/links', method:'GET' });
    console.log('GET /api/links ->', get3.status, get3.body);
  }catch(e){
    console.error('test error', e);
  }
})();
