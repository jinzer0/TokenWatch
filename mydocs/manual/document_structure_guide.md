# Document Structure and Naming Rules Manual

This manual defines `mydocs/` folder roles, document filename rules, the central document template policy, GitHub platform template boundaries, external contributor PR review folder policy, and Agent Skills location policy. Read it before creating a new document or moving an existing one. Code style, Git branch operation, and task stage workflow are covered by related manuals, not this document. Write all documents in the selected Hyper-Waterfall locale for this repository.

`mydocs/` is not a folder for accumulating arbitrary documents. It is a working memory system that lets a new AI session restore "what should be done now," "what was decided," "how far work progressed," "why that judgment was made," and "what pitfalls existed" by reading the repository.

## Core Terms

- **Document source of truth**: the single document or folder treated as current instead of duplicating the same information in multiple places.
- **Document template source of truth**: local `mydocs/_templates/` defines artifact output formats for TokenWatch. The upstream release source is `<hyper-waterfall-release-dir>/templates/locales/en/mydocs/_templates/` in the selected/pinned Hyper-Waterfall release or verified temporary checkout.
- **GitHub platform template**: `.github/ISSUE_TEMPLATE/` and `.github/pull_request_template.md`, which define the input/body format for GitHub Issues and Pull Requests.
- **Official documentation root**: the target project's official documentation location for users, contributors, external integrators, or distribution channels. Examples include `docs/`, `specs/`, `site/`, `website/`, `adr/`, `book/`, and GitHub Wiki. Hyper-Waterfall does not fix this name.
- **Release manifest**: `<hyper-waterfall-release-dir>/templates/manifest.json`, which defines release files, target paths, update policies, and checksum status. It is not installed in TokenWatch.
- **Applied version/locale record**: `.hyper-waterfall/version.json`, which records the framework version and selected locale used by a repository where Hyper-Waterfall is applied.
- **Actual artifact document**: a document written for a specific date, Issue, PR, or research topic, such as `orders/20260506.md` or `plans/task_m010_3.md`.
- **Internal task**: 요청 scope의 저장소 내부 작업. 필요한 Issue·단일 canonical 계획·stage/final evidence를 연결하되 LOW는 기존 context만으로 처리할 수 있다.
- **External contributor PR**: review work for a Pull Request submitted by an external contributor. It uses a different folder and procedure from internal tasks.
- **Milestone-including filename**: a new document filename such as `task_m010_49.md` that includes both milestone and Issue number.
- **Agent Skills source of truth**: `mydocs/skills/{skill-name}/SKILL.md`, read by Codex and Claude Code.

## Document Filename Rules

실제 Issue의 새 산출물이 필요할 때는 Issue 번호와 milestone을 함께 사용한다. Issue 없는 작업은 root의 task slug/semantic summary와 기존 canonical context 위치를 사용하며 가짜 번호·milestone·dummy plan을 만들지 않는다. 명명 규칙은 문서 생성 의무가 아니다.

- Task plan: `task_{milestone}_{issue_number}.md` (example: `task_m100_7.md`)
- Implementation plan: 기존 `task_{milestone}_{issue_number}_impl.md`는 보존·참조한다. 새 실행 구성은 canonical 계획 안에 두고 별도 `_impl` 원본은 강제하지 않는다.
- Stage report: `task_{milestone}_{issue_number}_stage{N}.md` (example: `task_m100_7_stage1.md`)
- Final report: `task_{milestone}_{issue_number}_report.md` (example: `task_m100_7_report.md`)

Supporting documents should expose topic and date when useful.

- Daily task board: `{yyyymmdd}.md` (example: `20260506.md`)
- Feedback: `{yyyymmdd}_{topic}.md` or `task_{milestone}_{issue_number}_feedback.md`
- Technical research: `{yyyymmdd}_{topic}.md` or `task_{milestone}_{issue_number}_{topic}.md`
- Troubleshooting: `{yyyymmdd}_{topic}.md` or `task_{milestone}_{issue_number}_{topic}.md`
- External PR review documents: `pr_{number}_review.md`, `pr_{number}_review_impl.md`, `pr_{number}_report.md`

Mandatory rules:

