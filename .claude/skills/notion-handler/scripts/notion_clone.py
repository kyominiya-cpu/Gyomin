#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
공개 Notion 페이지(notion.site) -> 내 Notion 워크스페이스 충실 복사.

원본 읽기: splitbee 비공식 래퍼(공개 페이지 무인증). 요청한 페이지의 모든 자손 블록을
반환하되 '하위 page'는 stub만 줌 -> 하위 page는 각각 재귀 fetch.
쓰기: 공식 Notion API. 연동 앱(NOTION_TOKEN)이 공유받은 부모 페이지 아래에 생성.

사용:
  python notion_clone.py --source <공개페이지URL또는ID> --parent <내페이지URL또는ID> [--dry-run]
"""
import os, sys, re, json, time, argparse
import requests

TOKEN = os.environ.get("NOTION_TOKEN")
API = "https://api.notion.com/v1"
NV = "2022-06-28"
SPLITBEE = "https://notion-api.splitbee.io/v1/page/"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Notion-Version": NV,
    "Content-Type": "application/json",
}

LOG = []
def log(msg):
    LOG.append(msg)
    print(msg, file=sys.stderr, flush=True)

# ---------- id helpers ----------
def to_hex(s):
    m = re.findall(r"[0-9a-fA-F]{32}", s.replace("-", ""))
    if m:
        return m[0].lower()
    # try dashed uuid embedded
    m2 = re.search(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}", s)
    if m2:
        return m2.group(0).replace("-", "").lower()
    raise ValueError(f"페이지 ID를 찾을 수 없음: {s}")

def dashed(i):
    h = to_hex(i)
    return f"{h[0:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}"

# ---------- source fetch (splitbee) ----------
_cache = {}
def fetch_map(page_id):
    h = to_hex(page_id)
    if h in _cache:
        return _cache[h]
    last = None
    for attempt in range(4):
        try:
            r = requests.get(SPLITBEE + h, timeout=45)
            if r.ok:
                m = r.json()
                _cache[h] = m
                return m
            last = f"{r.status_code} {r.text[:120]}"
        except Exception as e:
            last = str(e)
        time.sleep(2 + attempt)
    raise RuntimeError(f"원본 fetch 실패 {page_id}: {last}")

def bval(m, bid):
    n = m.get(bid) or m.get(dashed(bid)) or m.get(to_hex(bid))
    if not n:
        return None
    return (n.get("value") or {}).get("value") or {}

# ---------- rich text ----------
ALLOWED_COLORS = {
    "default","gray","brown","orange","yellow","green","blue","purple","pink","red",
    "gray_background","brown_background","orange_background","yellow_background",
    "green_background","blue_background","purple_background","pink_background","red_background",
}
def _chunks(text, n=1900):
    if text == "":
        return [""]
    return [text[i:i+n] for i in range(0, len(text), n)]

def conv_rich(title):
    """v3 title 배열 -> 공식 rich_text (annotations/link 보존)."""
    if not title:
        return []
    out = []
    for seg in title:
        if not isinstance(seg, list) or len(seg) == 0:
            continue
        text = seg[0] if isinstance(seg[0], str) else str(seg[0])
        anns = seg[1] if len(seg) > 1 and isinstance(seg[1], list) else []
        a = {"bold": False, "italic": False, "strikethrough": False,
             "underline": False, "code": False, "color": "default"}
        link = None
        for fmt in anns:
            if not fmt:
                continue
            f = fmt[0]
            if f == "b": a["bold"] = True
            elif f == "i": a["italic"] = True
            elif f == "s": a["strikethrough"] = True
            elif f == "_": a["underline"] = True
            elif f == "c": a["code"] = True
            elif f == "h":
                col = fmt[1] if len(fmt) > 1 else "default"
                a["color"] = col if col in ALLOWED_COLORS else "default"
            elif f == "a":
                url = fmt[1] if len(fmt) > 1 else None
                if url:
                    link = {"url": url}
            elif f in ("e", "eqn"):
                pass  # equation inline -> 텍스트로 둠
        for ch in _chunks(text):
            rt = {"type": "text", "text": {"content": ch}, "annotations": dict(a)}
            if link:
                rt["text"]["link"] = link
            out.append(rt)
        if len(out) > 95:  # 블록당 rich_text 100개 한도 방어
            out = out[:95]
            out.append({"type": "text", "text": {"content": " …(생략)"},
                        "annotations": {"bold": False,"italic": False,"strikethrough": False,
                                        "underline": False,"code": False,"color": "default"}})
            log("  [경고] rich_text 100개 초과 -> 일부 생략")
            break
    return out

def plain_of(title):
    if not title:
        return ""
    return "".join(seg[0] for seg in title if isinstance(seg, list) and seg and isinstance(seg[0], str))

# ---------- icon ----------
def page_icon(v):
    ic = (v.get("format") or {}).get("page_icon")
    if not ic:
        return None
    if ic.startswith("http"):
        return {"type": "external", "external": {"url": ic}}
    if ic.startswith("/"):
        return None  # Notion 내장 svg는 API로 못 씀
    return {"type": "emoji", "emoji": ic}

CODE_LANGS = {
    "abap","arduino","bash","basic","c","clojure","coffeescript","c++","c#","css","dart",
    "diff","docker","elixir","elm","erlang","flow","fortran","f#","gherkin","glsl","go",
    "graphql","groovy","haskell","html","java","javascript","json","julia","kotlin","latex",
    "less","lisp","livescript","lua","makefile","markdown","markup","matlab","mermaid","nix",
    "objective-c","ocaml","pascal","perl","php","plain text","powershell","prolog","protobuf",
    "python","r","reason","ruby","rust","sass","scala","scheme","scss","shell","sql","swift",
    "typescript","vb.net","verilog","vhdl","visual basic","webassembly","xml","yaml",
}
def norm_lang(v):
    lp = v.get("properties", {}).get("language")
    lang = (lp[0][0] if lp else "plain text").lower()
    aliases = {"plain text": "plain text", "plaintext": "plain text", "text": "plain text",
               "js": "javascript", "ts": "typescript", "py": "python", "sh": "shell"}
    lang = aliases.get(lang, lang)
    return lang if lang in CODE_LANGS else "plain text"

# ---------- block conversion ----------
HEADING = {"header": "heading_1", "sub_header": "heading_2", "sub_sub_header": "heading_3",
           "header_4": "heading_3"}  # Notion은 제목3까지만 -> header_4는 제목3로
LISTLIKE = {"bulleted_list": "bulleted_list_item", "numbered_list": "numbered_list_item"}
# 자식(content)을 들여쓰기로 보존해야 하는 타입
RECURSE_TYPES = {"bulleted_list", "numbered_list", "to_do", "toggle", "quote", "callout"}

def rt_of(v):
    return conv_rich(v.get("properties", {}).get("title", []))

def block_color(v):
    c = (v.get("format") or {}).get("block_color")
    return c if c in ALLOWED_COLORS else "default"

def to_official(v):
    """v3 블록 -> (공식 블록 dict 또는 None). 자식 처리는 호출측에서."""
    t = v.get("type")
    if t in HEADING:
        k = HEADING[t]
        return {"object": "block", "type": k, k: {"rich_text": rt_of(v), "color": block_color(v)}}
    if t == "text":
        return {"object": "block", "type": "paragraph",
                "paragraph": {"rich_text": rt_of(v), "color": block_color(v)}}
    if t in LISTLIKE:
        k = LISTLIKE[t]
        return {"object": "block", "type": k, k: {"rich_text": rt_of(v), "color": block_color(v)}}
    if t == "to_do":
        checked = v.get("properties", {}).get("checked", [["No"]])[0][0] == "Yes"
        return {"object": "block", "type": "to_do",
                "to_do": {"rich_text": rt_of(v), "checked": checked, "color": block_color(v)}}
    if t == "toggle":
        return {"object": "block", "type": "toggle",
                "toggle": {"rich_text": rt_of(v), "color": block_color(v)}}
    if t == "quote":
        return {"object": "block", "type": "quote",
                "quote": {"rich_text": rt_of(v), "color": block_color(v)}}
    if t == "callout":
        ic = page_icon(v) or {"type": "emoji", "emoji": "💡"}
        col = block_color(v)
        if col == "default":
            col = "gray_background"
        return {"object": "block", "type": "callout",
                "callout": {"rich_text": rt_of(v), "icon": ic, "color": col}}
    if t == "divider":
        return {"object": "block", "type": "divider", "divider": {}}
    if t == "code":
        rt = rt_of(v) or [{"type": "text", "text": {"content": ""},
                           "annotations": {"bold": False,"italic": False,"strikethrough": False,
                                           "underline": False,"code": False,"color": "default"}}]
        return {"object": "block", "type": "code",
                "code": {"rich_text": rt, "language": norm_lang(v)}}
    if t == "bookmark":
        link = v.get("properties", {}).get("link", [[None]])[0][0]
        if link:
            return {"object": "block", "type": "bookmark", "bookmark": {"url": link}}
        return None
    if t == "image":
        src = (v.get("properties", {}) or {}).get("source", [[None]])[0][0]
        if not src:
            return None
        if src.startswith("http") and "amazonaws.com" not in src and "secure.notion" not in src:
            return {"object": "block", "type": "image",
                    "image": {"type": "external", "external": {"url": src}}}
        # 만료되는 Notion 첨부 이미지 -> 플레이스홀더
        log(f"  [이미지 복사불가] {src[:80]}")
        return {"object": "block", "type": "callout",
                "callout": {"rich_text": [{"type": "text",
                    "text": {"content": f"[원본 이미지 - 복사 불가] {src[:200]}"}}],
                    "icon": {"type": "emoji", "emoji": "🖼️"}, "color": "gray_background"}}
    if t == "equation":
        expr = v.get("properties", {}).get("title", [[""]])
        return {"object": "block", "type": "equation",
                "equation": {"expression": plain_of(expr)}}
    # 미지원 -> 텍스트가 있으면 문단으로, 없으면 None
    rt = rt_of(v)
    if rt:
        log(f"  [미지원블록 {t} -> 문단 대체]")
        return {"object": "block", "type": "paragraph", "paragraph": {"rich_text": rt}}
    log(f"  [블록 스킵 {t}]")
    return None

def build_table(m, table_bid):
    v = bval(m, table_bid)
    fmt = v.get("format") or {}
    col_order = fmt.get("table_block_column_order") or []
    has_col_header = bool(fmt.get("table_block_column_header"))
    has_row_header = bool(fmt.get("table_block_row_header"))
    row_ids = v.get("content") or []
    if not col_order and row_ids:
        col_order = list((bval(m, row_ids[0]).get("properties") or {}).keys())
    width = max(1, len(col_order))
    rows = []
    for rid in row_ids:
        rv = bval(m, rid)
        props = rv.get("properties") or {}
        cells = [conv_rich(props.get(col, [])) for col in col_order]
        while len(cells) < width:
            cells.append([])
        rows.append({"object": "block", "type": "table_row", "table_row": {"cells": cells}})
    if not rows:
        return None
    return {"object": "block", "type": "table",
            "table": {"table_width": width, "has_column_header": has_col_header,
                      "has_row_header": has_row_header, "children": rows}}

# ---------- official API write ----------
def api(method, path, **kw):
    for attempt in range(5):
        r = requests.request(method, API + path, headers=HEADERS, timeout=60, **kw)
        if r.status_code == 429:
            wait = float(r.headers.get("Retry-After", 1.5))
            time.sleep(wait + 0.3); continue
        if r.status_code >= 500:
            time.sleep(1.5 * (attempt + 1)); continue
        if not r.ok:
            raise RuntimeError(f"{method} {path} -> {r.status_code} {r.text[:300]}")
        time.sleep(0.34)  # rate limit
        return r.json()
    raise RuntimeError(f"{method} {path} 재시도 초과")

def create_page(parent_id, title_rt, icon):
    body = {"parent": {"type": "page_id", "page_id": dashed(parent_id)},
            "properties": {"title": {"title": title_rt or [{"type": "text", "text": {"content": "제목 없음"}}]}}}
    if icon:
        body["icon"] = icon
    res = api("POST", "/pages", data=json.dumps(body))
    return res["id"]

def process_children(parent_id, child_ids, m):
    """parent_id 아래에 child_ids를 순서대로 생성. page는 하위페이지, 나머지는 블록."""
    pending = []   # (official_block, source_bid, btype)
    def flush():
        nonlocal pending
        if not pending:
            return
        for i in range(0, len(pending), 90):
            group = pending[i:i+90]
            children = [g[0] for g in group]
            res = api("PATCH", f"/blocks/{dashed(parent_id)}/children",
                      data=json.dumps({"children": children}))
            results = res["results"]
            for (ob, sbid, btype), made in zip(group, results):
                if btype in RECURSE_TYPES:
                    gkids = (bval(m, sbid).get("content") or [])
                    if gkids:
                        process_children(made["id"], gkids, m)
        pending = []

    for cb in child_ids:
        v = bval(m, cb)
        if not v:
            continue
        t = v.get("type")
        if t == "page":
            flush()
            create_subpage(parent_id, cb)
        elif t in ("column_list", "column"):
            flush()
            log(f"  [컬럼 평탄화 {t}]")
            process_children(parent_id, v.get("content") or [], m)
        elif t == "table":
            flush()
            tb = build_table(m, cb)
            if tb:
                api("PATCH", f"/blocks/{dashed(parent_id)}/children",
                    data=json.dumps({"children": [tb]}))
        elif t == "table_row":
            continue  # 테이블에서 처리됨
        else:
            ob = to_official(v)
            if ob:
                pending.append((ob, cb, t))
    flush()

def create_subpage(parent_id, page_bid):
    sm = fetch_map(page_bid)
    pv = bval(sm, page_bid)
    title = plain_of(pv.get("properties", {}).get("title", []))
    log(f"  └ 하위페이지 생성: {title}")
    new_id = create_page(parent_id, conv_rich(pv.get("properties", {}).get("title", [])), page_icon(pv))
    process_children(new_id, pv.get("content") or [], sm)
    return new_id

# ---------- dry-run walk ----------
def walk(page_id, depth=0, stats=None):
    if stats is None:
        stats = {"pages": 0, "tables": 0, "blocks": 0}
    m = fetch_map(page_id)
    pv = bval(m, page_id)
    title = plain_of(pv.get("properties", {}).get("title", [])) or "(제목없음)"
    print("  " * depth + f"📄 {title}")
    stats["pages"] += 1
    def count(ids):
        for cb in ids:
            v = bval(m, cb)
            if not v:
                continue
            t = v.get("type")
            if t == "page":
                walk(cb, depth + 1, stats)
            elif t == "table":
                stats["tables"] += 1
                stats["blocks"] += 1
                rows = len(v.get("content") or [])
                print("  " * (depth + 1) + f"▦ 표 ({rows}행)")
            elif t == "table_row":
                continue
            elif t in ("column_list", "column"):
                count(v.get("content") or [])
            else:
                stats["blocks"] += 1
                if t in RECURSE_TYPES:
                    count(v.get("content") or [])
    count(pv.get("content") or [])
    return stats

# ---------- main ----------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True, help="공개 Notion 페이지 URL 또는 ID")
    ap.add_argument("--parent", help="내 Notion 부모 페이지 URL 또는 ID (실행 시 필수)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not TOKEN:
        print("NOTION_TOKEN 미설정", file=sys.stderr); sys.exit(1)

    if args.dry_run:
        print("=== DRY-RUN: 복사될 구조 ===")
        stats = walk(args.source)
        print(f"\n합계: 페이지 {stats['pages']}개 · 표 {stats['tables']}개 · 일반블록 {stats['blocks']}개")
        return

    if not args.parent:
        print("실행하려면 --parent 필요", file=sys.stderr); sys.exit(1)

    m = fetch_map(args.source)
    rv = bval(m, args.source)
    title_rt = conv_rich(rv.get("properties", {}).get("title", []))
    log(f"허브 페이지 생성: {plain_of(rv.get('properties', {}).get('title', []))}")
    hub_id = create_page(args.parent, title_rt, page_icon(rv) or {"type": "emoji", "emoji": "🍷"})
    process_children(hub_id, rv.get("content") or [], m)
    url = "https://www.notion.so/" + to_hex(hub_id)
    print(f"\n완료! 허브 페이지: {url}")
    print(f"로그 {len(LOG)}줄")

if __name__ == "__main__":
    main()
