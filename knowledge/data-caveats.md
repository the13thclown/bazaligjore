# Data caveats — what this database contains, and its sharp edges

## Coverage
- Every Fletorja Zyrtare issue from **2000 to present**: ~43,500 acts parsed from issue
  tables of contents, enriched with qbz metadata (ELI URI, institution, relations).
- ~42,600 acts have OCR full text (`raw_text`); the rest are metadata-only.
- The Constitution and the Codes come from qbz's Botime Zyrtare collection.
- ~1,470 Constitutional Court decisions 1992–present with OCR text (see `gjk` guide).
- **Not in the DB:** acts published only before 2000 (unless amended/referenced later and
  enriched from qbz), sub-legal acts never published in the FZ, municipal acts, court
  jurisprudence other than the GJK, and travaux préparatoires (see `external-sources`).

## OCR quirks — read before trusting text search
- Three OCR backends were used; formatting is NOT uniform. Expect plain text.
- **Albanian letters ë and ç are often corrupted in older PDFs** (extracted as `?` or
  mangled). Consequences:
  - Substring search: replace ë/ç with `_` (single-char SQL wildcard): `'%po_em%'`
    matches "Poçem".
  - Full-text search: try both spellings ("perdorim" and "përdorim").
  - `find` in get_act_text: try ASCII variants if the diacritic form misses.
- Line breaks fall mid-sentence (PDF columns); numbers sometimes contain spaces
  ("nr.10 419").
- Scanned older gazettes have genuinely noisy OCR — quote carefully, verify against the
  PDF (`cdn_url`) when a passage matters.

## Search strategy (fast vs slow paths)
- `search_acts` fulltext mode uses a **tsvector GIN index** ('simple' dictionary —
  lowercase, no stemming, correct for Albanian) over title + title_full + first 200k chars
  of raw_text. Fast. Quoted phrases work (websearch syntax).
- Substring mode uses **trigram indexes** on title/title_full. Fast for titles.
- In `query_sql`: `search_vector @@ websearch_to_tsquery('simple', '…')` is the fast path;
  `raw_text ILIKE '%…%'` over all acts also works (trigram-indexed) but is slower — always
  add filters (year, act_type) when you can. The statement timeout is 15s.

## Fields with known unreliability
- **`in_force`** — upstream flag, catches almost nothing. Never use it to judge validity;
  use REPEAL edges in the amendment graph.
- **`act_category`** — automated classification (rules + LLM). Good but not perfect;
  borderline "shtesë" acts and court decisions have known error modes.
- **`act_date`** — occasionally null or off; for GJK decisions published in the FZ,
  2021–2023 dates are one day earlier than the true decision date (timezone artifact).
- **`title` vs `title_full`** — TOC-parsed vs qbz metadata; search both (the tools do).

## Sizes (orient your queries)
~43.5k acts; ~260 gazette issues/year recently; tens of thousands of amendment edges;
raw_text ranges from a few hundred chars to ~200KB (codes). Aggregate in SQL rather than
pulling rows into context.
