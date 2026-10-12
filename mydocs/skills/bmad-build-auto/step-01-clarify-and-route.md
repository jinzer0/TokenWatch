---
plan_file: '' # set at runtime once a route resolves it; some HALT branches exit before it is set
ticket_args: '' # arguments tickets.py find resolved; resolution evidence, not mutation authority
followup_pass: '' # set at runtime when a `built` or `done` plan is re-dispatched for a follow-up review pass; empty on a first pass
---

# Step 1: Clarify and Route

## RULES

- Treat invocation intent as scope input under root/nearest-child `AGENTS.md` and native permissions. Existing canonical/unformatted plans are reusable in place; plans/handoffs never override authority.
- Before routing, EARLY EXIT, resume, HALT or follow-up, resolve current request mode/scope, risk and task-owned files/hunks versus unrelated dirty/staged/untracked baselines. baseline_revision differences are not ownership. Preserve userwork; only actual inseparable conflict blocks that target.
- Before every next risky action revalidate actual HIGH requester scope/authority, targets/actions/impact/recovery_conditions/result/evidence. Reuse only matching approval; missing/denied/changed conditions block that action while independent safe work continues. No-human, status/reset/past done are not authority.
- Explicit required plan/state-based full/resume with a missing path blocks without recreation. Wrapper invocation or pinned route alone does not require a plan for LOW. Read-only/planning-only/report-only means safe context evidence only, mutation/publication zero.
- **EARLY EXIT** means: stop this step immediately, then read and follow the target file. Return here only if a later step explicitly says to loop back.

## Request-mode guard (before any routing)

Resolve the current invocation's request mode before ticket resolution, status-based routing, artifact scans, plan creation or follow-up/reset. A plan's status or prior approval never changes this mode.

For read-only, planning-only or report-only:

- Read only the relevant existing canonical context, regardless of plan status: `draft`, `ready-for-dev`, `in-progress`, `in-review`, `built`, `done`, `blocked` or `dropped`. Return the requested analysis, planning proposal or report with actual limitations, not a build/resume result.
- Do not write or create a plan, frontmatter, ticket, source or workflow/result artifact; do not reset iteration, dispatch implementation/repair or perform commit/push/PR. Do not run ticket commands or downstream workflow steps.
- **STOP this workflow here — no status-based EARLY EXIT, ticket routing, step-02, implementation, review/repair or Finalize fallthrough.**

Only an invocation that delegates changes may continue to Intent check below, subject to existing scope, ownership, required-plan and HIGH/native permission safeguards.

## Optional ticket capability (before every ticket command)

Ticket integration is optional and is not part of the tracked standalone runtime. Direct intent and canonical-plan work require neither tickets nor `uv` nor installer setup.

- Before **each** `find` command, including resumed resolution and prerequisite lookups, revalidate the request-mode guard, current scope/native permission and any action-specific HIGH authority. Check that the actual helper at `{project-root}/_bmad/method/scripts/tickets.py` and its local runtime/dependencies are available and can execute without installation, dependency synchronization, downloads or bootstrap. A path, plan, static instruction or prior success is not capability or native permission evidence. If this cannot be established safely, do not invoke the helper. Never install or adopt the ticket engine to resolve a request.
- A genuinely explicit ticket request with unavailable capability or denied authority is **scoped blocked** for ticket-dependent work. Preserve the canonical plan and existing ticket state; continue independent safe analysis only. Do not reinterpret the ticket as ordinary intent, invent its resolution/prerequisites or create a substitute plan.
- Without explicit ticket intent, use safe existing context/artifact inspection or ask for missing intent; do not invoke a ticket helper merely to discover work.
- On command failure, report only a privacy-safe reason/category and the affected limitation, never raw command output, errors, paths, records or stack traces. Block ticket-dependent work without fabricated ticket/prerequisite evidence.

## Canonical state/evidence selection (only after the request-mode guard)

Whenever an existing canonical plan is selected — by explicit file, recent conversation, artifacts, ticket resolution, existing-path collision or markerless-plan fallback — set `plan_file` to that exact existing path and select its state/evidence location BEFORE testing any status, ordinary-intent fallback, LOW entry, slug assignment or NEXT. Re-read the required plan; a missing required path is scoped blocked without recreation.

Use frontmatter/workflow sections only for a supported existing BMAD-format plan with authorized task-owned metadata. Otherwise use existing context associated with the exact selected canonical path AND task. Reuse that location downstream for status, route, baseline and logs; never add frontmatter, infer status from formatting, reset iteration/baseline or modify the unformatted human body to route. Ignore stale context for another plan/task; if association or recorded state is ambiguous/conflicting, block dependent execution rather than guess. Unknown recorded status is likewise scoped blocked, not fresh implementation.

