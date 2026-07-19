/* =========================================================================
   Personal Trainer PWA — app logic
   Standalone-capable: works entirely on localStorage + seeded data.
   Enhances progressively when Supabase (push) and the Claude bridge are set.
   ========================================================================= */
(function () {
  'use strict';

  const { TAGS, USERS } = window.APP_DATA;
  const CFG = window.APP_CONFIG || {};
  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };

  /* ---------------- State ---------------- */
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  let currentUserId = LS.get('pt.currentUser', CFG.DEFAULT_USER || 'caryn');
  if (!USERS[currentUserId]) currentUserId = Object.keys(USERS)[0];

  const user = () => USERS[currentUserId];
  const progKey = () => `pt.${currentUserId}.progress`;
  const getProgress = () => LS.get(progKey(), {});
  const setProgress = (p) => LS.set(progKey(), p);

  /* ---------------- Dates ---------------- */
  function localDateStr(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  // Allow ?date=YYYY-MM-DD to preview a specific day (handy for testing/demo).
  const _q = new URLSearchParams(location.search).get('date');
  const TODAY = (_q && /^\d{4}-\d{2}-\d{2}$/.test(_q)) ? _q : localDateStr();

  function prettyDate(str) {
    const [y, m, d] = str.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  }

  function shortDate(str) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  function sessionFor(dateStr) { return user().sessions.find(s => s.date === dateStr) || null; }
  function isComplete(session, prog = getProgress()) {
    if (!session) return false;
    const done = prog[session.date] || {};
    return session.blocks.every(b => done[b.id]);
  }
  function completedCount(session, prog = getProgress()) {
    const done = prog[session.date] || {};
    return session.blocks.filter(b => done[b.id]).length;
  }

  /* ---------------- Streaks ---------------- */
  function computeStreak() {
    const prog = getProgress();
    const past = user().sessions
      .filter(s => s.date <= TODAY)
      .sort((a, b) => (a.date < b.date ? 1 : -1)); // descending
    let streak = 0;
    for (const s of past) {
      const done = isComplete(s, prog);
      if (s.date === TODAY && !done) continue; // today still open — don't break
      if (done) streak++; else break;
    }
    return streak;
  }
  function bestStreak() {
    const prog = getProgress();
    const asc = user().sessions.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    let best = 0, run = 0;
    for (const s of asc) { if (isComplete(s, prog)) { run++; best = Math.max(best, run); } else if (s.date < TODAY) { run = 0; } }
    return best;
  }
  function totalWorkoutsDone() {
    const prog = getProgress();
    return user().sessions.filter(s => isComplete(s, prog)).length;
  }

  /* ---------------- Router ---------------- */
  function show(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(`#screen-${screen}`).classList.add('active');
    document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('active', b.dataset.screen === screen));
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    if (screen === 'schedule') renderSchedule();
    if (screen === 'me') renderProfile();
    if (screen === 'chat') renderChat();
  }
  $('#nav').addEventListener('click', e => {
    const btn = e.target.closest('button[data-screen]');
    if (btn) show(btn.dataset.screen);
  });

  /* ---------------- Render: header ---------------- */
  function greetingText() {
    const h = new Date().getHours();
    if (h < 5) return 'Still up';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }
  function renderHeader() {
    $('#greeting').innerHTML = `${greetingText()}, <b>${user().name}</b>`;
    $('#date-line').textContent = prettyDate(TODAY);
    $('#streak-num').textContent = computeStreak();
  }

  /* ---------------- Render: Today ---------------- */
  function ringSvg(pct) {
    const r = 28, c = 2 * Math.PI * r, off = c * (1 - pct);
    return `<div class="ring"><svg width="66" height="66" viewBox="0 0 66 66">
      <circle class="track" cx="33" cy="33" r="${r}" fill="none" stroke-width="6"/>
      <circle class="fill" cx="33" cy="33" r="${r}" fill="none" stroke-width="6"
        stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>
    </svg><div class="pct">${Math.round(pct * 100)}%</div></div>`;
  }

  function renderToday() {
    const root = $('#today-content');
    root.innerHTML = '';
    const session = sessionFor(TODAY);

    if (!session) {
      // Rest day — show the next scheduled session too.
      const next = user().sessions.find(s => s.date > TODAY);
      const card = el('div', 'card rest');
      card.innerHTML = `<div class="emoji">🧘‍♀️</div>
        <h1>Rest &amp; recover</h1>
        <p>No session scheduled today. Great training comes from good recovery — hydrate, stretch, and rest up.</p>`;
      root.appendChild(card);
      if (next) {
        const t = el('div', 'section-title', 'Up next');
        root.appendChild(t);
        root.appendChild(scheduleRow(next));
      }
      return;
    }

    const prog = getProgress();
    const total = session.blocks.length;
    const done = completedCount(session, prog);
    const pct = total ? done / total : 0;

    const card = el('div', 'card hero');
    card.innerHTML = `
      <div class="hero-top">
        <div>
          <div class="eyebrow">${session.day} · Week ${session.week}</div>
          <h1>${session.focus}</h1>
          <div class="window">${session.window}</div>
        </div>
        ${ringSvg(pct)}
      </div>
      <div class="blocks"></div>
      <div class="done-banner" id="done-banner"></div>`;
    root.appendChild(card);

    const list = $('.blocks', card);
    session.blocks.forEach(b => {
      list.appendChild(blockRow(session, b, prog[session.date]?.[b.id]));
    });

    if (isComplete(session, prog)) showDoneBanner(session, false);
  }

  function blockRow(session, b, doneNow) {
    const tag = TAGS[b.tag] || { label: b.tag, accent: '#ffc86b' };
    const row = el('div', 'block' + (doneNow ? ' done' : ''));
    row.style.setProperty('--accent', tag.accent);
    row.innerHTML = `
      <div class="check"><svg viewBox="0 0 24 24" fill="none" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg></div>
      <div class="b-body">
        <div class="b-title">${b.title}</div>
        <div class="b-detail">${b.detail}</div>
        <div class="b-meta">
          <span class="chip tag" style="background:${hexA(tag.accent, 0.22)};border-color:${hexA(tag.accent, 0.4)};color:${tag.accent}">${tag.label}</span>
          <span class="chip">${b.time}${b.minutes ? ' · ' + b.minutes + ' min' : ''}</span>
        </div>
      </div>`;
    row.addEventListener('click', () => toggleBlock(session, b, row));
    return row;
  }

  function toggleBlock(session, b, row) {
    const prog = getProgress();
    prog[session.date] = prog[session.date] || {};
    const nowDone = !prog[session.date][b.id];
    if (nowDone) prog[session.date][b.id] = true; else delete prog[session.date][b.id];
    setProgress(prog);

    row.classList.toggle('done', nowDone);
    const check = $('.check', row);
    if (nowDone) {
      check.classList.remove('burst'); void check.offsetWidth; check.classList.add('burst');
      buzz(12);
      const r = row.getBoundingClientRect();
      confettiBurst(r.left + 26, r.top + r.height / 2, 14, tagColor(b.tag));
    }
    updateRing(session);

    const complete = isComplete(session);
    if (complete && nowDone) onSessionComplete(session);
    else hideDoneBanner();
    renderHeader();
  }

  function updateRing(session) {
    const total = session.blocks.length, done = completedCount(session);
    const fill = $('#today-content .ring .fill');
    const pctEl = $('#today-content .ring .pct');
    if (!fill) return;
    const r = 28, c = 2 * Math.PI * r;
    fill.style.strokeDashoffset = (c * (1 - done / total)).toFixed(1);
    pctEl.textContent = `${Math.round((done / total) * 100)}%`;
  }

  /* ---------------- Completion celebration ---------------- */
  const CHEERS = [
    "Crushed it. That's how the week gets built. 💪",
    "Done and done. Future you says thanks.",
    "Another one in the bank. You showed up — that's the whole game.",
    "Strong work today. Rest, refuel, repeat.",
    "That's a wrap. Consistency is quietly stacking up.",
  ];
  function onSessionComplete(session) {
    buzz([16, 40, 16]);
    bigCelebration();
    const chip = $('#streak-chip'); chip.classList.remove('pop'); void chip.offsetWidth; chip.classList.add('pop');
    showDoneBanner(session, true);
    syncCompletion(session); // best-effort remote log + AI feedback
  }

  function showDoneBanner(session, fresh) {
    const banner = $('#done-banner');
    if (!banner) return;
    const streak = computeStreak();
    const msg = fresh ? CHEERS[Math.floor(Date.now() / 8.64e7) % CHEERS.length] : "You completed this session. Nice.";
    banner.innerHTML = `<h3>Workout complete 🎉</h3>
      <p>${msg}${streak > 1 ? ` &nbsp;·&nbsp; <b>${streak}-workout streak</b> 🔥` : ''}</p>
      <div id="ai-feedback"></div>`;
    banner.classList.add('show');
    maybeAiFeedback(session, banner);
  }
  function hideDoneBanner() { const b = $('#done-banner'); if (b) b.classList.remove('show'); }

  /* ---------------- Render: Schedule ---------------- */
  function scheduleRow(session) {
    const prog = getProgress();
    const complete = isComplete(session, prog);
    const done = completedCount(session, prog);
    const isToday = session.date === TODAY;
    const row = el('div', 'sched-row' + (complete ? ' complete' : '') + (isToday ? ' today' : ''));
    let status = complete ? 'Done ✓' : (done > 0 ? `${done}/${session.blocks.length}` : (session.date < TODAY ? 'Missed' : ''));
    if (isToday && !complete) status = 'Today';
    row.innerHTML = `
      <div class="day-dot">${session.day}<br>${session.date.slice(8)}</div>
      <div class="sched-body">
        <div class="t">${session.focus}</div>
        <div class="s">${session.blocks.length} blocks · ${session.window}</div>
      </div>
      <div class="sched-status">${status}</div>`;
    row.addEventListener('click', () => openSessionSheet(session));
    return row;
  }

  function renderSchedule() {
    const root = $('#schedule-content');
    root.innerHTML = '';
    const weeks = {};
    user().sessions.forEach(s => { (weeks[s.week] = weeks[s.week] || []).push(s); });
    Object.keys(weeks).forEach(w => {
      const days = weeks[w];
      const range = `${shortDate(days[0].date)} – ${shortDate(days[days.length - 1].date)}`;
      const doneN = days.filter(s => isComplete(s)).length;
      const head = el('div', 'week-head', `<b>Week ${w}</b><span>${range}${doneN ? ` · ${doneN}/${days.length} done` : ''}</span>`);
      root.appendChild(head);
      days.forEach(s => root.appendChild(scheduleRow(s)));
    });
  }

  function openSessionSheet(session) {
    const prog = getProgress();
    const rows = session.blocks.map(b => {
      const done = prog[session.date]?.[b.id];
      const tag = TAGS[b.tag] || { label: b.tag, accent: '#ffc86b' };
      return `<div class="block ${done ? 'done' : ''}" style="--accent:${tag.accent}" data-bid="${b.id}">
        <div class="check"><svg viewBox="0 0 24 24" fill="none" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg></div>
        <div class="b-body"><div class="b-title">${b.title}</div><div class="b-detail">${b.detail}</div>
        <div class="b-meta"><span class="chip">${b.time}${b.minutes ? ' · ' + b.minutes + ' min' : ''}</span></div></div></div>`;
    }).join('');
    const html = `<div class="big-emoji">🏋️‍♀️</div>
      <h2>${session.focus}</h2>
      <p>${session.day} · Week ${session.week} · ${session.window}</p>
      <div class="blocks" style="margin-top:14px">${rows}</div>
      <div class="actions"><button class="btn ghost full" id="sheet-close">Close</button></div>`;
    openSheet(html);
    // wire toggles inside the sheet
    $('#sheet').querySelectorAll('.block').forEach(row => {
      row.addEventListener('click', () => {
        const b = session.blocks.find(x => x.id === row.dataset.bid);
        toggleBlockSilent(session, b, row);
      });
    });
    $('#sheet-close').addEventListener('click', closeSheet);
  }

  function toggleBlockSilent(session, b, row) {
    const prog = getProgress();
    prog[session.date] = prog[session.date] || {};
    const nowDone = !prog[session.date][b.id];
    if (nowDone) prog[session.date][b.id] = true; else delete prog[session.date][b.id];
    setProgress(prog);
    row.classList.toggle('done', nowDone);
    if (nowDone) { buzz(10); const r = row.getBoundingClientRect(); confettiBurst(r.left + 26, r.top + r.height / 2, 12, tagColor(b.tag)); }
    if (isComplete(session) && nowDone) { bigCelebration(); buzz([16, 40, 16]); }
    renderHeader();
    renderToday();
  }

  /* ---------------- Render: Profile ---------------- */
  function renderProfile() {
    const root = $('#me-content');
    const u = user();
    const notifState = Notification && Notification.permission;
    const notifLabel = notifState === 'granted' ? 'On' : (notifState === 'denied' ? 'Blocked' : 'Off');
    root.innerHTML = `
      <div class="profile-hero">
        <div class="avatar">${u.emoji}</div>
        <h2>${u.name}</h2>
        <div class="goal">${u.goals}</div>
      </div>
      <div class="stat-row">
        <div class="stat"><div class="n">${computeStreak()}</div><div class="l">Streak 🔥</div></div>
        <div class="stat"><div class="n">${totalWorkoutsDone()}</div><div class="l">Done</div></div>
        <div class="stat"><div class="n">${bestStreak()}</div><div class="l">Best</div></div>
      </div>
      <div class="section-title">Reminders</div>
      <div class="setting-row">
        <div><div class="label">6:15am workout reminder</div><div class="sub">Push notification: ${notifLabel}</div></div>
        <button class="btn small ${notifState === 'granted' ? 'good' : 'primary'}" id="notif-btn">${notifState === 'granted' ? 'Send test' : 'Turn on'}</button>
      </div>
      <div class="section-title">App</div>
      <div class="setting-row">
        <div><div class="label">Reset this program's progress</div><div class="sub">Clears checks &amp; streak for ${u.name}</div></div>
        <button class="btn small ghost" id="reset-btn">Reset</button>
      </div>`;
    $('#notif-btn').addEventListener('click', () => notifState === 'granted' ? sendTestPush() : enableNotifications());
    $('#reset-btn').addEventListener('click', () => {
      openSheet(`<div class="big-emoji">⚠️</div><h2>Reset progress?</h2>
        <p>This clears all checked workouts and the streak for ${u.name}. This can't be undone.</p>
        <div class="actions"><button class="btn primary full" id="do-reset">Yes, reset</button><button class="btn ghost full" id="cancel-reset">Cancel</button></div>`);
      $('#do-reset').addEventListener('click', () => { setProgress({}); closeSheet(); renderAll(); toast('Progress reset'); });
      $('#cancel-reset').addEventListener('click', closeSheet);
    });
  }

  /* ---------------- Render: Chat ---------------- */
  const chatKey = () => `pt.${currentUserId}.chat`;
  function renderChat() {
    const log = $('#chat-log');
    const msgs = LS.get(chatKey(), []);
    if (!msgs.length) {
      log.innerHTML = `<div class="chat-note">Your coach can adjust the plan, swap a class, or talk through how a session felt. ${CFG.BRIDGE_URL ? '' : 'AI replies come online once the coach bridge is running.'}</div>`;
      appendMsg('ai', `Hey ${user().name}! I'm your coach. Tell me how a workout felt, ask me to tweak anything, or just check in. 💬`, false);
    } else {
      log.innerHTML = '';
      msgs.forEach(m => appendMsg(m.role, m.text, false));
    }
    $('#coach-status').textContent = CFG.BRIDGE_URL ? 'Online' : 'Offline — messages saved for your coach';
    log.scrollTop = log.scrollHeight;
  }
  function appendMsg(role, text, store = true) {
    const log = $('#chat-log');
    log.appendChild(el('div', 'msg ' + (role === 'me' ? 'me' : 'ai'), text));
    log.scrollTop = log.scrollHeight;
    if (store) { const m = LS.get(chatKey(), []); m.push({ role, text, at: Date.now() }); LS.set(chatKey(), m); }
  }
  async function sendChat() {
    const input = $('#chat-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    appendMsg('me', text);
    const reply = await askCoach(text);
    appendMsg('ai', reply);
  }
  $('#chat-send').addEventListener('click', sendChat);
  $('#chat-input').addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });

  /* ---------------- AI bridge (best-effort) ---------------- */
  async function askCoach(text) {
    if (!CFG.BRIDGE_URL) {
      return "Saved! Your coach bridge isn't running yet, so I can't reply live — but I've noted this and Chris will see it. (Once the bridge is on, I'll answer here instantly.)";
    }
    try {
      const res = await fetch(CFG.BRIDGE_URL.replace(/\/$/, '') + '/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: currentUserId, message: text, context: coachContext() }),
      });
      const data = await res.json();
      return data.reply || "Hmm, I didn't catch that — try again?";
    } catch {
      return "I couldn't reach the coach right now. Your message is saved and I'll pick it up when I'm back online.";
    }
  }
  function coachContext() {
    const s = sessionFor(TODAY);
    return { name: user().name, goals: user().goals, streak: computeStreak(), today: s ? { focus: s.focus, blocks: s.blocks } : null };
  }
  async function maybeAiFeedback(session, banner) {
    if (!CFG.BRIDGE_URL) return;
    try {
      const res = await fetch(CFG.BRIDGE_URL.replace(/\/$/, '') + '/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: currentUserId, session: { focus: session.focus, day: session.day }, streak: computeStreak(), context: coachContext() }),
      });
      const data = await res.json();
      if (data.message) $('#ai-feedback', banner).innerHTML = `<p style="margin-top:8px">${data.message}</p>`;
    } catch {}
  }
  function syncCompletion(session) {
    // Best-effort: tell backend a session was completed (for cross-device + coach memory).
    if (!CFG.SUPABASE_URL) return;
    fetch(`${CFG.SUPABASE_URL}/rest/v1/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': CFG.SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + CFG.SUPABASE_ANON_KEY, 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({ user_id: currentUserId, date: session.date, focus: session.focus }),
    }).catch(() => {});
  }

  /* ---------------- Notifications / Push ---------------- */
  function urlB64ToUint8(base64) {
    const pad = '='.repeat((4 - base64.length % 4) % 4);
    const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(b64); const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  async function enableNotifications() {
    if (!('Notification' in window)) { toast('Notifications not supported on this browser'); return; }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { toast(perm === 'denied' ? 'Notifications blocked — enable in settings' : 'Maybe later'); renderProfile?.(); return; }
    await subscribePush();
    toast('Reminders on 🔔');
    renderProfile();
  }
  async function subscribePush() {
    if (!('serviceWorker' in navigator) || !CFG.VAPID_PUBLIC_KEY) return null;
    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(CFG.VAPID_PUBLIC_KEY) });
      }
      if (CFG.SUPABASE_URL) {
        await fetch(`${CFG.SUPABASE_URL}/rest/v1/push_subscriptions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': CFG.SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + CFG.SUPABASE_ANON_KEY, 'Prefer': 'resolution=merge-duplicates' },
          body: JSON.stringify({ user_id: currentUserId, endpoint: sub.endpoint, subscription: sub.toJSON() }),
        });
      }
      return sub;
    } catch (e) { console.warn('push subscribe failed', e); return null; }
  }
  async function sendTestPush() {
    if (CFG.SUPABASE_URL) {
      try {
        await fetch(`${CFG.SUPABASE_URL}/functions/v1/send-reminder`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': CFG.SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + CFG.SUPABASE_ANON_KEY },
          body: JSON.stringify({ user_id: currentUserId, test: true }),
        });
        toast('Test push sent — check your lock screen');
        return;
      } catch {}
    }
    // Local fallback so the button always does something visible.
    const reg = await navigator.serviceWorker?.ready;
    reg?.showNotification('Trainer', { body: "Test reminder — you're all set for 6:15am 🔔", icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' });
    toast('Local test shown');
  }

  /* ---------------- Onboarding ---------------- */
  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }
  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }

  function maybeOnboard() {
    const done = LS.get('pt.onboarded', false);
    if (done) return;
    // On iOS, push requires the app be installed to the Home Screen first.
    if (isIOS() && !isStandalone()) { showInstallSheet(); return; }
    showWelcomeSheet();
  }
  function showInstallSheet() {
    openSheet(`<div class="big-emoji">📲</div>
      <h2>Add to Home Screen</h2>
      <p>To get your 6:15am reminders, add ${document.title} to your Home Screen first — Apple only allows notifications from installed apps.</p>
      <ol>
        <li>Tap the <b>Share</b> button <span aria-hidden="true">􀈂</span> at the bottom of Safari</li>
        <li>Scroll and tap <b>Add to Home Screen</b></li>
        <li>Open the app from your Home Screen and finish setup</li>
      </ol>
      <div class="actions"><button class="btn ghost full" id="ob-later">Got it</button></div>`, false);
    $('#ob-later').addEventListener('click', closeSheet);
  }
  function showWelcomeSheet() {
    const u = user();
    openSheet(`<div class="big-emoji">${u.emoji}</div>
      <h2>Welcome, ${u.name}!</h2>
      <p>Your 4-week program starts Monday. Each morning your workout is right here — tap each block as you finish it and watch your streak grow.</p>
      <p style="margin-top:10px">Turn on reminders and I'll nudge you at <b>6:15am</b> on workout days with the day's plan.</p>
      <div class="actions">
        <button class="btn primary full" id="ob-notif">Turn on 6:15am reminders 🔔</button>
        <button class="btn ghost full" id="ob-skip">Maybe later</button>
      </div>`, false);
    $('#ob-notif').addEventListener('click', async () => { await enableNotifications(); LS.set('pt.onboarded', true); closeSheet(); });
    $('#ob-skip').addEventListener('click', () => { LS.set('pt.onboarded', true); closeSheet(); });
  }

  /* ---------------- Sheet ---------------- */
  function openSheet(html, dismissable = true) {
    $('#sheet').innerHTML = html;
    $('#sheet-backdrop').classList.add('show');
    $('#sheet-backdrop').dataset.dismiss = dismissable ? '1' : '0';
  }
  function closeSheet() { $('#sheet-backdrop').classList.remove('show'); }
  $('#sheet-backdrop').addEventListener('click', e => {
    if (e.target.id === 'sheet-backdrop' && e.currentTarget.dataset.dismiss === '1') closeSheet();
  });

  /* ---------------- Toast + haptics ---------------- */
  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }
  function buzz(p) { try { navigator.vibrate && navigator.vibrate(p); } catch {} }

  /* ---------------- Confetti ---------------- */
  const canvas = $('#confetti');
  const ctx = canvas.getContext('2d');
  let particles = [], raf = null, dpr = Math.min(window.devicePixelRatio || 1, 2);
  function sizeCanvas() { canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  sizeCanvas(); addEventListener('resize', sizeCanvas);

  function tagColor(tag) { return (TAGS[tag] || {}).accent || '#ffc86b'; }
  const CONFETTI_COLORS = ['#ff7a59', '#ffc46b', '#64e0b8', '#7aa2ff', '#ff7ea8'];

  function confettiBurst(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random();
      const sp = 2 + Math.random() * 4;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, g: 0.14, life: 1, size: 4 + Math.random() * 4, color: color || CONFETTI_COLORS[i % CONFETTI_COLORS.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4 });
    }
    startRaf();
  }
  function bigCelebration() {
    const cx = innerWidth / 2;
    for (let k = 0; k < 3; k++) {
      setTimeout(() => {
        for (let i = 0; i < 46; i++) {
          const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
          const sp = 5 + Math.random() * 8;
          particles.push({ x: cx + (Math.random() - 0.5) * 120, y: innerHeight * 0.42, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0.16, life: 1, size: 5 + Math.random() * 6, color: CONFETTI_COLORS[i % CONFETTI_COLORS.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.5 });
        }
        startRaf();
      }, k * 130);
    }
  }
  function startRaf() { if (!raf) raf = requestAnimationFrame(tick); }
  function tick() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    particles = particles.filter(p => p.life > 0);
    for (const p of particles) {
      p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.life -= 0.012; p.rot += p.vr;
      ctx.save(); ctx.globalAlpha = Math.max(0, p.life); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6); ctx.restore();
    }
    if (particles.length) raf = requestAnimationFrame(tick); else { raf = null; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  }

  /* ---------------- helpers ---------------- */
  function hexA(hex, a) {
    const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  /* ---------------- Boot ---------------- */
  function renderAll() { renderHeader(); renderToday(); }
  function boot() {
    LS.set('pt.currentUser', currentUserId);
    renderAll();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW reg failed', e));
    }
    // Re-subscribe silently if already granted (keeps endpoint fresh).
    if ('Notification' in window && Notification.permission === 'granted') subscribePush();
    setTimeout(maybeOnboard, 600);
  }
  boot();
})();
