import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { q, qSandboxed } from "./db.js";
import { FAMILY_GRAPH_RESOURCE_URI } from "./ui-resource.js";

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

const ACT_COLS = `a.id, a.eli_uri, a.act_type, a.act_number,
  to_char(a.act_date, 'YYYY-MM-DD') AS act_date, a.act_category,
  a.title, a.title_full, a.in_force, a.is_base_act, a.institution_name,
  a.cdn_url, a.gazette_issue_id, (a.raw_text IS NOT NULL) AS has_text,
  length(a.raw_text) AS text_length`;

interface ActRow {
  id: number;
  eli_uri: string | null;
  act_type: string;
  act_number: string | null;
  act_date: string | null;
  act_category: string;
  title: string;
  title_full: string | null;
  in_force: boolean | null;
  is_base_act: boolean | null;
  institution_name: string | null;
  cdn_url: string | null;
  gazette_issue_id: number | null;
  has_text: boolean;
  text_length: number | null;
}

/** Resolve an act by numeric id or ELI URI (with or without http(s):// prefix). */
async function resolveAct(ref: { id?: number; eli_uri?: string }): Promise<ActRow | null> {
  if (ref.id != null) {
    const rows = await q<ActRow>(`SELECT ${ACT_COLS} FROM act a WHERE a.id = $1`, [ref.id]);
    return rows[0] ?? null;
  }
  if (ref.eli_uri) {
    const raw = ref.eli_uri.trim().replace(/\/+$/, "");
    const rows = await q<ActRow>(
      `SELECT ${ACT_COLS} FROM act a
       WHERE a.eli_uri = $1 OR a.eli_uri = 'http://' || $1 OR a.eli_uri = 'https://' || $1
       LIMIT 1`,
      [raw]
    );
    return rows[0] ?? null;
  }
  return null;
}

function actLine(a: ActRow): string {
  const date = a.act_date ?? "pa datë";
  const nr = a.act_number ? `nr. ${a.act_number}` : "";
  return `[${a.act_category}] ${a.act_type} ${nr} (${date}) — ${a.title}` +
    (a.eli_uri ? ` <${a.eli_uri}>` : ` (id ${a.id})`);
}

function text(s: string) {
  return { content: [{ type: "text" as const, text: s }] };
}

const refInput = {
  eli_uri: z.string().optional().describe(
    "ELI URI of the act, e.g. 'qbz.gov.al/eli/ligj/2015/05/28/55' (http:// prefix optional). Preferred stable key."
  ),
  id: z.number().int().optional().describe("Numeric act id from this database (from a previous search result)."),
};

/* ------------------------------------------------------------------ */
/* Tool registration                                                   */
/* ------------------------------------------------------------------ */