Read status from that selected location and apply **Existing-state dispatch** identically for all eight recognized statuses. No plan/state mutation precedes dispatch. Only genuinely absent recorded status permits ordinary-intent routing with canonical reuse (including the existing LOW safeguards), never a dummy/replacement plan. Status and context supply continuity, not authority; actual new scope/mutation requires current delegation and its appropriate phase.

## Intent check (only after the request-mode guard)

Use the invocation prompt as the intent.

The invocation prompt names a ticket from the tree when it calls a reference a ticket (such as `ticket 1.2`, a ticket file's name, or a ticket's title), or points to an existing file whose frontmatter `type` is `story`, `spike`, or `bug`, whatever its `status`. A ref or title it does not present as a ticket is not one. Only after **Optional ticket capability** permits this command, resolve the named ticket's plan, entry and prerequisites with the existing local `uv run {project-root}/_bmad/method/scripts/tickets.py --project-root {project-root} find <ref>` without provisioning; for a ticket file, pass its folder before its file name. Unavailable capability, denied authority or non-zero exit → scoped blocked with a privacy-safe `ticket not resolved` reason/limitation, preserving existing state and continuing independent safe analysis only; no routing fallthrough. Otherwise follow **Ticket resolution** (below).

Select any existing canonical plan identified by the explicit file, recent conversation or relevant permitted artifacts before treating the prompt as starting intent. Apply **Canonical state/evidence selection**, then the dispatch below to its recorded status, whether formatted or contextual.

### Existing-state dispatch

Revalidate current request mode, scope/ownership/native permission and next-risk authority before each dispatch. Preserve canonical content/path, baseline and prior logs; no status/iteration reset or successor plan merely for routing. All eight recognized statuses terminate routing here:

- `draft` → `{{ rendered("step-02-plan.md") }}`
- `ready-for-dev` or `in-progress` → `{{ rendered("step-03-implement.md") }}`
- `in-review` → `{{ rendered("step-04-review.md") }}`
- `blocked` → HALT with status `blocked` and blocking condition `blocked plan supplied`.
- `dropped` → HALT with status `blocked` and blocking condition `dropped plan supplied`.
- `built` or `done` → revalidate current scope/ownership/permission and current verification/review evidence; set `followup_pass` to `true` in runtime context for a fresh review. Do not reset iteration, baseline or status, create a successor plan or reimplement merely to dispatch. Prior completion grants no new authority; actual new scope/mutation needs actual delegation and the appropriate phase. **EARLY EXIT** to `{{ rendered("step-04-review.md") }}` for safe in-scope review.

Only with no selected canonical plan, or genuinely no recorded status in its selected location, treat the resolved prompt/conversation/artifacts as starting intent. Reuse a selected canonical/unformatted plan at its original `plan_file` path/content with state/evidence in existing context; unknown/conflicting recorded status blocks rather than falling through. An explicitly required missing plan blocks execution, but absence of a plan for LOW does not.
If the invocation prompt and existing safe context do not contain enough intent to identify what to implement, ask for the missing intent and HALT dependent execution with status `blocked` and blocking condition `unclear intent`; do not run a ticket helper to fill the gap.

One ticket per invocation: never read another entry, and never advance to a different ticket regardless of outcome.

### Ticket resolution

This runs on the output of `tickets.py find` for one ticket. Set `ticket_args` to the arguments find resolved it with. Find's `description`, `verify`, `references`, `notes`, and `unknown` are the intent, together with `epic_file` and what that file's References name when it is not null, and `story_file` when it is not null. Never write to a ticket file or run `pull`/`mark` to manufacture workflow artifacts or authority.

- When the file at find's `plan` exists on disk, apply **Canonical state/evidence selection** before testing status or fallback, then **Existing-state dispatch** for its recorded status. Genuinely absent status continues with canonical reuse, never a replacement plan.
- If that plan is genuinely required for explicit full/resume or existing state, but missing, block dependent execution without recreation; preserve ticket state and continue independent safe analysis.
- Otherwise set `plan_file` to find's `plan`; the plan's frontmatter carries `ticket` set to find's `id`, or to the stem of find's `story_file` when `id` is null, never its `ref`. Continue to INSTRUCTIONS, skipping item 5.

## INSTRUCTIONS

