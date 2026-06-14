---
name: youtube-insight
description: 자막 있는 유튜브 영상 주소를 주면 자막을 추출해 인사이트를 1000자 이내로 정리하고 Notion「유튜브 인사이트」DB에 저장. "유튜브 정리", "유튜브 인사이트", "이 영상 정리해서 노션에 저장", "유튜브 노션", "영상 인사이트 저장", 유튜브 URL(youtube.com/watch, youtu.be, /shorts)을 주며 정리/저장을 요청하면 자동 실행.
allowed-tools:
  - Bash
  - Read
  - Write
---

# YouTube Insight → Notion Skill

자막 있는 유튜브 영상을 받아 **자막 추출 → 인사이트 1000자 정리 → Notion DB 저장**까지 처리한다.

## 대상 Notion DB

「유튜브 인사이트」 — `37e8dc08-cce8-812a-81d9-f1a94a18829b`
스크립트 `DEFAULT_DB`에 박혀 있음. 컬럼: 제목 / 채널 / URL / 썸네일(files) / 인사이트(rich_text) / 태그(multi_select: 마케팅·비즈니스·와인·기타) / 저장일(date)

토큰: 환경변수 `NOTION_TOKEN` (이미 `.claude/settings.local.json`에 설정됨). 세션에 잡혀있지 않으면 명령에 직접 토큰을 넣어 실행.

## 사전 준비

- **메타데이터·Notion 저장**: Python stdlib만으로 동작 (추가 설치 불필요)
- **자막 추출(모드 A)**: `pip install youtube-transcript-api` 1회 필요 + Python 설치 필요
  - Python 미설치 시 → **모드 B(수동 폴백)** 로 진행

---

## 모드 A — URL 자동 처리 (Python 사용 가능 시)

### 1. 자막 + 메타데이터 추출
```bash
python3 .claude/skills/youtube-insight/scripts/youtube_insight.py fetch "<유튜브 URL>"
```
출력(JSON): `video_id, url, title, channel, thumbnail_url, thumbnail_maxres, transcript, transcript_lang, transcript_chars`
- `transcript_error` 키가 있으면 자막 추출 실패 → 사용자에게 알리고 모드 B 제안.

### 2. 인사이트 작성 (Claude가 수행)
`transcript`를 읽고 **한국어 1000자 이내**로 핵심 인사이트를 정리한다. 형식 가이드:
- 영상의 **핵심 주장 2~4개**를 불릿 또는 짧은 문단으로
- 단순 요약이 아니라 **"그래서 뭐가 쓸모 있나"** 관점 (교민님 업무·관심사 맥락이면 연결)
- 1000자는 **상한**. 짧고 밀도 높게. 스크립트가 1000자 넘으면 자동으로 자르므로 넘기지 말 것.

작성한 인사이트는 셸 이스케이프를 피하려 **임시 파일로 저장** 후 `--insight-file`로 넘긴다:
```bash
# 인사이트를 파일로 (Write 도구 사용 권장)
#   /tmp/insight.txt 에 저장
```
태그는 `마케팅 / 비즈니스 / 와인 / 기타` 중 영상 성격에 맞게 1~2개 선택.

### 3. Notion 저장
```bash
python3 .claude/skills/youtube-insight/scripts/youtube_insight.py save \
  --title "영상 제목" \
  --channel "채널명" \
  --url "https://www.youtube.com/watch?v=..." \
  --thumbnail "https://i.ytimg.com/vi/<id>/hqdefault.jpg" \
  --insight-file /tmp/insight.txt \
  --tags "마케팅,비즈니스" \
  --date "$(date +%Y-%m-%d)"
```
성공 시 `{"ok": true, "page_url": "..."}` → 사용자에게 page_url 보고.

---

## 모드 B — 수동 폴백 (Python 없음 / 자막 추출 실패)

Python이 없거나 자막 추출이 막히면:

1. **메타데이터는 curl로** (stdlib 불필요, 항상 동작):
   ```bash
   curl -s "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<ID>&format=json"
   ```
   → title, author_name(채널) 확보. 썸네일은 `https://i.ytimg.com/vi/<ID>/hqdefault.jpg`.

2. **자막 텍스트**: 사용자에게 받는다.
   - "영상 자막을 복사해서 붙여주세요" (유튜브 '스크립트 표시' → 전체 복사)
   - 또는 사용자가 이미 가진 자막 파일 경로.

3. **인사이트 정리**(1000자 이내) 후 **curl로 Notion 저장**:
   인사이트를 `/tmp/insight.txt`에 Write로 저장하고, 아래처럼 JSON을 구성해 POST.
   (※ 한글/줄바꿈이 많으므로 JSON 파일을 Write로 만든 뒤 `--data @파일`로 보낼 것)
   ```bash
   # /tmp/yt_page.json 예시 구조
   # {
   #   "parent": {"database_id": "37e8dc08-cce8-812a-81d9-f1a94a18829b"},
   #   "properties": {
   #     "제목":   {"title":[{"text":{"content":"제목"}}]},
   #     "채널":   {"rich_text":[{"text":{"content":"채널"}}]},
   #     "URL":    {"url":"https://..."},
   #     "썸네일": {"files":[{"type":"external","name":"thumb.jpg","external":{"url":"https://i.ytimg.com/vi/<ID>/hqdefault.jpg"}}]},
   #     "인사이트":{"rich_text":[{"text":{"content":"...1000자 이내..."}}]},
   #     "태그":   {"multi_select":[{"name":"마케팅"}]},
   #     "저장일": {"date":{"start":"2026-06-13"}}
   #   }
   # }
   curl -s -X POST "https://api.notion.com/v1/pages" \
     -H "Authorization: Bearer $NOTION_TOKEN" \
     -H "Notion-Version: 2022-06-28" \
     -H "Content-Type: application/json" \
     --data @/tmp/yt_page.json
   ```

---

## 동작 원칙

- **인사이트는 항상 1000자 이내.** 넘기면 스크립트/저장 단계에서 잘려 내용 손실 → 처음부터 1000자 안으로.
- **자막이 없는 영상**이면 솔직히 알리고(자막 미존재) 저장하지 않거나, 사용자 동의 하에 설명/제목 기반 요약만.
- **언어**: 한국어 자막 우선, 없으면 영어 자막 → 인사이트는 항상 한국어로 작성.
- **태그**: 기존 옵션(마케팅·비즈니스·와인·기타)에서 고름. 새 태그가 꼭 필요하면 multi_select에 새 이름을 넣으면 Notion이 자동 생성.
- **저장 후** page_url을 반드시 사용자에게 보고.
- **중복 방지**: 같은 영상을 또 저장 요청하면 한 번 확인.

## 트러블슈팅

- `NOTION_TOKEN 없음` → 명령에 토큰을 직접 넣어 실행하거나 Claude Code 재시작(세션에 env 반영).
- `transcript_error` / `자막 추출 실패` → 영상에 자막이 없거나 YouTube가 막은 경우. 모드 B로.
- `youtube-transcript-api 미설치` → `pip install youtube-transcript-api` (venv 활성화 후).
- Notion `401/403` → 토큰 만료 또는 DB가 봇과 공유 안 됨. DB 페이지에서 봇(교민) 연결 확인.
