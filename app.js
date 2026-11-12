// 단어로 찾는 켄시 노래 — 정적 사이트(서버 없음). 데이터는 data/*.json 을 읽는다.
const $ = (s, el = document) => el.querySelector(s);
const UNIT_TITLE = { 1: "どうぞ よろしく", 2: "おはなみは どう？", 3: "おちゃ どうぞ" };
const UNIT_PAGES = { 1: "10–25쪽", 2: "26–41쪽", 3: "42–57쪽" };

const state = { words: [], tracks: [], index: {}, views: {}, viewsUpdated: null, lyrics: undefined, rows: [], built: "", unit: 0, tab: "search", sort: "views", wid: null, q: "" };

// ---------- 데이터 ----------
async function getJSON(url, optional = false) {
  try {
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) throw new Error(`${url} → ${r.status}`);
    return await r.json();
  } catch (e) {
    if (optional) return null;
    throw e;
  }
}

// ---------- 글자 처리 ----------
const toHira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const plain = (s) => toHira(String(s).normalize("NFKC").toLowerCase()).replace(/[～~\-\s・･]/g, "");

// 로마자 → 히라가나 (헵번식·훈령식 혼용 입력 허용)
const T = {};
{
  const rows = { "": "あいうえお", k: "かきくけこ", s: "さしすせそ", t: "たちつてと", n: "なにぬねの", h: "はひふへほ", m: "まみむめも", r: "らりるれろ", g: "がぎぐげご", z: "ざじずぜぞ", d: "だぢづでど", b: "ばびぶべぼ", p: "ぱぴぷぺぽ" };
  const V = "aiueo";
  for (const [c, ks] of Object.entries(rows)) [...ks].forEach((k, i) => (T[c + V[i]] = k));
  Object.assign(T, { ya: "や", yu: "ゆ", yo: "よ", wa: "わ", wo: "を", shi: "し", chi: "ち", tsu: "つ", fu: "ふ", ji: "じ", si: "し", ti: "ち", tu: "つ", hu: "ふ", zi: "じ", di: "ぢ", du: "づ" });
  const small = { a: "ゃ", u: "ゅ", o: "ょ" };
  const pal = { ky: "き", gy: "ぎ", ny: "に", hy: "ひ", my: "み", ry: "り", by: "び", py: "ぴ", sh: "し", ch: "ち", j: "じ", sy: "し", ty: "ち", zy: "じ", dy: "ぢ" };
  for (const [c, k] of Object.entries(pal)) for (const [v, s] of Object.entries(small)) T[c + v] = k + s;
  Object.assign(T, { she: "しぇ", che: "ちぇ", je: "じぇ", fa: "ふぁ", fi: "ふぃ", fe: "ふぇ", fo: "ふぉ" });
}
function romajiToHira(input) {
  let s = input.toLowerCase().replace(/[^a-z'\- ]/g, ""), out = "";
  while (s) {
    if (s.startsWith("tch")) { out += "っ"; s = s.slice(1); continue; }
    if (/^([bcdfghjklmpqrstvwxyz])\1/.test(s) && !s.startsWith("nn")) { out += "っ"; s = s.slice(1); continue; }
    if (s.startsWith("nn")) { out += "ん"; s = s.slice(1); continue; }
    if (s[0] === "'" || s[0] === " ") { s = s.slice(1); continue; }
    if (s[0] === "-") { out += "ー"; s = s.slice(1); continue; }
    let hit = false;
    for (const L of [3, 2, 1]) { const k = T[s.slice(0, L)]; if (k) { out += k; s = s.slice(L); hit = true; break; } }
    if (hit) continue;
    if (s[0] === "n") { out += "ん"; s = s.slice(1); continue; }
    out += s[0]; s = s.slice(1);
  }
  return out;
}

// ---------- 검색 ----------
function keysOf(w) {
  if (w._keys) return w._keys;
  const ks = [];
  for (const part of String(w.w).split(/[/･]/)) ks.push(plain(part));
  for (const part of String(w.kanji || "").split("･")) if (part) ks.push(plain(part));
  for (const a of w.alias || []) ks.push(plain(a.w));
  w._keys = ks.filter(Boolean);
  w._ko = String(w.ko).toLowerCase();
  return w._keys;
}
function searchWords(raw) {
  const q0 = raw.normalize("NFKC").trim().toLowerCase();
  if (!q0) return [];
  const forms = new Set([plain(q0)]);
  if (/^[a-z'\- ]+$/.test(q0)) forms.add(plain(romajiToHira(q0)));
  const res = [];
  for (const w of state.words) {
    if (state.unit && w.unit !== state.unit) continue;
    const ks = keysOf(w);
    let score = 0;
    for (const f of forms) {
      if (!f) continue;
      for (const k of ks) {
        if (k === f) score = Math.max(score, 100);
        else if (k.startsWith(f)) score = Math.max(score, 60);
        else if (k.includes(f)) score = Math.max(score, 30);
      }
    }
    if (!score && w._ko.includes(q0)) score = 20;     // 한국어 뜻
    if (score) res.push({ w, score });
  }
  res.sort((a, b) => b.score - a.score || a.w.unit - b.w.unit || a.w.page - b.w.page);
  return res.map((r) => r.w);
}

// ---------- 표시 도우미 ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function fmtViews(n) {
  if (n >= 1e8) return `${(n / 1e8).toFixed(n >= 1e9 ? 0 : 1).replace(/\.0$/, "")}억회`;
  if (n >= 1e4) return `${Math.round(n / 1e4).toLocaleString("ko-KR")}만회`;
  return `${n.toLocaleString("ko-KR")}회`;
}
const KIND = { album: "앨범", single: "싱글", other: "기타" };
const idx = (wid) => state.index[wid] || { mode: "skip", prec: "low", t: [] };
const viewsOf = (t) => (t.vid && state.views[t.vid] != null ? state.views[t.vid] : null);

// ---------- 화면: 추천 칩 ----------
function renderSuggest(list) {
  const box = $("#suggest");
  box.innerHTML = list.slice(0, 18).map((w) =>
    `<button type="button" class="sg${w.id === state.wid ? " on" : ""}" data-w="${w.id}"><span class="jp">${esc(w.w)}</span><span class="ko">${esc(w.ko)}</span><span class="u">${w.unit}과</span></button>`).join("");
}

// ---------- 화면: 결과 ----------
function renderResult() {
  closePanel(true);
  const box = $("#result"), empty = $("#empty");
  const w = state.words.find((x) => x.id === state.wid);
  if (!w) { box.hidden = true; empty.hidden = false; return; }
  empty.hidden = true; box.hidden = false;
  const ix = idx(w.id);
  const tags = [`<span class="tag">${w.unit}과 · ${w.page}쪽</span>`];
  if (w.kind === "phrase") tags.push(`<span class="tag">표현</span>`);
  if (ix.mode === "kanji") tags.push(`<span class="tag warn">한자 표기(${esc(w.kanji)})만 집계</span>`);
  if (ix.mode !== "skip" && ix.prec === "low") tags.push(`<span class="tag warn">정확도 낮음 · 다른 단어 속에서도 잡혀요</span>`);
  const alias = (w.alias || []).length ? `<p class="alias">교과서에 나온 활용형: ${w.alias.map((a) => `${esc(a.w)} (${esc(a.ko)})`).join(", ")}</p>` : "";
  let body;
  if (ix.mode === "skip") {
    body = `<p class="none">${w.kind === "grammar" ? "조사·어미·접사는 거의 모든 곡에 나와서 가사 검색에서 제외했어요." : "한 글자 단어라 다른 글자 속에서 너무 많이 잡혀서 가사 검색에서 제외했어요."}</p>`;
  } else {
    const hasViews = Object.keys(state.views).length > 0;
    const sort = hasViews ? state.sort : "count";
    const rows = ix.t.map(([ti, n]) => ({ ti, n, t: state.tracks[ti], v: viewsOf(state.tracks[ti]) }));
    rows.sort(sort === "views" ? (a, b) => (b.v ?? -1) - (a.v ?? -1) || b.n - a.n : (a, b) => b.n - a.n || (b.v ?? -1) - (a.v ?? -1));
    const seg = hasViews ? `<div class="seg" id="seg" role="group" aria-label="정렬"><i></i><button type="button" data-sort="views" class="${sort === "views" ? "on" : ""}">조회수순</button><button type="button" data-sort="count" class="${sort === "count" ? "on" : ""}">등장 횟수순</button></div>` : "";
    state.rows = ix.t.map(([ti, n]) => ({ ti, n, t: state.tracks[ti], v: viewsOf(state.tracks[ti]) }));
    state.sortKey = sort;
    body = state.rows.length
      ? `<div class="sortbar"><span class="count"><b>${state.rows.length}</b>곡에 나와요</span>${seg}</div><ul class="songs" id="songList"></ul>`
      : `<p class="none">켄시·하치 노래 가사에서는 이 단어를 찾지 못했어요.</p>`;
  }
  closePanel(true);
  box.innerHTML = `<header class="wordhead rise"><div><span class="jp">${esc(w.w)}</span>${w.kanji ? `<span class="kanji">${esc(w.kanji)}</span>` : ""}</div><p class="ko">${esc(w.ko)}</p><div class="meta">${tags.join("")}</div>${alias}</header>${body}`;
  if ($("#songList")) { drawSongs(); placePill(); }
}
function drawSongs() {
  const rows = [...state.rows];
  rows.sort(state.sortKey === "views" ? (a, b) => (b.v ?? -1) - (a.v ?? -1) || b.n - a.n : (a, b) => b.n - a.n || (b.v ?? -1) - (a.v ?? -1));
  closePanel(true);
  $("#songList").innerHTML = rows.map((r, i) => songItem(r, i + 1, i)).join("");
}
function songItem(r, rank, i) {
  const t = r.t;
  const year = t.album.date ? t.album.date.slice(0, 4) : "";
  const thumb = t.vid ? `<img loading="lazy" alt="" src="https://i.ytimg.com/vi/${encodeURIComponent(t.vid)}/mqdefault.jpg">` : "";
  return `<li class="item" style="--i:${Math.min(i, 12)}" data-ti="${r.ti}">
    <button class="song" type="button" aria-expanded="false" aria-label="${esc(t.title)} 재생 패널 열기/닫기">
      <span class="rank">${rank}</span><span class="thumb">${thumb}</span>
      <span><h3>${esc(t.title)}</h3>
        <div class="sub">${esc(t.album.title)} · ${KIND[t.album.kind] || ""}${year ? ` · ${year}` : ""}${t.artist !== "米津玄師" ? ` · ${esc(t.artist)}` : ""}</div>
        <div class="nums"><span class="views">${r.v != null ? `조회수 <b title="${r.v.toLocaleString("ko-KR")}회">${fmtViews(r.v)}</b>` : `조회수 <b>—</b>`}</span><span>가사 속 <b>${r.n}</b>번</span></div></span>
      <svg class="chev" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 8l5 5 5-5"/></svg>
    </button>
    <div class="drawer"><div class="clip"></div></div></li>`;
}
function placePill() {
  const seg = $("#seg"); if (!seg) return;
  const on = seg.querySelector("button.on"), pill = seg.querySelector("i");
  if (!on || !pill) return;
  pill.style.setProperty("--x", (on.offsetLeft - 3) + "px"); pill.style.setProperty("--w", on.offsetWidth + "px");
}

// ---------- 인앱 재생 패널 (YouTube 공식 임베드 + 시간 가사) ----------
let cur = null;                                         // 열려 있는 패널의 상태
let ytPromise = null;
function loadYT() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  return (ytPromise ||= new Promise((res, rej) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prev) prev(); res(); };
    const sc = document.createElement("script");
    sc.src = "https://www.youtube.com/iframe_api"; sc.onerror = () => { ytPromise = null; rej(new Error("yt")); };
    document.head.append(sc);
  }));
}
async function ensureLyrics() {
  if (state.lyrics === undefined) state.lyrics = await getJSON("data/lyrics.json", true);
  return state.lyrics;
}
const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function panelHTML(t, hasLyr) {
  return `<div class="panel">
    <button class="close" type="button" aria-label="닫기">✕</button>
    <div class="vid"><div class="screen"><div class="mount"></div></div>
      <div class="tools"><span class="hits"></span></div></div>
    <div class="grip" role="separator" aria-orientation="vertical" aria-label="영상 폭 조절"></div>
    <div class="lyr"><div class="ly-lines"></div></div>
    <div class="vgrip" role="separator" aria-orientation="horizontal" aria-label="패널 높이 조절"></div>
  </div>`;
}
async function openPanel(item) {
  if (cur && cur.item === item) return closePanel();
  closePanel();
  const ti = +item.dataset.ti, t = state.tracks[ti], wid = state.wid;
  const key = `${t.album.id}|${t.album.n}`;
  const c = { item, ti, vid: t.vid, key, wid, k: -1, times: [], lines: [], cands: [], idx: -1, off: 0, chosen: false, player: null, poll: null, dead: false };
  cur = c;
  const clip = $(".clip", item);
  clip.innerHTML = panelHTML(t);
  item.querySelector(".song").setAttribute("aria-expanded", "true");
  void clip.offsetHeight;                               // 열리는 모션이 시작 상태에서 출발하도록
  item.classList.add("open");
  setTimeout(() => item.scrollIntoView({ behavior: "smooth", block: "nearest" }), 120);

  // 가사
  const ly = await ensureLyrics();
  if (c.dead) return;
  const rec = ly && ly[ti];
  c.off = rec && Number.isFinite(rec.o) ? rec.o : 0;           // 곡별 보정값(lyrics-offsets.json)
  if (!rec) {
    const box = $(".lyr", clip);
    box.classList.add("static");
    box.insertAdjacentHTML("beforeend", `<div class="empty-note">${ly ? "이 곡은 가사 데이터가 없어요." : "가사 데이터(data/lyrics.json)가 없어서 영상만 재생합니다."}</div>`);
  } else {
    c.cands = rec.c;
    useCand(c, Math.max(0, rec.c.findIndex((x) => x.l.some((r) => r[0] != null))));
  }

  // 영상
  try {
    await loadYT();
    if (c.dead) return;
    const opts = { videoId: t.vid, playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1 }, host: "https://www.youtube-nocookie.com",
      events: {
        onReady: (e) => { try { e.target.playVideo(); } catch { /* 자동재생이 막히면 직접 ▶ */ } },
        onStateChange: (e) => { if (e.data === 1) startPoll(c); else stopPoll(c); },
        onError: () => showFail(c, "이 영상은 사이트 안에서 재생할 수 없어요."),
      } };
    if (location.protocol.startsWith("http")) opts.playerVars.origin = location.origin;
    c.player = new YT.Player($(".mount", clip), opts);
  } catch { showFail(c, "YouTube 플레이어를 불러오지 못했어요."); }
}
function useCand(c, i) {
  const cand = c.cands[i]; if (!cand) return;
  c.idx = i; c.k = -1;
  const clip = $(".clip", c.item), box = $(".lyr", clip), linesEl = $(".ly-lines", clip);
  const hl = new Set(cand.h[c.wid] || []);
  const synced = cand.l.some((r) => r[0] != null);
  c.times = synced ? cand.l.map((r) => r[0]) : [];
  linesEl.innerHTML = cand.l.map((r, j) => `<button type="button" class="ln${hl.has(j) ? " hit" : ""}" data-i="${j}">${esc(r[1] || "♪")}</button>`).join("");
  linesEl.style.setProperty("--y", "0px");
  box.classList.toggle("static", !synced);
  const hits = $(".hits", clip);
  const chips = [...hl].filter((j) => cand.l[j][0] != null).slice(0, 6).map((j) => `<button type="button" class="hit-btn" data-t="${cand.l[j][0]}">▶ ${fmtT(cand.l[j][0])}</button>`);
  hits.innerHTML = chips.length ? `<span>단어가 나오는 곳</span>${chips.join("")}` : hl.size ? "강조된 줄에 단어가 나와요" : "";
}
// 영상 길이를 알게 되면, 길이가 가장 비슷한 가사 후보로 바꾼다 (켄시 도서관과 같은 방식)
function chooseByDuration(c) {
  if (c.chosen || c.dead || !c.cands.length || !c.player || typeof c.player.getDuration !== "function") return;
  const dur = c.player.getDuration(); if (!dur) return;
  c.chosen = true;
  let best = -1, bd = Infinity;
  c.cands.forEach((x, i) => { if (!x.l.some((r) => r[0] != null)) return; const d = Math.abs((x.d || 0) - dur); if (d < bd) { bd = d; best = i; } });
  if (best >= 0 && best !== c.idx) useCand(c, best);
}
function showFail(c, msg) {
  if (c.dead) return;
  const scr = $(".screen", c.item); if (!scr) return;
  scr.innerHTML = `<div class="fail"><span>${msg}</span><a href="https://www.youtube.com/watch?v=${encodeURIComponent(c.vid)}" target="_blank" rel="noopener">YouTube에서 열기 ↗</a></div>`;
}
function startPoll(c) { stopPoll(c); chooseByDuration(c); c.poll = setInterval(() => tick(c), 200); tick(c); }
function stopPoll(c) { if (c.poll) { clearInterval(c.poll); c.poll = null; } }
function tick(c) {
  if (c.dead || !c.player || !c.times.length || typeof c.player.getCurrentTime !== "function") return;
  const t = c.player.getCurrentTime() + c.off;
  let k = -1;
  for (let i = 0; i < c.times.length; i++) { if (c.times[i] != null && c.times[i] <= t) k = i; else if (c.times[i] != null) break; }
  if (k !== c.k) setLine(c, k);
}
function setLine(c, k) {
  c.k = k;
  const els = c.item.querySelectorAll(".ln");
  els.forEach((e, j) => e.classList.toggle("now", j === k));
  const el = els[k]; const lines = $(".ly-lines", c.item);
  if (lines) lines.style.setProperty("--y", el ? (el.offsetTop + el.offsetHeight / 2) + "px" : "0px");
}
function closePanel(instant = false) {
  const c = cur; if (!c) return;
  cur = null; c.dead = true; stopPoll(c);
  const { item } = c, clip = $(".clip", item);
  try { c.player && c.player.destroy && c.player.destroy(); } catch { /* 이미 정리됨 */ }
  const btn = item.querySelector(".song"); if (btn) btn.setAttribute("aria-expanded", "false");
  item.classList.remove("open");
  if (instant) { if (clip) clip.innerHTML = ""; }
  else setTimeout(() => { if (!item.classList.contains("open") && clip) clip.innerHTML = ""; }, 760);
}
function wirePanel() {
  const res = $("#result");
  res.addEventListener("click", (e) => {
    const item = e.target.closest(".item"); if (!item) return;
    if (e.target.closest(".close")) return closePanel();
    if (e.target.closest(".song")) return openPanel(item);
    if (!cur || cur.item !== item) return;
    const ln = e.target.closest(".ln"), hb = e.target.closest(".hit-btn");
    const seek = (sec) => { if (cur.player && cur.player.seekTo) { cur.player.seekTo(Math.max(0, sec - cur.off), true); cur.player.playVideo && cur.player.playVideo(); } };
    if (ln && cur.times.length && cur.times[+ln.dataset.i] != null) seek(cur.times[+ln.dataset.i]);
    else if (hb) seek(+hb.dataset.t);
  });
  // 크기 조절: 가로(영상 폭) / 세로(패널 높이)
  const root = document.documentElement;
  try { const vw = localStorage.getItem("kjw-vw"), ph = localStorage.getItem("kjw-ph"); if (vw) root.style.setProperty("--vw", vw); if (ph) root.style.setProperty("--ph", ph); } catch { /* 무시 */ }
  res.addEventListener("pointerdown", (e) => {
    const h = e.target.closest(".grip, .vgrip"); if (!h) return;
    const axis = h.classList.contains("grip") ? "x" : "y";
    const panel = h.closest(".panel"), r = panel.getBoundingClientRect();
    panel.classList.add("drag"); h.setPointerCapture(e.pointerId);
    const mv = (ev) => {
      if (axis === "x") root.style.setProperty("--vw", Math.min(70, Math.max(28, (ev.clientX - r.left) / r.width * 100)) + "%");
      else root.style.setProperty("--ph", Math.min(620, Math.max(230, ev.clientY - r.top)) + "px");
      if (cur) setLine(cur, cur.k);
    };
    const up = () => {
      panel.classList.remove("drag"); h.removeEventListener("pointermove", mv); h.removeEventListener("pointerup", up);
      try { localStorage.setItem("kjw-vw", root.style.getPropertyValue("--vw")); localStorage.setItem("kjw-ph", root.style.getPropertyValue("--ph")); } catch { /* 무시 */ }
      if (cur) setLine(cur, cur.k);
    };
    h.addEventListener("pointermove", mv); h.addEventListener("pointerup", up);
  });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && cur) closePanel(); });
  addEventListener("resize", () => { placePill(); if (cur) setLine(cur, cur.k); });
}

