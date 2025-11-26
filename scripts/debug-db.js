(async ()=>{
  try{
    const db = require('../db');
    const text = `SELECT code, target_url, total_clicks, created_at, last_clicked
                              FROM links
                              ORDER BY created_at DESC`;
    const r = await db.query(text, []);
    console.log('QUERY RESULT:', JSON.stringify(r));
  }catch(e){
    console.error('QUERY ERROR:', e);
  }
})();
