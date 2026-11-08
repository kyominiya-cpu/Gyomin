"""매일 영어뉴스 3개(경제 2 + 세계 정치·사회·문화 1)를 노션「경제 영어뉴스」DB에 올린다.

1) 단어장 복습 처리: 「영어 단어장」에서 '복습함' 체크된 단어를 다음 단계로(1→3→7→14→30일)
2) claude -p (WebSearch/WebFetch만 허용)로 기사 선정 + 요약/번역/단어/배경 JSON 생성
3) 기사 페이지 생성 — 새 단어(파랑)·표현(주황)·다시 나온 단어(초록) 표시, 같은 이슈의 이전 기사 링크
4) 새 단어는 단어장 DB에 추가, 이미 있는 단어가 다시 나오면 '다시 나옴' +1
5) 일요일이면 한 주 정리 페이지 추가

실행: python -X utf8 daily_news.py           (오늘치, 일요일엔 주간 정리까지)
      python -X utf8 daily_news.py weekly    (주간 정리만)
      python -X utf8 daily_news.py FILE.json (저장된 JSON만 노션에 다시 올리기)

클라우드 루틴(Claude가 직접 기사 조사, claude -p 안 씀) — 상태는 전부 노션에서 읽음:
      python3 daily_news.py cloud-prepare              → 프롬프트 파일 경로 출력 (오늘치 있으면 SKIP)
      python3 daily_news.py cloud-publish FILE.json    → 기사 3개 노션에 올림
      python3 daily_news.py cloud-weekly-prepare       → 일요일이고 주간 정리 없으면 프롬프트 파일 경로 출력
      python3 daily_news.py cloud-weekly-publish FILE.json
노션 토큰: 환경변수 NOTION_TOKEN → .claude/settings.local.json → 없으면 헤더 없이 보냄(클라우드 네트워크 시크릿이 붙여줌)
"""
import datetime as dt
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
WS = HERE.parents[1]  # 워크스페이스 루트
DB = "40d8dc08-cce8-8192-ac4a-cac18f154beb"        # 경제 영어뉴스
VOCAB_DB = "40d8dc08-cce8-81dd-a433-d00d19f39f1f"  # 영어 단어장
HISTORY = HERE / "history.txt"
LOGS = HERE / "logs"
CLAUDE = Path.home() / ".local" / "bin" / "claude.exe"
INTERVALS = [1, 3, 7, 14, 30]  # 단계별 다음 복습까지 일수

_SETTINGS = WS / ".claude" / "settings.local.json"
# 클라우드: 네트워크 시크릿 프록시가 api.notion.com 요청에 Authorization 헤더를 붙여줌 → 토큰 없이 실행
TOKEN = os.environ.get("NOTION_TOKEN") or (
    json.loads(_SETTINGS.read_text(encoding="utf-8"))["env"]["NOTION_TOKEN"] if _SETTINGS.exists() else "")
KST = dt.timezone(dt.timedelta(hours=9))  # 클라우드는 UTC라서 한국 날짜로 고정
TODAY_D = dt.datetime.now(KST).date()
TODAY = TODAY_D.isoformat()


def log(msg):
    LOGS.mkdir(exist_ok=True)
    with open(LOGS / "run.log", "a", encoding="utf-8") as f:
        f.write(f"{dt.datetime.now(KST):%Y-%m-%d %H:%M:%S} {msg}\n")
    print(msg)


def parse_json(text):
    """순수 JSON 또는 <<<JSON ... JSON>>> 마커로 감싼 텍스트"""
    m = re.search(r"<<<JSON\s*(\{.*\})\s*JSON>>>", text, re.S)
    return json.loads(m.group(1) if m else text)


def run_claude(prompt, tag, tools=()):
    args = [str(CLAUDE), "-p", prompt, "--output-format", "json"]
    if tools:
        args[3:3] = ["--allowedTools", *tools]
    r = subprocess.run(args, cwd=HERE, capture_output=True, text=True, encoding="utf-8", timeout=1800)
    (LOGS / f"{TODAY}.{tag}.raw.json").write_text(r.stdout, encoding="utf-8")
    if r.returncode != 0:
        sys.exit(log(f"[{tag}] claude 실패 rc={r.returncode}: {r.stderr[-500:]}"))
    m = re.search(r"<<<JSON\s*(\{.*\})\s*JSON>>>", json.loads(r.stdout)["result"], re.S)
    if not m:
        sys.exit(log(f"[{tag}] JSON 마커를 찾지 못함 — logs 확인"))
    return json.loads(m.group(1))


