# Research methodology — how to answer legal questions correctly with this database

## Finding the right act
- **Search by title words, never by bare act number.** Act numbers repeat across years and
  changed format around 2015 (`nr.10 419, datë 26.5.2011` → `nr. 30/2024`). If a user gives
  you "ligji 55", ask which year or search title words and confirm by date.
- The **ELI URI** (e.g. `qbz.gov.al/eli/ligj/2015/05/28/55`) is the only stable identifier.
  Use it for every lookup, join, and citation.
- Try search variants: with and without ë/ç diacritics (older OCR corrupts them), singular
  and definite forms (Albanian nouns decline: "ligji/ligjin/ligjit").

## Determining whether a law is in force
1. `get_amendment_family` on the act. **Ignore the `in_force` flag — it is unreliable
   upstream and catches almost nothing.**
2. A **REPEAL act pointing at the law = abrogated** (shfuqizuar). Check the repealing act's
   text for transition provisions (dispozita kalimtare) — old law may still govern pending cases.
3. Check the Constitutional Court: `search_court_decisions` for the law's number/name.
   A GJK decision can strike the whole law or single provisions (shfuqizim i pjesshëm).
   Careful: a GJK case *title* saying "shfuqizim" describes the request, not the outcome —
   read the dispositive (after "PËR KËTO ARSYE" / "VENDOSI") to see if the petition was
   granted (pranim/shfuqizim) or rejected (rrëzim).
4. Amendments (AMENDMENT category) change the text but keep the law in force. The current
   text = base act + all amendments applied in order; qbz publishes official consolidated
   versions for many laws (see the `amendments` guide).

## Citation discipline
Cite every claim so a reader can verify it:
- **Acts:** type + number/year + date, ELI URI, gazette reference (FZ year/nr from `get_act`),
  and the `cdn_url` PDF (a stable public copy of the official gazette PDF).
- **GJK decisions:** number/year + date + `document_url`.
- When you assert something about an act's *content*, read it first (`get_act_text`) — never
  infer content from the title alone. Titles like "për disa shtesa" hide what actually changed.

## Source reliability tiers (when combining DB facts with outside information)
Label every claim by its source class:
- **Primary/authoritative:** this database (= Fletorja Zyrtare), court decisions, official
  registers (ASHK cadastre, QKB business registry), prosecution releases. State as fact.
- **Mainstream media:** established outlets reporting on documents. State as "reported by X".
- **Weak/partisan:** minor outlets or material released by an interested party. Flag as
  "reported, needs corroboration" — never state as fact.
Mark your own inferences explicitly as inference. Describe uncharged individuals as
reported/suspected, never as guilty.

## General habits
- Verify before asserting: run the query, read the text, then answer.
- Chronology matters: order amendment chains by act_date; an amendment can itself be
  amended or repealed later.
- When a question needs data no curated tool provides (counts, rankings, cross-tabulations),
  use `query_sql` — read the `schema` guide first.
