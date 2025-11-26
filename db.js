const fs = require('fs');
const path = require('path');

// If a DATABASE_URL is provided, use Postgres. Otherwise use a
// small file-backed JSON store for local development so the API
// doesn't return 500s when Postgres isn't configured.
if (process.env.DATABASE_URL) {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  module.exports = {
    query: (text, params) => pool.query(text, params),
  };
} else {
  const DATA_DIR = path.resolve(__dirname, 'data');
  const DB_FILE = path.join(DATA_DIR, 'links.json');

  // Ensure data dir exists
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {}

  function load() {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      return [];
    }
  }

  function save(rows) {
    fs.writeFileSync(DB_FILE, JSON.stringify(rows, null, 2), 'utf8');
  }

  // simple helper to normalize row objects
  function makeRow(obj) {
    return Object.assign(
      {
        id: obj.id || null,
        code: obj.code,
        target_url: obj.target_url,
        total_clicks: obj.total_clicks || 0,
        created_at: obj.created_at || new Date().toISOString(),
        last_clicked: obj.last_clicked || null,
      },
      {}
    );
  }

  console.warn('DATABASE_URL not set — using file-backed dev database at', DB_FILE);

  module.exports = {
    // Minimal query(text, params) shim covering the queries used by server.js
    query: async (text, params) => {
      const rows = load();

      // INSERT INTO links (code, target_url)
      if (/INSERT\s+INTO\s+links/i.test(text)) {
        const code = params[0];
        const target_url = params[1];

        // Unique check
        if (rows.find((r) => r.code === code)) {
          const err = new Error('duplicate');
          err.code = '23505';
          throw err;
        }

        const id = rows.length ? Math.max(...rows.map((r) => r.id || 0)) + 1 : 1;
        const row = makeRow({ id, code, target_url });
        rows.push(row);
        save(rows);
        return { rows: [row], rowCount: 1 };
      }

      // SELECT ... FROM links ORDER BY created_at DESC
      if (/FROM\s+links/i.test(text) && /ORDER\s+BY/i.test(text) && !/WHERE/i.test(text)) {
        const out = [...rows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return { rows: out, rowCount: out.length };
      }

      // SELECT ... WHERE code = $1
      if (/WHERE\s+code\s*=\s*\$1/i.test(text)) {
        const code = params[0];
        const found = rows.filter((r) => r.code === code);
        return { rows: found, rowCount: found.length };
      }

      // UPDATE links SET total_clicks = total_clicks + 1, last_clicked = now() WHERE code = $1 RETURNING target_url
      if (/UPDATE\s+links\s+SET\s+total_clicks/i.test(text)) {
        const code = params[0];
        const idx = rows.findIndex((r) => r.code === code);
        if (idx === -1) return { rows: [], rowCount: 0 };
        rows[idx].total_clicks = (rows[idx].total_clicks || 0) + 1;
        rows[idx].last_clicked = new Date().toISOString();
        save(rows);
        return { rows: [{ target_url: rows[idx].target_url }], rowCount: 1 };
      }

      // DELETE FROM links WHERE code = $1 RETURNING code
      if (/DELETE\s+FROM\s+links/i.test(text)) {
        const code = params[0];
        const idx = rows.findIndex((r) => r.code === code);
        if (idx === -1) return { rows: [], rowCount: 0 };
        console.log('db.js: DELETE matched for code=', code, 'rows before=', rows.length);
        const [removed] = rows.splice(idx, 1);
        console.log('db.js: removed=', removed);
        save(rows);
        console.log('db.js: rows after save=', load().length);
        return { rows: [{ code: removed.code }], rowCount: 1 };
      }

      // fallback: return empty
      return { rows: [], rowCount: 0 };
    },
    // Delete a link by code and return deleted row (or null)
    deleteLink: async (code) => {
      const rows = load();
      const idx = rows.findIndex((r) => r.code === code);
      if (idx === -1) return { rowCount: 0, rows: [] };
      const [removed] = rows.splice(idx, 1);
      save(rows);
      return { rowCount: 1, rows: [removed] };
    },
    // Increment clicks for a code and return target_url (or null)
    incrementClicks: async (code) => {
      const rows = load();
      const idx = rows.findIndex((r) => r.code === code);
      if (idx === -1) return { rowCount: 0, rows: [] };
      rows[idx].total_clicks = (rows[idx].total_clicks || 0) + 1;
      rows[idx].last_clicked = new Date().toISOString();
      save(rows);
      return { rowCount: 1, rows: [rows[idx]] };
    },
  };
}
