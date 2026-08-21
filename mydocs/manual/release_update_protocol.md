# Release and Update Protocol Guide

This document defines GitHub Release/tag criteria, release PRs, and the update protocol for repositories that already adopted Hyper-Waterfall. General task branch operation follows `git_workflow_guide.md`.

## Upstream Release Source

Read the selected Hyper-Waterfall GitHub Release/tag through a verified temporary checkout or release source root named `<hyper-waterfall-release-dir>`. Upstream `templates/` and `docs/` paths below are relative to that directory; TokenWatch retains only its local `.hyper-waterfall/version.json` record.

## Canonical Distribution Baseline

The canonical distribution unit for the Hyper-Waterfall methodology is a GitHub Release/tag. TokenWatch uses `main` for both base and release branches, so release-promotion PRs are inapplicable; separately approved tags are the release baseline. Already adopted repositories update based on `<hyper-waterfall-release-dir>/templates/manifest.json` and `<hyper-waterfall-release-dir>/docs/migrations/`.

Prompts, npm CLI, plugins, and Homebrew are only channels that make the release/tag baseline easier to execute or discover. They do not replace the canonical baseline.

## Release Readiness Checks

When evaluating the selected upstream release, confirm:

- `frameworkVersion`, `plannedTag`, and `baselineTag` in `<hyper-waterfall-release-dir>/templates/manifest.json` match release intent.
- checksums can be finalized from `pending-release` during release packaging.
- `<hyper-waterfall-release-dir>/docs/migrations/v{from}-to-v{to}.md` includes added files, modified files, manual review, conflict risk, and verification criteria.
- `.hyper-waterfall/version.json` in adopted repositories can record or preserve the target version and selected locale.

## PR Type Separation

Normal task PRs, release PRs, and Hyper-Waterfall version update PRs have different purposes.

| Type                              | Purpose                                                                                                                  | Branch Flow                                    | PR Title                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------ |
| task PR                           | Apply repository feature, documentation, or operations work by Issue                                                     | `local/task{N}` -> `publish/task{N}` -> `main` | `Task #{N}: {task title}`                                                |
| release promotion                 | Inapplicable while the base and release branches are both `main`; create tags only in a separately approved release task | Not applicable                                 | `Release: {version}`                                                     |
| Hyper-Waterfall version update PR | Update an adopted repository from the current version to a target release/tag                                            | `local/task{N}` -> `publish/task{N}` -> `main` | `Task #{N}: Hyper-Waterfall {fromVersion} -> {toVersion} version update` |

Separate normal task PRs from release PRs. Updates for adopted repositories happen after release as separate Hyper-Waterfall version update PRs.

## Release Promotion Exception

TokenWatch uses `main` for both base and release branches. Release-promotion branch steps are inapplicable while both branches are `main`; do not create a `main -> main` PR. Create a release tag only in a separately approved release task.

Before creating a separately approved tag, check the manifest and migration guide again.

```bash
HYPER_WATERFALL_RELEASE_DIR=<hyper-waterfall-release-dir>
ruby -rjson -e 'JSON.parse(File.read(ARGV.fetch(0)))' "$HYPER_WATERFALL_RELEASE_DIR/templates/manifest.json"
grep -nE 'target version|added files|modified files|manual review|conflict risk|verification' "$HYPER_WATERFALL_RELEASE_DIR/docs/migrations/v{from}-to-v{to}.md"
```

Actual tag creation and GitHub Release publication happen in a separately approved release stage.

## Update Protocol

Existing adopted repository updates compare these inputs:

- `.hyper-waterfall/version.json` in the target repository
- `<hyper-waterfall-release-dir>/templates/manifest.json` from the target GitHub Release/tag
- `<hyper-waterfall-release-dir>/docs/migrations/v{from}-to-v{to}.md` from current version to target version
- user modification diff in the target repository
- if the manifest provides `localization`, current locale record in `.hyper-waterfall/version.json`, requested locale or switch request, target release locale support, locale manifest diff, and locale preserve/switch judgment

Report the judgment first using `<hyper-waterfall-release-dir>/docs/lifecycle/update.md`. Do not apply files from the manifest diff to the target repository before approval.

## Hyper-Waterfall Version Update PR

Hyper-Waterfall version update PRs use the same branch flow as normal task PRs. The inputs and PR body differ.

- Input: existing update judgment result, manifest diff, locale manifest diff, locale preserve/switch judgment, migration guide
- Body: reflect `<hyper-waterfall-release-dir>/docs/lifecycle/update_pr.md` into local `.github/pull_request_template.md`
- Tracking: GitHub Issue, task plan, implementation plan, stage reports, final report

Commit message rules, only with explicit current user authorization:

- Single commit: `{type}: Task #{N}: Hyper-Waterfall {fromVersion} -> {toVersion} version update`
- Stage commit: `{type}: Task #{N} Stage {S}: Hyper-Waterfall version update {summary}`
- Final report commit: `{type}: Task #{N}: final report and daily task board completion`
- Use `{type}` from `feat`, `fix`, `docs`, `test`, `build`, or `chore`, and include the TokenWatch attribution body and `Co-authored-by` trailer.

Hyper-Waterfall version update PRs do not use a separate branch prefix because work tracking remains GitHub Issue plus Hyper-Waterfall artifacts. Even when a CLI or automation creates a PR candidate, it must first print the judgment result, receive an approved Issue number, then follow `local/task{N}` -> `publish/task{N}` -> `main`. Preparing a candidate does not authorize a commit, push, or PR creation; each is a separately explicit user-authorized action.

## Related Documents

- `git_workflow_guide.md`: branch flow and maintainer/contributor Git commands.
- `framework_lifecycle_guide.md`: criteria for turning lifecycle judgment into a normal task.
- `<hyper-waterfall-release-dir>/docs/lifecycle/update.md`: existing update judgment result format.
- `<hyper-waterfall-release-dir>/docs/lifecycle/update_pr.md`: update PR body criteria.
- `<hyper-waterfall-release-dir>/docs/migrations/README.md`: migration guide writing rules.