- 실제 Issue에 연결되는 새 task 문서는 `task_{milestone}_{issue_number}`를 사용한다. Issue 없는 LOW/MEDIUM의 기존 context를 이 형식으로 변환하지 않는다.
- Milestones are written as `m{number}`, such as `m100` or `m200`.
- Do not create new internal task documents in `task_{issue_number}` format without milestone.
- 기존 사용자 계획·legacy 파일명·역사 보고는 유지한다. 새 Issue 산출물은 milestone 명명을 사용하되 기존 파일을 이동·삭제·복제·강제 변환하지 않는다.
- Do not put template files inside actual artifact folders. Templates live only in `mydocs/_templates/`.

## Folder Roles

| Folder              | Purpose                                            | Notes                                                                                                              |
| ------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `_templates/`       | Document output format templates                   | Source of truth for artifact formats, not task artifacts                                                           |
| `orders/`           | Daily task board                                   | Only `yyyymmdd.md`; detailed analysis goes to `tech/` or `troubleshootings/`; completed rows include `Done: HH:mm` |
| `plans/`            | 필요한 canonical task 계획과 기존 구현 계획        | 기존 활성 계획을 우선 재사용; 새 계획은 BMAD 하나, HF는 참조/context/evidence; `_stage{N}`·`_report`는 두지 않음   |
| `plans/archives/`   | Completed plan archive                             | 이동/cleanup은 실제 위임 범위에서만; merge 자체가 삭제 권한은 아님                                                 |
| `working/`          | Stage reports (`_stage{N}.md`)                     | Do not place final reports here                                                                                    |
| `report/`           | Final reports (`_report.md`) and long-term reports | Final reports must go here                                                                                         |
| `feedback/`         | Task requester feedback and code review comments   | Preserves human judgment the AI cannot invent                                                                      |
| `tech/`             | Technical research and structure/spec analysis     | Reusable evidence, alternative comparison, unofficial drafts                                                       |
| `manual/`           | Operating manuals and guides                       | Hyper-Waterfall procedures, agent rules, repeated work standards                                                   |
| `troubleshootings/` | Troubleshooting and recurrence prevention          | Records resolution process and pitfalls                                                                            |
| `pr/`               | External contributor PR review records             | Separate from internal tasks                                                                                       |
| `pr/archives/`      | Archived completed PR review records               |                                                                                                                    |
| `skills/`           | Agent Skills `SKILL.md` source of truth            | `.agents/skills` and `.claude/skills` symlink here                                                                 |

## Official Documentation Root and `mydocs/` Boundary

Hyper-Waterfall does not fix the official documentation root name for the target project. The target project may choose `docs/`, `specs/`, `site/`, `website/`, `adr/`, `book/`, GitHub Wiki, or another location according to its needs. This list is examples, not a default.

Content that may belong in the official documentation root:

- Product documentation referenced directly by users, contributors, or external integrators
- Official contracts that implementation and external users must follow, such as APIs, protocols, DSLs, schemas, or MCP tool contracts
- Public surfaces such as documentation sites, update feeds, or release notes
- Architecture, security, integration, or operations policy documents linked by README as official standards

Content that belongs in `mydocs/`:

- Plans, stage results, and final reports for specific Issues
- Research, alternative comparisons, decision evidence, and drafts not yet formalized
- Task requester feedback and review judgments
- Hyper-Waterfall operating procedures, agent rules, and repeated work standards
- Failure symptoms, causes, resolutions, and recurrence prevention records

Mandatory rules:

- During new Hyper-Waterfall adoption, do not choose or create an official documentation root. If product documentation seems needed outside the manifest, record it as a deferred item or separate task candidate.
- 문서 위치 판단은 기존 canonical 계획/context에 기록한다. 같은 scope의 기존 위치 문서·검증 기록 수정에는 새 plan/location 승인을 요구하지 않는다. 새 공식 root·독자·architecture 또는 실제 scope를 바꾸는 결정만 확인한다.
- The document location judgment must include audience, officialness level, selected path, alternative path, and reason.
- `mydocs/manual/` is not the target project's product documentation location. It contains repeated Hyper-Waterfall operating procedures and standards.
- `mydocs/tech/`는 연구·설계 판단 evidence다. 공식 계약/사용자 문서로 승격하며 공식 root·독자·scope를 바꾸는 경우 그 실질 결정의 위임을 확인한다. 기록 위치 자체를 반복 승인 gate로 만들지 않는다.
- If the target repository already has official documentation root or documentation site rules, inspect those conventions first. Hyper-Waterfall does not create `docs/` as a default.

## Manual Document Neutrality Policy

