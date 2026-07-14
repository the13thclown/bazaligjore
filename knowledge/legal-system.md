# The Albanian legal system — a map for reading this database

## Act types (`act_type` column values)
| Stored value | What it is |
|---|---|
| `LIGJ` | Law, passed by Parliament (Kuvendi). Article-structured ("Neni N"). |
| `VENDIM` | Decision. **Council of Ministers decisions (VKM) are stored as `VENDIM`** — never filter on 'VKM', it returns nothing. Constitutional Court and other bodies' decisions published in the FZ are also `VENDIM`. |
| `DEKRET` | Presidential decree (promulgates laws, appoints officials). |
| `URDHER` | Order (ministerial). |
| `UDHEZIM` | Instruction/guideline (ministerial, implements laws). |
| `KORRIGJIM` | Correction of a previously published act. |

Hierarchy (highest first): Kushtetuta (Constitution) → ratified international agreements →
laws (ligje) and codes (kode) → normative acts with force of law → VKM → ministerial acts
(urdhra, udhëzime). Codes (Kodi Civil, Kodi Penal, …) and the Constitution enter the DB from
qbz's "Botime Zyrtare" collection (`source` = CODE / CONSTITUTION), not from gazette TOCs.

## Categories (`act_category`)
- `ORIGINAL` — a new act.
- `AMENDMENT` — changes an existing act ("Për disa ndryshime/shtesa në ligjin …").
  Note: "shtesë" in a title does NOT always mean amendment — many acts grant financial
  supplements (shtesë pensioni) and are ORIGINAL.
- `REPEAL` — abrogates an act (shfuqizim).
- `RATIFICATION` — ratifies an international agreement.
- `OTHER` — everything else.
Classification is automated (rules + LLM) — treat borderline cases with care and verify
against the text.

## Numbering and dating
- Pre-~2015: laws numbered sequentially all-time (`nr.10 419, datë 26.5.2011` — spaces inside
  numbers occur). Post-~2015: number/year (`nr. 30/2024, datë 4.4.2024`).
- Numbers repeat across years and across act types — a "vendim nr. 1" exists for every year
  and several institutions. This is why the ELI URI is the only safe key.

## The Official Gazette (Fletorja Zyrtare)
- Published by QBZ (Qendra e Botimeve Zyrtare), qbz.gov.al. This DB indexes every issue from
  2000 onward (~43,500 acts); the gazette itself goes back to 1991+.
- An issue = year + issue number; an act's authoritative publication is its FZ issue.
- Acts take effect (hyrja në fuqi) per their final article — commonly 15 days after FZ
  publication, sometimes immediately.
- Albania has **no official consolidated legal database** — qbz publishes consolidated PDFs
  for many amended laws (see `amendments` guide), but there is no complete, queryable,
  current-text source. That is the gap this database addresses.

## Institutions you will meet in `institution_name`
Kuvendi (Parliament), Këshilli i Ministrave (Council of Ministers), individual ministries,
Presidenti, Gjykata Kushtetuese (GJK), Banka e Shqipërisë, ERE (energy regulator), and many
independent agencies. Names vary over time as ministries merge/rename — group carefully.
