You are writing a weekly recap ({RANGE}) for a Korean learner who studies stocks and follows global issues, using English news.
Do not use any tools. Use ONLY the article data below (this week's study articles as JSON). Do not invent facts or numbers.

{ARTICLES}

## Write
1. **Economy flow**: how markets moved this week and WHY, connecting the economy articles into one story (150–200 words, natural financial English, CEFR B2–C1), plus natural Korean translation.
2. **World flow**: the week's global politics/society/culture issues and how they connect to each other and to history/society (120–160 words English), plus Korean translation.
3. **Watch next week**: 3 bullet points in Korean — what to keep an eye on, based only on the articles.
4. **Vocab quiz**: pick the 10 most useful words from this week's vocab lists. For each, write a NEW fill-in-the-blank English sentence with "____" in place of the word, and the answer.

Reuse this week's vocab words naturally inside the two English flows where possible.

Output ONLY this JSON between the markers:

<<<JSON
{
  "econ_en": ["paragraph", "..."],
  "econ_ko": ["문단", "..."],
  "world_en": ["paragraph", "..."],
  "world_ko": ["문단", "..."],
  "watch_ko": ["...", "...", "..."],
  "quiz": [{"q": "The index ____ 3% on Tuesday.", "a": "slumped (slump) — 급락하다"}]
}
JSON>>>