`mydocs/manual/` documents record long-lived principles, procedures, and judgment standards. Do not accumulate details from a specific Issue, PR, Stage, release, one-time verification, or failure event in manual bodies.

Allowed in manuals:

- Repeated policies and guardrails
- Procedures and check criteria reusable by workers
- Operating standards and responsibility boundaries that require document updates when changed
- Short entrypoints and links for finding subordinate documents or artifacts

Separate out of manuals:

- Analysis, evidence, and completion results for a specific Issue, PR, or Stage
- Detailed release preparation, deployment verification, or release decision records
- Specific migration/update review results and follow-up handoff
- Incident records that need symptoms, reproduction conditions, cause, and recurrence prevention

Separation targets:

| Content                                                    | Location                                         |
| ---------------------------------------------------------- | ------------------------------------------------ |
| Internal task stage results and approval evidence          | `mydocs/working/`                                |
| Internal task final results and long-term reports          | `mydocs/report/`                                 |
| Reusable technical research and design judgment            | `mydocs/tech/`                                   |
| Failure symptoms, causes, fixes, and recurrence prevention | `mydocs/troubleshootings/`                       |
| Upstream release preparation and deployment verification   | `<hyper-waterfall-release-dir>/docs/releases/`   |
| Upstream migration/update judgment criteria                | `<hyper-waterfall-release-dir>/docs/migrations/` |

When a manual needs to reference a specific event document, do not copy the event content. Keep only generalized judgment rules and a short link in the manual; keep detailed context in the artifact document.

## Central Template Policy

필요한 문서의 출력 형식은 `mydocs/_templates/`를 먼저 참조하고 읽을 수 없으면 Skill의 최소 section 요약을 사용한다. template 위치/형식은 별도 계획 생성·승인 gate가 아니다. LOW는 기존 context에 요청·변경·최소 검증·제약을 기록한다. 기존 canonical 계획을 재사용하고 새 계획이 필요하면 BMAD 하나만 작성하며 HF는 context/evidence를 연결한다. 실패/차단도 기록하되 incomplete를 완료/pass로 바꾸지 않는다.

- Upstream release source: `<hyper-waterfall-release-dir>/templates/locales/en/mydocs/_templates/`
- Applied TokenWatch location: `mydocs/_templates/`
- TokenWatch does not retain or symlink the upstream `templates/` source tree.

Central templates:

- Fix expected output shape and output format requirements as file structure.
- Specify desired output format and constraints so literal instruction following stays stable.
- Prevent the model from inventing a document structure every time.
- Keep section meaning stable when documents are reused as the next session prompt.

Mandatory rules:

- Do not place template files inside artifact folders.
- `orders/`, `plans/`, `working/`, `report/`, `feedback/`, `tech/`, `troubleshootings/`, and `pr/` contain only actual artifacts.
- Template filenames or first headings must make it clear that they are templates.
- When a template changes, review the related Skill template references and the README document structure description.

## GitHub Platform Template Policy

GitHub Issues and Pull Requests are GitHub platform artifacts, not `mydocs/` artifacts. Manage their formats under `.github/`, not `mydocs/_templates/`.

- Upstream Issue Form source: `<hyper-waterfall-release-dir>/templates/locales/en/.github/ISSUE_TEMPLATE/task.yml`
- Applied repository location: `.github/ISSUE_TEMPLATE/task.yml`
- Upstream PR body source: `<hyper-waterfall-release-dir>/templates/locales/en/.github/pull_request_template.md`
- Applied repository PR body location: `.github/pull_request_template.md`

Role boundaries:

- `.github/ISSUE_TEMPLATE/task.yml` structures background, goals, included scope, excluded scope, acceptance criteria, verification criteria, references, and metadata so a GitHub Issue can become the first prompt for the next task.
- `.github/pull_request_template.md` defines the review-screen summary format for changes, verification, and remaining risks after the final report.
- `mydocs/_templates/` defines formats for repository-retained artifacts such as task plans, implementation plans, stage reports, final reports, feedback, technical notes, troubleshooting, and external PR review documents.

Mandatory rules:

- Do not put the GitHub Issue Form in `mydocs/_templates/`.
- `task-register` should use `.github/ISSUE_TEMPLATE/task.yml` first when creating Issue bodies, and use Skill fallback sections only when the file cannot be read.
- When `.github/ISSUE_TEMPLATE/task.yml` changes, review the `task-register` Skill, README prompt guide explanation, and this manual's role boundaries.

