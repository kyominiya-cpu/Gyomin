#!/usr/bin/env python3
"""
youtube_insight.py — 유튜브 영상에서 자막/메타데이터를 추출하고 Notion DB에 저장.

두 개의 서브커맨드:
  fetch <url>   : 영상 ID/제목/채널/썸네일/자막을 JSON으로 stdout에 출력
                  (자막 추출은 youtube-transcript-api 필요)
  save ...      : Notion DB에 한 행(페이지) 생성

stdlib만으로 oEmbed 메타데이터와 Notion 저장을 처리한다.
자막 추출에만 youtube-transcript-api(+requests)가 필요하다.

설치(1회):  pip install youtube-transcript-api
환경변수:    NOTION_TOKEN  (필수, 저장 시)
            NOTION_YT_DB  (선택, 기본 DB id는 아래 DEFAULT_DB)
"""
import argparse
import json
import os
import re
import sys
import urllib.parse
import urllib.request

# 「유튜브 인사이트」 데이터베이스 (2026-06-13 생성)
DEFAULT_DB = "37e8dc08-cce8-812a-81d9-f1a94a18829b"
NOTION_VERSION = "2022-06-28"
INSIGHT_MAX = 1000  # 인사이트 글자 수 가이드(안전 상한)

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"


def extract_video_id(url: str) -> str:
    """다양한 유튜브 URL 형태에서 11자리 video id 추출."""
    url = url.strip()
    # 순수 ID를 그대로 준 경우
    if re.fullmatch(r"[0-9A-Za-z_-]{11}", url):
        return url
    patterns = [
        r"(?:v=|/v/|youtu\.be/|/embed/|/shorts/|/live/)([0-9A-Za-z_-]{11})",
    ]
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(1)
    raise ValueError(f"video id를 URL에서 찾지 못했습니다: {url}")


