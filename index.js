/* =====================================================
   RoastMyTaste
   APIs: MusicBrainz (artist search) · Groq (roast AI)
   Storage: localStorage
   ===================================================== */

const GROQ_URL   = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const MB_URL     = 'https://musicbrainz.org/ws/2/artist/';
const DB_KEY     = 'roastmytaste_roasts';

// ── App state ─────────────────────────────────────────
const state = {
  artists:   [],
  vibes:     [],
  intensity: 'mild',
  current:   null,
};

// ── DOM helper ────────────────────────────────────────
const $ = id => document.getElementById(id);
let suggestTimer = null;

// ═══════════════════════════════════════
//  VIEW SWITCHING
// ═══════════════════════════════════════

function showView(name) {
  document.querySelectorAll('.view').forEach(v => {
    v.classList.remove('active');
    v.classList.add('hidden');
  });
  const target = $(`view-${name}`);
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('active');
  }
  document.querySelectorAll('.nav-item[data-view]').forEach(link => {
    link.classList.toggle('active', link.dataset.view === name);
  });
  if (name === 'saved') renderSavedView();
}

document.querySelectorAll('.nav-item[data-view]').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    showView(link.dataset.view);
  });
});

$('go-home-btn').addEventListener('click', () => showView('home'));
$('roast-again-btn').addEventListener('click', () => showView('home'));

// ═══════════════════════════════════════
//  ARTIST MANAGEMENT
// ═══════════════════════════════════════

function addArtist(name) {
  const n = name.trim();
  if (!n) return;
  if (state.artists.some(a => a.toLowerCase() === n.toLowerCase())) {
    showToast('Artist already added');
    return;
  }
  if (state.artists.length >= 10) { showToast('Max 10 artists'); return; }
  state.artists.push(n);
  renderChips();
  hideSuggestions();
}

function removeArtist(name) {
  state.artists = state.artists.filter(a => a !== name);
  renderChips();
}

function renderChips() {
  const row = $('artist-chips');
  row.innerHTML = '';
  state.artists.forEach(name => {
    const chip = document.createElement('span');
    chip.className = 'artist-chip';
    chip.innerHTML =
      `🎤 ${escHtml(name)} ` +
      `<button class="chip-remove" aria-label="Remove ${escHtml(name)}">×</button>`;
    chip.querySelector('.chip-remove').addEventListener('click', () => removeArtist(name));
    row.appendChild(chip);
  });
  // pulse button when artists are ready
  $('roast-btn').classList.toggle('ready', state.artists.length > 0);
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ═══════════════════════════════════════
//  ARTIST SEARCH — MusicBrainz API
// ═══════════════════════════════════════

const artistInput = $('artist-input');
const suggestBox  = $('search-suggestions');

artistInput.addEventListener('input', () => {
  clearTimeout(suggestTimer);
  const q = artistInput.value.trim();
  if (q.length < 2) { hideSuggestions(); return; }
  suggestTimer = setTimeout(() => fetchSuggestions(q), 320);
});

artistInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const val = artistInput.value.trim();
    if (val) { addArtist(val); artistInput.value = ''; }
  }
  if (e.key === 'Escape') hideSuggestions();
});

