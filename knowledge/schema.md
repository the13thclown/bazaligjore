# SQL schema — for `query_sql` (read-only, 200-row cap, 15s timeout)

## act — one row per act (~43,500)
| column | type | notes |
|---|---|---|
| id | bigint PK | internal id |
| eli_uri | varchar | stable key, e.g. `http://qbz.gov.al/eli/ligj/2015/05/28/55` (nullable) |
| act_type | varchar | LIGJ, VENDIM (incl. all VKM), DEKRET, URDHER, UDHEZIM, KORRIGJIM… (indexed) |
| act_category | varchar | ORIGINAL / AMENDMENT / REPEAL / RATIFICATION / OTHER (indexed) |
| act_number | varchar | NOT unique — repeats across years/types; may contain spaces |
| act_date | date | nullable, occasionally wrong (see data-caveats) |
| title, title_full | text | TOC title / longer qbz title (both trigram-indexed) |
| raw_text | text | OCR full text (nullable; trigram-indexed) |
| search_vector | tsvector | GIN index over title + title_full + LEFT(raw_text, 200k), 'simple' dict |
| in_force | boolean | UNRELIABLE — do not use for validity |
| is_base_act | boolean | qbz flag |
| institution_name | varchar | issuing institution (names vary over time) |
| gazette_issue_id | bigint FK | → gazette_issue |
| cdn_url | varchar | public PDF copy |
| source | varchar | GAZETTE / ALFRESCO_ENRICHMENT / BOTIME_ZYRTARE / CODE / CONSTITUTION |
| page_in_gazette | int | page in the FZ issue |

## act_amendment — the amendment graph
| column | notes |
|---|---|
| amending_act_id → act.id | the act that changes something |
| amended_act_id → act.id | the act being changed |
| amended_act_eli_uri, amending_act_eli_uri | denormalized ELIs |
| source | 'RDF' (official qbz links) |
Both id columns indexed; ids can be null when the counterpart act isn't in the DB — filter
`IS NOT NULL` when joining.

## gazette_issue — one row per FZ issue
`id, year, issue_number, page_count, acts_parsed_count, download_status`
(use `download_status = 'COMPLETED'`).

## court_decision — GJK decisions (~1,470)
`id, court ('GJK'), decision_number (varchar), decision_year, decision_date, title,
source_page_url, document_url (unique), raw_text, matched_act_id → act.id (mostly null)`.
No tsvector — use ILIKE (small table, fine).

## Query patterns that work well
```sql
-- Acts per type per year
SELECT EXTRACT(YEAR FROM act_date)::int AS yr, act_type, count(*)
FROM act WHERE act_date IS NOT NULL GROUP BY 1, 2 ORDER BY 1, 3 DESC;

-- Fast full-text (ALWAYS prefer this over ILIKE on raw_text)
SELECT eli_uri, title, act_date FROM act
WHERE search_vector @@ websearch_to_tsquery('simple', 'investimet strategjike')
ORDER BY act_date DESC LIMIT 50;

-- ë/ç-safe title match (single-char wildcard _)
SELECT eli_uri, title FROM act WHERE title ILIKE '%po_em%';

-- Most-amended laws
SELECT a.eli_uri, a.title, count(*) AS amendments
FROM act_amendment am JOIN act a ON a.id = am.amended_act_id
JOIN act b ON b.id = am.amending_act_id AND b.act_category = 'AMENDMENT'
GROUP BY a.id ORDER BY amendments DESC LIMIT 20;

-- Repealed laws of a year
SELECT t.eli_uri, t.title, r.title AS repealed_by
FROM act_amendment am
JOIN act r ON r.id = am.amending_act_id AND r.act_category = 'REPEAL'
JOIN act t ON t.id = am.amended_act_id
WHERE EXTRACT(YEAR FROM t.act_date) = 2015;
```

## Rules
- SELECT/WITH only; single statement. Rows are capped at 200 (`truncated` flag set) —
  aggregate in SQL or paginate with OFFSET rather than pulling big sets.
- 15s statement timeout: filter before scanning raw_text; use search_vector for text search.
- Dates: `to_char(act_date,'YYYY-MM-DD')` for clean output; guard NULLs.
- Text you display to users should cite eli_uri — select it in every act query.
