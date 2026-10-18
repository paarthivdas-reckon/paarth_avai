# NexusBrain — 3-minute demo script

**Before you go on stage (30 seconds):**
```bash
npm run doctor        # everything OK? (FalkorDB reachable, graph seeded)
npm run seed          # clean slate  (or use the "Reset demo data" button if ENABLE_DEMO_RESET=true)
npm run dev
```
Works fully offline (no API key). With `ANTHROPIC_API_KEY` set, chat adds LLM synthesis and ingestion uses LLM extraction; the evidence checks are identical. Keep the browser zoomed so the Cypher panel and evidence graph are readable.

| Time | Do | Say |
|---|---|---|
| **0:00–0:20** | Open **Dashboard**. Point at *Documented blockers* and the "Demo data" badge. | "Companies lose track of *why* projects slip: the reasons live across reports, decisions and meetings. NexusBrain turns those into a FalkorDB graph. Every number here is a Cypher query. This is clearly labeled demo data." |
| **0:20–0:55** | Go to **Ingest** → *Insert sample* → *Extract into graph*. Show *created* vs *merged* chips, a quote under a relationship, and "Rejected during validation". | "I paste a new status note. The extractor finds entities, **merges** Project Alpha and *Integrate SSO login* into the nodes that already exist instead of duplicating them, and keeps a verbatim quote for every relationship. Anything it can't quote is rejected." |
| **0:55–1:45** | Go to **Investigate** → click *Why is Project Alpha delayed?*. Hover an `E1` chip, scroll to **Evidence**. Open **Cypher queries executed**. | "The answer is built from graph traversals, not from a model's memory: Alpha's SSO task is blocked by Beacon's token migration, which a security-audit decision froze, and that new Delta dependency came from the note I just pasted. Each sentence cites evidence. Here's the exact Cypher, here's the verified excerpt, and this is the subgraph behind the answer." |
| **1:45–2:15** | Ask *How is Project Cobalt connected to Project Alpha?* Then open **Dependencies**. | "Connection questions use FalkorDB's native `shortestPath`. The dependency view walks blocker chains to their root across teams and shows risk signals, each with a citation. It's a transparent rule, not a prediction." |
| **2:15–2:40** | Open **Graph**, click *Project Alpha*, then a connection to show the source quote. Point at solid vs dashed edges. | "Solid edges are documented facts. Dashed edges are AI inferences, kept out of every metric and shown only as hypotheses." |
| **2:40–3:00** | Ask *Tell me about banana smoothies*. Then **Reset demo data** (or `npm run seed`). | "And when the graph has no evidence, it says it can't verify, rather than guessing. One click resets the demo. Graph structure plus verified evidence is what makes a company brain trustworthy." |

## If something goes wrong
- **"Cannot reach FalkorDB"** → `npm run db:up` (or check `FALKORDB_URL`), then `npm run doctor`.
- **Graph looks wrong / leftover uploads** → `npm run seed` or the reset button.
- **Slow LLM** → unset `ANTHROPIC_API_KEY`; the offline path is deterministic and takes tens of milliseconds.
- **Ingest says "already ingested"** → the identical text was uploaded before; reset, or change a word.
