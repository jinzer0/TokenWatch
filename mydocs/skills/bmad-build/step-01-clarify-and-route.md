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

## Optional ticket capability (before every ticket command)

Ticket integration is optional and is not part of the tracked standalone runtime. Direct intent and canonical-plan work require neither tickets nor `uv` nor installer setup.

- Before **each** `next` or `find` command, including resumed choices and prerequisite lookups, revalidate the request-mode guard, current scope/native permission and any action-specific HIGH authority. Check that the actual helper at `{project-root}/_bmad/method/scripts/tickets.py` and its local runtime/dependencies are available and can execute without installation, dependency synchronization, downloads or bootstrap. A path, plan, static instruction or prior success is not capability or native permission evidence. If this cannot be established safely, do not invoke the helper. Never install or adopt the ticket engine to resolve a request.
- A genuinely explicit ticket request with unavailable capability or denied authority is **scoped blocked** for ticket-dependent work. Preserve the canonical plan and existing ticket state; continue independent safe analysis only. Do not reinterpret the ticket as ordinary intent, invent its resolution/prerequisites or create a substitute plan.
- With no explicit ticket intent, unavailable capability skips only the ticket-tree branch; continue safe existing context/artifact inspection or ask for missing intent. Do not offer a ticket choice without actual resolution evidence.
- On command failure, report only a privacy-safe reason/category and the affected limitation, never raw command output, errors, paths, records or stack traces. Explicit ticket failure blocks its dependent work; discovery failure continues to existing artifacts. Do not fabricate ticket/prerequisite evidence.

## Canonical state/evidence selection (only after the request-mode guard)

Whenever an existing canonical plan is selected — by explicit file, recent conversation, artifacts, ticket resolution, existing-path collision or markerless-plan fallback — set `plan_file` to that exact existing path and select its state/evidence location BEFORE testing any status, ordinary-intent fallback, LOW entry, slug assignment or NEXT. Re-read the required plan; a missing required path is scoped blocked without recreation.

Use frontmatter/workflow sections only for a supported existing BMAD-format plan with authorized task-owned metadata. Otherwise use existing context associated with the exact selected canonical path AND task. Reuse that location downstream for status, route, baseline and logs; never add frontmatter, infer status from formatting, reset iteration/baseline or modify the unformatted human body to route. Ignore stale context for another plan/task; if association or recorded state is ambiguous/conflicting, block dependent execution rather than guess. Unknown recorded status is likewise scoped blocked, not fresh implementation.

Read status from that selected location and apply **Existing-state dispatch** identically for all eight recognized statuses. No plan/state mutation precedes dispatch. Only genuinely absent recorded status permits ordinary-intent routing with canonical reuse (including the existing LOW safeguards), never a dummy/replacement plan. Status and context supply continuity, not authority; actual new scope/mutation requires current delegation and its appropriate phase.

## Intent check (only after the request-mode guard)

Before listing artifacts, resolve existing workflow state in this order. Skip the remaining checks as soon as a branch applies. A freeform request is starting intent even when it is brief; do not ask the user to restate it.

1. Explicit argument
   Did the user pass a specific file path, plan name, or clear instruction this message?
   - It names a ticket from the tree when the user presents a ref such as `1.2`, a file name or title as a ticket, or points to an existing file whose frontmatter `type` is `story`, `spike`, or `bug`, whatever its `status`. A bare ref/title not presented as a ticket is ordinary intent. Only after **Optional ticket capability** permits this command, resolve the named ticket's plan, entry and prerequisites with the existing local `uv run {project-root}/_bmad/method/scripts/tickets.py --project-root {project-root} find <ref>` without provisioning; for a ticket file, pass its folder before its file name. Unavailable capability, denied authority or non-zero exit → scoped blocked as above, with no routing fallthrough. Otherwise follow **Ticket resolution** (below).
   - If it points to an existing canonical plan, first apply **Canonical state/evidence selection**, then **Existing-state dispatch** for any recognized status. Every recognized status ends with EARLY EXIT or HALT; never fall through to planning or reset status merely because the route is pinned.
   - Anything else (intent files, external docs, planning documents, descriptions) → ingest it and proceed to INSTRUCTIONS. If selected as the existing canonical/unformatted plan, apply **Canonical state/evidence selection** before any fallback; only genuinely absent recorded status permits ordinary intent with reuse in place.

2. Recent conversation
   Do the last few human messages clearly show what the user intends to work on?
   Use the same routing as above.

