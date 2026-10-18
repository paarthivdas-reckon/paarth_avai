# NexusBrain — The Intelligent Company Knowledge Graph

WeMakeDevs × FalkorDB hackathon · Track 3 (Company Brain).

FalkorDB is the core of the product: the dashboard, graph explorer, dependency analysis, document pipeline and investigation agent all run live, parameterized Cypher against the graph. Sample data is fictional and labeled **[DEMO]**.

## Quick start

Requirements: Node 20+ and Docker.

```bash
npm install
cp .env.example .env.local        # optional: add ANTHROPIC_API_KEY (see Environment)
npm run db:up && npm run seed     # FalkorDB container + labeled demo company
npm run dev                       # http://localhost:3000
```

* Reset the demo (wipes uploaded documents too): `npm run seed`.
* FalkorDB browser UI (optional): http://localhost:3001. No Docker? Point `FALKORDB_URL` at any FalkorDB server.

## Verify

```bash
npm run doctor        # preflight: Node, FalkorDB, seeded graph, LLM/gate status
npm run typecheck && npm run lint
npm test              # unit tests + integration tests (integration auto-skips if FalkorDB is down)
npm run test:db       # same, but FAILS if FalkorDB is unreachable (use in CI)
npm run build
npm run dev           # in another terminal:  npm run smoke   -> live end-to-end check
```
Integration tests use a separate graph (`nexusbrain_test`) and never touch your data. `npm run smoke` talks to the running app (`BASE_URL`, default http://localhost:3000) and **adds one small document to the graph** — run `npm run seed` afterwards to reset.

## Features

| Area | What it does | Backed by |
|---|---|---|
| **Dashboard** `/` | Projects, blockers, decisions, outstanding tasks, cross-team dependencies, recently updated knowledge. Every number is a Cypher aggregation; the queries are shown. | `lib/queries.ts` |
| **Graph explorer** `/graph` | Force-directed graph, search, type filters, zoom, node inspector with connections and source quotes, neighborhood expansion. Dashed edges = AI inference; parallel evidence is collapsed with a source count. | `/api/graph`, `/api/node` |
| **Ingestion** `/ingest` | Paste text or upload `.txt/.md/.pdf` → extract → deduplicate → write to FalkorDB. Shows exactly what was created, merged, corroborated, rejected. | `/api/ingest`, `lib/ingest.ts` |
| **Investigate** `/chat` | Multi-round graph investigation. Cited root-cause narrative (each sentence carries evidence ids), inline **evidence graph**, FalkorDB `shortestPath` for “how is X connected to Y?”, verified vs hypothesis separation, next steps, and the Cypher it ran. | `/api/chat`, `lib/agent.ts` |
| **Dependencies** `/dependencies` | Transitive upstream/downstream projects, cross-team flags, task blocker chains to their root, decisions that affect them, cycle detection, rule-based risk signals with citations. | `/api/dependencies`, `lib/dependencies.ts` |

### Document pipeline
1. **Validate** — extension + content sniffing (PDF header, binary check), 1 MB file / 100k character limits, empty-document check. Errors return structured codes (`UNSUPPORTED_TYPE` 415, `TOO_LARGE` 413, `EMPTY_DOCUMENT` 400…).
2. **Store** — a `Document` node keyed by content hash (`doc-<sha256[:12]>`); `status` goes `processing → complete | failed`. Re-uploading identical content is detected as a duplicate; re-uploading after a failure safely resumes.
3. **Extract** — LLM extractor when `ANTHROPIC_API_KEY` is set (falls back to rules if it errors), otherwise a deterministic rule-based extractor (known-entity matching + sentence patterns such as “X is blocked by Y”, “X depends on Y”, “X is a member of Y”, “Decision: …”, “Task: …”).
4. **Verify (every extractor)** — a relationship is kept only if its excerpt appears **verbatim** in the document, its endpoint labels fit the relationship type (`REL_SIGNATURE`), and (LLM) the excerpt names both entities. Anything else is listed under “Rejected during validation”.
5. **Deduplicate** — entities are matched per label on a normalized key (case, punctuation, “Project”/“Team”/“Task” prefixes), then a conservative fuzzy match (edit distance 1, names ≥ 6 chars, unique candidate). Relationships: identical (from, type, to, source, excerpt) → *duplicate* (not written); same triple with new evidence → *corroborated* (an evidence edge is added; the graph view shows “N sources”); otherwise *new*.
6. **Cite** — each entity gets a `Document -[:MENTIONS]-> entity` edge quoting its sentence; each relationship stores `source` (document id), `excerpt` and `kind`.
7. **Facts vs inferences** — `kind: "extracted"` is a documented fact. `kind: "inferred"` (LLM only; limited to `BLOCKED_BY`, `DEPENDS_ON`, `AFFECTS`, with a rationale) is shown dashed, excluded from dashboard metrics and dependency analysis, and surfaced in chat only as a *hypothesis*.
8. Task status is only filled from text and never silently overwrites an existing, different status (a warning is reported).

### Investigation agent (bounded, fixed pipeline)
* **Round 1** resolve entities named in the question and explore their 2-hop neighborhood (documents are excluded from traversal). **Round 2** project dependency analysis. **Round 3** follow root blockers one more hop to find decisions/owners. Then retrieve supporting documents and **re-verify each excerpt against the retrieved text**.
* Limits: 24 queries, 25 facts, 500-character questions, 5 s per query, 3 follow-up expansions. There is no LLM-driven loop.
* With a key, one LLM call synthesizes the answer from numbered facts; any “verified” claim citing an unknown fact id is demoted to a hypothesis. LLM failure falls back to the retrieved facts.

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | DB status, node count, whether an LLM is configured |
| `GET /api/dashboard` | Dashboard metrics + queries |
| `GET /api/graph?center=<id>&depth=1..3` | Whole graph (≤ 400 nodes) or a neighborhood |
| `GET /api/node?id=<id>` | Node properties, connections, source quotes |
| `GET /api/dependencies?project=<id>` | Dependency/blocker/risk analysis |
| `GET /api/ingest` · `POST /api/ingest` | List documents · ingest (`multipart`: `file` or `text`, `title`, `extractor=auto\|rules\|llm`; or JSON `{title,text}`) |
| `POST /api/chat` | `{message}` → answer, verified claims, hypotheses, evidence, analysis, queries, steps |

Errors are always `{ "error", "code", "hint?" }` with a matching HTTP status (`DB_UNAVAILABLE` 503, `QUERY_TIMEOUT` 504, `RATE_LIMITED` 429, …). Internal details are logged server-side only.

## Environment

| Variable | Purpose | Default |
|---|---|---|
| `FALKORDB_URL` | `falkor://[user:pass@]host:port` (`falkors://` for TLS) | `falkor://localhost:6379` |
| `FALKORDB_GRAPH` | graph name | `nexusbrain` |
| `ANTHROPIC_API_KEY` | optional; enables LLM chat synthesis **and** LLM extraction. Server-side only. | unset → offline mode |
| `ANTHROPIC_MODEL` | model id | `claude-sonnet-5-5` |
| `NEXUS_ACCESS_TOKEN` | optional; require HTTP Basic auth (any username, this password) for everything except `/api/health` | unset → open |
| `ENABLE_DEMO_RESET` | `true` shows a *Reset demo data* button and enables `POST /api/demo/reset` | `false` |
| `TRUST_PROXY` | `true` only behind a trusted reverse proxy; otherwise `X-Forwarded-For` is ignored for rate limiting | `false` |

Limits (`lib/schema.ts → LIMITS`): 1 MB per file, 100,000 text characters, 150 entities and 300 relationships per document.

## Design system: claymorphism
The whole UI uses a soft, puffy clay look defined in one place (`app/globals.css`): raised **`.card`** slabs (outer shadow + light edge + inner highlight), pressed **`.clay-well`** inputs/code blocks, **`.chip`** pills that lift on hover and press in on click, **`.clay-btn`** primary actions, a floating clay sidebar (bottom pill nav on mobile), pastel status tints, and graph nodes painted as glossy clay balls (red ring = blocked task). Text/surface pairs were checked against WCAG AA (≥ 4.5:1); focus rings are always visible and `prefers-reduced-motion` disables the hover lift. The layout was not visually inspected in a browser in the build environment.

## Why a graph (and not just vector search)
The questions this product answers are structural, which is what FalkorDB is for:
* **“Why is Alpha late?”** is a *transitive* question: Alpha’s task → blocked by Beacon’s task → frozen by a security decision. One variable-length traversal plus per-edge evidence, not a similarity search.
* **“Which teams depend on Beacon?”** joins projects, owning teams and dependency edges.
* **“How is Cobalt connected to Alpha?”** uses FalkorDB’s native `shortestPath`, and every hop carries a quote.
* Provenance lives *on the edges* (`source`, `excerpt`, `kind`), so facts, inferences and corroborating evidence are separable by query.
Rule-based extraction is the default because it is deterministic and offline-safe; the LLM path adds recall but passes through the same verification.

## Security notes
Parameterized Cypher only; labels/relationship types come from whitelists (`lib/schema.ts`). Uploads are sniffed (PDF header / binary check) and size-limited before parsing. Untrusted text is rendered by React (escaped) and handed to the LLM as data. Responses carry `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` and a restrictive CSP subset. Set `NEXUS_ACCESS_TOKEN` before exposing the app. **There is still no per-user authentication, authorization or multi-tenancy**, and the rate limiter is in-memory per instance.

See `DEMO.md` (3-minute script) and `docs/JUDGE_REVIEW.md` (strict self-review with scores and backlog).

## Architecture

```
app/                 pages (/, /graph, /chat, /dependencies, /ingest) + /api routes
components/          GraphExplorer, Chat, Ingest, Nav, QueryLog
lib/falkor.ts        FalkorDB client: parameterized, read-only helper, 5 s timeout, query trace
lib/schema.ts        label / relationship whitelists + signatures (the only values interpolated into Cypher)
lib/ingest.ts        pipeline orchestration      lib/extract.ts   rule + LLM extraction and validation
lib/graph-write.ts   node/relationship upsert    lib/files.ts     upload validation (txt/md/pdf)
lib/dependencies.ts  graph analysis (pure core)  lib/agent.ts     investigation pipeline
lib/queries.ts       dashboard/graph/node reads  lib/errors.ts    structured errors
lib/demo-data.ts, lib/seed.ts   labeled demo company + loader
```

## Demo script
The rehearsed 3-minute version is in `DEMO.md`. Outline:
1. **Dashboard**: 3 projects, 2 documented blockers, cross-team dependencies; open the Cypher log.
2. **Ingest**: open `/ingest`, click *Insert sample*, extract. Point out *created* vs *merged* entities (Project Alpha and “Integrate SSO login” merge with existing nodes), the quotes behind each relationship, and “Rejected during validation”.
3. **Graph**: “View in graph” → Project Delta now connects to Alpha; click an edge’s endpoint to see the source quote.
4. **Dependencies**: Project Alpha now has Delta upstream; Delta’s blocker chain ends in Beacon’s unstarted token migration; read the risk signals and their citations.
5. **Investigate**: “Why is Project Alpha delayed?” → rounds shown in *Investigation steps*, blocker chains, evidence from both seeded and uploaded documents, verified vs hypotheses, next steps.
6. “Tell me about banana smoothies” → states it cannot verify an answer.
7. `npm run seed` to reset.

## Known limitations
* **LLM paths were not run against the real API** (no key in the build environment). Their validation, demotion and fallback logic is tested with a mocked SDK. The rule-based path is what ran end-to-end. Check `ANTHROPIC_MODEL`.
* Rule-based extraction is **sentence-bound and pattern-based**: it will not link facts across sentences (e.g. a decision and a later “Approved by …” sentence), resolve pronouns, or understand paraphrase. Expect recall to be modest without an LLM; precision is protected by the excerpt/type checks. Person names are only recognized in simple patterns.
* Deduplication is heuristic (normalized names + edit distance 1). Different entities sharing a name merge; unrelated near-misses can fail to merge. There is no merge-review UI.
* Ingestion is **not transactional** (FalkorDB writes are per query). A failed run is marked `failed` and is safe to retry (writes are idempotent). Concurrent ingestion of the same document is not guarded.
* PDFs: text layer only (no OCR). Files: `.txt`, `.md`, `.pdf`.
* Agent entity resolution is keyword-based on node names; paraphrased questions can miss. Risk levels are a transparent rule, not a prediction.
* No per-user authentication or multi-tenancy (only the optional shared access token); the rate limiter is in-memory per instance. Do not expose publicly with real data.
* FalkorDB’s `shortestPath` is directed-only, so connection questions try both directions and then fall back to an undirected search in application code (the steps say which was used). FalkorDB full-text/vector search is not used.
* CI (`.github/workflows/ci.yml`) and `docker-compose.yml` were written but not executed in the build environment.
* `docker-compose.yml` was not executed in the build environment (no Docker); FalkorDB was tested via a standalone FalkorDB server (module build in the `falkordblite` package), including all integration tests and the live smoke run.
* The graph canvas and page layouts were **not inspected visually** in a browser; pages and APIs were exercised over HTTP.

## Deployment
Run FalkorDB (FalkorDB Cloud or a container with a persistent volume). Set `FALKORDB_URL` (`falkors://` for TLS) and optionally `ANTHROPIC_API_KEY` as server environment variables on any Node host (Vercel, Fly, Docker). `npm run build && npm start`, then `npm run seed` once if you want the demo data. Add authentication before using real company data.