## Release Manifest and Version Record Policy

The canonical distribution unit for Hyper-Waterfall is a GitHub Release/tag. Prompts are only user interfaces for starting installation or update. Actual file application is based on `<hyper-waterfall-release-dir>/templates/manifest.json`, the local version record, and upstream migration guide from the selected release or verified temporary checkout.

- Manifest source of truth: `<hyper-waterfall-release-dir>/templates/manifest.json`
- Applied repository version/locale record: `.hyper-waterfall/version.json`
- Upstream migration guide location: `<hyper-waterfall-release-dir>/docs/migrations/`

Lifecycle judgment details are covered by the following documents:

| Topic                                             | Source of Truth                                             |
| ------------------------------------------------- | ----------------------------------------------------------- |
| New adoption procedure and judgment result format | `<hyper-waterfall-release-dir>/docs/lifecycle/adoption.md`  |
| Existing repository update judgment               | `<hyper-waterfall-release-dir>/docs/lifecycle/update.md`    |
| Hyper-Waterfall version update PR transition      | `<hyper-waterfall-release-dir>/docs/lifecycle/update_pr.md` |
| Release/tag and update protocol                   | [`release_update_protocol.md`](release_update_protocol.md)  |

`<hyper-waterfall-release-dir>/templates/manifest.json`:

- Lists framework files included in a release and their target paths.
- Identifies update target areas such as `AGENTS.md`, `CLAUDE.md`, `.github/`, `mydocs/_templates/`, `mydocs/manual/`, and `mydocs/skills/`.
- Expresses each entry's update policy as `overwrite`, `merge`, `manual`, `preserve`, or `symlink`.
- May keep checksums as `pending-release` before release packaging, then finalize them when the actual tag/release is created.

Update policy meanings:

- `overwrite`: replace only when the target file still matches the previous manifest checksum; treat user modification as conflict.
- `merge`: use for user-visible and commonly customized rule/template files; prefer patch and review over automatic overwrite.
- `manual`: require maintainer judgment with a migration guide.
- `preserve`: create when missing, but do not change existing content without explicit approval.
- `symlink`: verify links such as `.agents/skills -> ../mydocs/skills` and `.claude/skills -> ../mydocs/skills`.

`.hyper-waterfall/version.json` is not a work artifact. Do not place it under `mydocs/`. It records which Hyper-Waterfall release and locale the target repository installed and when it was last updated. Lifecycle judgment reads this file and compares the current version, current locale, target release manifest, and migration guide.

New adoption uses strict manifest mode. Allowed targets are manifest `files[]` targets, `.hyper-waterfall/version.json`, and manifest-defined symlinks. Do not create or modify files outside the manifest during adoption. Target-project-specific artifacts such as product code, product docs, architecture docs, roadmap, API contracts, examples, and schemas are deferred task candidates, not adoption side effects.

Hyper-Waterfall version update PRs are also GitHub platform artifacts, so do not create a separate document template for them in `mydocs/_templates/`. Use `.github/pull_request_template.md` for the PR body, and reflect manifest diff and migration guide evidence in the `Summary`, `Changes`, `Verification`, `Verification limits`, and `Remaining risks` sections.

Lifecycle 판단 결과는 적용 전 보고 형식이지 `mydocs/` 장기 template가 아니다. 실제 적용의 승인/adoption 경계는 유지하며, 적용 작업 추적은 root 위험 정책에 따라 기존 canonical 계획/context와 필요한 Issue·stage/final evidence·PR 형식으로 비례 구성한다. 별도 구현 계획 원본이나 과거 파일의 소급 변환을 강제하지 않는다.

Mandatory rules:

- When a selected upstream release changes `<hyper-waterfall-release-dir>/templates/manifest.json`, review the applicable update judgment and migration guides together.
- `.hyper-waterfall/version.json` is a local state file in TokenWatch; do not mix it with document artifact templates.
- Do not mark highly user-customizable files as unconditional `overwrite` in the manifest.
- When upstream `<hyper-waterfall-release-dir>/docs/agent-entrypoint.md` installation/update explanations change, review the selected manifest, migration guides, `framework_lifecycle_guide.md`, and `release_update_protocol.md` explanations together.

## External Contributor PR Review Policy

External contributor PR review uses `mydocs/pr/`, not the internal task folders.