# ---------- Notion ----------
def api(method, path, body=None):
    req = urllib.request.Request(
        "https://api.notion.com/v1" + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Notion-Version": "2022-06-28", "Content-Type": "application/json",
                 **({"Authorization": f"Bearer {TOKEN}"} if TOKEN else {})})
    try:
        with urllib.request.urlopen(req) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(log(f"Notion HTTP {e.code}: {e.read().decode()[:500]}"))


def query_all(db, body=None):
    body, out = dict(body or {}), []
    while True:
        r = api("POST", f"/databases/{db}/query", body)
        out += r["results"]
        if not r.get("has_more"):
            return out
        body["start_cursor"] = r["next_cursor"]


def plain(prop):
    return "".join(t["plain_text"] for t in prop.get("title") or prop.get("rich_text") or [])


def txt(s, **ann):
    d = {"type": "text", "text": {"content": s}}
    if ann:
        d["annotations"] = ann
    return d


def mention(page_id):
    return {"type": "mention", "mention": {"type": "page", "page": {"id": page_id}}}


def rich(p, colors):
    """colors: {표현/단어: 색} — 본문에서 찾아 굵게 + 색칠 (긴 표현 우선)"""
    colors = {k.lower(): c for k, c in colors.items() if k}
    if not colors:
        return [txt(p)]
    pat = re.compile(r"(?<!\w)(" + "|".join(re.escape(k) for k in sorted(colors, key=len, reverse=True)) + r")(?!\w)", re.I)
    out, pos = [], 0
    for m in pat.finditer(p):
        if m.start() > pos:
            out.append(txt(p[pos:m.start()]))
        out.append(txt(m.group(0), bold=True, color=colors[m.group(0).lower()]))
        pos = m.end()
    if pos < len(p):
        out.append(txt(p[pos:]))
    return out


def para(rt):
    return {"type": "paragraph", "paragraph": {"rich_text": rt}}


def h2(s):
    return {"type": "heading_2", "heading_2": {"rich_text": [txt(s)]}}


def bullet(rt):
    return {"type": "bulleted_list_item", "bulleted_list_item": {"rich_text": rt}}


def toggle(label, children, **ann):
    return {"type": "toggle", "toggle": {"rich_text": [txt(label, **ann)], "children": children}}


def vocab_table(vocab):
    rows = [["단어", "품사", "뜻", "비슷한 말", "예문"]] + [
        [v.get("base") or v["word"], v.get("pos", ""), v["ko"], v.get("synonym", ""), v.get("example", "")] for v in vocab]
    return {"type": "table", "table": {
        "table_width": 5, "has_column_header": True, "has_row_header": False,
        "children": [{"type": "table_row", "table_row": {"cells": [
            [txt(c, bold=(i == 0 or j == 0), color="blue" if (i and j == 0) else "default")] for j, c in enumerate(r)]}}
            for i, r in enumerate(rows)]}}


# ---------- 단어장 ----------
def forms(base):
    """기본형에서 흔한 변형(복수·과거·진행·부사)을 만든다 — 다시 나온 단어 찾기용"""
    b = base.lower().strip()
    if len(b) < 4 or " " in b:
        return {b}
    f = {b, b + "s", b + "es", b + "ed", b + "d", b + "ing", b + "ly", b + b[-1] + "ed", b + b[-1] + "ing"}
    if b.endswith("e"):
        f.add(b[:-1] + "ing")
    if b.endswith("y"):
        f |= {b[:-1] + "ies", b[:-1] + "ied", b[:-1] + "ily"}
    return f


