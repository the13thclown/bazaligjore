# Amendment mechanics — how Albanian acts change each other

## The amendment graph (`get_amendment_family` / `act_amendment` table)
Edges come from qbz's official RDF `qbz:amends` links (amending act → amended act). This is
the authoritative record of what changed what. Semantics:
- AMENDMENT → target: target's text changed, still in force.
- REPEAL → target: target abrogated (shfuqizuar).
- An amendment can itself be amended/repealed later — walk the graph, don't stop at depth 1.

## Anatomy of an amendment act's text (for `get_act_text`)
Amendment acts have a NESTED structure — don't confuse the amendment's own articles with
the target's articles:

```
LIGJ Nr. 10 148, datë 28.9.2009
PËR NJË SHTESË NË LIGJIN NR.9920 …        ← title names the target
Në mbështetje të … VENDOSI:               ← preamble
Neni 1                                     ← the amendment's OWN wrapper article
  Në ligjin nr.9920, datë 19.5.2008 "…",   ← instruction block opens by naming the TARGET
  pas nenit 75 shtohet neni 75/1           ← instruction: insert new art. 75/1 after 75
  me këtë përmbajtje:                      ← "with this content:"
  "Neni 75/1 …".                           ← new text is QUOTE-DELIMITED
Neni 2  Ky ligj hyn në fuqi …              ← wrapper: entry into force
```

Key patterns:
- Instruction blocks open with **"Në ligjin nr.X, datë …"** naming the target law.
- Instruction verbs (declined): `shtohet/shtohen` (insert), `ndryshohet/ndryshohen`
  (replace), `shfuqizohet` (repeal a provision), `riformulohet` (reword).
- Article references decline: match `nen(i|in|it|eve) N` — "Në nenin 5", "neni 5 ndryshohet".
- New/replacement wording is between quotation marks and carries its own "Neni X/Y" heading.

## Omnibus trap
The amendment chain of a law can include acts that are NOT dedicated amendments to it:
omnibus acts amending many laws at once, or a big ORIGINAL law that changed one provision
of another (e.g. a whole new code whose final articles amend older laws). When reading such
an act for one target law, extract ONLY the instruction block(s) that name that target
("Në ligjin nr.X…") — the rest of the text is about other laws.

## Consolidated versions (the current text of an amended law)
- qbz publishes official **consolidated PDFs** ("versioni i përditësuar") for most
  heavily-amended laws — roughly 85–90% of families with amendments, less for rarely-amended
  ones. These are editorial ground truth for the current text.
- This DB stores the original acts and the graph; when a user needs the *current wording*
  of a specific article, the safest route is: base act text + read each amendment's
  instruction blocks in chronological order, or point them to qbz's consolidated version
  (search qbz.gov.al for the law + "i përditësuar").

## Structure of act text generally
- Laws (LIGJ): articles at line starts — `Neni 1`, `Neni 2` … (94% of laws have this);
  chapters as `KREU I`, `KREU II`. Numbered points `1.`, `2.` and lettered sub-points
  `a)`, `b)`, `ç)` inside articles.
- VKM/URDHER/UDHEZIM mostly use numbered points ("Pika") rather than articles.
- Do NOT expect markdown in raw_text — it is plain OCR text; headings are rare.