def get_metadata(video_id: str) -> dict:
    """oEmbed로 제목/채널/썸네일을 가져온다 (stdlib만 사용)."""
    watch = f"https://www.youtube.com/watch?v={video_id}"
    oembed = "https://www.youtube.com/oembed?" + urllib.parse.urlencode(
        {"url": watch, "format": "json"}
    )
    req = urllib.request.Request(oembed, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as r:
        data = json.loads(r.read().decode("utf-8"))
    return {
        "title": data.get("title", ""),
        "channel": data.get("author_name", ""),
        # oEmbed 썸네일은 hqdefault(480x360). maxres 우선 시도.
        "thumbnail_url": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
        "thumbnail_maxres": f"https://i.ytimg.com/vi/{video_id}/maxresdefault.jpg",
    }


def get_transcript(video_id: str, languages=("ko", "en", "en-US")) -> dict:
    """youtube-transcript-api로 자막 텍스트를 추출.

    구/신 버전 API를 모두 처리한다.
    반환: {"text": "...", "lang": "ko", "generated": bool}
    """
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
    except ImportError:
        raise RuntimeError(
            "youtube-transcript-api 미설치. 'pip install youtube-transcript-api' 후 다시 시도하세요."
        )

    langs = list(languages)

    # 신버전(1.x): 인스턴스 .fetch()
    try:
        ytt = YouTubeTranscriptApi()
        fetched = ytt.fetch(video_id, languages=langs)
        snippets = list(fetched)
        text = " ".join(getattr(s, "text", "") for s in snippets).strip()
        lang = getattr(fetched, "language_code", langs[0])
        if text:
            return {"text": text, "lang": lang, "generated": getattr(fetched, "is_generated", None)}
    except AttributeError:
        pass  # 구버전 → 아래로
    except Exception as e:
        # 신버전인데 해당 언어 없음 → 사용가능한 첫 자막으로 폴백
        try:
            ytt = YouTubeTranscriptApi()
            tlist = ytt.list(video_id)
            for t in tlist:
                try:
                    fetched = t.fetch()
                    text = " ".join(getattr(s, "text", "") for s in fetched).strip()
                    if text:
                        return {"text": text, "lang": t.language_code, "generated": t.is_generated}
                except Exception:
                    continue
        except Exception:
            pass
        raise RuntimeError(f"자막 추출 실패(신버전): {e}")

    # 구버전(0.6.x): 정적 get_transcript
    try:
        segs = YouTubeTranscriptApi.get_transcript(video_id, languages=langs)
        text = " ".join(s.get("text", "") for s in segs).strip()
        return {"text": text, "lang": langs[0], "generated": None}
    except Exception:
        # 언어 폴백
        listed = YouTubeTranscriptApi.list_transcripts(video_id)
        for t in listed:
            try:
                segs = t.fetch()
                text = " ".join(s.get("text", "") for s in segs).strip()
                if text:
                    return {"text": text, "lang": t.language_code, "generated": t.is_generated}
            except Exception:
                continue
    raise RuntimeError("이 영상에서 사용 가능한 자막을 찾지 못했습니다.")


def cmd_fetch(args):
    vid = extract_video_id(args.url)
    out = {"video_id": vid, "url": f"https://www.youtube.com/watch?v={vid}"}
    out.update(get_metadata(vid))
    if not args.no_transcript:
        try:
            tr = get_transcript(vid)
            out["transcript"] = tr["text"]
            out["transcript_lang"] = tr["lang"]
            out["transcript_chars"] = len(tr["text"])
        except Exception as e:
            out["transcript_error"] = str(e)
    print(json.dumps(out, ensure_ascii=False, indent=2))


def _rich_text(content: str):
    # Notion rich_text 단일 블록은 2000자 제한. 인사이트는 1000자 가이드이나 안전상 자름.
    return [{"type": "text", "text": {"content": content[:1990]}}]


def cmd_save(args):
    token = os.environ.get("NOTION_TOKEN")
    if not token:
        sys.exit("ERROR: NOTION_TOKEN 환경변수가 없습니다.")
    db_id = args.db or os.environ.get("NOTION_YT_DB") or DEFAULT_DB

    insight = args.insight or ""
    if args.insight_file:
        with open(args.insight_file, "r", encoding="utf-8") as f:
            insight = f.read().strip()
    if len(insight) > INSIGHT_MAX:
        print(f"⚠️  인사이트가 {len(insight)}자 → {INSIGHT_MAX}자로 자릅니다.", file=sys.stderr)
        insight = insight[:INSIGHT_MAX]

    props = {
        "제목": {"title": _rich_text(args.title)},
    }
    if args.channel:
        props["채널"] = {"rich_text": _rich_text(args.channel)}
    if args.url:
        props["URL"] = {"url": args.url}
    if insight:
        props["인사이트"] = {"rich_text": _rich_text(insight)}
    if args.thumbnail:
        props["썸네일"] = {
            "files": [{
                "type": "external",
                "name": "thumbnail.jpg",
                "external": {"url": args.thumbnail},
            }]
        }
    if args.tags:
        tags = [t.strip() for t in args.tags.split(",") if t.strip()]
        props["태그"] = {"multi_select": [{"name": t} for t in tags]}
    if args.date:
        props["저장일"] = {"date": {"start": args.date}}

    body = json.dumps({"parent": {"database_id": db_id}, "properties": props}).encode("utf-8")
    req = urllib.request.Request(
        "https://api.notion.com/v1/pages",
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            res = json.loads(r.read().decode("utf-8"))
        print(json.dumps({"ok": True, "page_url": res.get("url"), "id": res.get("id")}, ensure_ascii=False))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "ignore")
        sys.exit(f"ERROR: Notion 저장 실패 ({e.code}) {detail}")


def main():
    ap = argparse.ArgumentParser(description="유튜브 인사이트 → Notion")
    sub = ap.add_subparsers(dest="cmd", required=True)

    pf = sub.add_parser("fetch", help="자막/메타데이터 추출")
    pf.add_argument("url")
    pf.add_argument("--no-transcript", action="store_true", help="자막 없이 메타데이터만")
    pf.set_defaults(func=cmd_fetch)

    ps = sub.add_parser("save", help="Notion DB에 저장")
    ps.add_argument("--title", required=True)
    ps.add_argument("--channel", default="")
    ps.add_argument("--url", default="")
    ps.add_argument("--thumbnail", default="")
    ps.add_argument("--insight", default="")
    ps.add_argument("--insight-file", default="")
    ps.add_argument("--tags", default="", help="콤마구분: 마케팅,비즈니스")
    ps.add_argument("--date", default="", help="YYYY-MM-DD")
    ps.add_argument("--db", default="", help="DB id 오버라이드")
    ps.set_defaults(func=cmd_save)

    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