export function registerTools(server: McpServer) {
  /* ---------------- search_acts ---------------- */
  server.registerTool(
    "search_acts",
    {
      title: "Search Albanian legal acts",
      description:
        "Full-text search over ~43,000 acts of the Albanian Official Gazette (Fletorja Zyrtare, 2000–present), " +
        "including OCR'd body text. Modes: 'fulltext' (default; word matching over title + body, supports quoted phrases) " +
        "and 'substring' (ILIKE over titles only — use SQL wildcards: '_' matches one char, '%' many). " +
        "IMPORTANT for Albanian: older OCR often corrupts 'ë'/'ç'. In substring mode replace those letters with '_' " +
        "(e.g. 'po_em' finds 'Poçem'); in fulltext mode try both spellings (with and without diacritics). " +
        "act_type values are stored tokens like LIGJ, VENDIM (Council of Ministers decisions / VKM are stored as VENDIM, never 'VKM'), " +
        "DEKRET, URDHER, UDHEZIM, KORRIGJIM. act_category is one of ORIGINAL, AMENDMENT, REPEAL, RATIFICATION, OTHER.",
      inputSchema: {
        query: z.string().min(2).describe("Search terms (Albanian). In substring mode this is matched against titles with ILIKE."),
        mode: z.enum(["fulltext", "substring"]).default("fulltext").optional(),
        act_type: z.string().optional().describe("Filter: LIGJ | VENDIM | DEKRET | URDHER | UDHEZIM | KORRIGJIM ..."),
        category: z.enum(["ORIGINAL", "AMENDMENT", "REPEAL", "RATIFICATION", "OTHER"]).optional(),
        year_from: z.number().int().optional().describe("Earliest act year (inclusive)."),
        year_to: z.number().int().optional().describe("Latest act year (inclusive)."),
        limit: z.number().int().min(1).max(50).default(20).optional(),
        offset: z.number().int().min(0).default(0).optional(),
      },
    },
    async (args) => {
      const limit = Math.min(args.limit ?? 20, 50);
      const offset = args.offset ?? 0;
      const mode = args.mode ?? "fulltext";
      const where: string[] = [];
      const params: unknown[] = [];
      const p = (v: unknown) => {
        params.push(v);
        return `$${params.length}`;
      };

      let select = `SELECT ${ACT_COLS}`;
      let order = "ORDER BY a.act_date DESC NULLS LAST";

      if (mode === "fulltext") {
        const tq = p(args.query);
        select += `, ts_headline('simple', LEFT(coalesce(a.raw_text, a.title), 30000),
            websearch_to_tsquery('simple', ${tq}),
            'MaxFragments=2, MaxWords=25, MinWords=8, FragmentDelimiter= … ') AS snippet`;
        where.push(`a.search_vector @@ websearch_to_tsquery('simple', ${tq})`);
        order = `ORDER BY ts_rank(a.search_vector, websearch_to_tsquery('simple', ${tq})) DESC`;
      } else {
        const like = p(`%${args.query}%`);
        where.push(`(a.title ILIKE ${like} OR a.title_full ILIKE ${like})`);
      }
      if (args.act_type) where.push(`a.act_type = ${p(args.act_type.toUpperCase())}`);
      if (args.category) where.push(`a.act_category = ${p(args.category)}`);
      if (args.year_from) where.push(`EXTRACT(YEAR FROM a.act_date) >= ${p(args.year_from)}`);
      if (args.year_to) where.push(`EXTRACT(YEAR FROM a.act_date) <= ${p(args.year_to)}`);

      const sql = `${select} FROM act a WHERE ${where.join(" AND ")} ${order}
        LIMIT ${p(limit)} OFFSET ${p(offset)}`;
      const rows = await q<ActRow & { snippet?: string }>(sql, params);

      if (rows.length === 0) {
        return text(
          "No results. Tips: try substring mode with '_' in place of ë/ç; VKMs are act_type=VENDIM; " +
          "act numbers repeat across years — search by title words instead."
        );
      }
      const lines = rows.map((r, i) => {
        let s = `${offset + i + 1}. ${actLine(r)}`;
        if (r.snippet) s += `\n   …${r.snippet.replace(/\s+/g, " ").slice(0, 400)}…`;
        return s;
      });
      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
        structuredContent: { results: rows, offset, limit },
      };
    }
  );

  /* ---------------- get_act ---------------- */
  server.registerTool(
    "get_act",
    {
      title: "Get act details",
      description:
        "Full metadata for one act: identity, gazette issue, PDF link (cdn_url — a stable public copy of the official PDF), " +
        "plus its amendment relations: which acts amend/repeal it, and which acts it amends. " +
        "Note: do NOT trust the in_force flag — it is unreliable upstream. Judge current validity from REPEAL/AMENDMENT " +
        "edges returned here (an act with a REPEAL pointing at it is abrogated).",
      inputSchema: refInput,
    },
    async (args) => {
      const act = await resolveAct(args);
      if (!act) return text("Act not found. Pass eli_uri (e.g. qbz.gov.al/eli/ligj/2015/05/28/55) or a numeric id from search results.");

      const [amendedBy, amends, issue] = await Promise.all([
        q<ActRow>(
          `SELECT ${ACT_COLS} FROM act_amendment am JOIN act a ON a.id = am.amending_act_id
           WHERE am.amended_act_id = $1 ORDER BY a.act_date NULLS LAST LIMIT 100`,
          [act.id]
        ),
        q<ActRow>(
          `SELECT ${ACT_COLS} FROM act_amendment am JOIN act a ON a.id = am.amended_act_id
           WHERE am.amending_act_id = $1 ORDER BY a.act_date NULLS LAST LIMIT 100`,
          [act.id]
        ),
        act.gazette_issue_id
          ? q<{ year: number; issue_number: number }>(
              `SELECT year, issue_number FROM gazette_issue WHERE id = $1`,
              [act.gazette_issue_id]
            )
          : Promise.resolve([] as { year: number; issue_number: number }[]),
      ]);

      const parts: string[] = [actLine(act)];
      if (act.title_full && act.title_full !== act.title) parts.push(`Full title: ${act.title_full}`);
      if (act.institution_name) parts.push(`Institution: ${act.institution_name}`);
      if (issue[0]) parts.push(`Gazette: Fletorja Zyrtare ${issue[0].year} nr. ${issue[0].issue_number}`);
      if (act.cdn_url) parts.push(`PDF: ${act.cdn_url}`);
      parts.push(`OCR text: ${act.has_text ? `${act.text_length} chars (use get_act_text)` : "not available"}`);
      parts.push("");
      parts.push(`Amended/repealed BY ${amendedBy.length} act(s):`);
      for (const r of amendedBy) parts.push("  - " + actLine(r));
      parts.push(`Amends/repeals ${amends.length} act(s):`);
      for (const r of amends) parts.push("  - " + actLine(r));

      return {
        content: [{ type: "text" as const, text: parts.join("\n") }],
        structuredContent: { act, amended_by: amendedBy, amends, gazette: issue[0] ?? null },
      };
    }
  );

  /* ---------------- get_act_text ---------------- */
  server.registerTool(
    "get_act_text",
    {
      title: "Read the OCR text of an act",
      description:
        "Returns a slice of the act's full OCR body text (raw_text). Use offset/length to page through long laws, " +
        "or 'find' to jump to the first occurrence of a string (case-insensitive; remember older OCR may render ë/ç as '?'). " +
        "Structural tip: articles start at line beginnings as 'Neni N'. Amendment instructions typically open with " +
        "'Në ligjin nr.X …' and quote the new wording between quotation marks.",
      inputSchema: {
        ...refInput,
        offset: z.number().int().min(0).default(0).optional().describe("Character offset into the text."),
        length: z.number().int().min(200).max(20000).default(6000).optional(),
        find: z.string().optional().describe("Jump to first case-insensitive occurrence of this string and return text around it."),
      },
    },
    async (args) => {
      const act = await resolveAct(args);
      if (!act) return text("Act not found.");
      if (!act.has_text) return text(`This act has no OCR text. PDF (if any): ${act.cdn_url ?? "none"}`);

      const rows = await q<{ raw_text: string }>(`SELECT raw_text FROM act WHERE id = $1`, [act.id]);
      const full = rows[0].raw_text;
      const len = Math.min(args.length ?? 6000, 20000);
      let offset = args.offset ?? 0;

      if (args.find) {
        const idx = full.toLowerCase().indexOf(args.find.toLowerCase());
        if (idx === -1) {
          return text(`'${args.find}' not found in ${full.length} chars. Older OCR may corrupt ë/ç — try a variant without diacritics.`);
        }
        offset = Math.max(0, idx - 300);
      }
      const slice = full.slice(offset, offset + len);
      const header = `— ${act.title.slice(0, 120)} — chars ${offset}–${offset + slice.length} of ${full.length} —\n`;
      return text(header + slice);
    }
  );

  /* ---------------- get_amendment_family (with UI) ---------------- */
  registerAppTool(
    server,
    "get_amendment_family",
    {
      title: "Amendment family graph",
      description:
        "Walks the amendment graph (act_amendment table, sourced from official qbz RDF 'amends' links) around one act, " +
        "in both directions, up to 'depth' hops. Returns the family as nodes + edges and renders an interactive " +
        "timeline of the law and everything that amended or repealed it. This is the authoritative way to determine " +
        "whether a law is still in force and what shaped its current text — NOT the in_force flag.",
      inputSchema: {
        ...refInput,
        depth: z.number().int().min(1).max(4).default(2).optional()
          .describe("Hops to walk from the starting act (2 covers base act + its amendments + what those amend)."),
      },
      _meta: { ui: { resourceUri: FAMILY_GRAPH_RESOURCE_URI } },
    },
    async (args: { eli_uri?: string; id?: number; depth?: number }) => {
      const root = await resolveAct(args);
      if (!root) return text("Act not found. Pass eli_uri or numeric id.");
      const depth = Math.min(args.depth ?? 2, 4);

      const nodeIds = new Set<number>([root.id]);
      const edges = new Map<string, { from_id: number; to_id: number }>();
      let frontier = [root.id];
      const MAX_NODES = 150;

      for (let d = 0; d < depth && frontier.length > 0 && nodeIds.size < MAX_NODES; d++) {
        const rows = await q<{ amending_act_id: number; amended_act_id: number }>(
          `SELECT DISTINCT amending_act_id, amended_act_id FROM act_amendment
           WHERE (amending_act_id = ANY($1) OR amended_act_id = ANY($1))
             AND amending_act_id IS NOT NULL AND amended_act_id IS NOT NULL`,
          [frontier]
        );
        const next: number[] = [];
        for (const r of rows) {
          edges.set(`${r.amending_act_id}>${r.amended_act_id}`, {
            from_id: r.amending_act_id,
            to_id: r.amended_act_id,
          });
          for (const idn of [r.amending_act_id, r.amended_act_id]) {
            if (!nodeIds.has(idn) && nodeIds.size < MAX_NODES) {
              nodeIds.add(idn);
              next.push(idn);
            }
          }
        }
        frontier = next;
      }

      const nodes = await q<ActRow>(
        `SELECT ${ACT_COLS} FROM act a WHERE a.id = ANY($1) ORDER BY a.act_date NULLS LAST`,
        [[...nodeIds]]
      );

      const repealed = [...edges.values()].some(
        (e) => e.to_id === root.id && nodes.find((n) => n.id === e.from_id)?.act_category === "REPEAL"
      );
      const lines = [
        `Family of: ${actLine(root)}`,
        `${nodes.length} acts, ${edges.size} amendment links (depth ${depth}).` +
          (repealed ? " ⚠ A REPEAL act points at the root — this law appears ABROGATED." : ""),
        ...nodes.map((n) => "  " + actLine(n)),
      ];

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
        structuredContent: {
          root_id: root.id,
          depth,
          truncated: nodeIds.size >= MAX_NODES,
          nodes,
          edges: [...edges.values()],
        },
      };
    }
  );

  /* ---------------- browse_gazette ---------------- */
  server.registerTool(
    "browse_gazette",
    {
      title: "Browse Official Gazette issues",
      description:
        "Without issue_number: lists the gazette issues of a year with act counts. With issue_number: lists every act " +
        "published in that issue (its table of contents as parsed).",
      inputSchema: {
        year: z.number().int().min(2000).max(2100),
        issue_number: z.number().int().optional(),
      },
    },
    async (args) => {
      if (args.issue_number == null) {
        const rows = await q<{ issue_number: number; acts: number; page_count: number | null }>(
          `SELECT gi.issue_number, count(a.id) AS acts, gi.page_count
           FROM gazette_issue gi LEFT JOIN act a ON a.gazette_issue_id = gi.id
           WHERE gi.year = $1 AND gi.download_status = 'COMPLETED'
           GROUP BY gi.id ORDER BY gi.issue_number`,
          [args.year]
        );
        if (rows.length === 0) return text(`No indexed issues for ${args.year}.`);
        return {
          content: [{
            type: "text" as const,
            text: `Fletorja Zyrtare ${args.year}: ${rows.length} issues.\n` +
              rows.map((r) => `  nr. ${r.issue_number} — ${r.acts} acts`).join("\n"),
          }],
          structuredContent: { year: args.year, issues: rows },
        };
      }
      const rows = await q<ActRow>(
        `SELECT ${ACT_COLS} FROM act a JOIN gazette_issue gi ON gi.id = a.gazette_issue_id
         WHERE gi.year = $1 AND gi.issue_number = $2 ORDER BY a.page_in_gazette NULLS LAST, a.id`,
        [args.year, args.issue_number]
      );
      if (rows.length === 0) return text(`No acts found for FZ ${args.year} nr. ${args.issue_number}.`);
      return {
        content: [{
          type: "text" as const,
          text: `FZ ${args.year} nr. ${args.issue_number} — ${rows.length} acts:\n` +
            rows.map((r) => "  " + actLine(r)).join("\n"),
        }],
        structuredContent: { year: args.year, issue_number: args.issue_number, acts: rows },
      };
    }
  );

  /* ---------------- search_court_decisions ---------------- */
  server.registerTool(
    "search_court_decisions",
    {
      title: "Search Constitutional Court decisions",
      description:
        "Searches ~1,470 Albanian Constitutional Court (Gjykata Kushtetuese, GJK) final decisions 1992–present, " +
        "with full OCR text. Matches title and body text. Note: no decisions exist for 2019–2020 (the court lacked " +
        "quorum during the vetting crisis) — that gap is real. GJK decision numbering restarts each year.",
      inputSchema: {
        query: z.string().min(2).describe("Words to find in the decision title or body (Albanian)."),
        year: z.number().int().optional(),
        limit: z.number().int().min(1).max(30).default(10).optional(),
      },
    },
    async (args) => {
      const limit = Math.min(args.limit ?? 10, 30);
      const params: unknown[] = [`%${args.query}%`];
      let where = `(cd.title ILIKE $1 OR cd.raw_text ILIKE $1)`;
      if (args.year) {
        params.push(args.year);
        where += ` AND cd.decision_year = $${params.length}`;
      }
      params.push(limit);
      let rows: {
        id: number; decision_number: string | null; decision_year: number;
        decision_date: string | null; title: string; document_url: string; has_text: boolean;
      }[];
      try {
        rows = await q(
          `SELECT cd.id, cd.decision_number, cd.decision_year,
             to_char(cd.decision_date, 'YYYY-MM-DD') AS decision_date,
             cd.title, cd.document_url, (cd.raw_text IS NOT NULL) AS has_text
           FROM court_decision cd WHERE ${where}
           ORDER BY cd.decision_date DESC NULLS LAST LIMIT $${params.length}`,
          params
        );
      } catch {
        return text("Constitutional Court (GJK) decisions are not available in this deployment.");
      }
      if (rows.length === 0) return text("No GJK decisions matched. Try fewer/other words; ë/ç variants may help.");
      return {
        content: [{
          type: "text" as const,
          text: rows.map((r) =>
            `GJK nr. ${r.decision_number ?? "?"}/${r.decision_year} (${r.decision_date ?? "?"}) [id ${r.id}] — ${r.title.slice(0, 200)}`
          ).join("\n"),
        }],
        structuredContent: { results: rows },
      };
    }
  );

  /* ---------------- get_court_decision_text ---------------- */
  server.registerTool(
    "get_court_decision_text",
    {
      title: "Read a Constitutional Court decision",
      description:
        "Returns a slice of the OCR text of one GJK decision by id (from search_court_decisions). " +
        "Use offset/length to page, or 'find' to jump to a phrase. The dispositive part usually follows " +
        "'PËR KËTO ARSYE' / 'VENDOSI'.",
      inputSchema: {
        id: z.number().int(),
        offset: z.number().int().min(0).default(0).optional(),
        length: z.number().int().min(200).max(20000).default(6000).optional(),
        find: z.string().optional(),
      },
    },
    async (args) => {
      let rows: { title: string; raw_text: string | null }[];
      try {
        rows = await q(`SELECT title, raw_text FROM court_decision WHERE id = $1`, [args.id]);
      } catch {
        return text("Constitutional Court (GJK) decisions are not available in this deployment.");
      }
      if (!rows[0]) return text("Decision not found.");
      if (!rows[0].raw_text) return text("This decision has no OCR text yet.");
      const full = rows[0].raw_text;
      const len = Math.min(args.length ?? 6000, 20000);
      let offset = args.offset ?? 0;
      if (args.find) {
        const idx = full.toLowerCase().indexOf(args.find.toLowerCase());
        if (idx === -1) return text(`'${args.find}' not found in ${full.length} chars.`);
        offset = Math.max(0, idx - 300);
      }
      const slice = full.slice(offset, offset + len);
      return text(`— ${rows[0].title.slice(0, 120)} — chars ${offset}–${offset + slice.length} of ${full.length} —\n${slice}`);
    }
  );

  /* ---------------- query_sql ---------------- */
  server.registerTool(
    "query_sql",
    {
      title: "Run a read-only SQL query",
      description:
        "Runs a single read-only SQL query (SELECT or WITH) against the legal database — use it for anything the " +
        "curated tools don't cover: counts, rankings, cross-tabulations, custom joins. " +
        "READ get_guide('schema') FIRST — it has the tables, indexes, and worked examples. " +
        "Rules: one statement; results capped at 200 rows (aggregate in SQL or paginate with OFFSET); 15s timeout, " +
        "so use the indexed paths (search_vector @@ websearch_to_tsquery('simple', …) for text, trigram ILIKE on titles) " +
        "and filter before scanning raw_text. Remember: ë/ç may be corrupted in older text — '_' is a one-char wildcard " +
        "in LIKE patterns. Always select eli_uri when returning acts, for citation.",
      inputSchema: {
        sql: z.string().min(8).describe("A single SELECT (or WITH … SELECT) statement. No trailing semicolon needed."),
      },
    },
    async (args) => {
      // Defense in depth — the real guards are the read-only role,
      // default_transaction_read_only=on, and the 15s statement timeout.
      const cleaned = args.sql
        .replace(/--[^\n]*/g, " ")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .trim()
        .replace(/;+\s*$/, "");
      if (cleaned.includes(";")) {
        return { content: [{ type: "text" as const, text: "Error: a single statement only — remove inner ';'." }], isError: true };
      }
      if (!/^(select|with)\b/i.test(cleaned)) {
        return { content: [{ type: "text" as const, text: "Error: only SELECT / WITH queries are allowed." }], isError: true };
      }

      const MAX_ROWS = 200;
      try {
        // 8s ceiling for ad-hoc SQL — tighter than the 15s pool default, to
        // limit how long one public query can hold a connection.
        const rows = await qSandboxed<Record<string, unknown>>(
          `SELECT * FROM (${cleaned}) _q LIMIT ${MAX_ROWS + 1}`,
          8000
        );
        const truncated = rows.length > MAX_ROWS;
        const shown = truncated ? rows.slice(0, MAX_ROWS) : rows;
        if (shown.length === 0) {
          return { content: [{ type: "text" as const, text: "0 rows." }], structuredContent: { rows: [], truncated: false } };
        }
        const cols = Object.keys(shown[0]);
        const fmt = (v: unknown) =>
          v == null ? "∅" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).replace(/\s+/g, " ").slice(0, 200);
        const lines = [
          cols.join(" | "),
          ...shown.map((r) => cols.map((c) => fmt(r[c])).join(" | ")),
        ];
        const footer = truncated
          ? `\n(${MAX_ROWS} rows shown — result truncated; aggregate or paginate with OFFSET)`
          : `\n(${shown.length} rows)`;
        return {
          content: [{ type: "text" as const, text: lines.join("\n") + footer }],
          structuredContent: { rows: shown, truncated },
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: "text" as const, text: `SQL error: ${msg}` }], isError: true };
      }
    }
  );

  /* ---------------- prompts ---------------- */
  server.registerPrompt(
    "is_law_in_force",
    {
      title: "Is this law still in force?",
      description: "Trace whether an Albanian law is still in force and what has changed it.",
      argsSchema: { law: z.string().describe("Law name, number/year, or ELI URI") },
    },
    ({ law }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text:
              `Determine whether this Albanian law is still in force and summarize its amendment history: ${law}\n\n` +
              `Method: 1) find it with search_acts (title words beat act numbers — numbers repeat across years); ` +
              `2) run get_amendment_family on its eli_uri; 3) a REPEAL act pointing at it means abrogated — ` +
              `ignore the in_force flag; 4) list amendments chronologically with gazette references and PDF links; ` +
              `5) check search_court_decisions for any GJK decision striking it down (shfuqizim).`,
          },
        },
      ],
    })
  );

  server.registerPrompt(
    "trace_amendments",
    {
      title: "Full amendment history of a law",
      description: "Chronological, cited history of every change to an Albanian law, with what each change did.",
      argsSchema: { law: z.string().describe("Law name, number/year, or ELI URI") },
    },
    ({ law }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text:
              `Produce the full amendment history of this Albanian law: ${law}\n\n` +
              `Method: read get_guide('methodology') and get_guide('amendments') first. Find the base act ` +
              `(search_acts by title words), run get_amendment_family, then for each amending act read its text ` +
              `(get_act_text) and summarize WHAT it changed — the instruction blocks open with 'Në ligjin nr.X…'; ` +
              `beware omnibus acts (extract only the blocks naming this law). Also check search_court_decisions ` +
              `for GJK strikes. Deliver a chronological table: date, act (ELI + FZ ref + PDF), category, what changed.`,
          },
        },
      ],
    })
  );

  server.registerPrompt(
    "research_topic",
    {
      title: "Research a legal topic across the corpus",
      description: "Find and synthesize all Albanian legislation on a topic, with citations.",
      argsSchema: { topic: z.string().describe("Topic in Albanian or English, e.g. 'energjia e rinovueshme'") },
    },
    ({ topic }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text:
              `Research Albanian legislation on: ${topic}\n\n` +
              `Method: read get_guide('methodology') first. Search with multiple variants (Albanian terms, with and ` +
              `without ë/ç, synonyms); use query_sql for aggregate views (acts per year, institutions) after reading ` +
              `get_guide('schema'). Identify the governing law(s), map their families (get_amendment_family) to find ` +
              `the current state, check GJK decisions, and deliver: governing framework, key acts chronologically, ` +
              `what is currently in force, open questions. Cite every act (ELI + FZ ref + PDF).`,
          },
        },
      ],
    })
  );
}
