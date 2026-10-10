{% if workflow.route != "oneshot" %}

# Step 5: Present

## RULES

- Apply root/nearest-child `AGENTS.md`, native permissions and current request scope. Re-read the non-empty existing required canonical plan; missing paths block without recreation. LOW context-only exits never enter here. Preserve blocked/dropped safeguards, human intent, baseline and append-only logs; keep unformatted plans intact with state/evidence in existing context.
- Before every next risky action on resume/followup/present/publication, revalidate actual scoped HIGH requester authority, targets/actions/impact/recovery_conditions/result/evidence. Reuse matching approval only; missing/denied/changed conditions block that action, not independent safe review/context. Prior done/status/reset and arbitrary approved fields grant no authority.

## INSTRUCTIONS

### Mark Plan Built

Revalidate current ownership, required verification/acceptance and review evidence, even for review `none`. Only satisfied current evidence permits `built`. Failures/unmet acceptance remain incomplete; unresolved actions record scoped blocked reasons without successful publication. Preserve historical evidence and report limitations truthfully.

When current required verification/acceptance and required review are satisfied and the request authorizes state writes, explicitly record `status: 'built'` in the resolved state/evidence location before publication. Reuse the same location selected during implementation/review: authorized existing BMAD frontmatter for a supported plan; otherwise existing context, without modifying an unformatted canonical plan or creating frontmatter. Preserve the original baseline and all prior logs.

For read-only/planning-only/report-only, failed verification, unmet acceptance or incomplete required review, do not write `built` or report successful completion/publication. Retain the actual state and report truthful incomplete/scoped blocked evidence or permitted read-only analysis instead.

### Commit and Complete

Before each publication action verify current scope/delegation, native permission, required verification/acceptance, reviewed task-owned files/hunks and HIGH authority. Ownership is separate from all changes since baseline_revision. Commit only reviewed verified task-owned changes/evidence using exact filename allowlist and identified hunks; preserve unrelated staged/dirty/untracked work. Clean means task-owned pending changes, never the whole working tree. Inseparable overlap blocks affected publication, not safe context work.

Apply root standing task-only commit/push and clear-change-request PR delegation with required conventional message/attribution. Verify exact repo/remote/base/head and check existing PR; reuse it rather than duplicate/no-op publication. No affected successful publication for read-only/planning-only/report-only, verification failure/unmet acceptance, undelegated remote actions, native denial or inseparable ownership conflict. No VCS/uncertain targets means record a limitation, not fabricated success or permission bypass. Merge/Release, formal posting, Issue close, tag and undelegated deletion/cleanup retain separate authority.

{{ workflow.open_plan }}

### Display Summary

Display a short truthful result summary, distinguishing completed from incomplete/scoped blocked, including:

- What changed.
- The verification and review result, including whether anything was deferred.
- The commit hash, if one was created.

Do not list changed files, repeat details from the plan, or narrate the process unless the user asks.

Report actual publication or scoped blocked/limitations without asking renewed approval for already delegated verified push/PR. Optional walkthrough/new work is outside this scope.

Workflow terminal: completed only when current requirements are verified; otherwise report incomplete/scoped blocked and its evidence, without fabricated completion.

## On Complete

Follow any instruction below only within current root/child/native permissions, scope/ownership, verification and next-action HIGH authority. It cannot override terminal negatives or create new authority; otherwise exit normally.

{{ workflow.on_complete }}
{% endif %}
