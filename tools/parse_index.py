"""교과서 '찾아보기'(PDF 156~163쪽)를 단어 목록으로 변환한다.
usage: python3 parse_index.py <txt 폴더> <out.json>   (txt 폴더에는 p156.txt ... p163.txt)"""
import re, json, sys, os
src, out = sys.argv[1], sys.argv[2]
HDR = set("あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん")
entries, buf = [], ""
for pg in range(156, 164):
    f = os.path.join(src, f"p{pg}.txt")
    if not os.path.exists(f): continue
    for raw in open(f, encoding="utf-8").read().split("\n"):
        line = raw.replace("　", " ").strip()
        if not line or line == str(pg): continue
        if ".indd" in line or line.startswith("찾아보기"): continue   # 쪽 머리글(인쇄 정보) 제거
        if line.startswith("◆") or line.startswith("어휘입니다") : continue
        if len(line) == 1 and line in HDR: continue
        if line == "기타": continue                              # 찾아보기의 '기타'(알파벳 시작 단어) 구역 제목
        cur = (buf + " " + line).strip() if buf else line
        m = re.match(r"^(.*?)[\s\t]+(\d{1,3})\s*$", cur)
        if not m:
            buf = cur            # 뜻이 다음 줄로 이어지는 경우
            continue
        buf = ""
        body, page = m.group(1).strip(), int(m.group(2))
        # 단어 / 뜻 분리: 탭·공백 우선, 없으면 첫 한글에서 분리
        parts = re.split(r"[\t ]+", body, maxsplit=1)
        w = parts[0]; mean = parts[1] if len(parts) > 1 else ""
        mm = re.match(r"^([^가-힣]+)([가-힣].*)$", w)
        if mm: w, mean = mm.group(1), (mm.group(2) + " " + mean).strip()
        entries.append({"raw": w, "meaning": mean.strip(), "page": page, "pdfpage": pg})
json.dump(entries, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(entries), "entries;", sum(1 for e in entries if 10 <= e["page"] <= 57), "in pages 10-57")
