"""찾아보기(words) + 단어 박스(extra) → data/words.json
usage: python3 merge_words.py <words.json> <extra.json> <out words.json>"""
import re, json, sys
wj, ej, out = sys.argv[1:4]
words = json.load(open(wj, encoding="utf-8"))
extra = json.load(open(ej, encoding="utf-8"))

# --- 단어 박스 파싱 보정(수동) ---
FIX = {"さく (": ("さく", "(꽃이) 피다")}
BASE_MANUAL = {"できますか": "できる", "まにあって": "まにあう", "よかった": "よい", "きてね": "くる", "いって": "いく"}
DROP = {"ポップ"}                       # Jポップ / Kポップ 로 이미 있음
plain = lambda s: re.sub(r"[～\-\s]", "", s)

entries = []
for w in words:
    entries.append({"w": w["w"], "kanji": w["kanji"], "ko": w["ko"], "unit": w["unit"], "page": w["page"], "src": "index"})
byplain = {}
for e in entries:
    byplain.setdefault(plain(e["w"]), e)
    for part in re.split(r"[/･]", e["w"]): byplain.setdefault(plain(part), e)

for x in extra:
    w, ko = x["w"], x["ko"]
    if w in DROP: continue
    if w in FIX: w, ko = FIX[w]
    w = re.sub(r"\s+", " ", w).strip()
    if plain(w) in byplain: continue           # 찾아보기에 이미 있는 단어
    base = x.get("base") or BASE_MANUAL.get(plain(w), "")
    tgt = byplain.get(plain(base)) if base else None
    if tgt is not None:                       # 활용형 → 기본형 항목의 별칭
        tgt.setdefault("alias", []).append({"w": w, "ko": ko})
        continue
    entries.append({"w": w, "kanji": "", "ko": ko, "unit": x["unit"], "page": x["page"], "src": "box"})

# --- 분류 ---
PARTICLE = set("はがのにをでとももかねよてへやから")
def kind(e):
    w = e["w"]
    if w.startswith(("～", "-")) or w.endswith(("-", "～")) or plain(w) in PARTICLE or "･" in w and w.startswith("～"):
        return "grammar"
    if " " in w or w.endswith(("ます", "です")) and len(plain(w)) > 4 or re.search(r"(ください|ましょう|ございます|ありがとう|おねがい|こちらこそ|はじめまして|いってきます|いただきます|おじゃまします|ただいま)", w):
        return "phrase"
    return "word"
for e in entries:
    e["kind"] = kind(e)
entries.sort(key=lambda e: (e["unit"], e["page"]))
for i, e in enumerate(entries, 1): e["id"] = f"w{i:03d}"
json.dump(entries, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
from collections import Counter
print(len(entries), "entries", dict(Counter(e["unit"] for e in entries)), dict(Counter(e["kind"] for e in entries)))
print("alias:", [(e["w"], [a["w"] for a in e["alias"]]) for e in entries if e.get("alias")])
print("grammar:", [e["w"] for e in entries if e["kind"] == "grammar"])
print("phrase:", [e["w"] for e in entries if e["kind"] == "phrase"])