0. **LOW existing-context entry — before Set plan file/step-02.** For clear LOW intent needing no separate plan and no explicit plan/state-based required full/resume, enter even with no existing plan or an explicit wrapper/pinned route.
   - Use existing conversation/task context for request/scope authority, intent/acceptance, risk reason, task-owned files/hunks and unrelated dirty baseline. No dummy plan/frontmatter/claims/Issue/board/result artifacts.
   - Read-only/planning-only/report-only: safe analysis, verification proposals and context evidence only; mutation/commit/push/PR zero. Report then **STOP with no fallthrough**.
   - Delegated changes: narrowly investigate, implement in scope, run required verification and proportional review, repair same-scope failures autonomously and reverify. Preserve failed evidence. If investigation reveals MEDIUM/HIGH or genuine plan need, transition to plan-required instructions below with canonical reuse and next-risk authority; size/complexity alone is not a gate. Genuine unresolved intent blocks only dependent work.
   - **Verified terminal:** record changes, actual verification/acceptance/review, authority and limitations in existing context. Revalidate scope, ownership, native permission and any next HIGH bundle. Only reviewed verified task-owned changes/evidence may use exact filename allowlist and identified hunks for standing commit/push and clear-change-request PR. Verify current exact repo/remote/base/head and previous PR lookup; reuse existing PR, no duplicate/no-op publication. Clean means task-owned pending changes, not whole-tree cleanliness; preserve unrelated staged/dirty/untracked work.
   - Failed verification/unmet acceptance stays incomplete with no successful publication. Read-only/planning-only/report-only, undelegated remote, native denial or inseparable ownership conflict prevents affected publication only; record scoped blocked/limitations and continue independent safe context/review. Merge/Release, formal posting, Issue close, tag and undelegated deletion/cleanup remain separate authority.
   - Report completed or incomplete/scoped blocked truthfully, apply bounded On Complete only, then **STOP this workflow — no step-02/plan-required implementation/Finalize fallthrough and no forced LOW result artifacts/state**.

1. Load context.
   - **A ticket from the tree** — when **Ticket resolution** set `plan_file`: the entry, its epic file and what that file's References name, and the story file when there is one are already the intent. For continuity, read the plans beside `plan_file` whose `ticket` is one of find's `after` ids that is a plain number (an entry of the same epic; a ref such as `1.5` is another epic's). Carry forward each one's **Code Map**, **Design Notes**, **Implementation Notes**, **Plan Change Log**, and **Tasks & Acceptance**, where present, as continuity context for step-02.
   - **Anything else:**
     - List `{{ config.output_folder }}/{active_initiative}/` only when an active initiative is known and that directory exists, then `{{ config.output_folder }}/` only when it exists. Absent directories are empty existing context; never create directories or placeholder plans merely to scan. If existing safe context/artifacts cannot resolve intent, ask for the missing intent and stop dependent work.
     - If the invocation prompt points to an unformatted plan or intent file, ingest that file. Do not scan for unrelated intent files.
     - Planning documents sit in folders by type, main file named after the folder. Typical ones:
       - **PRD** (`prd-*/prd-*.md`) — product requirements and success criteria
       - **Architecture** (`architecture-*/architecture-*.md`) — technical design decisions and constraints
       - **UX/Design** (`ux-*/`, with `DESIGN.md` and `EXPERIENCE.md`) — user experience and interaction design
       - **Product Brief** (`brief-*/brief-*.md`) — project vision and scope
       - **Spec** (`spec-*/spec-*.md`) — the capability contract
     - Scan the listing for folders matching these patterns. If any look relevant to the current intent, load them selectively — you don't need all of them, but you need the right constraints and requirements rather than guessing from code alone.
2. Resolve intent from the invocation prompt and loaded artifacts. Do not fantasize or leave open questions. If the intent cannot be resolved, HALT with status `blocked` and the unresolved questions as blocking condition.
3. Version control sanity check. Capture canonical revision/branch and separate task-owned files/hunks/pre-edit baselines from unrelated dirty/staged/untracked work. Never refresh/stage the whole tree or attribute all revision changes to the task. Block only actual inseparable ownership conflicts or uncertain publication targets; safe independent work continues. Missing VCS/metadata permission records its affected-action limitation, not fabricated verification or whole-task dirty blocking.
4. Multi-goal warning. If the intent appears to contain multiple independently shippable goals, carry `multiple-goals` forward so step-02 can add it to `{plan_file}` frontmatter `warnings`. Do not split or block.
5. Set the plan file.

   Reuse the selected existing canonical plan first, including unformatted user plans, keeping original path/content/human intent and state/evidence in existing context. HF references it, not a second original. If canonical was selected, reapply **Canonical state/evidence selection** and dispatch recorded status before NEXT; only genuinely absent status goes NEXT with that same path. Slug derivation/new-path assignment below applies only otherwise, when a new BMAD plan is genuinely needed. No dummy Issue/board.

   Derive a valid kebab-case slug from the clarified intent. If the intent references a tracking identifier (story number, issue number, ticket ID), lead the slug with it (e.g. `3-2-digest-delivery`, `gh-47-fix-auth`). If `{{ config.output_folder }}/{active_initiative}/plan-{slug}.md` already exists, determine whether it is this task's canonical plan before selecting a new path. For the same task, apply **Canonical state/evidence selection** and dispatch recorded status; genuinely absent status reuses it as ordinary intent. Uncertain association blocks dependent work, not a guessed successor. Only a demonstrably unrelated collision permits `-2`, `-3`, etc. Set `plan_file` to a new path only when no canonical plan is reusable and a new BMAD plan is genuinely needed.

## NEXT

Read fully and follow `{{ rendered("step-02-plan.md") }}`
