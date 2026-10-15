---
name: task-register
description: |
  Register a new task that does not yet have a GitHub Issue in the Hyper-Waterfall workflow.
  Query open milestones and existing labels, choose candidates,
  confirm with the task requester before creating the Issue, then create the GitHub Issue number.
  Issue 등록이 필요한 명시 요청에만 사용한다. 승인된 생성 후에는 기존 scope의 task-start로 추가 승인 대기 없이 연결한다.
---

# Hyper-Waterfall Issue Registration

## Trigger

- The task requester explicitly asks to register an Issue, create a new task, or start from an Issue.
- The task requester invokes this SKILL directly.

## Preconditions

- root/nearest-child `AGENTS.md` Risk-Based Execution Policy와 native permission을 우선한다. 명확한 LOW 요청은 existing context로 처리할 수 있으며 이 등록 절차를 강제하지 않는다.
- The work does not yet have an Issue number.
- Purpose, background, and scope are at least drafted.
- `gh` CLI is authenticated for the current user.
- 저장소 소유 한국어 `.github/ISSUE_TEMPLATE/task.yml`을 읽는다. 읽을 수 없으면 아래 한국어 섹션 목록을 사용하며 upstream locale 선택·설치·네트워크 조회에 의존하지 않는다.
- Before creating the Issue, the title, body, milestone, and label draft can be confirmed with the task requester.

## Procedure

1. Check for duplicate Issues.

   ```bash
   gh issue list --repo jinzer0/TokenWatch --state all \
     --search "{work keywords}" \
     --limit 20 \
     --json number,title,state,milestone,labels,url
   ```

   - If a substantially identical open Issue exists, do not create a new one. Ask whether to use the existing Issue.
   - If a closed Issue covered the same topic, link it in the new Issue references.

2. Check open milestones.

   ```bash
   gh api repos/jinzer0/TokenWatch/milestones \
     --jq '.[] | {number,title,state,description,open_issues,closed_issues}'
   ```

   - Judge from the live `title`, `state`, and `description`.
   - Do not rely on remembered old milestone lists or version mappings.

3. Check existing labels.

   ```bash
   gh api repos/jinzer0/TokenWatch/labels --paginate \
     --jq '.[] | {name,description,color}'
   ```

   - Judge from live `name` and `description`.
   - Do not rely on remembered old label lists.

4. Choose milestone candidates.
   - Use only open milestones.
   - Compare work purpose, scope, component, and release phase with the milestone `title` and `description`.
   - If one candidate is clear, record its title and reason.
   - If 2-3 candidates are possible, present them with reasons and ask the task requester.
   - If no open milestone fits or descriptions are insufficient, ask the task requester instead of guessing.
5. Choose label candidates.
   - Use only existing labels from the live lookup.
   - Select a label only when the work clearly matches the label `name` and `description`.
   - Prefer 1 type label, 1-2 area labels, and 0-1 kind/status label.
   - Type labels include `bug`, `documentation`, `enhancement`, `duplicate`, or `question`.
   - Area labels are selected by primary work ownership, not every affected area.
   - Kind labels such as `kind:architecture`, `kind:automation`, `kind:regression`, `kind:verification`, or `kind:follow-up` are used only when they meaningfully distinguish handling.
   - General Issues should usually have 2-4 labels.
   - If 5 or more labels are needed, write the exception reason in the draft and confirm it with the task requester.
   - If candidates are clear, record label names and reasons.
   - If no label fits or the fit is ambiguous, create without labels or ask the task requester.
   - Do not create new labels.
6. Draft the Issue.
   - Write the Issue title and body in Korean. Keep fixed technical tokens such as labels, file paths, branch names, command names, and code identifiers unchanged where needed.
   - Title: `작업: ` 접두사와 작업 단위를 드러내는 한국어 한 문장.
   - Body: prefer GitHub Issue Form `.github/ISSUE_TEMPLATE/task.yml`.
     - 저장소 소유 한국어 서식만 사용한다. `gh issue create`는 Issue Form UI를 실행하지 않으므로 필드의 한국어 항목명을 Markdown 제목으로 변환한다. 고정 field ID/type/required 값은 바꾸지 않는다.
   - Issue Form sections:
     - 배경
     - 목표
     - 범위 - 포함
     - 범위 - 제외
     - 인수 기준
     - 검증 기준
     - 참고 자료
     - 마일스톤 및 라벨 후보
     - 확인 사항
   - Issue Form을 읽을 수 없으면 위 한국어 섹션 목록을 fallback으로 사용한다. 확인 사항에는 실제 확인한 중복·제외 범위·위험 승인 경계만 기록하며 영어 upstream 서식으로 대체하지 않는다.
   - Milestone: one open milestone chosen from live lookup and the selection reason.
   - Labels: approved existing labels and reasons, or none.
   - Split label reasons by type/area/kind, and include the exception reason if using 5 or more labels.
7. Request approval before creating the Issue.
   - 제목·본문·마일스톤·라벨·선택 이유와 생성 승인 요청을 한국어로 제시한다. 고정 라벨명·명령·경로·식별자는 유지한다.
   - Do not run `gh issue create` until the task requester explicitly approves creation in the same thread.
8. After approval, create the Issue.

   ```bash
   gh issue create --repo jinzer0/TokenWatch \
     --title "{title}" \
     --body "{body}" \
     --milestone "{milestone}" \
     --label "{label}"
   ```

   - Repeat `--label` for multiple labels, such as `--label documentation --label enhancement`.
   - Omit `--label` when creating without labels.

9. Confirm the created Issue.
   ```bash
   gh issue view {N} --repo jinzer0/TokenWatch \
     --json number,title,state,milestone,labels,url
   ```
10. 생성한 Issue 번호/URL과 scope·선택 근거를 기록하고 `task-start`에 연결한다. 같은 scope의 branch/필요 보드/기존 canonical 계획 또는 context/구현·검증·repair·stage는 다시 승인받지 않는다. 필요한 새 계획은 BMAD 하나만 만들고 HF는 참조/evidence를 연결한다. read-only/planning-only 등록 요청 자체를 implementation/publication 권한으로 확대하지 않는다. HIGH는 다음 위험 행동 직전 및 재개에서 한정 승인 조건을 확인한다.

## Verification

- The created Issue is `OPEN`.
- The milestone is not empty and was an open milestone from live lookup.
- Labels are only approved existing labels.
- General Issue labels are usually in the recommended 2-4 range.
- If 5 or more labels were used, the approved exception reason is included in the report.
- `area:*` labels are selected by primary work ownership.
- The Issue body fills the required inputs corresponding to `.github/ISSUE_TEMPLATE/task.yml`.
- 생성 보고는 한국어 제목·항목명으로 Issue 번호, URL, 마일스톤, 라벨, 선택 이유를 포함한다. 고정 기술 토큰과 상태값은 유지한다.

## Never Do

- Run `gh issue create` without task requester approval.
- Create a new milestone or label.
- Arbitrarily use a closed milestone.
- LOW 작업에 Issue/보드/계획을 강제하거나 승인된 등록 뒤 같은 scope의 start를 반복 승인 대기로 막는다.
- 등록 승인을 HIGH 위험 행동·Merge/Release·formal posting·Issue close·tag·미위임 삭제/cleanup 권한으로 확대한다.
- Create branches, update the daily task board, or write the task plan inside this Skill.

## Invocation

- Codex: `$task-register` or select `task-register` from the `/skills` menu
- Claude Code: `/task-register`
