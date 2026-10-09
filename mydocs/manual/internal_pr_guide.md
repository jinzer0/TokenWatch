# Internal Task PR Writing Guide

## Purpose

내부 task PR body를 정의한다. root/nearest-child `AGENTS.md` Risk-Based Execution Policy·native permission에 따라 검증된 task-owned 변경의 standing commit/push와 명확한 변경 요청의 PR를 처리한다. 조회·계획·보고/PR body 준비만의 요청은 구현/publication 위임이 아니다. Merge/Release·formal review/comment·Issue close·tag·미위임 삭제/cleanup은 별도 권한을 유지한다.

실제 repo/remote/base/head·현재 검증/ownership과 기존 PR를 확인하고 exact filename allowlist만 공개한다. unrelated dirty/untracked는 보존하며 검증 실패/미달·미위임/permission-blocked publication은 실행하지 않는다. Issue 없는 작업은 실제 task slug/context로 추적하며 가짜 번호·계획·stage 산출물을 만들지 않는다.

Branch creation, push, and `gh pr create` commands follow [`pr_command_guide.md`](pr_command_guide.md).

## Basic Principles

- Write the PR body from `.github/pull_request_template.md`.
- The template is extended to connect with this repository's Hyper-Waterfall artifacts.
- The PR body is a short compressed version of the final report.
- Link details through Stage report links and work document links in `Changes`.

## Section Structure

Internal task PRs use these top-level sections:

- `Summary`
- `Changes`
  - `### Impact Areas` (optional)
  - `### Work Documents`
- `Key Review Points`
- `Verification`
- `Screenshots`
- `Related Issues`
- `Proposed Follow-up Issues`
- `Remaining Risks`

stage 기반 작업의 `Changes`는 실제 timeline과 필요한 `Impact Areas`/`Work Documents`를 분리한다. LOW/context 작업은 필요한 변경·검증 요약만 기록하며 없는 stage/report 파일을 만들지 않는다.

Keep `Key Review Points`, `Screenshots`, `Proposed Follow-up Issues`, and `### Impact Areas` only when needed. If they do not apply, delete the whole section or write `None`.

## Section Writing Rules

`Summary`:

- Use at most 4 bullets.
- Include target task, reason for change, what changed, and what reviewers should inspect first.
- Put the Issue directly performed by this PR in `Target task`.
- Issue가 없으면 기존 task context의 짧은 식별/scope를 사용한다. 번호를 만들지 않는다.

`Changes`:

- 실제 stage가 있으면 timeline을 사용하고 아니면 기존 context의 변경 요약을 사용한다. area table/work document는 필요할 때만 subsection에 둔다.
- For Stage-based work, write one line per Stage.
- Link the Stage title to the stage report, and link the short commit SHA next to it to the commit URL.
- Example: `**[Stage 1](stage-url)** ([0cdbae0](commit-url)): one-line summary`

`### Impact Areas` under `Changes`:

- Keep only when several areas changed and reviewers need area-specific priority.
- If only 1-2 areas changed, delete this subsection.
- Use at most 5 rows: `Area / Change / Review Focus`.

`### Work Documents` under `Changes`:

- 존재하는 공개 가능한 **단일 canonical 계획/context와 필요한 final evidence**만 참조한다. 기존 `_impl` canonical은 보존·참조하되 task plan + 별도 implementation 원본을 강제하지 않는다. LOW는 existing context로 충분하며 optional 문서 부재는 실패가 아니다.
- Do not duplicate stage reports here; they are already linked from the Stage timeline.
- Use PR head commit SHA GitHub blob URLs and display them as `[filename](URL)`, not raw URLs.
- 비공개 native 계획/context의 raw path/session 자료·private 설정·가짜 문서 링크를 노출하지 않는다. 실제 공개 문서만 SHA-pinned 링크로 연결한다.

`Key Review Points`:

- Keep only when reviewers must first judge ABI, schema, rendering contracts, algorithm branches, or compatibility.
- Use at most 3 items. Keep each code block to 20 lines or less.

`Verification`:

