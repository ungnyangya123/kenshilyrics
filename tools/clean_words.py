"""parse_index.py 결과를 정리해 단원(1~3)을 붙이고 words.json 으로 저장."""
import re, json, sys
src, out = sys.argv[1], sys.argv[2]
UNITS = {1: (10, 25), 2: (26, 41), 3: (42, 57)}   # 목차: 1단원 10쪽, 2단원 26쪽, 3단원 42쪽, 4단원 58쪽
def unit_of(p):
    for u, (a, b) in UNITS.items():
        if a <= p <= b: return u
res = []
for e in json.load(open(src, encoding="utf-8")):
    u = unit_of(e["page"])
    if not u: continue
    raw = e["raw"]
    m = re.match(r"^(.*?)[\(<\[（](.+?)[\)>\]）]?$", raw)   # 기본(한자) 형태
    kana, kanji = (m.group(1), m.group(2).rstrip(")>]")) if m else (raw, "")
    kana = kana.strip()
    meaning = re.sub(r"[\x07\s]+", " ", e["meaning"]).strip()
    meaning = re.sub(r",\s+", ", ", meaning)
    res.append({"w": kana, "kanji": kanji, "ko": meaning, "unit": u, "page": e["page"], "raw": raw})
json.dump(res, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
from collections import Counter
print(len(res), "words;", dict(Counter(x["unit"] for x in res)))