- Initial review: `mydocs/pr/pr_{number}_review.md`
- Optional review implementation/verification plan: `mydocs/pr/pr_{number}_review_impl.md`
- Final report: `mydocs/pr/pr_{number}_report.md`
- Archive after completion: `mydocs/pr/archives/`

내부 task는 필요한 Issue/stage 또는 기존 context로 추적한다. 외부 review는 PR 기반이며 내부 stage/final 형식을 강제하지 않는다. 안전한 local 분석·verification-plan 작성은 remote 게시가 아니며 같은 scope에서 진행한다. untrusted code 실행·formal review/comment 게시·merge/close는 실제 별도 권한과 안전 조건을 확인한다. 내부 후속 작업은 scope에 따라 context/canonical 계획에 연결하며 새 Issue가 필요하면 생성 위임을 확인한다.

## Agent Skills Location Policy

Agent Skills are stored in `mydocs/skills/{skill-name}/SKILL.md`.

`bmad-build`와 `bmad-build-auto`도 이 위치의 추적된 entrypoint로 발견한다. Git-only checkout은 `tools/bmad/render_skill.py`, `config_utils.py`, `config.toml`과 각 skill의 `customize.toml`, `review-prompts/`를 사용한다. Python 3.11+·설치된 Jinja2 3.1+는 명시 runtime prerequisite이며 uv/installer/setup/bmod 또는 machine-local artifact는 필요하지 않다. 자동 dependency 설치나 설정 초기화는 하지 않는다. root/child/native와 실제 요청 권한은 entrypoint에서도 우선하며 read-only/planning-only/report-only는 renderer 전에 종료한다.

tracked `[core]` 기본 설정 위에 존재하는 `_bmad/config.toml`, `_bmad/custom/config.toml`, `config.user.toml`과 skill override를 읽기만 한다. malformed 설정은 차단하며 무시·덮어쓰지 않는다. `_bmad/render/`는 local-only immutable 생성물로 Git/PR/export에서 제외한다. static source 검증은 default CI에서, 실제 entry command·render matrix·strict 실패/기존 설정 보존 검증은 `corepack pnpm exec vitest run --config vitest.approval-render.config.ts`로 명시 실행한다. 이 검증은 renderer/entry 실행과 지침 계약을 증명하며 LLM의 실제 모든 분기 준수나 native 승인 강제를 증명하지 않는다.

독립 실행 범위는 직접 위임한 intent·기존 canonical 계획의 oneshot/full 및 review 분기다. 큰 ticket-tree engine은 포함하지 않는 선택 capability다. 명시 ticket 요청은 실제 helper/runtime/native 권한이 없으면 해당 ticket resolution만 scoped blocked로 기록하며 ticket·prerequisite를 꾸미거나 설치하지 않는다. 일반/no-intent 흐름은 ticket capability 부재로 중단하지 않고 안전한 기존 context·필요한 intent 확인으로 진행한다. 없는 artifact 폴더는 빈 context로 취급하며 scan을 위해 dummy 폴더/계획을 만들지 않는다.

- Source of truth: `mydocs/skills/`
- Codex discovery path: `.agents/skills -> mydocs/skills`
- Claude Code discovery path: `.claude/skills -> mydocs/skills`
- Both symlinks are committed to git with mode `120000`.
- Skill bodies should be tool-independent (`gh`, `git`, file creation), and tool-specific invocation differences should live only in the "Invocation" section at the end of `SKILL.md`.
- When a Skill writes a plan, report, or review document, it should first consult the corresponding template under `mydocs/_templates/`.

Do not edit the symlink targets casually. If a Skill is added, removed, renamed, or its call timing changes, review README's core Skill table and `task_workflow_guide.md` Skill call display guidance in the same PR.

## Related Manuals

- [`task_workflow_guide.md`](task_workflow_guide.md): Issue-based task flow, approval gates, reports, and PR publication.
- [`git_workflow_guide.md`](git_workflow_guide.md): branch naming, remote publication, merge, and cleanup.
- [`pr_process_guide.md`](pr_process_guide.md): PR handling entrypoint.
- [`release_update_protocol.md`](release_update_protocol.md): release/tag and update protocol.
- [`agent_code_hyperfall_rule_conflict.md`](agent_code_hyperfall_rule_conflict.md): conflicts between agent defaults and Hyper-Waterfall rules.
