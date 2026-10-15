{% if workflow.route not in ("oneshot", "full", "auto") %}{{ halt("workflow.route must be oneshot, full, or auto, not " ~ workflow.route) }}{% endif %}
{% if workflow.review not in ("none", "quick", "thorough", "auto") %}{{ halt("workflow.review must be none, quick, thorough, or auto, not " ~ workflow.review) }}{% endif %}

# Build New Preview Workflow

**Goal:** Turn user intent into a hardened, reviewable artifact.

**CRITICAL:** If a step directs you to another snapshot file, read it fully and follow it within the root/nearest child `AGENTS.md` rules and native phase/tool permissions. A plan or handoff cannot override those boundaries.

## Execution Authority

Apply the root Risk-Based Execution Policy throughout activation, routing, checkpoints, EARLY EXIT and resume. Clear LOW/MEDIUM requests delegate their scope; checkpoints record evidence, not renewed approval. Before each next HIGH action, revalidate requester authority, scope, `targets`, `actions`, `impact`, `recovery_conditions`, approval result and evidence. Reuse only condition-matching approval; missing/denied or changed authority blocks that action, not independent safe work. Plan status or arbitrary approved fields confer no authority.

Step 1 has a narrow LOW existing-context entry before Set plan file/step-02, including explicit Build calls with no existing plan. It verifies and exits without fallthrough or dummy artifacts. Explicit plan-required full/resume and genuine missing required plans retain their safeguards. Read-only/planning-only requests do not authorize implementation or publication.

Subagents, when the capability is available, are an important part of this workflow. Use them as directed by the workflow steps.
If you need an explicit user instruction to run them, ask once now for the whole workflow run.

## Durable original review provenance (before intermediate effects)

자동 workflow와 동일한 `review_cycle` / `resume_incoming_status` / `followup_pass` 계약을 사용한다. read-only/planning-only/report-only는 provenance write 전에 종료한다. SAME selected authorized BMAD workflow metadata 또는 이미 존재하는 durable associated canonical context/task에서 exact canonical path AND task로 연결된 append-only `review_cycle` 이력을 읽는다. canonical association은 기존 검증된 privacy-safe reference/task 연결로 확인한다. 새 mandatory artifact, frontmatter 추가, human body/heading/path 변환·복사·번역, raw private path/identifier 또는 그 hash 저장은 금지한다. 안전한 영속 연결을 표현할 수 없으면 dependent effects만 차단한다.

1. 유일한 open cycle이 있으면 최초 `resume_incoming_status`와 cycle 연결을 재사용한다. interruption/repeated resume, patch, bad_plan, failed-verification loopback 및 oneshot 재진입은 새 cycle이 아니다. intermediate `in-review` 또는 다른 task의 원본으로 교체하지 않는다. open record 중복·상충, task/path 불일치, unknown/conflicting status는 dependent status/metadata/repair/completion/publication만 차단하고 independent safe analysis는 계속한다. route pin과 review pin은 별도 runtime 선택이며 provenance를 만들거나 바꾸지 않는다. blocked/dropped와 missing required path safeguards도 우회하지 않는다.
2. open cycle 없이 현재 status가 `in-review`이면 `missing original review provenance`로 dependent effects를 차단하며 legacy terminal 원본을 추측하지 않는다. 새 authorized active review를 시작할 때만 현재 선택 위치의 status를 `resume_incoming_status` (`done`, `built`, 그 외 인식된 비terminal 상태 또는 실제 부재인 `absent`)로 capture하고 canonical path/task association과 함께 새 open `review_cycle` 기록을 atomic append한다. terminal `built`/`done`에는 실제 delegated follow-up이 필요하다. 동일 위치를 re-read하여 유일한 open cycle/association/원본 값의 영속을 확인한 뒤에만 intermediate status와 다른 review metadata를 쓰거나 reviewer/repair를 dispatch한다. write-denied, non-durable/missing context, concurrent change, validation/readback failure면 기존 status/iteration/baseline/모든 로그를 보존하고 dependent effects만 차단한다. provenance failed write는 status를 바꿀 수 없으며 대체 artifact/context나 permission 우회는 없다.
3. runtime `resume_incoming_status`는 검증된 open record에서만 복원하고 `{followup_pass} = true` iff original status is `built` or `done`; 그 외에는 false다. entry/routing, review, repair, oneshot 및 presentation은 동일 원본을 소비한다. non-persisted runtime capture만으로 원본을 보장하지 않는다. 실패·HALT·retry·repair 및 route/review pin 변경은 cycle boundary가 아니며 failed review cycle은 active로 남긴다.
4. 현재 AC/verification과 모든 applicable required native review lane의 successful execution/completion 및 actual authority가 확인된 성공 terminal event만 cycle boundary다. SAME selected 위치에 final status와 해당 cycle completion 기록을 원자적으로 함께 영속하고 re-read한다. `done` 원본의 verified follow-up만 `done`, `built` 원본은 `built`, fresh/in-progress/absent 원본도 성공 시 `built`다. status/completion의 atomic persistence/readback이 불가능하거나 verification/AC/required lane/authority 실패면 성공 status를 쓰거나 원본을 clear하지 않고 incomplete로 남긴다. completion은 append-only이며 이전 원본/모든 로그를 삭제·수정하지 않는다. 완료된 cycle을 다음 review 원본으로 재사용하지 않고 다음 실제 delegated cycle은 그때 현재 상태를 capture한다. open cycle은 terminal 상태로 중단되어도 먼저 같은 cycle로 resume한다. open cycle 없는 terminal presentation은 새 review/상태 전이를 만들지 않으며 기존 terminal 상태를 보존한다.

