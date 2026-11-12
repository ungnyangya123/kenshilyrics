# 단어로 찾는 켄시 노래

일본어 회화 교과서(다락원, 22개정) **1~3과 단어**를 검색하면, 그 단어가 가사에 나오는 米津玄師·ハチ의 노래를 **YouTube 조회수 순**으로 보여주는 정적 사이트입니다. 서버가 없고 GitHub Pages로 올릴 수 있습니다.

## 폴더 구성

| 경로 | 내용 | git에 올라감 |
|---|---|---|
| `index.html` `style.css` `app.js` | 사이트 본체 | O |
| `data/words.json` | 교과서 1~3과 단어 292개 (표기·한자·뜻·과·쪽) | O |
| `data/tracks.json` | 곡 169개 (제목·앨범·YouTube 영상 ID) | O |
| `data/index.json` | 단어별로 나오는 곡과 횟수 (가사 원문 없음) | O |
| `data/views.json` | 곡별 조회수 (처음엔 비어 있음 → 아래 "조회수") | O |
| `tools/` | 데이터를 다시 만드는 스크립트 | O |
| `raw/` | 가사 원본(`lyrics.json`)·`library.json` | **X** (`.gitignore`) |
| `data/lyrics.json` | 인앱 재생 패널용 시간 가사 (선택, 비공개 배포 전용) | **X** (`.gitignore`) |

## 내 컴퓨터에서 미리보기

Node.js 18 이상이 필요합니다.

```
npm start            # http://localhost:8000 (파일을 더블클릭해서 열면 데이터를 못 읽어요)
```

## GitHub에 올리기

1. GitHub에서 새 저장소를 만듭니다. **Private 권장**(Private 저장소의 Pages는 Pro 이상 플랜 필요. 아래 "저작권" 참고).
2. 이 폴더에서:
   ```
   git init -b main
   git add .
   git commit -m "첫 커밋"
   git remote add origin https://github.com/<아이디>/<저장소>.git
   git push -u origin main
   ```
3. 저장소 **Settings → Pages → Build and deployment → Source** 를 **GitHub Actions** 로 바꿉니다.
4. **Actions 탭**에서 `deploy` 가 초록색으로 끝나면 `https://<아이디>.github.io/<저장소>/` 에서 열립니다.

> Private 저장소의 Pages는 유료 플랜(Pro/Team)에서만 됩니다. 무료 계정이면 ① 저장소를 Public으로 하되 아래 "저작권" 조건을 지키거나, ② 기존처럼 Netlify에 `index.html` 등을 올리세요. 이 사이트는 폴더째 끌어다 놓는 방식으로도 그대로 동작합니다.

## 인앱 재생 패널

곡을 누르면 그 아래로 패널이 열려 왼쪽에 YouTube 영상(공식 임베드), 오른쪽에 시간에 맞춰 흐르는 가사가 나옵니다. 영상/가사 사이 세로 막대와 패널 아래 가로 막대를 끌어 크기를 바꿀 수 있고(마지막 크기는 브라우저에 저장), 가사 줄을 누르면 그 시간으로 이동합니다. 검색한 단어가 나온 줄은 강조되고, 그 시간으로 바로 가는 버튼이 영상 아래에 나옵니다. 

- 가사는 `data/lyrics.json` 이 있어야 나옵니다. 없으면 영상만 재생합니다.
- 곡마다 가사 후보가 여럿이면 영상 길이에 가장 가까운 후보를 자동으로 고르고(켄시 도서관과 같음), 켄시 도서관의 `lyrics-offsets.json`(곡별 싱크 보정값)을 `raw/` 에 넣고 빌드하면 그 값이 시작값이 됩니다.
- 만들기: `raw/` 에 `lyrics.json`, `library.json` 을 넣고 `npm run build:lyrics`. **가사 원문이 들어 있으니 비공개 배포에서만 쓰세요.**
- 일부 영상은 소유자가 외부 재생을 막아 두어 "사이트 안에서 재생할 수 없어요"와 YouTube 링크가 나옵니다.
- 영상 자동재생은 브라우저 정책에 따라 막힐 수 있습니다(그때는 영상의 ▶를 누르세요).

## 조회수 (YouTube API 키)

조회수는 YouTube Data API가 있어야 받을 수 있어서, **처음에는 `data/views.json`이 비어 있고** 사이트는 "가사 속 등장 횟수순"으로 보여줍니다. 키를 만들어 넣으면 조회수순이 켜집니다.

**키 만들기** (무료, 곡 169개 갱신에 하루 할당량 10,000 중 4만 씁니다)
1. <https://console.cloud.google.com> 에서 프로젝트 만들기 → **API 및 서비스 → 라이브러리 → "YouTube Data API v3" → 사용**
2. **사용자 인증 정보 → 사용자 인증 정보 만들기 → API 키**
3. 만든 키 → **API 제한사항 → 키 제한 → YouTube Data API v3** 만 선택(권장). 애플리케이션 제한은 "없음"(GitHub Actions의 주소가 매번 달라서)