// ---------- 화면: 단어장 ----------
function renderBook() {
  const showG = $("#showGrammar").checked, out = [];
  for (const u of [1, 2, 3]) {
    if (state.unit && state.unit !== u) continue;
    const ws = state.words.filter((w) => w.unit === u && (showG || w.kind !== "grammar"));
    out.push(`<section class="unit"><h2>${u}과 <span>${esc(UNIT_TITLE[u])}</span><small>${UNIT_PAGES[u]} · ${ws.length}개</small></h2><div class="grid">${ws.map((w) => {
      const ix = idx(w.id), n = ix.t.length;
      const cls = ix.mode === "skip" ? " skip" : n === 0 ? " zero" : "";
      const note = ix.mode === "skip" ? "검색 제외" : n ? `${n}곡` : "가사에 없음";
      return `<button type="button" class="wc${cls}" data-w="${w.id}"><span class="jp">${esc(w.w)}${w.kanji ? `<small> ${esc(w.kanji)}</small>` : ""}</span><span class="ko">${esc(w.ko)}</span><span class="n">${note}</span></button>`;
    }).join("")}</div></section>`);
  }
  $("#bookList").innerHTML = out.join("");
}

// ---------- 흐름 ----------
function select(wid, { push = true, fill = true } = {}) {
  state.wid = wid;
  const w = state.words.find((x) => x.id === wid);
  if (w && fill) $("#q").value = w.w.replace(/^[～-]/, "");
  if (push && wid) history.replaceState(null, "", `#w=${wid}`);
  setTab("search");
  renderSuggest(state.q ? searchWords(state.q) : w ? [w] : []);
  renderResult();
  if (w) $("#result").scrollIntoView({ block: "nearest" });
}
function onInput() {
  state.q = $("#q").value;
  const list = searchWords(state.q);
  if (!state.q.trim()) { state.wid = null; renderSuggest([]); renderResult(); return; }
  if (!list.some((w) => w.id === state.wid)) state.wid = list[0] ? list[0].id : null;
  renderSuggest(list);
  if (!list.length) { $("#result").hidden = false; $("#empty").hidden = true; $("#result").innerHTML = `<p class="none">‘${esc(state.q)}’ — 교과서 1~3단원 단어에서 찾지 못했어요. 히라가나나 한자, 한국어 뜻으로도 검색해 보세요.</p>`; return; }
  renderResult();
}
function setTab(tab) {
  state.tab = tab;
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
  $("#viewSearch").hidden = tab !== "search";
  $("#viewBook").hidden = tab !== "book";
  if (tab === "book") renderBook();
}

