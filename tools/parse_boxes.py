"""단원 본문(10~57쪽)의 '단어' 박스에서 단어를 뽑아 찾아보기에 없는 것만 보충한다.
usage: python3 parse_boxes.py <txt 폴더> <words.json(찾아보기 기준)> <out.json>"""
import re, json, sys, os
src, wjson, out = sys.argv[1:4]
words = json.load(open(wjson, encoding="utf-8"))
UNITS = {1: (10, 25), 2: (26, 41), 3: (42, 57)}
unit_of = lambda p: next((u for u, (a, b) in UNITS.items() if a <= p <= b), None)
def plain(s): return re.sub(r"[～\-\s]", "", s)
known = set()
for w in words:
    known.add(plain(w["w"]))
    for part in re.split(r"[/･]", w["w"]): known.add(plain(part))
    if w["kanji"]:
        for part in re.split("･", w["kanji"]): known.add(plain(part))
HAN = re.compile(r"[가-힣]")
extra, seen = [], set()
for p in range(10, 58):
    f = os.path.join(src, f"p{p:03d}.txt")
    for line in open(f, encoding="utf-8").read().split("\n"):
        line = line.replace(" ", " ")
        if not re.search(r" {3,}", line) or not HAN.search(line): continue
        for tok in re.split(r" {3,}", line):
            tok = re.sub(r"단어$", "", tok.strip()).strip()
            m = re.search(r"[가-힣~]", tok)
            if not m: continue
            w, ko = tok[:m.start()].strip(), tok[m.start():].strip()
            if not w or not re.search(r"[ぁ-んァ-ヶ一-龥]", w) or re.search(r"[。？！?!,、\d]", w): continue
            base = ""
            bm = re.search(r"\(기본형\s*([^)\s]+)\)?", ko)
            if bm: base = bm.group(1); ko = (ko[:bm.start()] + ko[bm.end():]).strip()
            key = plain(w)
            if key in known or (key, ko) in seen: continue
            seen.add((key, ko))
            extra.append({"w": w, "kanji": "", "ko": ko, "unit": unit_of(p), "page": p, "base": base, "src": "box"})
json.dump(extra, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(extra), "extra from boxes")
for e in extra: print(e["page"], e["w"], "|", e["ko"], "|", e["base"])
