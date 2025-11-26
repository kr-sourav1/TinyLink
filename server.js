// server.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const cors = require('cors');
const validUrl = require('valid-url');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Middlewares
app.use(helmet());
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // serves index.html and code.html

// Helper: validate code pattern
const CODE_REGEX = /^[A-Za-z0-9]{6,8}$/;
function isValidCode(code) {
  return CODE_REGEX.test(code);
}

// Health check
app.get('/healthz', (req, res) => {
  res.json({ ok: true, version: '1.0' });
});

/**
 * API: Create link
 * POST /api/links
 * body: { target_url: string, code?: string }
 * Responses:
 * 201 with created link object on success
 * 400 bad request (invalid URL or code)
 * 409 conflict (code exists)
 */
app.post('/api/links', async (req, res) => {
  try {
    const { target_url, code } = req.body || {};
    if (!target_url || typeof target_url !== 'string') {
      return res.status(400).json({ error: 'target_url required' });
    }

    // Validate URL - allow http(s) only
    if (!validUrl.isWebUri(target_url)) {
      return res.status(400).json({ error: 'Invalid target_url. Use http(s) URL.' });
    }

    // If no code provided, generate random 6-char code until unused
    let chosenCode = code && typeof code === 'string' ? code.trim() : null;
    if (chosenCode) {
      if (!isValidCode(chosenCode)) {
        return res.status(400).json({ error: 'code must match ^[A-Za-z0-9]{6,8}$' });
      }
    } else {
      // generate (A-Za-z0-9) 6-char
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      function gen(n = 6) {
        let s = '';
        for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
        return s;
      }
      // try up to e.g., 5 times
      for (let i = 0; i < 5; i++) {
        const cand = gen(6);
        const r = await db.query('SELECT 1 FROM links WHERE code = $1', [cand]);
        if (r.rowCount === 0) {
          chosenCode = cand;
          break;
        }
      }
      if (!chosenCode) {
        // fallback: expand to 7 chars
        chosenCode = gen(7);
      }
    }

    // Insert; handle unique violation (409)
    const insertText = `
      INSERT INTO links (code, target_url)
      VALUES ($1, $2)
      RETURNING code, target_url, total_clicks, created_at, last_clicked
    `;
    try {
      const r = await db.query(insertText, [chosenCode, target_url]);
      const row = r.rows[0];
      return res.status(201).json(row);
    } catch (err) {
      // Unique violation => code exists
      if (err.code === '23505') {
        return res.status(409).json({ error: 'code already exists' });
      }
      console.error('Insert error', err);
      return res.status(500).json({ error: 'internal error' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  }
});

/**
 * GET /api/links
 * List all links
 * Response: [{ code, target_url, total_clicks, created_at, last_clicked }, ...]
 */
app.get('/api/links', async (req, res) => {
  try {
    console.log('API /api/links handler: about to query DB');
    const r = await db.query(`SELECT code, target_url, total_clicks, created_at, last_clicked
                              FROM links
                              ORDER BY created_at DESC`);
    console.log('API /api/links handler: query returned', Array.isArray(r.rows) ? r.rows.length : typeof r.rows);
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  }
});

/**
 * GET /api/links/:code
 * Stats for one code
 * 200 with row or 404 if not found
 */
app.get('/api/links/:code', async (req, res) => {
  const { code } = req.params;
  if (!isValidCode(code)) return res.status(400).json({ error: 'Invalid code format' });
  try {
    const r = await db.query(
      `SELECT code, target_url, total_clicks, created_at, last_clicked FROM links WHERE code = $1`,
      [code]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  }
});

/**
 * DELETE /api/links/:code
 * Delete link
 * 200 on success (maybe respond with { ok: true }), or 404 if not found
 */
app.delete('/api/links/:code', async (req, res) => {
  const { code } = req.params;
  if (!isValidCode(code)) return res.status(400).json({ error: 'Invalid code format' });
  try {
    // Use a helper that works across Postgres and file-backed DB
    if (typeof db.deleteLink === 'function') {
      const r = await db.deleteLink(code);
      if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
      return res.json({ ok: true });
    }
    const r = await db.query(`DELETE FROM links WHERE code = $1 RETURNING code`, [code]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  }
});

/**
 * Stats page route (server serves frontend file)
 * Route: /code/:code  -> client-side code.html will fetch /api/links/:code
 * Note: serve static files from 'public' so index.html and code.html work.
 */
app.get('/code/:code', (req, res, next) => {
  // Let static /public/code.html handle this — ensure it exists.
  res.sendFile(require('path').resolve(__dirname, 'public', 'code.html'));
});

/**
 * Redirect route: /:code
 * Must come AFTER /code/:code and /healthz and other static routes to avoid clash.
 * On success: HTTP 302 -> target_url; increment total_clicks and update last_clicked
 * If not found -> 404
 */
app.get('/:code', async (req, res) => {
  const { code } = req.params;
  if (!isValidCode(code)) return res.status(404).send('Not found');
  try {
    // Use helper that works for both Postgres and file-backed DB.
    if (typeof db.incrementClicks === 'function') {
      const r = await db.incrementClicks(code);
      if (r.rowCount === 0) return res.status(404).send('Not found');
      return res.redirect(302, r.rows[0].target_url);
    }
    const q = `
      UPDATE links
      SET total_clicks = total_clicks + 1,
          last_clicked = now()
      WHERE code = $1
      RETURNING target_url
    `;
    const r = await db.query(q, [code]);
    if (r.rowCount === 0) {
      return res.status(404).send('Not found');
    }
    const target = r.rows[0].target_url;
    return res.redirect(302, target);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal error');
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`TinyLink running on ${BASE_URL} (port ${PORT})`);
});
