## Summary

<!-- Keep this to at most 4 bullets.
- What target task does this PR address?
- Why was the change made?
- What changed?
- What should reviewers inspect first?
root/nearest-child AGENTS.md Risk-Based Execution Policy·native permission을 우선한다.
body 준비만으로 implementation/publication 권한을 만들지 않는다.
검증된 task-owned standing commit/push와 명확한 변경 요청의 PR만 처리하며 실패/미위임/permission-blocked publication은 실행하지 않는다.
Merge/Release·formal posting·Issue close·tag·미위임 삭제/cleanup 권한은 별도다.
-->

- Target task: {실제 Issue 번호 또는 기존 task context/scope; 가짜 번호를 만들지 않음}
- Why:
- What:
- Review focus:

## Changes

<!--
For Stage-based work, write one line per Stage.
Link each Stage title to the stage report and each short commit SHA to the commit URL.
Example: **[Stage 1](stage-url)** ([0cdbae0](commit-url)): one-line summary
실제 필요한 stage/context만 기록한다. LOW에는 Issue/board/plan/모든 stage report를 강제하지 않는다.
-->

- {실제 stage/context 변경 요약; 존재하는 공개 evidence/commit만 링크}

### Impact Areas

<!-- Keep this only when several areas changed and reviewers need area-specific priority.
If only 1-2 areas changed, delete this subsection. Maximum 5 rows. -->

| Area | Change | Review Focus |
| ---- | ------ | ------------ |
|      |        |              |

### Work Documents

<!--
Just before creating the PR, run `git rev-parse HEAD` and use GitHub blob URLs pinned to the PR head commit SHA.
Use `[filename](https://github.com/jinzer0/TokenWatch/blob/{head_sha}/mydocs/...)` instead of raw URLs.
Delete entries that do not apply.
기존 단일 canonical 계획과 필요한 공개 evidence만 링크한다. 기존 _impl canonical은 그대로 참조하되 별도 implementation 원본을 강제하지 않는다.
비공개 native context의 raw path/session 자료나 가짜 문서 링크는 공개하지 않는다.
-->

- Canonical plan/context: {존재하는 공개 가능 문서의 SHA-pinned filename link 또는 해당 없음}
- Final report: [task*m{milestone}*{issue}\_report.md](https://github.com/jinzer0/TokenWatch/blob/{head_sha}/mydocs/report/task_m{milestone}_{issue}_report.md)

## Key Review Points

<!-- Keep only when needed. Maximum 3 items. Limit each code block to 20 lines or less. Delete the section if it does not apply. -->

-

## Verification

<!--
Keep only verification that was actually performed.
Do not list commands alone. Include topic, method, result, and evidence.
Do not include long logs. Summarize key output, pass counts, and checked conditions.
Move unperformed verification to `Verification Limitations` or `Remaining Risks` instead of leaving it in the table.
Delete subsections that do not apply.
-->

### Automated Verification

| Topic | Method    | Result  | Evidence                        |
| ----- | --------- | ------- | ------------------------------- |
|       | `command` | OK/MISS | Key output or checked condition |

### Manual/Scenario Verification

| Scenario | Check Procedure | Result  | Evidence                                  |
| -------- | --------------- | ------- | ----------------------------------------- |
|          |                 | OK/MISS | Screenshot, video, artifact link, or none |

### CI/Remote Verification

| Item | Result       | Evidence                                   |
| ---- | ------------ | ------------------------------------------ |
|      | OK/MISS/SKIP | GitHub Check name, run link, or check time |

### Verification Limitations

- None

## Screenshots

<!-- Keep only for visual changes. Do not keep the table without real images or artifacts. Delete the section if it does not apply. -->

| Before | After |
| ------ | ----- |
|        |       |

## Related Issues

<!-- Do not list the target task here. List only context needed to understand the PR, such as prerequisite, follow-up, Epic, upstream, or reference Issues/PRs. Write "None" if there are none. -->

-

## Proposed Follow-up Issues

<!-- List follow-up candidates that do not already have Issues. Write "None" if there are none. -->

-

## Remaining Risks

<!-- List verification limitations or operational cautions reviewers should know. Write "None" if there are none. -->

-
