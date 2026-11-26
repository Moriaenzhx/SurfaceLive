# SurfaceLive · Live Engine Design Knowledge (runnable seed)

This package is a **working first knowledge layer** for SurfaceLive. It is **not** a design-quality model, a website crawler, a vector database, or a production design engine yet.

## What exists (2026-11-19)

| Asset | Verified quantity | Evidence |
|---|---:|---|
| Official/research/implementation reference URLs | 43 | `data/sources.json` |
| Original Chinese design decision cards | 53 | `data/principles.json` |
| Knowledge categories | 15 | `node cli.ts check` |
| User-derived positive/negative aesthetic directives | 6 | `data/preferences.json` |
| **Actually inspected** licensed screenshots | 1 | `assets/openfilm-preview.png` + `data/visual-exemplars.json` |
| Knowledge tests | 9 passing | `npm run test:knowledge` |

We have **not** fetched or embedded complete articles, and do **not** redistribute copyrighted text. Source URLs were found through public web research and the rules are our own paraphrases/syntheses. The list is a *seed*, not an exhaustive or fully audited source catalog. Before using any card as a strict standard, re-open its primary source; some entries have only been checked via search summaries.

## Running from `surface-lab/`

```bash
npm run knowledge:check
npm run test:knowledge
npm run knowledge:bench
node live-engine/knowledge/cli.ts search '招聘 Agent 工作台，候选人表格筛选和任务状态'
node live-engine/knowledge/cli.ts brief 'coRoof 老板经营决策驾驶舱'
```

`brief` emits **source-attributed, scene-relevant design direction input**. The intended consumer is an authorized desktop coding Agent. It does not auto-call an Agent yet; no aesthetic win rate has been demonstrated.

## Data model

- `sources.json`: canonical primary-source URLs, publisher, topic/type; a link is not a license to redistribute page content.
- `principles.json`: reusable `decision` + explicit `avoid` + observable `check` + source IDs + applicability tags.
- `visual-exemplars.json`: pixels inspected by a human/vision model, annotated hierarchy/layout/tone/density, transfer boundaries, rights. A static screenshot **cannot establish actual interactive behavior**.
- `preferences.json`: user's own historical selection/rejection reasons, marked as individual preferences and never presented as universal rules.
- `src/live-knowledge.ts`: scene classification, transparent relevance scoring, category diversification and evidence-linked brief generation.

## What must be built next (in dependency order)

1. **Visual reference acquisition**: with source attribution and rights gates, capture screenshots at known viewports/states; inspect actual pixels and annotate hierarchy, typography rhythm, color relationships, density, motion evidence, business suitability and anti-patterns. Target **at least 60 carefully inspected cross-industry references**, then scale.
2. **Curated ingestion pipeline**: discover candidate URLs, deduplicate by canonical link, fetch with rate/rights constraints, chunk by information type, have a desktop agent distill structured cards, require human/automatic validation, attach screenshot/interaction evidence when available. Store provenance and revisions. Never blindly dump raw websites into prompts.
3. **Multimodal retrieval**: retrieve authoritative rules, visually analogous *but not copied* exemplars and positive/negative user preferences separately; reconcile contradictions and assemble compact DesignDNA for the scenario.
4. **Actual code-and-visual evaluation**: use an installed, user-authorized desktop Agent to make interactive UI; run it in a sandboxed browser; collect screenshots and real GUI interactions; use a separate vision critic with region-specific issues; revise and compare against baselines.
5. **Human calibration**: blind pairwise judgments from target users/designers, with separate task-completion gates; measure whether Live Engine beats identical-model single-pass code generation on fresh tasks.

## Legal / source boundaries

The OpenFilm image included here came from the locally reviewed [openfilm/openfilm](https://github.com/openfilm/openfilm) repository, checked visually and copied with its MIT license notice. This reference is for critique and learning; its name/logo have separate trademark terms. Other visual sources have **not** been copied. When extending the library, prefer open-licensed assets or image inspection with reference links and explicit permission.

**Do not mistake source count, retrieval relevance or an LLM self-score for measured aesthetic excellence.**
