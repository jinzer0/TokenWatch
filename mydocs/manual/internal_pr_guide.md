# Internal Task PR Writing Guide

## Purpose

내부 task PR body를 정의한다. root/nearest-child `AGENTS.md` Risk-Based Execution Policy·native permission에 따라 검증된 task-owned 변경의 standing commit/push와 명확한 변경 요청의 PR를 처리한다. 조회·계획·보고/PR body 준비만의 요청은 구현/publication 위임이 아니다. Merge/Release·formal review/comment·Issue close·tag·미위임 삭제/cleanup은 별도 권한을 유지한다.

실제 repo/remote/base/head·현재 검증/ownership과 기존 PR를 확인하고 exact filename allowlist만 공개한다. unrelated dirty/untracked는 보존하며 검증 실패/미달·미위임/permission-blocked publication은 실행하지 않는다. Issue 없는 작업은 실제 task slug/context로 추적하며 가짜 번호·계획·stage 산출물을 만들지 않는다.

Branch creation, push, and `gh pr create` commands follow [`pr_command_guide.md`](pr_command_guide.md).

## Basic Principles

- Write the PR body from `.github/pull_request_template.md`.
- 생성하는 PR 제목·본문과 HF 문서는 반드시 한국어로 작성한다. 경로·명령·API 식별자·상태 코드 등 고정 기술 토큰은 유지하며 기존 canonical 사용자 문서는 번역·복제하지 않고 참조한다.
- The template is extended to connect with this repository's Hyper-Waterfall artifacts.
- The PR body is a short compressed version of the final report.
- Link details through Stage report links and work document links in `변경 사항`.

## Section Structure

Internal task PRs use these top-level sections:

- `요약`
- `변경 사항`
  - `### 영향 영역` (optional)
  - `### 작업 문서`
- `핵심 검토 사항`
- `검증`
- `스크린샷`
- `관련 Issue`
- `후속 Issue 제안`
- `잔여 위험`

stage 기반 작업의 `변경 사항`은 실제 timeline과 필요한 `영향 영역`/`작업 문서`를 분리한다. LOW/context 작업은 필요한 변경·검증 요약만 기록하며 없는 stage/report 파일을 만들지 않는다.

Keep `핵심 검토 사항`, `스크린샷`, `후속 Issue 제안`, and `### 영향 영역` only when needed. If they do not apply, delete the whole section or write `없음`.

## Section Writing Rules

`요약`:

- Use at most 4 bullets.
- Include target task, reason for change, what changed, and what reviewers should inspect first.
- Put the Issue directly performed by this PR in `작업 대상`.
- Issue가 없으면 기존 task context의 짧은 식별/scope를 사용한다. 번호를 만들지 않는다.

`변경 사항`:

- 실제 stage가 있으면 timeline을 사용하고 아니면 기존 context의 변경 요약을 사용한다. area table/work document는 필요할 때만 subsection에 둔다.
- For Stage-based work, write one line per Stage.
- Link the Stage title to the stage report, and link the short commit SHA next to it to the commit URL.
- Example: `**[단계 1](stage-url)** ([0cdbae0](commit-url)): 한 줄 요약`

`### 영향 영역` under `변경 사항`:

- Keep only when several areas changed and reviewers need area-specific priority.
- If only 1-2 areas changed, delete this subsection.
- Use at most 5 rows: `영역 / 변경 / 검토 초점`.

`### 작업 문서` under `변경 사항`:

- 존재하는 공개 가능한 **단일 canonical 계획/context와 필요한 final evidence**만 참조한다. 기존 `_impl` canonical은 보존·참조하되 task plan + 별도 implementation 원본을 강제하지 않는다. LOW는 existing context로 충분하며 optional 문서 부재는 실패가 아니다.
- Do not duplicate stage reports here; they are already linked from the Stage timeline.
- Use PR head commit SHA GitHub blob URLs and display them as `[filename](URL)`, not raw URLs.
- 비공개 native 계획/context의 raw path/session 자료·private 설정·가짜 문서 링크를 노출하지 않는다. 실제 공개 문서만 SHA-pinned 링크로 연결한다.

`핵심 검토 사항`:

- Keep only when reviewers must first judge ABI, schema, rendering contracts, algorithm branches, or compatibility.
- Use at most 3 items. Keep each code block to 20 lines or less.

`검증`:

