---
plan_file: '' # set at runtime before leaving this step
---

# Step 1: Clarify

## RULES

- Use the invocation prompt as starting intent and scope delegation under root/child `AGENTS.md` and native permissions. Existing canonical plans, including unformatted user plans, are reusable without copying or forced conversion. A plan/handoff never overrides those rules.
- Before any routing or EARLY EXIT, resolve current request mode, scope, canonical context, risk and ownership. Capture task-owned files/hunks separately from unrelated tracked/untracked dirty baselines; `baseline_revision` alone does not establish ownership. Preserve userwork; only an actual inseparable conflict blocks its affected action.
- Before each next HIGH action, including EARLY EXIT/resume, revalidate requester authority, scope, `targets`, `actions`, `impact`, `recovery_conditions`, result and evidence. Reuse matching approval only; missing/denied or changed conditions block that action while independent safe work continues. Status/approved fields are not authority.
- Explicit plan-required full/resume with a missing named/required plan blocks that execution without recreating it. A pinned route or explicit wrapper call alone does not make a plan mandatory for LOW. Read-only/planning-only requests authorize no implementation/publication.
- **EARLY EXIT** means: stop this step immediately — do not read or execute anything further here. Read and fully follow the target file instead. Return here ONLY if a later step explicitly says to loop back.

## Request-mode guard (before any routing)

Resolve the current invocation's request mode before ticket resolution, status-based routing, artifact scans, plan creation or follow-up/reset. A plan's status or prior approval never changes this mode.

For read-only, planning-only or report-only:

- Read only the relevant existing canonical context, regardless of plan status: `draft`, `ready-for-dev`, `in-progress`, `in-review`, `built`, `done`, `blocked` or `dropped`. Return the requested analysis, planning proposal or report with actual limitations, not a build/resume result.
- Do not write or create a plan, frontmatter, ticket, source or workflow/result artifact; do not reset iteration, dispatch implementation/repair or perform commit/push/PR. Do not run ticket commands or downstream workflow steps.
- **STOP this workflow here — no status-based EARLY EXIT, ticket routing, step-02, implementation, review/repair or Finalize fallthrough.**

Only an invocation that delegates changes may continue to Intent check below, subject to existing scope, ownership, required-plan and HIGH/native permission safeguards.

## Intent check (only after the request-mode guard)

Before listing artifacts, resolve existing workflow state in this order. Skip the remaining checks as soon as a branch applies. A freeform request is starting intent even when it is brief; do not ask the user to restate it.

1. Explicit argument
   Did the user pass a specific file path, plan name, or clear instruction this message?
   - It names a ticket from the tree when it gives a ref such as `1.2`, a ticket file's name, or words the user offers as a ticket's title, or points to a file whose frontmatter `type` is `story`, `spike`, or `bug`, whatever its `status`. Resolve a named ticket's plan, entry, and prerequisites with `uv run {project-root}/_bmad/method/scripts/tickets.py --project-root {project-root} find <ref>`; for a ticket file, pass its folder before its file name. Non-zero exit → show its error and HALT. Otherwise follow **Ticket resolution** (below).
   - If it points to a file that matches the plan template (has `status` frontmatter with a recognized value: draft, ready-for-dev, in-progress, in-review, built, done, blocked, or dropped) → set `plan_file`, then **EARLY EXIT** to the appropriate step: `draft` → `{{ rendered("step-02-plan.md") }}`, {% if workflow.route == "oneshot" %}`ready-for-dev`/`in-progress` → `{{ rendered("step-oneshot.md") }}`{% elif workflow.route == "full" %}`ready-for-dev`/`in-progress` → `{{ rendered("step-03-implement.md") }}`, `in-review`/`built` → `{{ rendered("step-04-review.md") }}`{% else %}`ready-for-dev`/`in-progress` → `{{ rendered("step-03-implement.md") }}` (or `{{ rendered("step-oneshot.md") }}` when `route` is `oneshot`), `in-review`/`built` → `{{ rendered("step-04-review.md") }}`{% endif %}. For `done`, ingest as context and proceed to INSTRUCTIONS — do not resume. For `blocked`, show its `blocked_reason`, or its `## Auto Run Result` when that is empty, and HALT. For `dropped`, say the ticket was dropped and HALT.
   - Anything else (intent files, external docs, planning documents, descriptions) → ingest it and proceed to INSTRUCTIONS. When it is the existing canonical/unformatted plan, set `plan_file` to that same path and reuse it in place with state/evidence in existing context; do not infer status, duplicate it or force template conversion.

2. Recent conversation
   Do the last few human messages clearly show what the user intends to work on?
   Use the same routing as above.

