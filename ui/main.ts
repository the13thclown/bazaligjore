import { App } from "@modelcontextprotocol/ext-apps";

interface ActNode {
  id: number;
  eli_uri: string | null;
  act_type: string;
  act_number: string | null;
  act_date: string | null;
  act_category: string;
  title: string;
  title_full: string | null;
  in_force: boolean | null;
  institution_name: string | null;
  cdn_url: string | null;
  has_text: boolean;
}
interface Edge { from_id: number; to_id: number }
interface FamilyData {
  root_id: number;
  depth: number;
  truncated: boolean;
  nodes: ActNode[];
  edges: Edge[];
}

const CAT_COLOR: Record<string, string> = {
  ORIGINAL: "var(--cat-original)",
  AMENDMENT: "var(--cat-amendment)",
  REPEAL: "var(--cat-repeal)",
  RATIFICATION: "var(--cat-ratification)",
  OTHER: "var(--cat-other)",
};
const CAT_LABEL: Record<string, string> = {
  ORIGINAL: "akt bazë",
  AMENDMENT: "ndryshim",
  REPEAL: "shfuqizim",
  RATIFICATION: "ratifikim",
  OTHER: "tjetër",
};

const app = new App({ name: "Bazaligjore — Family Graph", version: "0.1.0" });
const root = document.getElementById("app")!;
let data: FamilyData | null = null;
let openId: number | null = null;

app.ontoolresult = (result: any) => {
  const sc = result?.structuredContent;
  if (sc && Array.isArray(sc.nodes)) {
    data = sc as FamilyData;
    openId = null;
    render();
  }
};
app.connect();

// Dev preview outside the MCP host: open dist/ui/index.html#demo in a browser.
if (location.hash === "#demo") {
  const mk = (id: number, cat: string, date: string, type: string, nr: string, title: string): ActNode => ({
    id, eli_uri: `http://qbz.gov.al/eli/demo/${id}`, act_type: type, act_number: nr,
    act_date: date, act_category: cat, title, title_full: null, in_force: null,
    institution_name: "Kuvendi", cdn_url: "https://example.invalid/demo.pdf", has_text: true,
  });
  data = {
    root_id: 1, depth: 2, truncated: false,
    nodes: [
      mk(1, "ORIGINAL", "2015-05-28", "LIGJ", "55", "Për investimet strategjike në Republikën e Shqipërisë"),
      mk(2, "AMENDMENT", "2018-10-04", "LIGJ", "67", "Për një ndryshim në ligjin nr. 55/2015"),
      mk(3, "AMENDMENT", "2019-12-17", "LIGJ", "89", "Për një ndryshim në ligjin nr. 55/2015, të ndryshuar"),
      mk(4, "RATIFICATION", "2021-03-10", "LIGJ", "22", "Për miratimin e marrëveshjes kuadër për një projekt strategjik"),
      mk(5, "REPEAL", "2024-02-01", "LIGJ", "21", "Për zhvillimin e qëndrueshëm të investimeve (shfuqizon ligjin 55/2015)"),
    ],
    edges: [
      { from_id: 2, to_id: 1 }, { from_id: 3, to_id: 1 },
      { from_id: 4, to_id: 1 }, { from_id: 5, to_id: 1 },
    ],
  };
  render();
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, cls?: string, txt?: string
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
}

function shortName(a: ActNode): string {
  const nr = a.act_number ? ` nr. ${a.act_number}` : "";
  const yr = a.act_date ? `/${a.act_date.slice(0, 4)}` : "";
  return `${a.act_type}${nr}${yr}`;
}

async function expandFrom(node: ActNode) {
  try {
    const res: any = await app.callServerTool({
      name: "get_amendment_family",
      arguments: node.eli_uri ? { eli_uri: node.eli_uri, depth: 2 } : { id: node.id, depth: 2 },
    });
    const sc = res?.structuredContent;
    if (sc && Array.isArray(sc.nodes)) {
      data = sc as FamilyData;
      openId = null;
      render();
    }
  } catch (e) {
    console.error("expand failed", e);
  }
}

