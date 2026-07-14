# bazaligjore

An MCP (Model Context Protocol) server for researching **Albanian legislation**. It exposes
a structured index of the Official Gazette (Fletorja Zyrtare, 2000–present, ~43,500 acts
with OCR full text), the official amendment graph between acts, and ~1,470 Constitutional
Court (Gjykata Kushtetuese) decisions — all built from the public sources at qbz.gov.al and
gjykatakushtetuese.gov.al.

Albania has no official consolidated legal database. This server lets any MCP client — for
example Claude, via **Settings → Connectors → Add custom connector** — research Albanian law
with correct method: stable ELI-URI citations, in-force tracing through repeal links instead
of unreliable flags, and OCR-aware search.

**Connector URL:** `https://bazaligjore.azurewebsites.net/mcp` (no auth, read-only)

## Tools

| Tool | Purpose |
|---|---|
| `search_acts` | Full-text or substring search over all acts (title + OCR body) |
| `get_act` | Metadata, gazette reference, PDF link, amendment relations |
| `get_act_text` | Paged slices of an act's OCR text, with find-jump |
| `get_amendment_family` | Walks the official amendment graph; renders an interactive timeline (MCP App) |
| `browse_gazette` | Issues of a year / table of contents of one issue |
| `search_court_decisions` | Constitutional Court decisions, full text |
| `get_court_decision_text` | Paged slices of a decision |
| `get_guide` | Built-in expert guides: research methodology, legal-system map, amendment mechanics, data caveats, SQL schema, external sources |
| `query_sql` | Ad-hoc read-only SQL (single SELECT/WITH, 200-row cap, 15s timeout) |

Prompts: `is_law_in_force`, `trace_amendments`, `research_topic`.

The guides (also exposed as `guide://` resources) carry the domain knowledge an assistant
needs to use the corpus correctly — start with `get_guide('methodology')`.

## Running it yourself

Requires Node 22+ and a PostgreSQL database with the expected schema (see
`get_guide('schema')` / `knowledge/schema.md`).

```sh
npm install
npm run build:ui        # bundles the MCP App UI into dist/ui/
PGHOST=... PGDATABASE=... PGUSER=... PGPASSWORD=... npm start
# MCP endpoint at http://localhost:3200/mcp (stateless streamable HTTP)
```

Environment: `PGHOST` `PGPORT` `PGDATABASE` `PGUSER` `PGPASSWORD` (`PGSSLMODE=require` for
managed Postgres), `PORT` (default 3200). Connections are forced
`default_transaction_read_only = on` with a 15s statement timeout — run it with a read-only
database role regardless.

A `Dockerfile` is included; `.github/workflows/deploy.yml` shows a container deploy driven
entirely by repository secrets.

## License

MIT