def load_vocab():
    words = {}
    for p in query_all(VOCAB_DB):
        pr = p["properties"]
        words[plain(pr["단어"]).lower()] = {
            "id": p["id"], "base": plain(pr["단어"]), "ko": plain(pr["뜻"]),
            "seen": pr["다시 나옴"]["number"] or 0, "done": (pr["상태"]["select"] or {}).get("name") == "외움",
            "articles": [x["id"] for x in pr["기사"]["relation"]]}
    return words


def process_reviews():
    """'복습함' 체크된 단어를 다음 단계로 올리고 체크 해제"""
    n = 0
    for p in query_all(VOCAB_DB, {"filter": {"property": "복습함", "checkbox": {"equals": True}}}):
        stage = (p["properties"]["단계"]["number"] or 0) + 1
        props = {"복습함": {"checkbox": False}, "단계": {"number": stage}}
        if stage >= len(INTERVALS):
            props |= {"상태": {"select": {"name": "외움"}}, "다음 복습일": {"date": None}}
        else:
            props["다음 복습일"] = {"date": {"start": (TODAY_D + dt.timedelta(days=INTERVALS[stage])).isoformat()}}
        api("PATCH", f"/pages/{p['id']}", {"properties": props})
        n += 1
    if n:
        log(f"복습 처리 {n}개")


def find_repeats(text, known, exclude):
    """본문에 나온 기존 단어장 단어: {본문 표기: 단어장 항목}"""
    found = {}
    for key, w in known.items():
        if key in exclude or w["done"]:
            continue
        for f in forms(key):
            m = re.search(r"(?<!\w)" + re.escape(f) + r"(?!\w)", text, re.I)
            if m:
                found[m.group(0)] = w
                break
    return found


def save_vocab(vocab, repeats, page_id, known):
    for v in vocab:
        base = (v.get("base") or v["word"]).strip()
        if base.lower() in known:  # 이미 있는 단어면 다시 나옴으로 처리
            repeats[v["word"]] = known[base.lower()]
            continue
        p = api("POST", "/pages", {"parent": {"database_id": VOCAB_DB}, "properties": {
            "단어": {"title": [txt(base)]},
            "뜻": {"rich_text": [txt(v["ko"])]},
            "품사": {"select": {"name": v.get("pos") or "n."}},
            "비슷한 말": {"rich_text": [txt(v.get("synonym", ""))]},
            "예문": {"rich_text": [txt(v.get("example", ""))]},
            "기사": {"relation": [{"id": page_id}]},
            "처음 본 날": {"date": {"start": TODAY}},
            "다음 복습일": {"date": {"start": (TODAY_D + dt.timedelta(days=INTERVALS[0])).isoformat()}},
            "단계": {"number": 0}, "다시 나옴": {"number": 0},
            "상태": {"select": {"name": "학습중"}}}})
        known[base.lower()] = {"id": p["id"], "base": base, "ko": v["ko"], "seen": 0, "done": False, "articles": [page_id]}
    for w in {w["id"]: w for w in repeats.values()}.values():
        w["seen"] += 1
        w["articles"] = (w["articles"] + [page_id])[-25:]
        api("PATCH", f"/pages/{w['id']}", {"properties": {
            "다시 나옴": {"number": w["seen"]}, "기사": {"relation": [{"id": i} for i in w["articles"]]}}})


# ---------- 기사 ----------
def issue_names():
    opts = api("GET", f"/databases/{DB}")["properties"]["이슈"]["select"]["options"]
    return [o["name"] for o in opts][-60:]


def previous_in_issue(issue):
    if not issue or issue not in issue_names():  # 새 이슈 — 없는 옵션으로 필터하면 400
        return []
    return query_all(DB, {"filter": {"property": "이슈", "select": {"equals": issue}},
                          "sorts": [{"property": "날짜", "direction": "descending"}], "page_size": 5})[:5]