3. The ticket tree
   With no argument and no intent from the conversation, run `uv run {project-root}/_bmad/method/scripts/tickets.py --project-root {project-root} next`.
   - Non-zero exit (no active initiative, a store refusal, a malformed tree) → say in one line that the ticket tree is unavailable and why, then go to 4.
   - A row in any group whose `status` is `draft`, `ready-for-dev`, `in-progress`, or `in-review` has a started plan when the file at `find <ref>`'s `plan` exists. When any row has one, or `{{ config.output_folder }}/{active_initiative}/` holds a `plan-*.md` with one of those statuses, go to 4.
   - No `ready_to_start` row → say in one line that nothing in the tree is ready, naming what is ready to refine, in progress, or blocked, then go to 4.
   - Otherwise run `find <ref>` with the first `ready_to_start` row's `ref`, tell the user in one line which entry you are building, and follow **Ticket resolution**.

4. Otherwise — scan artifacts and ask
   - Active plans (`draft`, `ready-for-dev`, `in-progress`, `in-review`) among `{{ config.output_folder }}/{active_initiative}/plan-*.md`, or started plans in the tree from branch 3? → List them all and HALT. Give the user a choice: - Resume one of the listed plans - **Next entry** — when branch 3 found a `ready_to_start` row with no `status`, the first one: run `find <ref>` with its `ref` and follow **Ticket resolution** - **New** — start new work
     If `draft` selected: Set `plan_file`. **EARLY EXIT** → `{{ rendered("step-02-plan.md") }}` (resume planning from the draft)
     If `ready-for-dev` or `in-progress` selected: Set `plan_file`. **EARLY EXIT** → {% if workflow.route == "oneshot" %}`{{ rendered("step-oneshot.md") }}`{% elif workflow.route == "full" %}`{{ rendered("step-03-implement.md") }}`{% else %}`{{ rendered("step-03-implement.md") }}` (or `{{ rendered("step-oneshot.md") }}` when `route` is `oneshot`){% endif +%}
     {% if workflow.route != "oneshot" %}
     If `in-review` selected: Set `plan_file`. **EARLY EXIT** → `{{ rendered("step-04-review.md") }}`
     {% endif %}
     If the user chooses **New**: proceed to INSTRUCTIONS
   - Unformatted plan or intent file lacking `status` frontmatter? → When it is the canonical plan, set `plan_file` to its existing path, reuse the content and record state in existing context. Do NOT infer a frontmatter state or force conversion.

### Ticket resolution

This runs on the output of `tickets.py find` for one ticket. Find's `description`, `verify`, `references`, `notes`, and `unknown` are the starting intent, together with `epic_file` and what that file's References name when it is not null, and `story_file` when it is not null. Never write to a ticket file, and never run `pull` or `mark`.

- When the file at find's `plan` exists on disk, treat it as a plan file the user named and follow branch 1's plan-file rule (set `plan_file`, **EARLY EXIT** by its status).
- Otherwise set `plan_file` to find's `plan`; the plan's frontmatter carries `ticket` set to find's `id`, or to the stem of find's `story_file` when `id` is null, never its `ref`. Proceed to INSTRUCTIONS, skipping step 5.

## INSTRUCTIONS

0. **LOW existing-context entry — before Set plan file or step-02.** When the request is clear, LOW, needs no separate plan and does not explicitly require plan/state-based full/resume, take this branch even when no plan exists or Build was explicitly called.
   - Use existing context (conversation/task record is sufficient) for intent, acceptance, scope authority, risk reason, task-owned file/hunk allowlist and dirty baseline. Do not create a plan, placeholder/frontmatter, Issue or board merely to enter Build.
   - For read-only/planning-only requests, perform only safe analysis, verification proposals and context recording; no source mutation, commit, push or PR. Report and **STOP this workflow with no fallthrough**.
   - For delegated changes: narrowly investigate, implement in scope, run required verification and proportional review; repair same-scope failures autonomously and preserve failed evidence. If investigation reveals MEDIUM/HIGH or a genuine need for a plan, leave this branch for the plan-required instructions below, reusing the canonical plan first. Size/complexity alone is not an approval gate. Resolve only material intent gaps or the affected HIGH action's authority.
   - **Verified exit:** record changes, actual verification, risk/authority, residual limitations and next safe action in existing context. Apply current scope/native permission and task-only terminal rules: only reviewed, verified task-owned changes/evidence via exact filename allowlist; task-owned pending changes define clean, unrelated dirty files stay untouched. Standing commit/push and clear-change-request PR require current delegation, exact repo/remote/base/head and an existing-PR check; create no duplicate/no-op publication. Revalidate any next HIGH action. Merge/Release, formal posting, Issue close, tag and undelegated deletion/cleanup remain separate authority.
   - Failed verification/unmet acceptance stays **incomplete**; an unresolved action records **scoped blocked** reason. No success/publication on failure, read-only/planning-only, native denial or undelegated remote action; continue independent safe work. End with completed or scoped blocked/incomplete evidence and **STOP this workflow — never fall through to step-02 or plan-required implementation**.