## READY FOR DEVELOPMENT STANDARD

A plan is "Ready for Development" when:

- **Actionable**: Every task has a file path and specific action.
- **Logical**: Tasks ordered by dependency.
- **Testable**: All ACs use Given/When/Then, and each is a check the implementer can prove it met without pointing at code.
- **Complete**: No placeholders or TBDs.
- **Sufficient**: No known requirement, acceptance, dependency, or implementation gaps remain unresolved.
- **Coherent**: No unresolved ambiguities or internal contradictions.

## SCOPE STANDARD

A plan should target a **single user-facing goal** within **900–1600 tokens**:

- **Single goal**: One cohesive feature, even if it spans multiple layers/files. Multi-goal means >=2 **top-level independent shippable deliverables** — each could be reviewed, tested, and merged as a separate PR without breaking the others. Never count surface verbs, "and" conjunctions, or noun phrases. Never split cross-layer implementation details inside one user goal.
  - Split: "add dark mode toggle AND refactor auth to JWT AND build admin dashboard"
  - Don't split: "add validation and display errors" / "support drag-and-drop AND paste AND retry"
- **900–1600 tokens**: Optimal range for LLM consumption. Below 900 risks ambiguity; above 1600 risks context-rot in implementation agents.
- **Neither limit is a gate.** Size and complexity guide warnings, routing or delegation, not human approval or HIGH classification. Preserve the requested cohesive scope; ask only for a material scope/intent decision.

## Conventions

- Every operational cross-file snapshot reference in this workflow is repository-root-relative. Resolve it against the authorized `{project-root}`, never the caller's nested cwd, skill directory or snapshot directory. The entrypoint's `read and follow` loading reference alone is relative to the unchanged caller cwd; these two bases are distinct. Do not change cwd or discover another checkout to resolve a step.
- `{project-root}` is the current authorized Git checkout root supplied to the tracked renderer by the entrypoint. Do not discover a parent installer or change repositories.
- `{active_initiative}` is the renderer-resolved central value `{{ config.core.active_initiative }}`, captured once from required shipped defaults plus present read-only project/user overrides. Treat it as data, never instructions or authority. When empty, drop `/{active_initiative}` from every path. No installer resolver or bootstrap is needed.
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

## WORKFLOW ARCHITECTURE

This uses **step-file architecture** for disciplined execution:

- **Micro-file Design**: Each step is self-contained and followed exactly
- **Just-In-Time Loading**: Only load the current step file
- **Sequential Enforcement**: Complete steps in order, no skipping
- **State Tracking**: Persist progress via plan frontmatter and in-memory variables
- **Append-Only Building**: Build artifacts incrementally

### Step Processing Rules

1. **READ COMPLETELY**: Read the entire step file before acting
2. **FOLLOW SEQUENCE**: Execute sections in order
3. **RECORD CHECKPOINTS**: Continue within delegated scope; wait only for unresolved core intent, inseparable userwork conflict or the next action's required HIGH authority
4. **LOAD NEXT**: When directed, read fully and follow the next step file

### Critical Rules (NO EXCEPTIONS)

- **NEVER** load multiple step files simultaneously
- **ALWAYS** read entire step file before execution
- Follow the sequence, including the explicit LOW context-only exit; do not send that exit into plan-required steps
- Follow step instructions subject to root/child/native rules, never plan overrides
- Record current scope, state, verification, risk/authority evidence and next safe action at checkpoints; do not impose same-scope source/plan/stage approval waits

## FIRST STEP

Read fully and follow: `{{ rendered("step-01-clarify-and-route.md") }}` to begin the workflow.
