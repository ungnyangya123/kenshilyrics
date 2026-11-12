#!/usr/bin/env node
// 켄시 라이브러리의 가사(raw/lyrics.json)에서 교과서 단어(data/words.json)가 나오는 곡을 찾아 색인을 만든다.
//
//   node tools/build-index.mjs                 # raw/ 의 파일로 data/tracks.json, data/index.json 생성
//   node tools/build-index.mjs --lines         # + data/lines.json (단어가 나온 가사 줄 예시, 비공개 배포 전용!)
//   node tools/build-index.mjs --lyrics        # + data/lyrics.json (인앱 재생 패널용 시간 가사 전체, 비공개 배포 전용!)
//   node tools/build-index.mjs --find 歌う      # 이 단어가 어느 곡 어느 줄에서 잡혔는지 확인(검증용)
//
// 입력 (raw/ 폴더, git 에 올라가지 않음):
//   lyrics-offsets.json = (선택) 켄시 라이브러리의 data/lyrics-offsets.json  — 곡별 싱크 보정값
//   lyrics.json  = 켄시 라이브러리의 data/lyrics.json   (곡마다 가사 후보 c:[{l|p, d, a, n}])
//   library.json = 켄시 라이브러리의 data/library.json  (앨범·곡·YouTube 영상 ID)
//
// 형태소 분석기 없이 "표기 + 활용형 규칙"으로 찾는다(의존 패키지 없음). 한계는 README 참고.

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : def; };
const RAW = opt("--raw", "raw");
const OUT = opt("--out", "data");
const WITH_LINES = args.includes("--lines");
const WITH_LYRICS = args.includes("--lyrics");
const FIND = opt("--find", "");

const readJSON = (f) => {
  if (!fs.existsSync(f)) {
    console.error(`파일이 없어요: ${f}\n→ 켄시 라이브러리의 public/data/lyrics.json, library.json 을 ${RAW}/ 폴더에 복사한 뒤 다시 실행하세요. (data/words.json 은 저장소에 들어 있습니다)`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(f, "utf8"));
};
const lyricsData = readJSON(path.join(RAW, "lyrics.json"));
const manualFile = path.join(RAW, "lyrics-manual.json");
if (fs.existsSync(manualFile)) Object.assign(lyricsData, readJSON(manualFile)); // 직접 싱크한 가사가 우선
const library = readJSON(path.join(RAW, "library.json"));
const words = readJSON(path.join(OUT, "words.json"));

// ---------------------------------------------------------------------------
// 1. 가사 정리 (켄시 라이브러리 main.js 의 parseLRC 와 같은 규칙)
// ---------------------------------------------------------------------------
const VI_RE = /[ạảãàáâầấẩẫậăằắẳẵặẹẻẽèéêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđĐ]/; // 베트남어 번역 줄
const CREDIT_RE = /^(作词|作詞|作曲|编曲|編曲|制作人|製作人|词|詞|曲)\s*[:：]/;                     // 작사·작곡 크레딧 줄
const hasKana = (s) => /[぀-ヿ]/.test(s);
const hasCJK = (s) => /[一-鿿]/.test(s);

function isRomajiLRC(text) {
  const L = String(text).split(/\r?\n/).map((x) => x.replace(/\[[^\]]*\]/g, "").trim()).filter(Boolean);
  if (L.length < 8) return false;
  return L.filter((x) => /[A-Za-z]{2,}/.test(x) && !/[぀-ヿ一-鿿]/.test(x)).length / L.length >= 0.8;
}
function timedOf(cand) {                       // [{t: 초|null, x: 가사 줄}]
  const raw = cand.l || cand.p || "";
  const out = [];
  for (const row of String(raw).split(/\r?\n/)) {
    const text = row.replace(/\[[^\]]*\]/g, "").trim();
    if (!text || VI_RE.test(text) || CREDIT_RE.test(text)) continue;
    const m = /^\s*\[(\d+):(\d+(?:\.\d+)?)\]/.exec(row);
    out.push({ t: m ? Math.round((+m[1] * 60 + +m[2]) * 100) / 100 : null, x: text });
  }
  return out;
}
const linesOf = (cand) => timedOf(cand).map((o) => o.x);
// 곡마다 후보 하나를 고른다: 싱크 가사(l) 우선, 로마자 표기본 제외. (사이트의 기본 선택과 같은 기준)
function pickCandidate(entry) {
  const cands = (entry && entry.c) || [];
  const ok = cands.filter((c) => (c.l || c.p) && !isRomajiLRC(c.l || c.p));
  return ok.find((c) => c.l) || ok[0] || null;
}

