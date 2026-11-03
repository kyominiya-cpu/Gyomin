You are preparing today's ({TODAY}, KST) economic English news study set for a Korean learner who also studies stocks.

## Task
Use WebSearch and WebFetch to pick 3 stories from the last 24 hours, then write study material for each:
- **Articles 1–2 (category "경제")**: the 2 most market-moving economy / stock market stories, on different topics (e.g. US market / Fed / rates, a major company's earnings or deal, commodities, FX, China, Asia or Korea-related).
- **Article 3 (category "정치·사회·문화")**: the single most talked-about **global** politics, society or culture story right now (the one leading front pages worldwide, not a local or celebrity-gossip story). Must not be an economy/market story.

## Sources (cross-verified as credible + widely read)
- Economy: prefer freely readable **Reuters, CNBC, AP, Yahoo Finance**.
- Politics/society/culture: prefer **Reuters, AP, BBC, The Guardian**.
- Bloomberg, WSJ, FT are paywalled: you may use them only if you can read the article, otherwise pick a free source covering the same story.
- Do not use blogs, press-release sites, or AI-generated content farms.

## Selection rules
- Each story must be from the last 24 hours. Read the actual article with WebFetch before writing.
- Skip any URL in this already-used list:
{HISTORY}

## Ongoing issues (follow the flow)
Each article gets an "issue": a short Korean name for the ongoing story it belongs to (e.g. "미국-이란 갈등", "애플 실적", "미국 중간선거", "AI 반도체 투자"). If the story continues one of these existing issues, reuse the exact same name; otherwise make a new one:
{ISSUES}

## Words the learner already has (do NOT pick these as vocab)
{KNOWN}

## Writing rules (copyright)
- **Never copy article sentences.** Write your own English summary in natural financial-news English (CEFR B2–C1), 150–200 words, 2–3 paragraphs. Numbers and facts must match the article.
- At most one short direct quote (under 25 words) per story, credited ("..., Powell said.").
- Korean translation should be natural Korean, not word-for-word.
- Expressions: 6 useful multi-word news expressions (phrases, collocations, idioms) that appear in YOUR summary verbatim (so they can be highlighted), e.g. "rate cut", "beat estimates", "risk-off".
- Vocabulary: the learner's vocabulary is weak, so also pick **12 single words** from YOUR summary that an intermediate Korean learner likely doesn't know (B2–C1, skip basic words and skip words already used in expressions). "word" must be the exact form in the summary (e.g. "slumped"); "base" is the dictionary form ("slump"). Give part of speech, Korean meaning in this context, a simple English synonym, and a new short example sentence.

## Output
Output ONLY this JSON between the markers, nothing else after it:

<<<JSON
{
  "articles": [
    {
      "title_en": "original headline",
      "title_ko": "한국어 제목",
      "category": "경제 | 정치·사회·문화",
      "source": "Reuters | CNBC | AP | Yahoo Finance | BBC | The Guardian | Bloomberg | WSJ | FT | MarketWatch",
      "url": "https://...",
      "published": "YYYY-MM-DD",
      "topics": ["증시 | 금리·연준 | 기업실적 | 원자재 | 환율 | 거시경제 | 기술주 | 지정학 | 정치 | 사회 | 문화 | 국제 (1-2개)"],
      "one_line_ko": "한 줄 요약 (40자 이내)",
      "summary_en": ["paragraph 1", "paragraph 2"],
      "summary_ko": ["문단 1 번역", "문단 2 번역"],
      "expressions": [{"en": "beat estimates", "ko": "예상치를 웃돌다", "example": "short new example sentence"}],
      "vocab": [{"word": "slumped", "base": "slump", "pos": "v.", "ko": "급락하다", "synonym": "fell sharply", "example": "short new example sentence"}],
      "issue": "이어지는 이슈 이름 (위 목록 재사용 우선)",
      "background_ko": "배경 지식 3-4문장. 이 일이 왜 생겼는지 역사적·사회적·경제적 맥락. 경제 기사는 핵심 개념(예: 마진, 국채 금리)이 왜 주가에 영향을 주는지도 설명",
      "why_it_matters_ko": "왜 중요한지 2-3문장 (경제 기사는 주식 투자자 관점, 정치·사회·문화 기사는 세계·한국에 미치는 영향)",
      "questions": [{"q": "comprehension question in English", "a": "답 (한국어)"}]
    }
  ]
}
JSON>>>

Include exactly 3 articles (2 경제 first, then 1 정치·사회·문화), 6 expressions, 12 vocab words and 2 questions per article.
