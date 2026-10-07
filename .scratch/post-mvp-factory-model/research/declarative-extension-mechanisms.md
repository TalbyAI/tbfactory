# Declarative Extension Mechanisms: Research Evidence

Status: evidence for an open exploration; no architecture selected.
Research date: 2026-10-06. Citations point to first-party docs, maintainer source,
or W3C standards. Current status is recorded as observed on this date.

## Scope

The issue asks how a TypeScript Factory can let installation-loaded local or
published Factory Plugins add step types, classification expressions, and inbound
or outbound adapters while a User composes permission-bound declarations through
the UI. Projection semantics remain open; SHACL is the confirmed ontology-validation
technology. “Documented” means stated by a cited source. “Inference” means a
possible Factory boundary, not an accepted architecture.

## Findings at a glance

| Approach | Covers | Main limit |
| --- | --- | --- |
| Typed AST + runtime schema | Portable declarations and validation | No rule evaluation or dispatch |
| CEL (`@bufbuild/cel`) | Restricted expressions over host inputs | JS package remains beta; host owns data, quotas, versions |
| RDF/SPARQL + SHACL | Graph vocabulary/query, shape validation, optional inference | No Factory history semantics, authorization, or effects |
| Mastra Workflows | Typed code-defined steps, composition, persistence | No documented general Factory Plugin or UI Workflow-definition registry |

These mechanisms can be combined; the evidence does not select a DSL or runtime.

## Boundaries

- **Ontology vocabulary** describes terms and relations. RDF supplies a graph model,
  not Factory identity, provenance, time, correction, or authority.
- **SHACL validation** checks a data graph against a shapes graph and returns a
  report. It does not authorize an Activity.
- **Projection evaluation** chooses a view of accumulated Facts. None of the
  compared APIs defines Factory ordering, correction, temporal, or replay semantics.
- **Classification** evaluates a supplied context into an eligibility result; it
  does not establish permission.
- **Trigger dispatch** must apply authorization, coordination, and deduplication
  before starting a Workflow Run. None of the expression/query tools supplies this.

## 1. Typed AST and runtime schema contract

A bounded discriminated-union AST can keep UI-authored configuration as data. The
Factory owns common operators; a plugin contributes a registered capability ID,
its JSON config schema, output schema, and trusted server-side evaluator. User
configuration contains only approved nodes and JSON values.