3. The ticket tree
   With no argument and no intent from the conversation, check **Optional ticket capability**. If unavailable or unauthorized, skip this branch and go to 4 without running a helper. Only when permitted, run the existing local `uv run {project-root}/_bmad/method/scripts/tickets.py --project-root {project-root} next` without provisioning.
   - Non-zero exit (no active initiative, a store refusal, a malformed tree) → report a privacy-safe tree-unavailable reason/limitation, then go to 4.
   - A row in any group whose `status` is `draft`, `ready-for-dev`, `in-progress`, or `in-review` has a started plan when the file at `find <ref>`'s `plan` exists. Ticket-row status is discovery evidence, not canonical plan status. Resolve each relevant existing plan candidate's exact path/task state/evidence location under **Canonical state/evidence selection** before testing its status. When any row has a started plan, or a relevant `plan-*.md` has a recorded active status in that location, go to 4.
   - No `ready_to_start` row → say in one line that nothing in the tree is ready, naming what is ready to refine, in progress, or blocked, then go to 4.
   - Otherwise run `find <ref>` with the first `ready_to_start` row's `ref`, tell the user in one line which entry you are building, and follow **Ticket resolution**.

4. Otherwise — scan artifacts and ask
   - Inspect only existing permitted context/artifact directories. An absent output/initiative directory is empty context, not a failure; do not create directories or placeholder plans to scan. Reapply the request-mode/scope/native guard before every selected route and **Optional ticket capability** before every `find`, including **Next entry**. If no existing context resolves intent, ask for the missing intent and stop dependent work.
   - Resolve each relevant existing candidate's state/evidence location before classifying it; never use absent frontmatter as absent status. Active plans (`draft`, `ready-for-dev`, `in-progress`, `in-review`) among `{{ config.output_folder }}/{active_initiative}/plan-*.md`, or started plans in the tree from branch 3? → List them all and HALT. Give the user a choice: - Resume one of the listed plans - **Next entry** — when branch 3 found a `ready_to_start` row with no `status`, the first one: run `find <ref>` with its `ref` and follow **Ticket resolution** - **New** — start new work
     For any selected existing plan: apply **Canonical state/evidence selection**, then **Existing-state dispatch** without route-specific fallthrough.
     If the user chooses **New**: proceed to INSTRUCTIONS
   - Unformatted plan or intent file lacking `status` frontmatter? → When it is the canonical plan, apply **Canonical state/evidence selection** and dispatch any recorded context status first. Only genuinely absent recorded status permits ordinary intent with canonical reuse. Do NOT infer a frontmatter state or force conversion.

### Existing-state dispatch

This single table applies to explicit plan files, recent conversation, selected artifacts and resolved ticket plans, on auto/full/oneshot routes. Re-read the required existing plan/context and apply the request-mode, ownership, native and next-action HIGH guards before dispatch. Missing required plans block without recreation. Keep the canonical content/path, original baseline and prior logs; do not reset iteration or status just to choose a route.

| Status          | Terminal dispatch                                                                                                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `draft`         | **EARLY EXIT** → `{{ rendered("step-02-plan.md") }}`                                                                                                                                                                |
| `ready-for-dev` | **EARLY EXIT** → {% if workflow.route == "oneshot" %}`{{ rendered("step-oneshot.md") }}`{% else %}`{{ rendered("step-03-implement.md") }}`{% endif %}                                                               |
| `in-progress`   | **EARLY EXIT** → {% if workflow.route == "oneshot" %}`{{ rendered("step-oneshot.md") }}`{% else %}`{{ rendered("step-03-implement.md") }}`{% endif %}                                                               |
| `in-review`     | **EARLY EXIT** → `{{ rendered("step-04-review.md") }}`                                                                                                                                                              |
| `built`         | Revalidate current scope and evidence; **EARLY EXIT** → `{{ rendered("step-04-review.md") }}` for fresh required review, never reimplementation.                                                                    |
| `done`          | **EARLY EXIT** → `{{ rendered("step-05-present.md") }}` for evidence/authority revalidation and truthful terminal reporting, never new planning or implementation. New scope requires a separate actual delegation. |
| `blocked`       | **HALT** dependent execution; report only the privacy-safe blocking category, not raw stored reason/result dumps.                                                                                                   |
| `dropped`       | **HALT** dependent execution; preserve the dropped plan.                                                                                                                                                            |

The review and presentation targets are included even on pinned oneshot. Their required-review/verification and publication negatives still apply; an available target or prior status is not successful evidence or authority.