function render() {
  root.textContent = "";
  if (!data || data.nodes.length === 0) {
    root.append(el("div", "empty", "S’ka të dhëna për këtë familje aktesh."));
    return;
  }
  const byId = new Map(data.nodes.map((n) => [n.id, n]));
  const rootAct = byId.get(data.root_id) ?? data.nodes[0];

  // ---- header ----
  const hdr = el("div", "hdr");
  hdr.append(el("h1", undefined, rootAct.title));
  const meta = el("div", "meta",
    `${shortName(rootAct)}${rootAct.act_date ? " · " + rootAct.act_date : ""}` +
    (rootAct.institution_name ? " · " + rootAct.institution_name : ""));
  hdr.append(meta);

  // status chips: derived from the graph, not the in_force flag
  const repealEdge = data.edges.find(
    (e) => e.to_id === rootAct.id && byId.get(e.from_id)?.act_category === "REPEAL"
  );
  const amendCount = data.edges.filter(
    (e) => e.to_id === rootAct.id && byId.get(e.from_id)?.act_category === "AMENDMENT"
  ).length;

  const chips = el("div");
  const catChip = el("span", "chip");
  const catDot = el("span", "dot");
  catDot.style.background = CAT_COLOR[rootAct.act_category] ?? CAT_COLOR.OTHER;
  catChip.append(catDot, document.createTextNode(CAT_LABEL[rootAct.act_category] ?? rootAct.act_category));
  chips.append(catChip);
  chips.append(el("span", "chip", `${amendCount} ndryshime`));
  chips.append(el("span", "chip", `${data.nodes.length} akte në familje`));
  hdr.append(chips);
  root.append(hdr);

  if (repealEdge) {
    const rep = byId.get(repealEdge.from_id)!;
    root.append(el("div", "banner",
      `⚠ Shfuqizuar nga ${shortName(rep)}${rep.act_date ? " (" + rep.act_date + ")" : ""} — sipas grafit të ndryshimeve.`));
  }

  // ---- legend (categories present) ----
  const cats = [...new Set(data.nodes.map((n) => n.act_category))];
  if (cats.length > 1) {
    const legend = el("div", "legend");
    for (const c of cats) {
      const chip = el("span", "chip");
      const d = el("span", "dot");
      d.style.background = CAT_COLOR[c] ?? CAT_COLOR.OTHER;
      chip.append(d, document.createTextNode(CAT_LABEL[c] ?? c));
      legend.append(chip);
    }
    root.append(legend);
  }

  // ---- timeline (chronological) ----
  const tl = el("div", "timeline");
  const sorted = [...data.nodes].sort((a, b) =>
    (a.act_date ?? "9999").localeCompare(b.act_date ?? "9999"));

  let lastYear = "";
  for (const n of sorted) {
    const row = el("div", "row" + (n.id === rootAct.id ? " is-root" : ""));
    row.title = n.title_full ?? n.title;

    const year = n.act_date ? n.act_date.slice(0, 4) : "—";
    row.append(el("div", "yr", year === lastYear ? "" : year));
    lastYear = year;

    const rail = el("div", "rail");
    const dot = el("span", "dot");
    dot.style.background = CAT_COLOR[n.act_category] ?? CAT_COLOR.OTHER;
    dot.style.color = CAT_COLOR[n.act_category] ?? CAT_COLOR.OTHER;
    rail.append(dot);
    row.append(rail);

    const body = el("div", "body");
    body.append(el("div", "title", n.title));
    const targets = data.edges
      .filter((e) => e.from_id === n.id)
      .map((e) => byId.get(e.to_id))
      .filter((t): t is ActNode => !!t);
    let subTxt = `${shortName(n)} · ${CAT_LABEL[n.act_category] ?? n.act_category}`;
    if (targets.length > 0 && n.id !== rootAct.id) {
      const verb = n.act_category === "REPEAL" ? "shfuqizon" : "ndryshon";
      subTxt += ` · ${verb}: ${targets.map((t) => shortName(t)).join(", ")}`;
    }
    body.append(el("div", "sub", subTxt));
    row.append(body);
    tl.append(row);

    row.addEventListener("click", () => {
      openId = openId === n.id ? null : n.id;
      render();
    });

    if (openId === n.id) {
      const det = el("div", "detail");
      if (n.title_full && n.title_full !== n.title) det.append(el("div", undefined, n.title_full));
      if (n.eli_uri) det.append(el("div", undefined, `ELI: ${n.eli_uri}`));
      if (n.cdn_url) {
        const p = el("div");
        const a = el("a", undefined, "PDF zyrtar");
        a.setAttribute("href", n.cdn_url);
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener");
        p.append(a, document.createTextNode(` — ${n.cdn_url}`));
        det.append(p);
      }
      const actions = el("div", "actions");
      const btn = el("button", undefined, "Shiko familjen nga ky akt");
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        btn.textContent = "Duke ngarkuar…";
        void expandFrom(n);
      });
      actions.append(btn);
      det.append(actions);
      const wrap = el("div", "row");
      wrap.append(el("div"), el("div", "rail"), det);
      tl.append(wrap);
    }
  }
  root.append(tl);

  if (data.truncated) {
    root.append(el("div", "note",
      "Familja u kufizua në 150 akte — kliko një akt dhe rifillo prej tij për të parë pjesën tjetër."));
  }
  root.append(el("div", "note",
    "Statusi bazohet në grafin zyrtar të ndryshimeve (qbz RDF), jo në flamurin in_force."));
}