async function fetchSuggestions(query) {
  try {
    const url = `${MB_URL}?query=artist:${encodeURIComponent(query)}&limit=5&fmt=json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'RoastMyTaste/1.0 (school project)' },
    });
    if (!res.ok) return;
    const data = await res.json();
    showSuggestions(data.artists || []);
  } catch {
    hideSuggestions();
  }
}

function showSuggestions(artists) {
  if (!artists.length) { hideSuggestions(); return; }
  suggestBox.innerHTML = '';
  artists.slice(0, 5).forEach(a => {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    const sub = a.disambiguation
      ? `<span class="suggestion-type">${escHtml(a.disambiguation)}</span>` : '';
    item.innerHTML = `<span class="suggestion-name">🎤 ${escHtml(a.name)}</span>${sub}`;
    item.addEventListener('mousedown', e => {
      e.preventDefault();
      addArtist(a.name);
      artistInput.value = '';
    });
    suggestBox.appendChild(item);
  });
  suggestBox.classList.remove('hidden');
}

function hideSuggestions() {
  suggestBox.classList.add('hidden');
  suggestBox.innerHTML = '';
}

document.addEventListener('click', e => {
  if (!e.target.closest('#search-suggestions') && !e.target.closest('#artist-input')) {
    hideSuggestions();
  }
});

// ═══════════════════════════════════════
//  TRENDING CHIPS
// ═══════════════════════════════════════

document.querySelectorAll('.trend-chip').forEach(chip => {
  chip.addEventListener('click', () => addArtist(chip.dataset.artist));
});

// ═══════════════════════════════════════
//  INTENSITY & VIBE SELECTORS
// ═══════════════════════════════════════

document.querySelectorAll('.intensity-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.intensity-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.intensity = btn.dataset.level;
  });
});

document.querySelectorAll('.vibe-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    pill.classList.toggle('active');
    const genre = pill.dataset.genre;
    const idx   = state.vibes.indexOf(genre);
    if (idx > -1) state.vibes.splice(idx, 1);
    else state.vibes.push(genre);
  });
});

// ═══════════════════════════════════════
//  SETTINGS / API KEY
// ═══════════════════════════════════════

function getKey() { return localStorage.getItem('groq_key') || ''; }
function hasKey() { return !!getKey(); }

function checkBanner() {
  $('api-banner').classList.toggle('hidden', hasKey());
}

function openSettings() {
  $('api-key-input').value = getKey();
  $('settings-modal').classList.remove('hidden');
}

function closeSettings() {
  $('settings-modal').classList.add('hidden');
}

$('settings-btn').addEventListener('click', openSettings);
$('banner-key-btn').addEventListener('click', openSettings);
$('modal-bg').addEventListener('click', closeSettings);
$('modal-close').addEventListener('click', closeSettings);
$('cancel-btn').addEventListener('click', closeSettings);

$('save-key-btn').addEventListener('click', () => {
  const key = $('api-key-input').value.trim();
  localStorage.setItem('groq_key', key);
  closeSettings();
  checkBanner();
  showToast(key ? '✅ API key saved!' : '⚠️ API key cleared');
});

// ═══════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════

let toastTimer;
function showToast(msg, ms = 2800) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
}

// ═══════════════════════════════════════
//  GROQ API — GENERATE ROAST
// ═══════════════════════════════════════

async function generateRoast() {
  if (!hasKey()) { openSettings(); return; }
  if (state.artists.length === 0) { showToast('Add at least one artist first!'); return; }

  const intensityDesc = {
    mild:    'gentle, playful, and light-hearted',
    medium:  'moderately savage and witty',
    nuclear: 'absolutely devastating — go all out (keep it PG-13)',
  };
  const vibeText = state.vibes.length ? state.vibes.join(', ') : 'a mix of genres';

  const prompt =
    `You are a hilarious music roast comedian. Your roasts are clever, observational, and school-appropriate (PG-13 max).\n\n` +
    `Artists the user listens to: ${state.artists.join(', ')}\n` +
    `Preferred genres/vibes: ${vibeText}\n` +
    `Roast intensity: ${intensityDesc[state.intensity]}\n\n` +
    `Reply ONLY with valid JSON — no extra text, no markdown fences:\n` +
    `{\n` +
    `  "title": "a creative 3-5 word name for their music taste",\n` +
    `  "roast": "a 2-3 sentence roast referencing these specific artists",\n` +
    `  "archetype": "listener archetype in 2-4 words",\n` +
    `  "mainstream_score": <integer 0-100>,\n` +
    `  "icon": "<single emoji>"\n` +
    `}`;

  $('loading-overlay').classList.remove('hidden');
  $('roast-btn').disabled = true;

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${getKey()}`,
      },
      body: JSON.stringify({
        model:       GROQ_MODEL,
        messages:    [{ role: 'user', content: prompt }],
        temperature: 0.92,
        max_tokens:  400,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error ${res.status}`);
    }

    const data  = await res.json();
    const raw   = data.choices[0].message.content;
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Unexpected response format from AI');

    const parsed = JSON.parse(match[0]);
    const now    = new Date();

    state.current = {
      id:               Date.now().toString(),
      title:            parsed.title            || 'Untitled Roast',
      roast:            parsed.roast            || raw,
      archetype:        parsed.archetype        || 'Unique Listener',
      mainstream_score: Math.min(100, Math.max(0, parsed.mainstream_score ?? 50)),
      icon:             parsed.icon             || '🔥',
      artists:          [...state.artists],
      vibes:            [...state.vibes],
      intensity:        state.intensity,
      date:             now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      timestamp:        now.getTime(),
    };

    displayResults(state.current);
    addToHistory(state.current);

  } catch (err) {
    showToast(`❌ ${err.message}`, 4500);
    console.error('Roast error:', err);
  } finally {
    $('loading-overlay').classList.add('hidden');
    $('roast-btn').disabled = false;
  }
}

function displayResults(roast) {
  $('result-thumb').textContent   = roast.icon;
  $('result-date').textContent    = roast.date.toUpperCase();
  $('result-title').textContent   = roast.title;
  $('result-artists').textContent =
    `${roast.artists.join(' · ')} · ${roast.artists.length} artist${roast.artists.length !== 1 ? 's' : ''} analyzed`;
  $('stat-score').textContent     = `${roast.mainstream_score}%`;
  $('stat-archetype').textContent = roast.archetype;
  $('stat-count').textContent     = roast.artists.length;
  $('stat-intensity').textContent =
    { mild: '🎵 Mild', medium: '🔥 Medium', nuclear: '💀 Nuclear' }[roast.intensity];

  // typewriter animation on roast text
  typewriter($('result-roast'), roast.roast);

  // animated score bar
  const bar = $('score-bar');
  if (bar) { bar.style.width = '0'; setTimeout(() => { bar.style.width = `${roast.mainstream_score}%`; }, 80); }

  const saveBtn = $('save-btn');
  const saved   = isRoastSaved(roast.id);
  saveBtn.classList.toggle('saved', saved);
  saveBtn.textContent = saved ? '✅' : '💾';

  showView('results');
}

$('roast-btn').addEventListener('click', generateRoast);

// Ctrl+Enter shortcut to roast from anywhere on home view
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.ctrlKey && $('view-home').classList.contains('active')) {
    generateRoast();
  }
});

// ═══════════════════════════════════════
//  COPY & SHARE
// ═══════════════════════════════════════

$('copy-btn').addEventListener('click', () => {
  if (!state.current) return;
  const text =
    `🔥 RoastMyTaste\n"${state.current.roast}"\nArtists: ${state.current.artists.join(', ')}`;
  navigator.clipboard.writeText(text).then(() => showToast('📋 Copied to clipboard!'));
});

$('share-btn').addEventListener('click', () => {
  if (!state.current) return;
  if (navigator.share) {
    navigator.share({ title: '🔥 ' + state.current.title, text: state.current.roast, url: location.href });
  } else {
    $('copy-btn').click();
  }
});

// ═══════════════════════════════════════
//  LOCALSTORAGE DATABASE
// ═══════════════════════════════════════

function loadDB() {
  try { return JSON.parse(localStorage.getItem(DB_KEY)) || []; }
  catch { return []; }
}

function saveDB(roasts) {
  localStorage.setItem(DB_KEY, JSON.stringify(roasts));
}

// ── History ───────────────────────────────────────────
function addToHistory(roast) {
  const roasts = loadDB();
  if (!roasts.find(r => r.id === roast.id)) {
    roasts.unshift(roast);
    if (roasts.length > 50) roasts.length = 50;
    saveDB(roasts);
  }
  renderHistorySidebar();
  updateCountBadge();
}

function renderHistorySidebar() {
  const list   = $('history-list');
  const roasts = loadDB();

  if (!roasts.length) {
    list.innerHTML = '<p style="font-size:0.76rem;color:var(--txt3);padding:6px 4px">No roasts yet</p>';
    return;
  }

  list.innerHTML = '';
  roasts.slice(0, 8).forEach(r => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
      <div class="history-thumb">${escHtml(r.icon)}</div>
      <div class="history-info">
        <div class="history-title">${escHtml(r.title)}</div>
        <div class="history-sub">Roast · ${escHtml(r.date)}</div>
      </div>`;
    item.addEventListener('click', () => {
      state.current = r;
      displayResults(r);
    });
    list.appendChild(item);
  });
}

