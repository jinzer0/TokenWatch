# PR Creation Commands and Link Guide

## Purpose

This document defines the `publish/task{number}` push, `gh pr create` commands, and PR body document link rules used for internal task PRs.

Internal task PR body structure follows [`internal_pr_guide.md`](internal_pr_guide.md).

## Authorization Boundary

root/nearest-child `AGENTS.md` Risk-Based Execution Policy와 native phase/tool permission을 우선한다. 검증된 reviewed task-owned 변경의 commit/push는 기존 standing 위임을 사용하고 명확한 변경 요청에는 같은 task PR 생성/갱신이 포함된다. 조회·계획·보고 또는 PR body 준비만 요청한 것은 구현/push/PR 권한이 아니다. plan/done status나 다른 task의 과거 승인을 새 권한으로 해석하지 않는다.

publication 직전에 현재 검증·scope/ownership·정확한 repo/remote/base/head와 기존 task PR를 확인한다. exact filename allowlist만 stage/commit하고 clean은 task-owned pending changes 기준이다. unrelated dirty/untracked는 포함하거나 정리하지 않는다. 검증 실패/unmet AC·미위임 remote·read-only/planning-only/report-only·permission-blocked publication은 실행하지 않고 해당 한계만 기록하며 독립 safe 작업은 계속한다.

Issue 작업은 `local/task{number}` -> `publish/task{number}`, Issue 없는 작업은 `local/{task_slug}` -> `publish/{task_slug}`를 사용하고 가짜 Issue를 만들지 않는다. base는 `main`; `main -> main` 또는 중복 PR는 만들지 않는다. 실제 대상/불가분 ownership이 불명확하면 그 행동만 확인한다. HIGH는 위험 행동 직전/재개에 한정 targets/actions/impact/recovery_conditions·실제 승인 evidence를 확인하고 같은 조건만 재사용한다. Merge/Release·formal review/comment·Issue close·tag·미위임 삭제/cleanup은 자동 PR 위임에 포함되지 않는다.

## PR Creation Command

위 검증·위임·permission을 충족하면 대응 publication branch에 push하고 기존 PR가 없는 경우만 생성한다. 아래 번호는 실제 Issue가 있는 작업의 예이며 같은 scope의 push/PR를 반복 승인받지 않는다.

```bash
git checkout local/task24
git push origin local/task24:publish/task24
gh pr create \
  --base main \
  --head publish/task24 \
  --title "Task #24: standardize PR template and PR creation rules" \
  --template .github/pull_request_template.md
```

Use `--template` only as the starting point for the PR body.

When the PR body has been finalized from the final report and stage reports, prefer `--body-file`.

```bash
gh pr create \
  --base main \
  --head publish/task24 \
  --title "Task #24: standardize PR template and PR creation rules" \
  --body-file /tmp/task24-pr-body.md
```

Operating standards:

- Starting from the template: `--template .github/pull_request_template.md`
- Finalized from reports: prefer `--body-file <written PR body file>`
- Do not use `--fill` as the default because it creates a body only from commit messages.
- Avoid putting a long body directly in `--body`; it is harder to reuse and review.

## PR Body Document Link Rules

When linking plans, stage reports, final reports, or troubleshooting documents in the PR body, prefer commit SHA-pinned GitHub blob URLs that remain valid after merge.

Use the PR head commit SHA from `git rev-parse HEAD` just before PR creation.

```text
https://github.com/jinzer0/TokenWatch/blob/{sha}/mydocs/...
```

This keeps links valid after the `publish/task{number}` branch is deleted.

## Work Document Link Format

In `Changes`, write work document links as `[filename](URL)` instead of raw URLs.

```md
- Task plan: [task_m010_61.md](https://github.com/jinzer0/TokenWatch/blob/{sha}/mydocs/plans/task_m010_61.md)
- Canonical plan: [task_m010_61_impl.md](https://github.com/jinzer0/TokenWatch/blob/{sha}/mydocs/plans/task_m010_61_impl.md) (기존 `_impl`가 실제 canonical인 경우만; 별도 원본을 요구하지 않음)
- Final report: [task_m010_61_report.md](https://github.com/jinzer0/TokenWatch/blob/{sha}/mydocs/report/task_m010_61_report.md)
```

In Stage summaries, link the Stage title to the stage report and the short commit SHA next to it to the commit URL.

필요한 실제 문서/stage만 링크한다. LOW/context 작업에 계획·보고·Issue를 강제하거나 존재하지 않는 링크를 만들지 않는다. 비공개 native context의 raw path/session 자료는 PR에 노출하지 않는다.

```md
- **[Stage 1](https://github.com/jinzer0/TokenWatch/blob/{sha}/mydocs/working/task_m010_61_stage1.md)** ([abc1234](https://github.com/jinzer0/TokenWatch/commit/{stage1_sha})): {Stage 1 one-line summary}
```

## Prohibited

- Relative links in PR bodies
- `blob/publish/task{number}/...` links
- Exposing raw URLs as document links
- Using `--fill` as the default PR body creation method

These patterns reduce readability and make links harder to use after merge.