// 비교용 정규화: 호환 문자 통일 후 일본어 글자·영문·숫자만 남김(공백·기호 제거)
const norm = (s) => s.normalize("NFKC").toLowerCase().replace(/[^぀-ヿ一-鿿々a-z0-9ー]/g, "");

// ---------------------------------------------------------------------------
// 2. 단어 → 찾을 문자열 만들기 (활용형 규칙)
// ---------------------------------------------------------------------------
const A = { う: "わ", く: "か", ぐ: "が", す: "さ", つ: "た", ぬ: "な", ぶ: "ば", む: "ま", る: "ら" };
const I = { う: "い", く: "き", ぐ: "ぎ", す: "し", つ: "ち", ぬ: "に", ぶ: "び", む: "み", る: "り" };
const E = { う: "え", く: "け", ぐ: "げ", す: "せ", つ: "て", ぬ: "ね", ぶ: "べ", む: "め", る: "れ" };
const O = { う: "お", く: "こ", ぐ: "ご", す: "そ", つ: "と", ぬ: "の", ぶ: "ぼ", む: "も", る: "ろ" };
const TE = { う: ["っ", "て", "た"], つ: ["っ", "て", "た"], る: ["っ", "て", "た"], く: ["い", "て", "た"], ぐ: ["い", "で", "だ"], す: ["し", "て", "た"], ぬ: ["ん", "で", "だ"], ぶ: ["ん", "で", "だ"], む: ["ん", "で", "だ"] };
const VERB_END = "うくぐすつぬぶむる";
const ICHIDAN_PREV = /[いきしちにひみりびぎじえけせてねへめれべげで一-鿿]$/; // 앞 글자가 い·え단이거나 한자면 1단 동사일 수도 있음

function verbForms(w, { godan = true, ichidan = true } = {}) {
  const L = w.slice(-1), stem = w.slice(0, -1), out = new Set([w]);
  if (godan) {
    const [sp, te, ta] = TE[L];                    // 行く/いく 는 SPECIAL 에서 따로 처리
    out.add(stem + A[L] + "ない"); out.add(stem + A[L] + "れ");
    for (const f of ["ます", "ました", "ません", "たい", "ながら", "そう"]) out.add(stem + I[L] + f);
    out.add(stem + sp + te); out.add(stem + sp + ta);
    out.add(stem + E[L] + "ば"); out.add(stem + E[L] + "る"); out.add(stem + O[L] + "う");
  }
  if (ichidan && L === "る") {
    for (const f of ["て", "た", "ない", "ます", "ました", "ません", "たい", "よう", "れば", "られ", "させ", "ながら", "そう"]) out.add(stem + f);
  }
  return [...out];
}
function iAdjForms(w) {
  const stem = w.slice(0, -1);
  if (stem.length < 2 && !hasCJK(stem)) return [w];            // いい 같은 1글자 어간은 기본형만
  return [w, ...["く", "かっ", "くて", "くない", "ければ", "そう", "さ"].map((f) => stem + f)];
}
const SPECIAL = {
  する: ["する", "して", "した", "しない", "します", "しました", "しません", "しよう", "すれば", "される", "させる", "しながら"],
  くる: ["くる", "きて", "きた", "こない", "きます", "きました", "こよう", "くれば", "こられ", "くれ"],
  来る: ["来る", "来て", "来た", "来ない", "来ます", "来ました", "来よう", "来れば", "来られ"],
  いく: ["いく", "いって", "いった", "いかない", "いきます", "いきました", "いこう", "いけば", "いけ"],
  行く: ["行く", "行って", "行った", "行かない", "行きます", "行きました", "行こう", "行けば", "行け"],
  くださる: ["くださる", "ください", "くださっ", "くださいま", "くださら"],
  ある: ["ある", "あって", "あった", "あれば", "あります", "ありました", "ありません", "あろう"],
  いる: ["いる", "いて", "いた", "いない", "います", "いました", "いません", "いよう", "いれば"],
  居る: ["居る", "居て", "居た", "居ない", "居ます", "居ました", "居ません", "居よう", "居れば"],
  できる: ["できる", "できて", "できた", "できない", "できます", "できました", "できません", "できれば", "できよう", "出来る", "出来て", "出来た", "出来ない"],
};
const ALT = [["ようび", "曜日"], ["だち", "達"], ["こども", "子供"]];     // 표기 변이

function formsFor(surface, isPredicate) {
  if (SPECIAL[surface]) return SPECIAL[surface];
  const last = surface.slice(-1);
  if (isPredicate && VERB_END.includes(last) && surface.length >= 2) {
    const prev = surface.slice(-2, -1);
    const both = last === "る" && ICHIDAN_PREV.test(surface.slice(0, -1));
    const ichidanOnly = false;
    return verbForms(surface, { godan: true, ichidan: both || ichidanOnly });
  }
  if (isPredicate && last === "い" && surface.length >= 2) return iAdjForms(surface);
  return [surface];
}

