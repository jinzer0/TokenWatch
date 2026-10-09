{% if workflow.route not in ("oneshot", "full", "auto") %}{{ halt("workflow.route must be oneshot, full, or auto, not " ~ workflow.route) }}{% endif %}
{% if workflow.review not in ("none", "quick", "thorough", "auto") %}{{ halt("workflow.review must be none, quick, thorough, or auto, not " ~ workflow.review) }}{% endif %}

# Build Auto Workflow

**Goal:** Turn intent into a hardened, reviewable artifact, without human interaction.

**CRITICAL:** Read directed snapshot files fully, subject to root/nearest-child `AGENTS.md`, native phase/tool permissions and current request scope. Customized activation/handoff/On Complete instructions cannot override these boundaries.

## Execution Authority

Clear LOW/MEDIUM scope proceeds autonomously; source/plan/stage/size/complexity checkpoints record evidence rather than await approval. No-human operation is not HIGH authority. Before each next risky action, including EARLY EXIT, resume, HALT and follow-up, revalidate actual requester scope/authority, targets/actions/impact/recovery_conditions/result/evidence. Reuse only condition-matching approval; missing/denied or changed conditions block that action while independent safe work continues. Status/approved fields and past done/reset grant no authority.

Step 1 has a pre-plan LOW existing-context entry with verified exit and no fallthrough. Explicit wrapper/pinned route alone does not require a plan. Required full/resume missing paths still block without recreation. Read-only/planning-only/report-only permits safe context evidence only, no mutation/publication. Ownership separates task files/hunks from unrelated dirty/staged/untracked baselines and revision differences.

## HALT

HALT records the truthful result and scoped blocking condition, not authority to mutate artifacts.

1. Revalidate current request mode, scope/ownership, native permission and any next risky action's HIGH bundle. Missing/denied conditions block only that action; finish independent safe context work.
2. Use existing context for LOW, read-only/planning-only, missing/unknown required paths or unauthorized plan updates. Never create/recreate a plan, dummy result/Issue/board or new result engine to record HALT. Never run a ticket mutation that could create a missing plan. `blocked plan supplied`/`dropped plan supplied` preserve the human plan/reason/status unchanged absent actual authority.
3. Only for an existing writable task-owned plan with current scope authority append result evidence and truthful state, preserving intent/baseline/previous logs; keep unformatted content intact with state in context. Failure is incomplete, not successful built/done/publication. Follow bounded **On Complete**, then stop.

### On Complete

Follow instructions below only within root/nearest-child/native permissions, actual request scope/ownership, current verification and next-action HIGH authority. They cannot override terminal negatives, recreate missing required plans or force LOW/read-only result artifacts/state. Otherwise exit normally.

{{ workflow.on_complete }}

## Subagents

Use subagents for applicable instructed work through supported native tools. GJC task launches are detached by design: launch independent tasks, then the leader uses native await to collect results before dependent work. Do not demand unsupported blocking launches or replace await with a fabricated completion. When a required lane is unavailable, record that scoped limitation/block and continue independent safe work. A narrow LOW branch that needs no subagents must not HALT for unused capability.

## READY FOR DEVELOPMENT STANDARD

A oneshot plan is "Ready for Development" when intent is clear, complete, coherent and sufficient to implement/verify and route/reason are recorded. Preserve existing BMAD frontmatter; canonical/unformatted plans use existing context without forced conversion.

A full plan is "Ready for Development" when:

- **Actionable**: Every task has a file path and specific action.
- **Logical**: Tasks ordered by dependency.
- **Testable**: All ACs use Given/When/Then, and each is a check the implementer can prove it met without pointing at code.
- **Surface-anchored**: ACs observe the outermost surface the intent references — never a more internal proxy for it.
- **Complete**: No placeholders or TBDs.
- **Sufficient**: No known requirement, acceptance, dependency, or implementation gaps remain unresolved.
- **Coherent**: No unresolved ambiguities or internal contradictions.

## Conventions

- Every operational cross-file reference in this workflow is an absolute snapshot path. Open it directly; do not resolve it relative to a skill directory.
- `{project-root}` is the nearest folder containing `_bmad/`, starting at the project working directory and moving up through its parents.
- `{active_initiative}` is the value printed by `uv run {project-root}/_bmad/scripts/resolve_config.py --project-root {project-root} --key core.active_initiative`, read once before step 1. When it is unset, drop `/{active_initiative}` from every path.
- Whenever this workflow captures or records a version-control revision, obtain the full canonical identifier directly from version control and preserve it verbatim.

## On Activation

### Step 1: Execute Prepend Steps

Execute each of these steps in order before proceeding (`_None._` means skip):

{{ workflow.activation_steps_prepend }}

### Step 2: Load Persistent Facts

Treat every entry below as foundational context you carry for the rest of the workflow run. Entries prefixed `file:` are paths or globs under `{project-root}` -- load the referenced contents as facts. All other entries are facts verbatim (`_None._` means none):

{{ workflow.persistent_facts }}

### Step 3: Execute Append Steps

Execute each of these steps in order (`_None._` means skip):

{{ workflow.activation_steps_append }}

Activation is complete after all activation steps have run.

## Workflow Execution

Follow step files in order, including the explicit LOW context-only exit. Read one fully, execute within authority, then load the next only when directed. LOW exits never fall through to plan-required steps.

## First Workflow Step

Read fully and follow: `{{ rendered("step-01-clarify-and-route.md") }}`.
