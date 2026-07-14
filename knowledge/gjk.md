# Constitutional Court (Gjykata Kushtetuese, GJK) decisions

## What's here
~1,470 final decisions ("vendime përfundimtare") 1992–present, harvested from
gjykatakushtetuese.gov.al, with OCR full text. Columns: decision_number, decision_year,
decision_date, title, document_url (the court's own file), raw_text.

## Numbering and matching
- **GJK numbering restarts every year** — "vendimi 45" is meaningless without the year.
  Always cite as nr./year + date.
- Decisions that strike laws are also published in the FZ as acts; match by
  **number + year**, using the date only as tie-breaker, because **FZ act_date is one day
  earlier than the true decision date for 2021–2023** (timezone-shifted metadata upstream).
  The court's own documents carry the correct date.

## The 2019–2020 gap is real
No decisions exist for 2019–2020: the court lacked quorum during the justice-reform vetting
crisis (most judges dismissed or resigned; the court could not decide cases). This is
history, not missing data.

## Reading a decision
- Structure: intro (parties, petition) → legal analysis → dispositive after
  **"PËR KËTO ARSYE"** and **"VENDOSI:"**.
- **Titles/petitions say what was REQUESTED, not what was decided.** A case "për
  shfuqizimin e ligjit X" may end in rrëzim (rejection) — the law survives. Read the
  dispositive: "Pranimin e kërkesës / Shfuqizimin e …" = struck; "Rrëzimin e kërkesës" =
  rejected. Partial strikes (shfuqizim i pjesshëm) hit named articles only.
- Ties (4–4) fail the petition without settling the constitutional question; separate
  opinions (mendim pakice) matter for understanding contested issues.
- Ripeness/admissibility rejections (moszbatueshmëri, legjitimim) are not merits rulings.

## Effects on legislation
A GJK shfuqizim removes the provision from the legal order (usually from publication of the
decision, sometimes deferred). The amendment graph does NOT contain GJK strikes — always
check both: `get_amendment_family` for legislative changes AND `search_court_decisions`
for constitutional ones.

## Older decisions
1990s decisions were .doc files (extracted locally, decent quality). Early numbering and
formats vary; some 2001–2002 decisions exist in the FZ but are absent from the court's own
site.