- Include only verification that was actually performed.
- Do not end with a command list. Include result and evidence.
- Use `Automated Verification`, `Manual/Scenario Verification`, `CI/Remote Verification`, and `Verification Limitations`.
- Automated verification uses a `Topic / Method / Result / Evidence` table.
  - `Topic`: which acceptance criterion, risk, or change area was verified.
  - `Method`: command or check method.
  - `Result`: use `OK`, `MISS`, or `SKIP`.
  - `Evidence`: key output, pass count, or checked condition.
- Manual/scenario verification uses `Scenario / Check Procedure / Result / Evidence`.
- CI/remote verification uses `Item / Result / Evidence`, including GitHub Check name, run link, or check time.
- Do not leave unperformed verification in tables. Move it to `Verification Limitations` or `Remaining Risks`.
- Do not paste long logs into the PR body. Link final reports or stage reports instead.
- Delete irrelevant subsections.

`Screenshots`:

- Keep only for visual changes such as UI, Finder, Quick Look, thumbnail, or renderer output.
- Use a Before/After table when there is visual change.
- Do not keep the format without real images or artifacts.

`Related Issues`:

- Do not list the PR's target task here. List contextual Issues needed to understand the PR.
- Use labels such as prerequisite, follow-up, Epic, upstream, or reference PR/Issue.
- Write `None` if there are none.

`Proposed Follow-up Issues`:

- List candidates that do not already have Issues.
- Write `None` if there are none.

`Remaining Risks`:

- Include verification limitations and operational cautions.
- Write `None` if there are none.

## Relationship Between PR Body and Final Report

The final report is a long-term retention document. The PR body is a quick review-screen summary.

- Final report:
  - Records full context, Stage results, verification logs, and remaining risks in detail.
- PR body:
  - Compresses only what reviewers need for merge judgment.
  - Links details through Stage links and work document links in `Changes`.

## Writing Example

```md
## Summary

- Target task: #22
- Why: {reason}
- What: {core change}
- Review focus: {what reviewers should inspect first}

## Changes

- **[Stage 1](https://github.com/jinzer0/TokenWatch/blob/{sha}/mydocs/working/task_m050_22_stage1.md)** ([abc1234](https://github.com/jinzer0/TokenWatch/commit/{stage1_sha})): {Stage 1 summary}
- **[Stage 2](https://github.com/jinzer0/TokenWatch/blob/{sha}/mydocs/working/task_m050_22_stage2.md)** ([def5678](https://github.com/jinzer0/TokenWatch/commit/{stage2_sha})): {Stage 2 summary}

### Impact Areas

| Area     | Change           | Review Focus   |
| -------- | ---------------- | -------------- |
| {area 1} | {change summary} | {review focus} |

### Work Documents

- Task plan: [task_m050_22.md](https://github.com/jinzer0/TokenWatch/blob/{sha}/mydocs/plans/task_m050_22.md)
- Implementation plan: [task_m050_22_impl.md](https://github.com/jinzer0/TokenWatch/blob/{sha}/mydocs/plans/task_m050_22_impl.md)
- Final report: [task_m050_22_report.md](https://github.com/jinzer0/TokenWatch/blob/{sha}/mydocs/report/task_m050_22_report.md)

## Verification

### Automated Verification

| Topic              | Method                            | Result                                                      | Evidence    |
| ------------------ | --------------------------------- | ----------------------------------------------------------- | ----------- | -------------------------- |
| Template structure | `grep -nE 'Automated Verification | Verification Limitations' .github/pull_request_template.md` | OK          | Required subsections found |
| whitespace         | `git diff --check`                | OK                                                          | No warnings |

### Manual/Scenario Verification

| Scenario            | Check Procedure                                                              | Result | Evidence        |
| ------------------- | ---------------------------------------------------------------------------- | ------ | --------------- |
| PR body readability | Confirm the drafted PR body separates automated verification and limitations | OK     | PR body preview |

### CI/Remote Verification

| Item          | Result | Evidence               |
| ------------- | ------ | ---------------------- |
| GitHub Checks | OK     | run link or check time |

### Verification Limitations

- {unperformed verification and reason. Write `None` if none.}

## Related Issues

- Prerequisite: #17
- Reference: edwardkim/rhwp#385

## Remaining Risks

- {remaining risk summary}
```