### Ticket resolution

This runs on the output of `tickets.py find` for one ticket. Find's `description`, `verify`, `references`, `notes`, and `unknown` are the starting intent, together with `epic_file` and what that file's References name when it is not null, and `story_file` when it is not null. Never write to a ticket file, and never run `pull` or `mark`.

- When the file at find's `plan` exists on disk, apply **Canonical state/evidence selection** before testing status or fallback, then **Existing-state dispatch**, exactly as for an explicit plan. Genuinely absent status continues with canonical reuse; never restart implementation for a review/terminal state.
- If that plan is genuinely required for explicit full/resume or existing state, but missing, block dependent execution without recreation; preserve ticket state and continue independent safe analysis.
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
     - List `{{ config.output_folder }}/{active_initiative}/` only when an active initiative is known and that directory exists, then `{{ config.output_folder }}/` only when it exists. Absent directories are empty existing context; never create directories or placeholder plans merely to scan.
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
   - Only an actual recorded human **Split** decision authorizes deferring the selected goals and narrowing scope. Preserve the canonical human plan's body/path, baseline and append-only logs. Before persistence, resolve the real paths of the repository root, canonical plan when associated, and deferred destination (including existing parents). Require repository containment, reject traversal/symlink escapes/private components, and normalize an associated plan to a privacy-safe repository-relative `source_plan`, never `{plan_file}` verbatim. Use the literal string `none` only when genuinely unassociated with a canonical plan; never to hide an unsafe association. If either reference is unsafe, retain evidence in non-persisted context only without narrowing scope or leaking it. Never persist raw paths, private identifiers or hashes of them in any field, or copy/relocate the human plan to manufacture a safe reference.

     Only after those checks, parse the ENTIRE existing `{{ config.output_folder }}/{active_initiative}/deferred-work.md` document and preserve all prior entries unchanged. An absent document may be initialized only for actual authorized deferred goals. Build the WHOLE candidate document with exactly one `deferred` list; append each real new entry with all four string fields (`id`, `source_plan`, `summary`, `evidence`). Allocate an `id` unique across preserved and new entries; do not deduplicate goals or fabricate task data. Serialize ALL free text as data using complete JSON valid as YAML, never interpolation, a bare YAML-body snippet, duplicate keys or a second deferred list. This complete object is illustrative only, not real evidence:

     ```json
     {
       "deferred": [
         {
           "id": "deferred-001",
           "source_plan": "none",
           "summary": "Secondary goal selected for later work.",
           "evidence": "Recorded human scope decision selected this unassociated goal for deferral."
         }
       ]
     }
     ```

     Parse and round-trip the WHOLE serialized candidate before publication; validate one deferred list, all four fields, unique ids, exact intended privacy-safe values/source-plan association and unchanged prior entries. Recheck realpath containment and that the destination/contents have not changed concurrently, then atomically publish the whole document. Parse, round-trip, validation, privacy or concurrent-change failure means zero file/scope changes; retain the reason in current context. Only successful authorized persistence permits the selected scope narrowing; continue routing.

   - If the user chooses **Keep all goals**: Proceed as-is.

5. Set the plan file.

   Reuse the existing active canonical plan first, including an unformatted user plan; keep its human intent and location, recording workflow state/evidence in existing context when needed. HF references it, not a second implementation original. Only choose a new BMAD plan path when a plan is actually needed and none is reusable. Do not create an Issue/board to support it.

   If a canonical plan was selected, reapply **Canonical state/evidence selection** and dispatch any recorded status before NEXT; only genuinely absent recorded status continues to NEXT with that same path. Slug derivation and new-path assignment below apply only otherwise.

   Derive a valid kebab-case slug from the current intent. If the intent references a tracking identifier (story number, issue number, ticket ID), lead the slug with it (e.g. `3-2-digest-delivery`, `gh-47-fix-auth`). If `{{ config.output_folder }}/{active_initiative}/plan-{slug}.md` already exists, determine whether it is this task's canonical plan before selecting a new path. For the same task, apply **Canonical state/evidence selection** and dispatch recorded status; genuinely absent status reuses it as ordinary intent. Uncertain association blocks dependent work, not a guessed successor. Only a demonstrably unrelated collision permits `-2`, `-3`, etc. Set `plan_file` to a new path only when no canonical plan is reusable and a new BMAD plan is genuinely needed.

## NEXT

Read fully and follow `{{ rendered("step-02-plan.md") }}`
