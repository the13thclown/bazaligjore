# External sources — for questions this database can't answer

## qbz.gov.al (Qendra e Botimeve Zyrtare) — the source of this DB
- JS single-page app; content sits in an Alfresco repository.
- Gazette issue PDFs follow a predictable pattern:
  `https://qbz.gov.al/alfresco/webdav/FZ/{YEAR}/{ISSUE}/FZ-{YEAR}-{ISSUE}.pdf`
  (uppercase `FZ-` post-~2015, lowercase `fz-` earlier).
- Consolidated ("i përditësuar") versions of amended laws exist for most heavily-amended
  laws — search the site for the law title; consolidated PDFs live under the act's ELI path
  with `/cons/{date}`.
- Every act in this DB carries a `cdn_url` — a stable public copy of its PDF — so you rarely
  need qbz directly for documents already indexed here.

## bisedimet.parlament.al — parliamentary debates (travaux préparatoires)
Digital archive of plenary session transcripts ("Punime të Kuvendit", 1991–2024). React SPA,
but the search API is open (no auth):
- `GET https://bisedimet.parlament.al/api/search?q=<terms>&limit=N` — full-text search;
  returns hits with `id`, `title` (e.g. "Punime të Kuvendit, viti 2008 nr.4"), speakers,
  and a content fragment around the match. Search WITHOUT ë/ç diacritics.
- `GET https://bisedimet.parlament.al/api/documents/{id}/download` — downloads the volume
  PDF without auth.
- Useful for legislative intent: find the debate on a law by searching its number or topic
  words. Inside a volume, sessions are ordered by date; votes appear at the end of a
  session ("Hapet votimi… X pro, Y kundër"). The real position is the vote, not the
  procedural "shprehet dakord" round.

## gjykatakushtetuese.gov.al — Constitutional Court
Decisions by year under "vendime përfundimtare" pages (this DB already indexes them —
see the `gjk` guide). The court's own PDFs are at each decision's `document_url`.

## Other official registers (not in this DB)
- **QKB** (qkb.gov.al) — business registry: company ownership, administrators, extracts.
- **ASHK** — cadastre (property); public map access via ASIG Geoportal
  (geoportal.asig.gov.al) WMS services.
- **Gjykata e Lartë / gjykata.gov.al** — ordinary-court decisions (not indexed here).
- **Official websites of ministries** for sub-legal acts never published in the FZ.

When you rely on any of these, cite the exact URL and treat scraped content per the
source-reliability tiers in the `methodology` guide.