def publish(a, known):
    vocab = a.get("vocab", [])
    category = a.get("category", "경제")
    new_keys = {(v.get("base") or v["word"]).lower() for v in vocab}
    repeats = find_repeats(" ".join(a["summary_en"]), known, new_keys)
    colors = ({k: "green" for k in repeats} | {v["word"]: "blue" for v in vocab}
              | {e["en"]: "orange" for e in a["expressions"]})
    prev = previous_in_issue(a.get("issue"))

    blocks = [
        {"type": "callout", "callout": {"icon": {"type": "emoji", "emoji": "📰" if category == "경제" else "🌍"}, "rich_text": [
            txt(f"{category} · {a['source']} · {a['published']}\n", bold=True), txt(a["title_ko"] + "\n"),
            txt("영어 요약은 원문을 바탕으로 새로 쓴 학습용 글이에요. 원문은 아래 링크에서 읽어보세요.\n", color="gray"),
            txt("주황", bold=True, color="orange"), txt(" 표현 · ", color="gray"),
            txt("파랑", bold=True, color="blue"), txt(" 새 단어 · ", color="gray"),
            txt("초록", bold=True, color="green"), txt(" 전에 배운 단어", color="gray")]}},
        h2("Summary"),
        *[para(rich(p, colors)) for p in a["summary_en"]],
        toggle("한글 해석", [para([txt(p, color="gray")]) for p in a["summary_ko"]], color="gray"),
    ]
    if a.get("background_ko"):
        blocks += [h2("배경 지식"), para([txt(a["background_ko"])])]
    if a.get("issue"):
        blocks.append(h2(f"이어지는 이슈: {a['issue']}"))
        if prev:
            for p in prev:
                d = (p["properties"]["날짜"]["date"] or {}).get("start", "")
                blocks.append(bullet([txt(d + "  "), mention(p["id"]),
                                      txt("  " + plain(p["properties"]["한줄요약"]), color="gray")]))
        else:
            blocks.append(para([txt("이 이슈의 첫 기사예요. 다음에 같은 이슈가 나오면 여기 연결돼요.", color="gray")]))
    if vocab:
        blocks += [h2(f"새 단어 ({len(vocab)})"), vocab_table(vocab),
                   toggle("뜻 가리고 테스트하기", [
                       toggle(v.get("base") or v["word"], [para([txt(
                           f"{v.get('pos', '')} {v['ko']} (= {v.get('synonym', '')})", color="gray")])], bold=True)
                       for v in vocab], color="gray")]
    if repeats:
        blocks.append(h2(f"다시 나온 단어 ({len(repeats)})"))
        for shown, w in repeats.items():
            blocks.append(bullet([txt(shown, bold=True, color="green"), txt(f"  ({w['base']}) — {w['ko']}  "),
                                  txt(f"{w['seen'] + 1}번째 다시 봄", color="gray")]))
    blocks.append(h2("표현 정리"))
    for e in a["expressions"]:
        rt = [txt(e["en"], bold=True), txt(" — " + e["ko"])]
        if e.get("example"):
            rt.append(txt("\n" + e["example"], italic=True, color="gray"))
        blocks.append(bullet(rt))
    blocks += [h2("왜 중요한가" + (" (투자 포인트)" if category == "경제" else "")),
               para([txt(a["why_it_matters_ko"])]), h2("확인 질문")]
    for q in a["questions"]:
        blocks.append(toggle(q["q"], [para([txt(q["a"], color="gray")])]))
    blocks += [{"type": "divider", "divider": {}}, h2("원문"), {"type": "bookmark", "bookmark": {"url": a["url"]}}]

    props = {
        "제목": {"title": [txt(a["title_en"])]},
        "날짜": {"date": {"start": TODAY}},
        "구분": {"select": {"name": category}},
        "매체": {"select": {"name": a["source"]}},
        "분야": {"multi_select": [{"name": t} for t in a["topics"][:2]]},
        "URL": {"url": a["url"]},
        "한줄요약": {"rich_text": [txt(a["one_line_ko"])]},
        "상태": {"select": {"name": "안읽음"}},
    }
    if a.get("issue"):
        props["이슈"] = {"select": {"name": a["issue"][:90]}}
    page = api("POST", "/pages", {"parent": {"database_id": DB},
                                  "icon": {"type": "emoji", "emoji": "📈" if category == "경제" else "🌍"},
                                  "properties": props, "children": blocks})
    save_vocab(vocab, repeats, page["id"], known)
    with open(HISTORY, "a", encoding="utf-8") as f:
        f.write(a["url"] + "\n")
    return page["url"], len(repeats)


