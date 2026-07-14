import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools.js";
import { registerUiResources } from "./ui-resource.js";
import { registerKnowledge } from "./knowledge.js";

const INSTRUCTIONS = `
Read-only research access to the Albanian consolidated legal database: every act of the
Official Gazette (Fletorja Zyrtare) since 2000 (~43,000 acts with OCR full text), the
amendment graph between them, and ~1,470 Constitutional Court (GJK) decisions since 1992.
Albania has no official consolidated legal database; this fills that gap.

Hard-won rules for querying correctly:
- The ELI URI (e.g. qbz.gov.al/eli/ligj/2015/05/28/55) is the ONLY stable key for an act.
  Act numbers repeat across years and changed format (~2015: 'nr.10419' -> 'nr.30/2024');
  never join or cite by bare act number.
- Council of Ministers decisions (VKM) are stored with act_type = VENDIM, not 'VKM'.
- The in_force flag is unreliable. To judge validity, walk the amendment graph
  (get_amendment_family): a REPEAL act pointing at a law means it is abrogated. Also check
  GJK decisions (shfuqizim) via search_court_decisions.
- Albanian letters ë/ç are often corrupted in older OCR. In substring searches use '_'
  as a one-character wildcard (e.g. 'po_em' matches 'Poçem'); in full-text mode try both
  spellings.
- Amendment texts open with 'Në ligjin nr.X ...' and quote new wording; articles start at
  line beginnings as 'Neni N' (declensions neni/nenin/nenit/neneve appear in references).
- Cite acts by ELI URI plus gazette reference (FZ year/nr.); PDFs at cdn_url are stable
  public copies of the official gazette PDFs.

This server also carries a knowledge base distilled from months of research on this corpus:
call get_guide() for the index. Before any nontrivial research task read
get_guide('methodology'); before writing SQL read get_guide('schema'). For ad-hoc analytical
questions (counts, rankings, custom joins) use query_sql — a read-only SELECT interface to
the whole database. Verify before asserting: read the act's text before describing its
content, and label claims by source reliability (see the methodology guide).
`.trim();

export function buildServer(): McpServer {
  const server = new McpServer(
    { name: "bazaligjore", version: "0.2.0" },
    { instructions: INSTRUCTIONS }
  );
  registerUiResources(server);
  registerKnowledge(server);
  registerTools(server);
  return server;
}