**방법 A — 내 컴퓨터에서 한 번 받아 올리기** (가장 단순)
```
# 맥/리눅스
YOUTUBE_API_KEY=여기에키 npm run views
# 윈도우 PowerShell
$env:YOUTUBE_API_KEY="여기에키"; npm run views

git add data/views.json && git commit -m "조회수 갱신" && git push
```

**방법 B — GitHub이 매주 자동으로 갱신** (키를 저장소에 넣지 않고 Secret으로)
저장소 **Settings → Secrets and variables → Actions → New repository secret** → 이름 `YOUTUBE_API_KEY`, 값에 키. 이후 매일 아침 6시경(한국 시간)에 조회수를 받아 다시 배포합니다. Actions 탭의 `deploy` → **Run workflow** 로 바로 실행할 수도 있습니다.

키는 절대 코드나 `data/`에 적지 마세요(공개되면 남이 할당량을 씁니다).

## 데이터를 다시 만들기

**가사/곡이 바뀌었을 때** — 켄시 라이브러리의 `public/data/lyrics.json`, `library.json`을 `raw/`에 복사한 뒤:
```
npm run build        # data/tracks.json, data/index.json 갱신
node tools/build-index.mjs --find 歌う    # 이 단어가 어느 곡 어느 줄에서 잡혔는지 확인
```
`lyrics-manual.json`(sync.html로 직접 만든 가사)이 `raw/`에 있으면 그쪽이 우선합니다.

**교과서 단어를 다시 뽑을 때** — (교과서 PDF가 있어야 합니다)
```
python3 tools/extract_textbook.py 교과서.pdf /tmp/tb
python3 tools/parse_index.py /tmp/tb /tmp/idx.json      # 부록 '찾아보기'(156~163쪽)
python3 tools/clean_words.py /tmp/idx.json /tmp/words.json   # 1~3과(10~57쪽)만
python3 tools/parse_boxes.py /tmp/tb /tmp/words.json /tmp/extra.json  # 본문 '단어' 박스 보충
python3 tools/merge_words.py /tmp/words.json /tmp/extra.json data/words.json
```

## 어떻게 찾나, 그리고 한계

- **단어 출처**: 교과서 부록 "찾아보기"에서 10~57쪽(1~3과)에 해당하는 266개 + 본문 "단어" 박스에만 있는 단어 + 박스의 활용형(별칭)입니다. 사진만 있는 쪽(12·28·44쪽 등)의 단어는 음성으로만 제시되어 "찾아보기"가 유일한 출처입니다.
- **가사 출처**: LRCLIB에서 받은 가사 중 곡마다 하나(싱크가 있는 후보 우선, 로마자 표기본 제외)를 씁니다. 작사·작곡 크레딧 줄과 베트남어 번역 줄은 뺍니다. 가사가 없는 곡 7곡은 검색되지 않습니다.
- **형태소 분석기를 쓰지 않습니다.** 표기와 활용형 규칙(예: 歌う → 歌って·歌った·歌わない…)으로 문자열을 찾습니다. 그래서:
  - 조사·어미·접사(～は, ～ます 등 50개)와 한 글자 감탄사는 거의 모든 곡에 나오거나 의미가 없어 **검색에서 제외**합니다(단어장에는 보입니다).
  - 짧은 가나 단어가 한자 표기를 가지면(いく, あめ, よる 등) **한자 표기만** 집계합니다. 가나로 쓴 가사는 놓칩니다.
  - 한자 표기가 없는 짧은 가나 단어(する, ある, ここ 등)는 다른 단어 속에서도 잡히므로 "정확도 낮음"으로 표시합니다.
  - 한 글자 한자(人, 今 등)는 앞뒤가 한자이면(복합어) 제외합니다.
  - 같은 노래의 다른 후보 가사를 쓰면 결과가 조금 달라질 수 있습니다.
- 정확도를 더 높이려면 형태소 분석기(kuromoji 등)를 붙여 `tools/build-index.mjs` 의 매칭 부분을 바꾸면 됩니다. 이 저장소에는 포함되어 있지 않습니다.

## 저작권

- 가사 원문은 이 저장소에 없습니다(`raw/`는 `.gitignore`). `data/index.json`에는 단어별 곡 번호와 횟수만 들어 있습니다.
- `npm run build:lyrics` 로 만드는 `data/lyrics.json` 은 가사 전체를 담으므로 **본인만 보는 비공개 배포에서만** 쓰세요. 기본적으로 `.gitignore`에 들어 있어 `git push` 로는 올라가지 않습니다(웹에서 끌어다 놓으면 올라가니 주의).
- `data/words.json` 은 교과서의 단어·뜻 목록입니다. 학습 목적의 개인·친구 사이 이용을 전제로 했고, 공개 저장소에 올리면 교과서 어휘 목록이 공개된다는 점을 알고 결정하세요.
- 곡 썸네일은 YouTube 이미지 주소를 그대로 불러올 뿐 저장하지 않습니다.