def done_today(kind="기사"):
    """노션에 오늘치가 이미 있나 — 로컬/클라우드 어디서 돌든 중복 방지"""
    cond = {"equals": "주간 정리"} if kind == "주간" else {"does_not_equal": "주간 정리"}
    return bool(api("POST", f"/databases/{DB}/query", {"page_size": 1, "filter": {"and": [
        {"property": "날짜", "date": {"equals": TODAY}}, {"property": "구분", "select": cond}]}})["results"])


def used_urls():
    """이미 쓴 기사 URL: history.txt(로컬) + 노션 최근 60일"""
    urls = HISTORY.read_text(encoding="utf-8").split() if HISTORY.exists() else []
    since = (TODAY_D - dt.timedelta(days=60)).isoformat()
    for p in query_all(DB, {"filter": {"property": "날짜", "date": {"on_or_after": since}},
                            "sorts": [{"property": "날짜", "direction": "ascending"}]}):
        u = p["properties"]["URL"]["url"]
        if u and u not in urls:
            urls.append(u)
    return urls


def build_prompt():
    process_reviews()
    known = load_vocab()
    return ((HERE / "prompt.md").read_text(encoding="utf-8")
            .replace("{TODAY}", TODAY)
            .replace("{HISTORY}", "\n".join(used_urls()[-90:]) or "(none)")
            .replace("{ISSUES}", "\n".join(f"- {n}" for n in issue_names()) or "(none yet)")
            .replace("{KNOWN}", ", ".join(sorted(w["base"] for w in known.values())) or "(none yet)"))