1. Load context.
   - **A ticket from the tree** — when **Ticket resolution** set `plan_file`: the entry, its epic file and what that file's References name, and the story file when there is one are already the intent. For continuity, read the plans beside `plan_file` whose `ticket` is one of find's `after` ids that is a plain number (an entry of the same epic; a ref such as `1.5` is another epic's). Extract each one's **Code Map**, **Design Notes**, **Plan Change Log**, and task list as continuity context for step-02 planning.
   - **Anything else:**
     - No `{active_initiative}`: use existing loose context unless the request genuinely needs an initiative decision. Do not require dummy tracking artifacts.
     - List `{{ config.output_folder }}/{active_initiative}/`, then `{{ config.output_folder }}/`.
     - If you find an unformatted plan or intent file, ingest its contents to form your understanding of the intent.
     - Planning documents sit in folders by type, main file named after the folder. Typical ones:
       - **PRD** (`prd-*/prd-*.md`) — product requirements and success criteria
       - **Architecture** (`architecture-*/architecture-*.md`) — technical design decisions and constraints
       - **UX/Design** (`ux-*/`, with `DESIGN.md` and `EXPERIENCE.md`) — user experience and interaction design
       - **Product Brief** (`brief-*/brief-*.md`) — project vision and scope
       - **Spec** (`spec-*/spec-*.md`) — the capability contract
     - Scan the listing for folders matching these patterns. If any look relevant to the current intent, load them selectively — you don't need all of them, but you need the right constraints and requirements rather than guessing from code alone.
2. Carry the intent and loaded evidence forward as-is. Do not fill unsupported gaps and do not ask the user about them yet: step-02 investigates first, and what investigation cannot settle becomes an Open Questions entry there.
3. Version control sanity check. Capture the current canonical revision, branch and task-owned files/hunks versus pre-existing unrelated changes. Preserve all userwork. Unrelated dirty/untracked files are not a gate and changes since a baseline are not automatically task-owned. Block only an inseparable conflict or ambiguous publication target; continue safe independent work. If version control is unavailable, record that limitation rather than claiming ownership/publication verification.
4. Multi-goal check (see SCOPE STANDARD). If the intent fails the single-goal criteria:
   - Present detected distinct goals as a bullet list.
   - Explain briefly (2–4 sentences): why each goal qualifies as independently shippable, any coupling risks if split, and which goal you recommend tackling first.
   - Continue the clear delegated scope, using proportional routing/delegation. Ask only when splitting changes requested intent or scope; then give the user a choice:
     - **Split** — pick first goal, defer the rest.
     - **Keep all goals** — accept the risks.
   - If the user chooses **Split**: For each deferred goal, append one new entry to `{{ config.output_folder }}/{active_initiative}/deferred-work.md` using this format. Do not modify existing entries or look for duplicates. Narrow scope to the first-mentioned goal. Continue routing.
     ```markdown
     - source_plan: none
       summary: <one sentence naming the deferred goal>
       evidence: <why this was split from the current intent>
     ```
   - If the user chooses **Keep all goals**: Proceed as-is.
5. Set the plan file.

   Reuse the existing active canonical plan first, including an unformatted user plan; keep its human intent and location, recording workflow state/evidence in existing context when needed. HF references it, not a second implementation original. Only choose a new BMAD plan path when a plan is actually needed and none is reusable. Do not create an Issue/board to support it.

   If a canonical plan was selected, keep `plan_file` at that path and go directly to NEXT. Slug derivation and new-path assignment below apply only otherwise.

   Derive a valid kebab-case slug from the current intent. If the intent references a tracking identifier (story number, issue number, ticket ID), lead the slug with it (e.g. `3-2-digest-delivery`, `gh-47-fix-auth`). If `{{ config.output_folder }}/{active_initiative}/plan-{slug}.md` already exists: if its status is `draft`, treat it as the same work and resume it (set `plan_file` to that path, **EARLY EXIT** → `{{ rendered("step-02-plan.md") }}`); otherwise append `-2`, `-3`, etc. Set `plan_file` = `{{ config.output_folder }}/{active_initiative}/plan-{slug}.md`.

## NEXT

Read fully and follow `{{ rendered("step-02-plan.md") }}`
