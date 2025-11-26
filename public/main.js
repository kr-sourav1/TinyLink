document.addEventListener('DOMContentLoaded', () => {
  const api = '/api/links';
  const tbody = document.getElementById('tbody');
  const msg = document.getElementById('msg');
  const submitBtn = document.getElementById('submitBtn');
  const form = document.getElementById('createForm');

  async function fetchLinks() {
    const r = await fetch(api);
    return r.json();
  }

  function truncate(s, n = 80) {
    if (!s) return '';
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  async function load() {
    tbody.innerHTML =
      '<tr><td colspan="5" class="py-8 text-center text-gray-500">Loading...</td></tr>';

    try {
      const links = await fetchLinks();
      if (!links.length) {
        tbody.innerHTML =
          '<tr><td colspan="5" class="py-8 text-center text-gray-500">No links yet</td></tr>';
        return;
      }

      tbody.innerHTML = '';

      for (const l of links) {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td class="py-2"><a href="/${l.code}" class="text-blue-600 font-medium">${l.code}</a></td>
          <td class="py-2"><a href="${l.target_url}" target="_blank" rel="noopener noreferrer"
                 title="${l.target_url}">${truncate(l.target_url)}</a></td>
          <td class="py-2">${l.total_clicks}</td>
          <td class="py-2">${l.last_clicked ? new Date(l.last_clicked).toLocaleString() : '-'}</td>
          <td class="py-2">
            <button data-code="${l.code}" class="delBtn px-2 py-1 border rounded text-sm">Delete</button>
            <button data-code="${l.code}" class="copyBtn px-2 py-1 border rounded text-sm ml-2">Copy</button>
            <a href="/code/${l.code}" class="ml-2 text-sm text-gray-600">Stats</a>
          </td>
        `;
        tbody.appendChild(row);
      }
    } catch (err) {
      tbody.innerHTML =
        '<tr><td colspan="5" class="py-8 text-center text-red-600">Error loading links</td></tr>';
    }
  }

  // Delete and Copy buttons
  document.addEventListener('click', async (e) => {
    if (e.target.matches('.delBtn')) {
      const code = e.target.dataset.code;
      if (!confirm('Delete ' + code + '?')) return;

      const r = await fetch(`/api/links/${code}`, { method: 'DELETE' });
      if (r.ok) load();
      else alert('Could not delete');
    }

    if (e.target.matches('.copyBtn')) {
      const code = e.target.dataset.code;
      const url = `${location.origin}/${code}`;
      await navigator.clipboard.writeText(url);
      alert('Copied: ' + url);
    }
  });

  // Create link form
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    submitBtn.disabled = true;
    msg.textContent = '';

    const target_url = document.getElementById('target_url').value.trim();
    const code = document.getElementById('code').value.trim();

    try {
      const res = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_url,
          code: code || undefined,
        }),
      });

      const data = await res.json();

      if (res.status === 201) {
        msg.textContent = 'Created!';
        document.getElementById('target_url').value = '';
        document.getElementById('code').value = '';
        load();
      } else if (res.status === 409) {
        msg.textContent = data.error || 'Code exists';
        msg.style.color = 'red';
      } else {
        msg.textContent = data.error || 'Error';
        msg.style.color = 'red';
      }
    } catch (err) {
      msg.textContent = 'Network error';
      msg.style.color = 'red';
    } finally {
      submitBtn.disabled = false;
      setTimeout(() => {
        msg.textContent = '';
        msg.style.color = '';
      }, 3000);
    }
  });

  // Filter
  document.getElementById('filter').addEventListener('input', (ev) => {
    const q = ev.target.value.toLowerCase();
    document.querySelectorAll('#tbody tr').forEach((tr) => {
      tr.style.display = tr.innerText.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  load();
});