function wire() {
  let timer;
  $("#q").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(onInput, 120); });
  $("#searchForm").addEventListener("submit", (e) => { e.preventDefault(); onInput(); $("#q").blur(); });
  $("#suggest").addEventListener("click", (e) => { const b = e.target.closest("[data-w]"); if (b) select(b.dataset.w, { fill: false }); });
  $("#bookList").addEventListener("click", (e) => { const b = e.target.closest("[data-w]"); if (b) { state.q = ""; select(b.dataset.w); window.scrollTo({ top: 0, behavior: "smooth" }); } });
  $("#result").addEventListener("click", (e) => {
    const b = e.target.closest("[data-sort]"); if (!b) return;
    state.sort = state.sortKey = b.dataset.sort;
    document.querySelectorAll("#seg button").forEach((x) => x.classList.toggle("on", x === b));
    placePill(); drawSongs();
  });
  wirePanel();
  document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));
  document.querySelectorAll("[data-goto]").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.goto)));
  $("#unitChips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-unit]"); if (!b) return;
    state.unit = +b.dataset.unit;
    document.querySelectorAll("#unitChips .chip").forEach((c) => c.classList.toggle("on", c === b));
    if (state.tab === "book") renderBook(); else if (state.q.trim()) onInput();
  });
  $("#showGrammar").addEventListener("change", renderBook);
  addEventListener("hashchange", () => { const m = /w=(w\d+)/.exec(location.hash); if (m && m[1] !== state.wid) select(m[1], { push: false }); });
}