function compileEntry(e) {
  const strip = (s) => s.replace(/[～\-\s]/g, "");
  const kanaForms = String(e.w).split(/[/･]/).map(strip).filter(Boolean);
  const kanjiForms = String(e.kanji || "").split(/[･]/).map(strip).filter((s) => hasCJK(s));
  const predicate = e.kind === "word" && /다(,|$|\s)/.test(e.ko) && !/(ます|です)$/.test(e.w);
  const patterns = new Map();                       // 문자열 → {s, b}
  const add = (str, boundary = false) => { const n = norm(str); if (n) patterns.set(n, { s: n, b: boundary }); };

  const coreKana = Math.max(...kanaForms.map((x) => x.length));
  const hasKanjiForm = kanjiForms.length > 0;
  let mode = "all", prec = "high";
  if (e.kind === "grammar") mode = "skip";                                   // 조사·어미·접사: 거의 모든 곡에 나와 의미가 없음
  else if (!hasKanjiForm && coreKana <= 1) mode = "skip";                    // あ·え 같은 한 글자 감탄사
  else if (hasKanjiForm && coreKana <= 2) mode = "kanji";                    // 짧은 가나(いく·あめ…)는 잡음이 많아 한자 표기만 집계
  else if (!hasKanjiForm && coreKana <= 2) prec = "low";                     // する·ある·ここ 등: 다른 단어 속에서도 잡힘
  if (mode === "skip") return { mode, prec: "low", patterns: [] };

  // 한자 표기 변이(土ようび→土曜日 등)
  const kanjiAll = new Set(kanjiForms);
  for (const k of kanjiForms) for (const [a, b] of ALT) if (k.includes(a)) kanjiAll.add(k.replace(a, b));
  for (const k of kanjiAll) {
    if (k.length === 1) add(k, true);                // 한 글자 한자: 앞뒤가 한자면 복합어이므로 제외
    else for (const f of formsFor(k, predicate)) add(f);
  }
  if (mode === "all") {
    for (const k of kanaForms) {
      if (k.length === 1 && !hasKanjiForm) continue;
      for (const f of formsFor(k, predicate)) add(f);
    }
  }
  for (const a of e.alias || []) add(strip(a.w));   // 교과서 박스의 활용형(できますか 등)
  return { mode, prec, patterns: [...patterns.values()].sort((x, y) => y.s.length - x.s.length) };
}

// ---------------------------------------------------------------------------
// 3. 곡 목록 만들기
// ---------------------------------------------------------------------------
const tracks = [];
const trackBy = new Map();
for (const item of library.items) {
  for (const t of item.tracks) {
    const key = `${item.id}|${t.n}`;
    const cand = pickCandidate(lyricsData[key]);
    const rec = {
      title: t.title, artist: item.artist, vid: t.v || "",
      album: { id: item.id, title: item.title, kind: item.kind, n: t.n, date: item.date || "" },
      lyr: Boolean(cand),
    };
    trackBy.set(key, tracks.length);
    const timed = cand ? timedOf(cand) : [];
    tracks.push({ rec, timed, lines: timed.map((o) => o.x) });
  }
}

// ---------------------------------------------------------------------------
// 4. 매칭
// ---------------------------------------------------------------------------
const isCJKch = (ch) => /[一-鿿々]/.test(ch || "");
function matchLine(nline, patterns) {
  const hits = [];                                   // [start, end)
  for (const p of patterns) {
    let from = 0, i;
    while ((i = nline.indexOf(p.s, from)) !== -1) {
      from = i + 1;
      if (p.b && (isCJKch(nline[i - 1]) || isCJKch(nline[i + p.s.length]))) continue;
      hits.push([i, i + p.s.length]);
    }
  }
  hits.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  let count = 0, end = -1;
  for (const [s, e] of hits) if (s >= end) { count++; end = e; }   // 겹치는 매칭은 하나로 셈
  return count;
}

const compiled = words.map((w) => ({ w, ...compileEntry(w) }));
const normLines = tracks.map((t) => t.lines.map((l) => ({ raw: l, n: norm(l) })));
const indexWords = {};
const lineEx = {};
const hitLines = {};                                   // 곡 번호 → { 단어 id: [가사 줄 번호…] }
const findKey = FIND.normalize("NFKC");
for (const c of compiled) {
  const hits = [];
  if (c.mode !== "skip") {
    tracks.forEach((tr, ti) => {
      let total = 0; const ex = [];
      const hl = [];
      normLines[ti].forEach((L, li) => {
        const n = matchLine(L.n, c.patterns);
        if (n) { total += n; hl.push(li); if (ex.length < 2) ex.push(L.raw); }
      });
      if (total && WITH_LYRICS) ((hitLines[ti] ||= {})[c.w.id] = hl);
      if (total) {
        hits.push([ti, total]);
        if (WITH_LINES) (lineEx[c.w.id] ||= {})[ti] = ex;
        if (findKey && (c.w.w.includes(findKey) || c.w.kanji.includes(findKey))) console.log(`[${c.w.w}] ${tr.rec.title} ×${total}: ${ex.join(" / ")}`);
      }
    });
  }
  indexWords[c.w.id] = { mode: c.mode, prec: c.prec, t: hits };
}

