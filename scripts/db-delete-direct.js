(async ()=>{
  const db = require('../db');
  try{
    console.log('Before load', JSON.stringify(require('fs').readFileSync(require('path').resolve(__dirname,'..','data','links.json'),'utf8')));
  }catch(e){console.log('no file before')}
  try{
    const r = await db.query('DELETE FROM links WHERE code = $1 RETURNING code', ['abc123']);
    console.log('db.query returned', r);
  }catch(e){console.error('query error', e)}
  try{
    console.log('After load', JSON.stringify(require('fs').readFileSync(require('path').resolve(__dirname,'..','data','links.json'),'utf8')));
  }catch(e){console.log('no file after')}
})();