- Include only verification that was actually performed.
- Do not end with a command list. Include result and evidence.
- Use `자동 검증`, `수동·시나리오 검증`, `CI·원격 검증`, and `검증 한계`.
- Automated verification uses a `주제 / 방법 / 결과 / 근거` table.
  - `주제`: which acceptance criterion, risk, or change area was verified.
  - `방법`: command or check method.
  - `결과`: use `OK`, `MISS`, or `SKIP`.
  - `근거`: key output, pass count, or checked condition.
- Manual/scenario verification uses `시나리오 / 확인 절차 / 결과 / 근거`.
- CI/remote verification uses `항목 / 결과 / 근거`, including GitHub Check name, run link, or check time.
- Do not leave unperformed verification in tables. Move it to `검증 한계` or `잔여 위험`.
- Do not paste long logs into the PR body. Link final reports or stage reports instead.
- Delete irrelevant subsections.

`스크린샷`:

- Keep only for visual changes such as UI, Finder, Quick Look, thumbnail, or renderer output.
- Use a `변경 전 / 변경 후` table when there is visual change.
- Do not keep the format without real images or artifacts.

`관련 Issue`:

- Do not list the PR's target task here. List contextual Issues needed to understand the PR.
- Use labels such as 선행 작업, 후속 작업, Epic, upstream, or 참고 PR/Issue.
- Write `없음` if there are none.

`후속 Issue 제안`:

- List candidates that do not already have Issues.
- Write `없음` if there are none.

`잔여 위험`:

- Include verification limitations and operational cautions.
- Write `없음` if there are none.

## Relationship Between PR Body and Final Report

The final report is a long-term retention document. The PR body is a quick review-screen summary.

- Final report:
  - Records full context, Stage results, verification logs, and remaining risks in detail.
- PR body:
  - Compresses only what reviewers need for merge judgment.
  - Links details through Stage links and work document links in `변경 사항`.

## Writing Example

아래는 stage·기존 `_impl` canonical·최종 보고서가 실제 존재하고 공개 가능한 경우의 예시다. 기준 계획·맥락은 하나만 참조하며 원본을 변경하지 않는다. 선택 evidence와 검증 행은 실제 존재·수행한 것만 남기고, 미실행 검증은 한계에 기록한다.

```md
## 요약

- 작업 대상: #22
- 이유: {변경 이유}
- 내용: {핵심 변경}
- 검토 초점: {검토자가 먼저 확인할 내용}

## 변경 사항

- **[단계 1](https://github.com/jinzer0/TokenWatch/blob/{sha}/mydocs/working/task_m050_22_stage1.md)** ([abc1234](https://github.com/jinzer0/TokenWatch/commit/{stage1_sha})): {단계 1 요약}
- **[단계 2](https://github.com/jinzer0/TokenWatch/blob/{sha}/mydocs/working/task_m050_22_stage2.md)** ([def5678](https://github.com/jinzer0/TokenWatch/commit/{stage2_sha})): {단계 2 요약}

### 영향 영역

| 영역     | 변경        | 검토 초점   |
| -------- | ----------- | ----------- |
| {영역 1} | {변경 요약} | {검토 초점} |

### 작업 문서

- 기준 계획·맥락: [task_m050_22_impl.md](https://github.com/jinzer0/TokenWatch/blob/{sha}/mydocs/plans/task_m050_22_impl.md)
- 최종 보고서: [task_m050_22_report.md](https://github.com/jinzer0/TokenWatch/blob/{sha}/mydocs/report/task_m050_22_report.md)

## 검증

### 자동 검증

| 주제      | 방법                                                                     | 결과 | 근거              |
| --------- | ------------------------------------------------------------------------ | ---- | ----------------- |
| 서식 구조 | `grep -n -e '자동 검증' -e '검증 한계' .github/pull_request_template.md` | OK   | 필수 하위 절 확인 |
| 공백      | `git diff --check`                                                       | OK   | 경고 없음         |

### 수동·시나리오 검증

| 시나리오       | 확인 절차                                   | 결과 | 근거             |
| -------------- | ------------------------------------------- | ---- | ---------------- |
| PR 본문 가독성 | 작성한 PR 본문의 자동 검증과 한계 분리 확인 | OK   | PR 본문 미리보기 |

### CI·원격 검증

| 항목          | 결과 | 근거                     |
| ------------- | ---- | ------------------------ |
| GitHub Checks | OK   | 실행 링크 또는 확인 시각 |

### 검증 한계

- {미실행 검증과 이유. 없으면 `없음`.}

## 관련 Issue

- 선행 작업: #17
- 참고: edwardkim/rhwp#385

## 잔여 위험

- {잔여 위험 요약}
```