Effect 4.0 became stable on 2026-09-30; v4 Schema documents decoding, encoding,
assertions, errors, Standard Schema V1, and JSON Schema generation. It validates
and describes data, but does not evaluate an expression AST. TypeScript type
syntax is erased from emitted JavaScript, so persisted/UI JSON needs runtime
validation. ([Effect 4.0](https://effect.website/blog/releases/effect/40),
[Effect Schema](https://effect.website/docs/v4/schema/introduction),
[JSON Schema generation](https://effect.website/docs/v4/schema/json-schema),
[TypeScript TSConfig](https://www.typescriptlang.org/tsconfig/))

**Inference:** installed plugins require runtime registration; a compile-time union
cannot automatically describe separately installed capabilities to the UI. The
host still owns AST semantics, selected history/projection input, output meaning,
quotas, diagnostics, and version migration. Effect 4’s `effect/workflow` exists,
but its current API reference marks it **unstable**; stable Effect core/Schema
does not imply a stable workflow engine. ([Effect Workflow API](https://effect.website/docs/v4/api/effect/workflow/Workflow))

## 2. CEL expression evaluator

CEL is a typed, non-Turing-complete expression language designed for small,
portable evaluation. Its specification describes host-provided variables/functions,
AST compilation, and serializable versioned ASTs. The official repositories moved
to `cel-expr` in June 2026. ([CEL spec](https://github.com/cel-expr/cel-spec),
[official move notice](https://opensource.googleblog.com/2026/06/cel-finds-a-new-home-at-githubcomcel-expr.html))

Buf’s ECMAScript implementation, `@bufbuild/cel`, released v0.6.1 on 2026-08-27
and remains marked **Beta**. Its environment accepts typed variables and registered
functions; its value model includes booleans, lists, and maps. A plugin can register
trusted custom functions; a User expression can only call functions in the installed
environment. ([CEL-ES source](https://github.com/bufbuild/cel-es),
[package README](https://github.com/bufbuild/cel-es/blob/main/packages/cel/README.md),
[v0.6.1 release](https://github.com/bufbuild/cel-es/releases))

The Factory must build the input from a selected projection or bounded history;
CEL does not define Fact identity, time, provenance, or authority. It can return a
boolean or structured map/list, but the Factory must define result shape, unknown
inputs, thresholds, and how multiple matches combine. CEL’s complexity properties
do not bound host preprocessing or plugin functions. Test expression/input size,
evaluation time, diagnostics, and custom-function costs against the exact beta
version. Pin the language, plugin-function, and input/projection versions for
reproducibility. Evaluation must not itself perform integrations or start Runs.

## 3. RDF, SPARQL, and SHACL

RDF 1.1 represents subject-predicate-object statements; datasets can group named
graphs, while snapshot/version semantics remain application-defined. Event/time semantics likewise require
an explicit vocabulary. This can fit graph-shaped Facts, but the Factory must still
define graph boundaries and how snapshots relate to its Fact history. ([RDF 1.1 Concepts](https://www.w3.org/TR/rdf11-concepts/))

SPARQL 1.1 provides boolean `ASK`, binding-producing `SELECT`, graph-producing
`CONSTRUCT`, and grouping/aggregates. It can query history or derive projection
values after the input graph’s meaning is defined. If Users author rules, the UI
should constrain them to registered queries or a bounded AST; arbitrary SPARQL
requires separate resource and access controls. ([SPARQL 1.1](https://www.w3.org/TR/sparql11-query/))

SHACL 1.0 is the W3C Recommendation baseline. Core validation takes a data graph
and shapes graph and returns a report with conformance and structured results
(focus node, path/value, source shape/component). The separate report is not a graph mutation or inference step.
Result messages are implementation-specific. ([SHACL Recommendation](https://www.w3.org/TR/2017/REC-shacl-20170720/))

Keep validation distinct from inference and dispatch. SHACL Advanced Features
(2017) defines optional rules that derive RDF triples, but is a First Public Working
Group Note/work in progress. SHACL 1.2 Core (2026-09-18) and Rules (2026-07-11)
are Working Drafts; 1.2 Rules defines an inference graph. These drafts are research
options, not the confirmed validation baseline. Inference produces graph data,
not external effects or a Trigger. ([SHACL AF](https://www.w3.org/TR/shacl-af/),
[SHACL 1.2 Core](https://www.w3.org/TR/shacl12-core/),
[SHACL 1.2 Rules draft](https://www.w3.org/TR/2026/WD-shacl12-rules-20260711/))

RDF/SPARQL handles graph and multidimensional query results; SHACL supplies
structural validation diagnostics. Neither supplies Factory authorization, query
quotas, classification contracts, or deduplicated Trigger dispatch. Verify a
maintained TypeScript-compatible stack, supported SHACL feature set, isolation,
and query limits before relying on this route.

## 4. Mastra Workflow composition

The local project pins `@mastra/core` 1.74.0. Mastra documents code-defined steps
with input/output schemas and an `execute` function, composed with sequencing,
branching, parallelism, and nested Workflows. Its classifier adapter returns typed
choice/score/probability answers and usage for downstream branching. ([local package.json](../../../package.json),
[Workflow docs](https://mastra.ai/docs/workflows/overview),
[classifier reference](https://mastra.ai/reference/workflows/workflow-methods/classifier),
[1.74.0 release](https://github.com/mastra-ai/mastra/releases))

Mastra normalizes Standard Schema, Zod, AI SDK Schema, and JSON Schema. Effect
Schema can generate Standard Schema V1, so integration is plausible; test runtime
validation, JSON Schema output, error mapping, and TypeScript inference with the
pinned versions. Workflow snapshots persist execution state for suspend/resume,
but do not establish that a run pins its original Workflow definition or plugin
version. ([Mastra schema changelog](https://mastra.ai/blog/changelog-2026-03-16),
[Effect Schema](https://effect.website/docs/v4/schema/introduction),
[Workflow snapshots](https://mastra.ai/en/reference/workflows/snapshots))

Studio documents graph visualization, schema-generated run inputs, traces, and
run inspection. The separate Agent Editor has draft/publish and immutable Agent
configuration versions. Reviewed docs do not establish UI Workflow-graph authoring
or a generic plugin-registration API. **Inference:** a Factory host can load trusted
plugin code, register its step implementations with Mastra, and expose only
serializable schemas/IDs to the Factory UI. The UI must not submit executors or
source. ([Studio](https://mastra.ai/docs/studio/overview),
[Agent Editor](https://mastra.ai/blog/introducing-agent-editor))

Mastra covers Workflow control flow and execution persistence, not Factory Fact
history/projections, rule semantics, authorization, plugin compatibility, or
Trigger claims/deduplication. Its documented branch/step callbacks are TypeScript;
a declarative UI therefore needs to map User configuration onto installed step
types and safe condition nodes.

## Minimum plugin boundary suggested by the evidence (inference)

An installation-loaded Factory Plugin likely needs to register:

- Namespaced capability IDs and plugin/package version.
- Capability kind: Workflow step, classification function, or integration adapter.
- Runtime config/input and output schemas plus UI display metadata.
- Trusted server-side implementation; User config stores IDs and JSON only.
- Input references and required Activities/permissions.
- Compatibility/migration metadata for saved definitions and suspended Runs.

These are product-contract needs inferred from the compared APIs, not requirements
imposed by Effect, CEL, RDF/SHACL, or Mastra.

## Open questions and evidence gaps

1. Does classification inspect full ordered Fact history, named-graph snapshots, a
   projection, or a plugin-declared selection? Define time, correction, and replay.
2. Are results binary, categorical, multidimensional, or matching-rule sets? Define
   unknown inputs, thresholds, precedence, and multiple-match behavior.
3. Does ontology own vocabulary only, or projection expressions too? SHACL Core,
   optional SHACL AF, and SHACL 1.2 drafts do not settle this split.
4. Does Effect Schema pass through current Mastra Standard Schema handling without
   lossy JSON Schema conversion? Verify runtime and static types.
5. How do local/published plugin updates affect activation and paused Workflow Runs?
   Which evaluator and definition version must be retained for replay?
6. Where are expression/history/query size, time, memory, and diagnostics bounded?
   CEL does not bound host preprocessing or extension-function work.
7. Which runtime owns durability? Effect 4 workflow modules are unstable; Mastra
   supports persisted Workflows and alternate engines. The boundary is open.

## Minimal distinguishing tests

- Submit valid/invalid/outdated capability JSON; check field-path diagnostics and
  confirm no User-supplied JavaScript is evaluated.
- Load one plugin step, pure classifier, and adapter; confirm server-only execution
  and an explicit Activity check before every effect.
- Compare full history with a current projection using boolean and multidimensional
  results; include correction, missing input, ties, and unknown values.
- For CEL, test typed variables, parse/check errors, registered functions, maps/lists,
  input/expression limits, timing, and versioned replay on v0.6.1.
- For SHACL, validate a bad graph, separately infer triples, then separately run an
  authorized Trigger; verify only the last performs an external effect.
- For Effect/Mastra, pass Effect Schema through Standard Schema, suspend a Run,
  upgrade a plugin, and test which version resumes.
