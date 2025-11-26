CREATE TABLE IF NOT EXISTS links (
  id SERIAL PRIMARY KEY,
  code VARCHAR(8) UNIQUE NOT NULL,
  target_url TEXT NOT NULL,
  total_clicks INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_clicked TIMESTAMP WITH TIME ZONE NULL
);

-- Index for lookup by code (unique already covers it)
CREATE UNIQUE INDEX IF NOT EXISTS idx_links_code ON links(code);