// ---------------------------------------------------------------------------
// 5. 저장
// ---------------------------------------------------------------------------
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "tracks.json"), JSON.stringify(tracks.map((t) => t.rec)));
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify({ version: 1, built: new Date().toISOString().slice(0, 10), words: indexWords }));
if (WITH_LINES) fs.writeFileSync(path.join(OUT, "lines.json"), JSON.stringify(lineEx));
else if (fs.existsSync(path.join(OUT, "lines.json"))) fs.rmSync(path.join(OUT, "lines.json")); // 옵션 없이 빌드하면 남아 있던 가사 줄 파일을 지운다
const lyFile = path.join(OUT, "lyrics.json");
if (WITH_LYRICS) {
  // 켄시 라이브러리와 같은 방식: 후보를 모두 담고(영상 길이로 사이트가 고름), 곡별 싱크 보정값(lyrics-offsets.json)을 함께 담는다.
  const offFile = path.join(RAW, "lyrics-offsets.json");
  const offsets = fs.existsSync(offFile) ? readJSON(offFile) : {};
  if (!fs.existsSync(offFile)) console.log(`(참고) ${offFile} 가 없어 싱크 보정값 없이 만듭니다.`);
  const parseLRC = (str) => {                                    // 켄시 라이브러리 main.js 의 parseLRC 와 같은 규칙
    const out = [];
    for (const row of String(str).split(/\r?\n/)) {
      const m = [...row.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
      if (!m.length) continue;
      const text = row.replace(/\[[^\]]*\]/g, "").trim();
      if (VI_RE.test(text) || CREDIT_RE.test(text)) continue;
      for (const x of m) out.push([Math.round((+x[1] * 60 + parseFloat(x[2])) * 100) / 100, text]);
    }
    return out.sort((a, b) => a[0] - b[0]);
  };
  const ly = {};
  library.items.forEach((item) => item.tracks.forEach((t) => {
    const key = `${item.id}|${t.n}`, ti = trackBy.get(key), entry = lyricsData[key];
    const cands = ((entry && entry.c) || []).filter((c) => (c.l || c.p) && !isRomajiLRC(c.l || c.p));
    const synced = cands.filter((c) => c.l), use = synced.length ? synced : cands.slice(0, 1);
    if (!use.length) return;
    const manual = use[0].a === "manual";
    const off = key in offsets ? Number(offsets[key]) : manual ? 0 : Number(offsets.default);
    const cs = use.map((c) => {
      const lines = c.l ? parseLRC(c.l) : linesOf(c).map((x) => [null, x]);
      const nl = lines.map((r) => norm(r[1]));
      const h = {};
      for (const cw of compiled) {
        if (cw.mode === "skip") continue;
        const hl = [];
        nl.forEach((n, li) => { if (n && matchLine(n, cw.patterns)) hl.push(li); });
        if (hl.length) h[cw.w.id] = hl;
      }
      return { d: c.d || 0, l: lines, h };
    });
    ly[ti] = { o: Number.isFinite(off) ? off : 0, c: cs };
  }));
  fs.writeFileSync(lyFile, JSON.stringify(ly));
} else if (fs.existsSync(lyFile)) fs.rmSync(lyFile);
if (!fs.existsSync(path.join(OUT, "views.json"))) fs.writeFileSync(path.join(OUT, "views.json"), JSON.stringify({ updated: null, views: {} }));

const used = Object.values(indexWords).filter((x) => x.t.length).length;
const skipped = compiled.filter((c) => c.mode === "skip").length;
console.log(`곡 ${tracks.length}개 (가사 있음 ${tracks.filter((t) => t.rec.lyr).length}) / 단어 ${words.length}개: 매칭 ${used}, 제외(조사·어미 등) ${skipped}, 곡 없음 ${words.length - used - skipped}`);
const noLyr = tracks.filter((t) => !t.rec.lyr).map((t) => `${t.rec.album.id}|${t.rec.album.n} ${t.rec.title}`);
if (noLyr.length) console.log("가사 없는 곡:", noLyr.join(", "));
