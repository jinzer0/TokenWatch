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

## Intent check (only after the request-mode guard)

Use the invocation prompt as the intent.

The invocation prompt names a ticket from the tree when it calls a reference a ticket (such as `ticket 1.2`, a ticket file's name, or a ticket's title), or points to a file whose frontmatter `type` is `story`, `spike`, or `bug`, whatever its `status`. A ref or title it does not present as a ticket is not one. Resolve a named ticket's plan, entry, and prerequisites with `uv run {project-root}/_bmad/method/scripts/tickets.py --project-root {project-root} find <ref>`; for a ticket file, pass its folder before its file name. Non-zero exit → HALT with status `blocked` and blocking condition `ticket not resolved`, with find's error. Otherwise follow **Ticket resolution** (below).

If the invocation prompt explicitly points to an existing plan file with recognized `status` frontmatter, set `plan_file`, then **EARLY EXIT** to the appropriate step:

- `draft` → `{{ rendered("step-02-plan.md") }}`
- `ready-for-dev` or `in-progress` → `{{ rendered("step-03-implement.md") }}`
- `in-review` → `{{ rendered("step-04-review.md") }}`
- `blocked` → HALT with status `blocked` and blocking condition `blocked plan supplied`.
- `dropped` → HALT with status `blocked` and blocking condition `dropped plan supplied`.
- `built` or `done` → revalidate current scope/ownership/permission and next-risk authority; set `followup_pass` to `true` in runtime context for a fresh review. Reset iteration only in authorized task-owned state, otherwise record it in existing context. Prior completion/reset grants no new authority. **EARLY EXIT** to `{{ rendered("step-04-review.md") }}` for safe in-scope review.

Otherwise, treat the invocation prompt as starting intent. Reuse a selected canonical/unformatted plan at its original `plan_file` path/content with state/evidence in existing context; do not infer status, copy or force-convert it. An explicitly required missing plan blocks execution, but absence of a plan for LOW does not.
If the invocation prompt does not contain enough intent to identify what to implement, HALT with status `blocked` and blocking condition `unclear intent`.

One ticket per invocation: never read another entry, and never advance to a different ticket regardless of outcome.

### Ticket resolution

This runs on the output of `tickets.py find` for one ticket. Set `ticket_args` to the arguments find resolved it with. Find's `description`, `verify`, `references`, `notes`, and `unknown` are the intent, together with `epic_file` and what that file's References name when it is not null, and `story_file` when it is not null. Never write to a ticket file or run `pull`/`mark` to manufacture workflow artifacts or authority.

- When the file at find's `plan` exists on disk, treat it as a plan file the invocation prompt pointed to and route it by its `status` (above).
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
     - List `{{ config.output_folder }}/{active_initiative}/`, then `{{ config.output_folder }}/`.
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

   Reuse the selected existing canonical plan first, including unformatted user plans, keeping original path/content/human intent and state/evidence in existing context. HF references it, not a second original. If canonical was selected, keep `plan_file` at its path and go NEXT; slug derivation/new-path assignment below applies only otherwise, when a new BMAD plan is genuinely needed. No dummy Issue/board.

   Derive a valid kebab-case slug from the clarified intent. If the intent references a tracking identifier (story number, issue number, ticket ID), lead the slug with it (e.g. `3-2-digest-delivery`, `gh-47-fix-auth`). If `{{ config.output_folder }}/{active_initiative}/plan-{slug}.md` already exists: if its status is `draft`, treat it as the same work and resume it (set `plan_file` to that path, **EARLY EXIT** → `{{ rendered("step-02-plan.md") }}`); otherwise append `-2`, `-3`, etc. Set `plan_file` = `{{ config.output_folder }}/{active_initiative}/plan-{slug}.md`.

## NEXT

Read fully and follow `{{ rendered("step-02-plan.md") }}`