def daily():
    data = run_claude(build_prompt(), "daily", ("WebSearch", "WebFetch"))
    (LOGS / f"{TODAY}.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    return data


def publish_all(data, label="OK"):
    known = load_vocab()
    for a in data["articles"][:3]:
        url, rep = publish(a, known)
        log(f"{label} {a.get('category', '경제')} | {a['source']} | {a['title_en']} -> {url} (다시 나온 단어 {rep})")


# ---------- 주간 정리 ----------
def week_articles(start):
    """이번 주 기사(노션에서 읽음): 제목·구분·이슈·영어 요약·새 단어"""
    pages = query_all(DB, {"filter": {"and": [
        {"property": "날짜", "date": {"on_or_after": start.isoformat()}},
        {"property": "날짜", "date": {"on_or_before": TODAY}},
        {"property": "구분", "select": {"does_not_equal": "주간 정리"}}]},
        "sorts": [{"property": "날짜", "direction": "ascending"}]})
    vocab = {}
    for v in query_all(VOCAB_DB, {"filter": {"property": "처음 본 날", "date": {"on_or_after": start.isoformat()}}}):
        pr = v["properties"]
        for rel in pr["기사"]["relation"][:1]:  # 처음 나온 기사
            vocab.setdefault(rel["id"], []).append(f"{plain(pr['단어'])} ({plain(pr['뜻'])})")
    arts = []
    for p in pages:
        pr = p["properties"]
        summary, inside = [], False
        for b in api("GET", f"/blocks/{p['id']}/children?page_size=100")["results"]:
            if b["type"] == "heading_2":
                if inside:
                    break
                inside = plain(b["heading_2"]) == "Summary"
            elif inside and b["type"] == "paragraph":
                summary.append(plain(b["paragraph"]))
            elif inside:
                break
        arts.append({"date": (pr["날짜"]["date"] or {}).get("start", ""),
                     "category": (pr["구분"]["select"] or {}).get("name", "경제"),
                     "issue": (pr["이슈"]["select"] or {}).get("name", ""),
                     "title": plain(pr["제목"]), "summary": summary,
                     "vocab": vocab.get(p["id"].replace("-", ""), vocab.get(p["id"], []))})
    return arts


def weekly_prompt():
    start = TODAY_D - dt.timedelta(days=6)
    arts = week_articles(start)
    if not arts:
        return None
    rng = f"{start:%m/%d}–{TODAY_D:%m/%d}"
    return ((HERE / "weekly_prompt.md").read_text(encoding="utf-8")
            .replace("{RANGE}", rng).replace("{ARTICLES}", json.dumps(arts, ensure_ascii=False)))


def weekly_publish(w):
    start = TODAY_D - dt.timedelta(days=6)
    rng = f"{start:%m/%d}–{TODAY_D:%m/%d}"
    arts = week_articles(start)
    week_vocab = {re.sub(r"\s*\(.*", "", v): "blue" for a in arts for v in a["vocab"]}
    blocks = [
        {"type": "callout", "callout": {"icon": {"type": "emoji", "emoji": "🗓️"}, "rich_text": [
            txt(f"{rng} 한 주 정리 · 기사 {len(arts)}개\n", bold=True),
            txt("파란 굵은 글씨", bold=True, color="blue"), txt(" = 이번 주에 배운 단어", color="gray")]}},
        h2("이번 주 경제 흐름"),
        *[para(rich(p, week_vocab)) for p in w["econ_en"]],
        toggle("한글 해석", [para([txt(p, color="gray")]) for p in w["econ_ko"]], color="gray"),
        h2("이번 주 세계 이슈 흐름"),
        *[para(rich(p, week_vocab)) for p in w["world_en"]],
        toggle("한글 해석", [para([txt(p, color="gray")]) for p in w["world_ko"]], color="gray"),
        h2("다음 주 지켜볼 것"),
        *[bullet([txt(x)]) for x in w["watch_ko"]],
        h2("단어 퀴즈"),
        *[toggle(f"{i}. {q['q']}", [para([txt(q["a"], color="gray")])]) for i, q in enumerate(w["quiz"], 1)],
    ]
    page = api("POST", "/pages", {"parent": {"database_id": DB}, "icon": {"type": "emoji", "emoji": "🗓️"},
                                  "properties": {
                                      "제목": {"title": [txt(f"Weekly Recap · {rng}")]},
                                      "날짜": {"date": {"start": TODAY}},
                                      "구분": {"select": {"name": "주간 정리"}},
                                      "한줄요약": {"rich_text": [txt(f"{rng} 경제·세계 이슈 흐름 + 단어 퀴즈")]},
                                      "상태": {"select": {"name": "안읽음"}}},
                                  "children": blocks})
    log(f"OK 주간 정리 -> {page['url']}")


def weekly():
    if done_today("주간"):
        return log("주간 정리 이미 있음 — 건너뜀")
    prompt = weekly_prompt()
    if not prompt:
        return log("주간 정리: 이번 주 기사 없음")
    weekly_publish(run_claude(prompt, "weekly"))


def write_prompt(name, text):
    LOGS.mkdir(exist_ok=True)
    f = LOGS / name
    f.write_text(text, encoding="utf-8")
    print(f"PROMPT {f}")


if __name__ == "__main__":
    LOGS.mkdir(exist_ok=True)
    arg = sys.argv[1] if len(sys.argv) > 1 else ""
    if arg == "weekly":
        weekly()
    elif arg == "cloud-prepare":
        if done_today():
            print("SKIP 오늘치 이미 노션에 있음")
        else:
            write_prompt(f"{TODAY}.cloud_prompt.md", build_prompt())
    elif arg == "cloud-publish":
        data = parse_json(Path(sys.argv[2]).read_text(encoding="utf-8"))
        if done_today():
            sys.exit(log("[cloud] 오늘치 이미 노션에 있음 — 올리지 않음"))
        publish_all(data, "OK[cloud]")
    elif arg == "cloud-weekly-prepare":
        prompt = None if TODAY_D.weekday() != 6 or done_today("주간") else weekly_prompt()
        print("SKIP 주간 정리 필요 없음") if not prompt else write_prompt(f"{TODAY}.cloud_weekly_prompt.md", prompt)
    elif arg == "cloud-weekly-publish":
        if done_today("주간"):
            sys.exit(log("[cloud] 주간 정리 이미 있음"))
        weekly_publish(parse_json(Path(sys.argv[2]).read_text(encoding="utf-8")))
    elif arg:
        publish_all(json.loads(Path(arg).read_text(encoding="utf-8")))
    else:
        if (LOGS / f"{TODAY}.json").exists() or done_today():
            sys.exit(log("오늘치 이미 생성됨 — 건너뜀"))
        publish_all(daily())
        if TODAY_D.weekday() == 6:
            weekly()
