"""교과서 PDF → 쪽별 txt (찾아보기 156~163쪽, 단원 10~57쪽). 교과서 본문은 저작물이므로 결과 txt는 저장소에 올리지 않는다.
usage: python3 tools/extract_textbook.py <교과서.pdf> <출력 폴더>
이후: parse_index.py → clean_words.py → parse_boxes.py → merge_words.py 순서로 실행 (README 참고)"""
import sys, os, pypdf
pdf, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
r = pypdf.PdfReader(pdf)
for i in list(range(9, 57)) + list(range(155, 163)):
    open(os.path.join(out, f"p{i+1:03d}.txt"), "w", encoding="utf-8").write(r.pages[i].extract_text() or "")
print("done", out)
