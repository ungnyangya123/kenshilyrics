#!/usr/bin/env node
// 곡별 YouTube 조회수를 받아 data/views.json 에 저장한다.
//   YOUTUBE_API_KEY=발급받은키 node tools/fetch-views.mjs        (맥/리눅스)
//   $env:YOUTUBE_API_KEY="발급받은키"; node tools/fetch-views.mjs  (윈도우 PowerShell)
// YouTube Data API v3 의 videos.list 는 요청 1번(영상 최대 50개)에 1유닛이라, 곡 169개 = 4유닛(하루 기본 10,000유닛).
import fs from "node:fs";

const key = process.env.YOUTUBE_API_KEY;
if (!key) {
  console.error("YOUTUBE_API_KEY 가 없어요. README 의 'YouTube API 키' 부분을 보고 키를 만든 뒤 환경변수로 넣어 주세요.");
  process.exit(1);
}
const tracks = JSON.parse(fs.readFileSync("data/tracks.json", "utf8"));
const ids = [...new Set(tracks.map((t) => t.vid).filter(Boolean))];

let prev = {};
try { prev = JSON.parse(fs.readFileSync("data/views.json", "utf8")).views || {}; } catch { /* 처음 실행 */ }

const views = { ...prev };
let got = 0;
const missing = [];
for (let i = 0; i < ids.length; i += 50) {
  const chunk = ids.slice(i, i + 50);
  const url = `${process.env.YT_API_BASE || "https://www.googleapis.com/youtube/v3"}/videos?part=statistics&id=${chunk.join(",")}&key=${encodeURIComponent(key)}`;
  const r = await fetch(url);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = body.error || {};
    const why = (e.errors && e.errors[0] && e.errors[0].reason) || e.status || r.status;
    console.error(`YouTube API 오류 (${r.status} ${why}): ${e.message || ""}`.trim());
    console.error("→ keyInvalid: 키가 틀림 / accessNotConfigured: 'YouTube Data API v3' 사용 설정 안 됨 / quotaExceeded: 하루 할당량 초과");
    process.exit(1); // views.json 은 건드리지 않음
  }
  const seen = new Set();
  for (const it of body.items || []) {
    seen.add(it.id);
    const n = Number(it.statistics && it.statistics.viewCount);
    if (Number.isFinite(n)) { views[it.id] = n; got++; }
  }
  for (const id of chunk) if (!seen.has(id)) missing.push(id);
}
fs.writeFileSync("data/views.json", JSON.stringify({ updated: new Date().toISOString(), views }));
console.log(`조회수 ${got}/${ids.length}개 갱신`);
if (missing.length) {
  const title = new Map(tracks.map((t) => [t.vid, t.title]));
  console.warn("응답에 없는 영상(삭제·비공개 가능성, 이전 값 유지):", missing.map((id) => `${id}(${title.get(id)})`).join(", "));
}
