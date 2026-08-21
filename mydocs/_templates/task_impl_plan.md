# Implementation Plan Template

This central template is for `mydocs/plans/task_{milestone}_{issue}_impl.md`. The implementation plan turns an approved task plan into concrete Stage artifacts, verification commands, and commit messages.

Task plan: [`task_{milestone}_{issue}.md`](task_{milestone}_{issue}.md)
GitHub Issue: [#{issue}](https://github.com/jinzer0/TokenWatch/issues/{issue})
Milestone: M{milestone}

## Stage Overview

| Stage | Title   | Main Output | Verification             |
| ----- | ------- | ----------- | ------------------------ |
| 1     | {title} | `{path}`    | `{verification summary}` |
| 2     | {title} | `{path}`    | `{verification summary}` |
| 3     | {title} | `{path}`    | `{verification summary}` |

## Commit Authorization and Subject

- An approved implementation plan, Stage, or report does not authorize a commit. Record artifacts and verification first, then stop unless the current user instruction explicitly requests a commit.
- For an authorized commit, select `{type}` from `feat`, `fix`, `docs`, `test`, `build`, or `chore` and preserve the Task/Stage traceability in the semantic subject.
- Every authorized commit command includes the TokenWatch attribution body and `Co-authored-by` trailer.

## Document Location Check

Confirm that the actual Stage artifact locations match the "Document Location Judgment" in the task plan. If no document is created, moved, or edited, write `Not applicable` and explain why.

| File                       | Planned Location in Task Plan | Stage Artifact Path | Match   | Notes                                                        |
| -------------------------- | ----------------------------- | ------------------- | ------- | ------------------------------------------------------------ |
| `{path or not applicable}` | `{path}`                      | `{path}`            | OK/MISS | {if mismatch, approval is required before changing the plan} |

## Stage 1 - {Title}

### Artifacts

New:

- `{path}`

Modified:

- `{path}`

### Changes

- {Specifically describe what will be created or changed.}

### Verification

```bash
{verification command}
git diff --check
```

### Authorized Commit

Only run this after the current user instruction explicitly authorizes the commit. Otherwise, show the intended files and subject, then stop after verification.

```text
{type}: Task #{issue} Stage 1: {summary}
```

```bash
git add {Stage 1 artifact files} mydocs/working/task_{milestone}_{issue}_stage1.md
git commit -m "{type}: Task #{issue} Stage 1: {summary}" \
  -m "Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)" \
  -m "Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>"
```

## Stage 2 - {Title}

### Artifacts

- `{path}`

### Changes

- {Specifically describe what will be created or changed.}

### Verification

```bash
{verification command}
git diff --check
```

### Authorized Commit

Only run this after the current user instruction explicitly authorizes the commit.

```text
{type}: Task #{issue} Stage 2: {summary}
```

```bash
git add {Stage 2 artifact files} mydocs/working/task_{milestone}_{issue}_stage2.md
git commit -m "{type}: Task #{issue} Stage 2: {summary}" \
  -m "Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)" \
  -m "Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>"
```

## Stage 3 - {Title}

### Artifacts

- `{path}`

### Changes

- {Specifically describe what will be created or changed.}

### Verification

```bash
{verification command}
git diff --check
```

### Authorized Commit

Only run this after the current user instruction explicitly authorizes the commit.

```text
{type}: Task #{issue} Stage 3: {summary}
```

```bash
git add {Stage 3 artifact files} mydocs/working/task_{milestone}_{issue}_stage3.md
git commit -m "{type}: Task #{issue} Stage 3: {summary}" \
  -m "Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)" \
  -m "Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>"
```

## Verification

- Run each Stage verification command before writing the stage report.
- Do not treat a Stage as complete when verification fails.
- If the plan must change, update the implementation plan first and get task requester approval.
- If a document location differs from the task plan judgment, update the task plan or implementation plan and get approval before implementing.

## Commits

- Each authorized Stage commit bundles the Stage artifacts with `mydocs/working/task_{milestone}_{issue}_stage{N}.md`.
- Commit messages follow `{type}: Task #{issue} Stage {N}: {summary}` and include the TokenWatch attribution body and trailer.
- Without current explicit commit authorization, record the intended files and subject in the Stage report or handoff, then stop after verification.

## Stage Dependencies

- Stage 2 starts after Stage 1 artifacts are confirmed.
- Stage 3 starts after Stage 2 verification and report approval.

## Risks and Responses

- **{risk name}**: {response}

## Approval Request

- {Ask for approval of Stage split, artifacts, verification commands, and commit messages.}