async function main() {
  try {
    [state.words, state.tracks] = await Promise.all([getJSON("data/words.json"), getJSON("data/tracks.json")]);
    const ix = await getJSON("data/index.json");
    state.index = ix.words; state.built = ix.built;
  } catch (e) {
    const el = $("#error"); el.hidden = false;
    el.innerHTML = location.protocol === "file:"
      ? "파일을 더블클릭해서 연 상태에서는 데이터를 읽을 수 없어요. 폴더에서 <code>python3 -m http.server</code> 를 실행한 뒤 <code>http://localhost:8000</code> 으로 열어 주세요."
      : `데이터를 불러오지 못했어요 (${esc(e.message)}).`;
    return;
  }
  const v = await getJSON("data/views.json", true);
  if (v && v.views) { state.views = v.views; state.viewsUpdated = v.updated; }
  if (!Object.keys(state.views).length) {
    const b = $("#banner"); b.hidden = false;
    b.textContent = "조회수 데이터가 아직 없어서 가사 속 등장 횟수순으로 보여줘요. (YouTube 조회수는 관리자가 갱신하면 나타납니다)";
  }
  $("#stamp").textContent = `곡 ${state.tracks.length}개 · 교과서 단어 ${state.words.length}개 · 색인 ${state.built}` + (state.viewsUpdated ? ` · 조회수 ${state.viewsUpdated.slice(0, 10)}` : "");
  wire();
  document.fonts && document.fonts.ready.then(placePill);
  const p = new URLSearchParams(location.search), m = /w=(w\d+)/.exec(location.hash);
  if (m) select(m[1], { push: false });
  else if (p.get("q")) { $("#q").value = p.get("q"); onInput(); }
}
main();
