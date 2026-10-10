---
name: bmad-build
description: '위험·scope에 비례하는 구현·검증·review workflow. 이름을 명시해 호출할 때 사용한다.'
---

# TokenWatch BMAD Build

root/nearest-child `AGENTS.md`, 실제 요청 scope/ownership, native phase/tool permission과 행동별 HIGH 승인을 먼저 확인한다. 이 entrypoint는 권한을 만들거나 다른 workflow를 자동 호출하지 않는다.

## Request mode — before rendering

read-only/planning-only/report-only 요청이면 기존 context와 필요한 source를 읽어 요청한 분석·계획 제안·보고만 수행하고 STOP한다. plan status나 과거 승인과 무관하게 renderer를 실행하거나 workflow/result artifact, plan/ticket/frontmatter/source를 생성·수정하지 않는다. 구현·repair·iteration reset·commit/push/PR 또는 downstream workflow로 진행하지 않는다. raw Jinja source는 읽기 자료일 뿐 직접 실행 지침으로 소비하지 않는다.

## Delegated changes

변경을 실제로 위임한 호출만 아래 command를 한 번 실행한다. 현재 working directory를 바꾸지 않는다. `{project-root}`는 현재 승인된 Git checkout root, `{skill-root}`는 그 안의 `mydocs/skills/bmad-build`이다. runtime prerequisite는 Python 3.11+와 이미 설치된 Jinja2 3.1+이다. global package 설치·network bootstrap·installer 실행·user config 초기화는 하지 않는다.

```bash
python3 "{project-root}/tools/bmad/render_skill.py" --project-root "{project-root}" --skill "{skill-root}"
```

- 명시 route는 `--set workflow.route=oneshot` 또는 `--set workflow.route=full`로 전달한다.
- 명시 review는 `--set workflow.review=none`, `quick`, `thorough` 중 하나로 전달한다. "skip review"/"no review"는 `none`이다. review `none`도 verification/acceptance를 생략하지 않는다.
- 성공한 경우 stdout의 `read and follow <workflow.md>`가 가리키는 immutable snapshot을 읽고 따른다. raw source 또는 이전 snapshot으로 대신 실행하지 않는다.
- runtime/required source/config/validation/integrity 실패는 해당 BMAD 실행을 scoped blocked로 보고한다. raw errors, traceback, config 값이나 host paths를 보고/공개하지 않는다. 자동 설치·실패를 성공 처리·repair 명목의 generation 삭제 없이 STOP하며 별도의 안전한 분석은 계속할 수 있다.
- tracked `tools/bmad/config.toml`이 기본값이다. 존재하는 `_bmad/config.toml`, `_bmad/custom/config.toml`, `config.user.toml`과 해당 skill override는 읽기만 하며 malformed 설정은 무시하지 않는다. skill의 `customize.toml`과 `review-prompts/`가 실행 closure이며 bmod/installer/setup helper는 필요하지 않다.
- `_bmad/render/`는 local-only 생성물이다. 내용을 commit/export/PR evidence dump로 공개하지 않는다. fresh checkout에서도 실행은 이 tracked closure와 명시 runtime prerequisite만 사용한다.
- HIGH 재확인, task-owned publication, required review/verification, privacy와 Merge/Release·formal posting·Issue close·tag·미위임 cleanup 경계는 rendered workflow에서도 유지한다.