$('clear-history-btn').addEventListener('click', () => {
  if (!confirm('Clear all roast history?')) return;
  saveDB([]);
  renderHistorySidebar();
  updateCountBadge();
  showToast('History cleared');
});

// ── Save / unsave ─────────────────────────────────────
function isRoastSaved(id) {
  return loadDB().some(r => r.id === id && r.saved);
}

function toggleSave(roast) {
  const roasts = loadDB();
  const found  = roasts.find(r => r.id === roast.id);
  if (found) {
    found.saved = !found.saved;
    saveDB(roasts);
    return found.saved;
  } else {
    roast.saved = true;
    roasts.unshift(roast);
    saveDB(roasts);
    return true;
  }
}

$('save-btn').addEventListener('click', () => {
  if (!state.current) return;
  const nowSaved = toggleSave(state.current);
  const btn      = $('save-btn');
  btn.classList.toggle('saved', nowSaved);
  btn.textContent = nowSaved ? '✅' : '💾';
  showToast(nowSaved ? '💾 Roast saved!' : 'Removed from saved');
  renderHistorySidebar();
});

// ── Saved roasts view ─────────────────────────────────
function renderSavedView() {
  const container = $('saved-list');
  const saved     = loadDB().filter(r => r.saved);

  if (!saved.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💀</div>
        <p>No saved roasts yet. Go get roasted!</p>
        <button class="btn-orange" id="go-home-saved">🔥 Get Roasted</button>
      </div>`;
    $('go-home-saved').addEventListener('click', () => showView('home'));
    return;
  }

  container.innerHTML = '';
  saved.forEach(r => {
    const card = document.createElement('div');
    card.className = 'saved-card';
    card.innerHTML = `
      <div class="saved-card-thumb">${escHtml(r.icon)}</div>
      <div class="saved-card-info">
        <div class="saved-card-title">${escHtml(r.title)}</div>
        <div class="saved-card-sub">${escHtml(r.artists.join(' · '))}</div>
      </div>
      <span class="saved-card-date">${escHtml(r.date)}</span>
      <button class="delete-btn" title="Remove" data-id="${escHtml(r.id)}">🗑</button>`;

    card.querySelector('.saved-card-info').addEventListener('click', () => {
      state.current = r;
      displayResults(r);
    });
    card.querySelector('.delete-btn').addEventListener('click', e => {
      e.stopPropagation();
      const roasts = loadDB();
      const target = roasts.find(x => x.id === r.id);
      if (target) { target.saved = false; saveDB(roasts); }
      renderSavedView();
      renderHistorySidebar();
      showToast('Removed from saved');
    });

    container.appendChild(card);
  });
}

// ═══════════════════════════════════════
//  POLISH — animations & extras
// ═══════════════════════════════════════

function typewriter(el, text, msPerChar = 20) {
  el.textContent = '';
  el.classList.add('typing');
  let i = 0;
  const tick = () => {
    if (i < text.length) {
      el.textContent += text[i++];
      setTimeout(tick, msPerChar);
    } else {
      el.classList.remove('typing');
    }
  };
  tick();
}

function updateCountBadge() {
  const total = loadDB().length;
  let badge   = document.querySelector('.roast-count');
  const logo  = document.querySelector('.logo');
  if (!logo) return;
  if (total > 0) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'roast-count';
      logo.appendChild(badge);
    }
    badge.textContent = total;
  } else if (badge) {
    badge.remove();
  }
}

// ═══════════════════════════════════════
//  INIT
// ═══════════════════════════════════════

checkBanner();
renderHistorySidebar();
updateCountBadge();
