import { lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// AC01–12 source contracts, not a risk evaluator or evidence of native enforcement.
const root = fileURLToPath(new URL('../', import.meta.url));
const bmadFiles = {
  'bmad-build': [
    'workflow.md',
    'step-01-clarify-and-route.md',
    'step-02-plan.md',
    'step-03-implement.md',
    'step-04-review.md',
    'step-05-present.md',
    'step-oneshot.md',
    'plan-template.md'
  ],
  'bmad-build-auto': [
    'workflow.md',
    'step-01-clarify-and-route.md',
    'step-02-plan.md',
    'step-03-implement.md',
    'step-04-review.md',
    'plan-template.md'
  ]
} as const;
const hfFiles = [
  'mydocs/manual/task_workflow_guide.md',
  'mydocs/manual/agent_code_hyperfall_rule_conflict.md',
  'mydocs/manual/document_structure_guide.md',
  'mydocs/manual/git_workflow_guide.md',
  'mydocs/skills/task-register/SKILL.md',
  'mydocs/skills/task-start/SKILL.md',
  'mydocs/skills/task-stage-report/SKILL.md',
  'mydocs/skills/task-final-report/SKILL.md',
  'mydocs/_templates/README.md',
  'mydocs/_templates/task_plan.md',
  'mydocs/_templates/task_impl_plan.md',
  'mydocs/_templates/stage_report.md',
  'mydocs/_templates/final_report.md'
] as const;
const publicationFiles = [
  'mydocs/manual/pr_process_guide.md',
  'mydocs/manual/internal_pr_guide.md',
  'mydocs/manual/pr_command_guide.md',
  'mydocs/skills/external-pr-review/SKILL.md',
  '.github/pull_request_template.md'
] as const;
const consumerGuides = [
  'mydocs/manual/external_pr_review_guide.md',
  'mydocs/plans/README.md',
  'mydocs/working/README.md',
  'mydocs/pr/README.md',
  'mydocs/_templates/external_pr_review.md',
  'mydocs/_templates/external_pr_review_impl.md'
] as const;
const deliveryPaths = Object.entries(bmadFiles).flatMap(([skill, files]) =>
  files.map((file) => `mydocs/skills/${skill}/${file}`)
);
const runtimePaths = [
  'tools/bmad/render_skill.py',
  'tools/bmad/config_utils.py',
  'tools/bmad/config.toml',
  ...Object.keys(bmadFiles).flatMap((skill) => [
    `mydocs/skills/${skill}/SKILL.md`,
    `mydocs/skills/${skill}/customize.toml`,
    `mydocs/skills/${skill}/review-prompts/edge-case-hunter.md`,
    `mydocs/skills/${skill}/review-prompts/verification-gap.md`
  ])
];
// Static delivery checks include the explicitly adopted runtime closure;
// default CI never executes Python or imports the separate renderer suite.
const inputMap = [
  'AGENTS.md',
  ...hfFiles,
  ...publicationFiles,
  ...consumerGuides,
  ...deliveryPaths,
  ...runtimePaths
];
function read(path: string): string {
  try {
    return readFileSync(resolve(root, path), 'utf8');
  } catch {
    throw new Error(`Required policy delivery source unavailable: ${path}`);
  }
}
function has(text: string, pattern: RegExp, label: string): void {
  expect(pattern.test(text), label).toBe(true);
}
function lacks(text: string, pattern: RegExp, label: string): void {
  expect(pattern.test(text), label).toBe(false);
}
function requiredReviewerBoundary(text: string, label: string): void {
  const unavailable =
    text.match(/^If a required reviewer capability is unavailable,[^\n]+/m)?.[0] ?? '';
  for (const pattern of [
    /affected lens and missing capability.*scoped blocked\/limitation.*existing context/i,
    /preserving the canonical\/unformatted plan and prior evidence/i,
    /Continue independent safe work and await all available launched reviewers before handling their results/i,
    /Do not create prompt artifacts, inline private context or file contents for export, request cross-session transfer, or fabricate reviewer results/i,
    /no successful completion or publication until the required review is done/i,
    /Native permissions, current authority and task-owned boundaries still apply/i,
    /review `none` never waives required verification or acceptance/i
  ])
    has(unavailable, pattern, `${label}: unavailable reviewer ${pattern.source}`);
  lacks(
    text,
    /write[^\n]*(?:beside|full prompt)|separate session|paste back|replaced inline by that file's contents/i,
    `${label}: no obsolete prompt artifact or cross-session export fallback`
  );
  has(
    text,
    /launch[\s\S]*await (?:for )?all results before triage/i,
    `${label}: available native launch/await preserved`
  );
}
function section(text: string, heading: string): string {
  const level = heading.match(/^#+/)?.[0].length;
  expect(level !== undefined, `Required Markdown heading: ${heading}`).toBe(true);
  let start = -1;
  let offset = 0;
  for (const line of text.split('\n')) {
    if (line === heading) {
      start = offset;
      break;
    }
    offset += line.length + 1;
  }
  expect(start >= 0, `Required section: ${heading}`).toBe(true);
  const remainder = text.slice(start + heading.length);
  const next = remainder.match(new RegExp(`\n#{1,${level}}[ \\t]+[^\n]+`));
  const end = next?.index === undefined ? undefined : start + heading.length + next.index;
  return text.slice(start, end);
}
const obsoleteGates = [
  /\*\*ALWAYS(?:\*\*)?\s+(?:WAIT|HALT)/i,
  /HALT on a dirty tree/i,
  /require a clean working tree/i,
  /Verify the version-controlled working copy is clean/i,
  /finalization left repository dirty/i,
  /Do not run (?:them|subagents) in the background/i,
  /or any entry whose fix edits agent-context files|or fixes that would edit CLAUDE\.md, AGENTS\.md/i,
  /Same as patch, but the smallest fix is not that simple\. Stop and ask/i,
  /If token count exceeded 1600[^\n]*(?:HALT|wait (?:for|until)[^\n]*approv|stop (?:for|until)[^\n]*approv)/i,
  /HALT and give the user a choice:[\s\S]{0,800}Approve and continue/i,
  /3\s*(?:[–~-]|to)\s*6\s*(?:개\s*)?(?:stages|단계)/i,
  /all source code changes require (?:explicit )?(?:user|human) approval/i,
  /(?:소스|계획|단계|stage)\s*(?:수정|전환|시작)?\s*(?:전|마다)\s*(?:반드시|항상)\s*(?:사용자\s*)?승인/i,
  /(?:source|plan|stage) (?:changes?|transitions?) (?:always )?require (?:user|human) approval/i
];
function authority(text: string, label: string): void {
  for (const key of ['targets', 'actions', 'impact', 'recovery_conditions']) {
    has(text, new RegExp(key), `${label}: bounded HIGH ${key}`);
  }
  has(text, /missing|absent|미승인/, `${label}: absent HIGH`);
  has(text, /denied|거절/, `${label}: denied HIGH`);
  has(text, /reuse|reusable|재사용/i, `${label}: matching resume`);
  has(text, /changed|변경|바뀐/i, `${label}: changed decision revalidation`);
  has(
    text,
    /independent safe|safe independent|safe 작업|독립 안전|안전 독립/i,
    `${label}: safe work continues`
  );
  has(text, /block|차단|실행하지/i, `${label}: missing/denied actions do not execute`);
  has(text, /result|결과/i, `${label}: approval result`);
  has(text, /evidence|근거/i, `${label}: authority evidence`);
}
function terminal(text: string, label: string): void {
  for (const pattern of [
    /task-owned|task-only/i,
    /exact filename/i,
    /pending/i,
    /unrelated/i,
    /read-only/i,
    /planning-only/i,
    /verification|검증/i,
    /fail|실패|미달/i,
    /native|permission/i,
    /remote/i,
    /base/i,
    /head/i,
    /(?:existing|previous)[\s-]+(?:task[\s-]+)?PR\b|기존 PR/i,
    /commit/i,
    /push/i,
    /Merge\/?Release|Merge\/Release/i,
    /formal/i,
    /Issue close/i,
    /tag/i,
    /cleanup/i
  ]) {
    has(text, pattern, `${label}: terminal ${pattern.source}`);
  }
}

const permission = `Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;
const normalize = (text: string): string => text.replace(/\s+/g, ' ').trim();

describe('risk-based approval delivery source contracts (not native enforcement)', () => {
  it('P1 discovers both standalone skills without an installer or implicit bootstrap', () => {
    for (const platform of ['.agents/skills', '.claude/skills']) {
      expect(lstatSync(resolve(root, platform)).isSymbolicLink()).toBe(true);
      expect(readlinkSync(resolve(root, platform))).toBe('../mydocs/skills');
    }
    for (const skill of Object.keys(bmadFiles)) {
      const text = read(`mydocs/skills/${skill}/SKILL.md`);
      has(text, new RegExp(`^name: ${skill}$`, 'm'), `${skill}: discoverable metadata`);
      has(
        text,
        /python3 "\{project-root\}\/tools\/bmad\/render_skill\.py"/,
        `${skill}: tracked entry command`
      );
      has(
        text,
        /read-only\/planning-only\/report-only[\s\S]*STOP/,
        `${skill}: request mode before preparation writes`
      );
      expect(text.indexOf('## Request mode') < text.indexOf('## Delegated changes')).toBe(true);
      lacks(
        text,
        /npx skills add|uv run|_bmad\/scripts\/render_skill|run.*setup/,
        `${skill}: no installer runtime`
      );
      has(
        text,
        /raw Jinja source[^\n]*직접 실행 지침으로 소비하지 않는다/,
        `${skill}: no source execution fallback`
      );
      const defaults = read(`mydocs/skills/${skill}/customize.toml`);
      lacks(
        defaults,
        /finding floor|find at least N|sole source of truth|do not stop with an empty list/,
        `${skill}: no authority override or fabricated quota`
      );
      has(
        defaults,
        /unformatted plan never needs new frontmatter/,
        `${skill}: actual handoff canonical boundary`
      );
      const workflow = read(`mydocs/skills/${skill}/workflow.md`);
      lacks(
        workflow,
        /resolve_config\.py|nearest folder containing `_bmad\/`|uv run/,
        `${skill}: no implicit activation helper`
      );
      has(
        workflow,
        /config\.core\.active_initiative/,
        `${skill}: tracked central config consumption`
      );
      const edge = read(`mydocs/skills/${skill}/review-prompts/edge-case-hunter.md`);
      const gap = read(`mydocs/skills/${skill}/review-prompts/verification-gap.md`);
      lacks(edge, /references\//, `${skill}: claims/deletion dependencies are embedded`);
      lacks(
        gap,
        /triage trusts|does not re-verify|tests are useless on static source/i,
        `${skill}: current evidence, not trusted labels`
      );
    }
    const renderer = read('tools/bmad/render_skill.py');
    lacks(
      renderer,
      /setup_check|report_owed_setup/,
      'standalone renderer never bootstraps installer'
    );
    has(read('tools/bmad/config_utils.py'), /config\.toml/, 'tracked central defaults');
    has(read('.gitignore'), /_bmad\/render\//, 'private generations cannot enter publication');
  });

  it('AC01/12 reads the explicit delivery map without installer prerequisites', () => {
    expect(deliveryPaths).toHaveLength(14);
    for (const path of inputMap) {
      expect(read(path).trim().length > 0, `${path}: delivered source`).toBe(true);
      expect(path.startsWith('_bmad/'), `${path}: not an installer input`).toBe(false);
    }
    const config = read('vitest.config.ts');
    has(
      config,
      /include:\s*\['tests\/\*\*\/\*\.test\.ts', 'tests\/\*\*\/\*\.test\.tsx'\]/,
      'unchanged default discovery'
    );
    lacks(
      config,
      /approvalPolicyRender|approval-render|render_skill|child_process/,
      'default has no opt-in connection'
    );
    const optInConfig = read('vitest.approval-render.config.ts');
    const selected = optInConfig.match(/include:\s*\[([^\]]+)\]/)?.[1];
    const optInPaths = [...(selected ?? '').matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]);
    expect(optInPaths, 'exact separate opt-in selection').toEqual([
      'tests/approvalPolicyRender.optin.ts'
    ]);
    const defaultInclude = config.match(/include:\s*\[([^\]]+)\]/)?.[1];
    const defaultGlobs = [...(defaultInclude ?? '').matchAll(/['"]([^'"]+)['"]/g)].map(
      (match) => match[1]
    );
    expect(defaultGlobs, 'actual default include list').toEqual([
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx'
    ]);
    for (const path of optInPaths) {
      expect(
        read(path).trim().length > 0,
        'selected opt-in source exists without importing it'
      ).toBe(true);
      for (const glob of defaultGlobs) {
        // Match these asserted default glob shapes against the selected real path.
        const pattern = glob
          .split('**/')
          .map((part) =>
            part
              .split('*')
              .map((literal) => literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
              .join('[^/]*')
          )
          .join('(?:.*/)?');
        expect(
          new RegExp(`^${pattern}$`).test(path),
          `${glob}: excludes selected opt-in source`
        ).toBe(false);
      }
    }
    const self = read('tests/approvalPolicy.test.ts');
    lacks(
      self,
      /(?:from\s+|import\s*\()['"][^'"]*(?:approvalPolicyRender|child_process|render_skill)/,
      'default never imports renderer or opt-in'
    );
    lacks(
      self,
      /\b(?:spawnSync|execSync|spawn|execFile|execFileSync)\s*\(/,
      'default never spawns'
    );
  });

  it('AC02–08 root delegates LOW/MEDIUM, bounded HIGH, canonical reuse and verified publication', () => {
    const policy = section(read('AGENTS.md'), '### Risk-Based Execution Policy');
    lacks(policy, /^### Naming Rules$/m, 'root policy excludes its sibling Naming Rules');
    for (const token of [
      'LOW',
      'MEDIUM',
      'HIGH',
      'context',
      'canonical',
      'BMAD',
      'HF',
      'incomplete'
    ]) {
      has(policy, new RegExp(token), `root: ${token}`);
    }
    authority(policy, 'root');
    terminal(policy, 'root');
    has(
      policy,
      /파일\/줄\/token\/stage 수·복잡성[^\n]*승인 대기의 근거가 아니다/,
      'size/complexity is not approval authority'
    );
    has(
      policy,
      /plan-required full\/resume[^\n]*missing plan[^\n]*차단/,
      'missing required plan remains blocked'
    );
    has(policy, /system\/developer\/native/, 'native precedence');
    has(policy, /임의 `approved`[^\n]*권한을 만들지 않는다/, 'status cannot manufacture authority');
  });

  for (const path of [...hfFiles, ...deliveryPaths]) {
    it(`AC03/04 rejects legacy unconditional emitters: ${path}`, () => {
      const text = read(path);
      for (const pattern of obsoleteGates) lacks(text, pattern, `${path}: ${pattern.source}`);
    });
  }

  for (const skill of Object.keys(bmadFiles)) {
    const source = (file: string): string => read(`mydocs/skills/${skill}/${file}`);
    it(`AC05/P1 ${skill} routes metadata to existing context for unformatted plans`, () => {
      for (const file of [
        'step-02-plan.md',
        'step-03-implement.md',
        'step-04-review.md',
        ...(skill === 'bmad-build' ? ['step-oneshot.md'] : [])
      ]) {
        const text = source(file);
        const storage = section(text, '### State/evidence location');
        has(
          storage,
          /Only an existing BMAD-format plan with authorized task-owned metadata/i,
          `${skill}/${file}: supported format and authority`
        );
        has(
          storage,
          /Otherwise[\s\S]*unformatted[\s\S]*unchanged[\s\S]*existing context/i,
          `${skill}/${file}: context without conversion`
        );
        has(
          storage,
          /all state\/evidence reads and writes/i,
          `${skill}/${file}: same storage on resume`
        );
        has(
          storage,
          /baseline_revision[\s\S]*status[\s\S]*review[\s\S]*notes/i,
          `${skill}/${file}: all metadata consumers`
        );
        lacks(
          text,
          /Capture `baseline_revision`[^\n]*into `\{plan_file\}` frontmatter/i,
          `${skill}/${file}: no unconditional baseline write`
        );
        lacks(
          text,
          /Change `\{plan_file\}` status to[^\n]*frontmatter/i,
          `${skill}/${file}: no unconditional status write`
        );
        lacks(
          text,
          /^Write [^\n]*to `\{plan_file\}` frontmatter/m,
          `${skill}/${file}: no unconditional review write`
        );
      }
    });

    it(`D01/P1 ${skill} stops non-mutating resumes before status routing`, () => {
      const step = source('step-01-clarify-and-route.md');
      const start = step.indexOf('## Request-mode guard');
      const routing = step.indexOf('## Intent check');
      expect(start >= 0 && routing > start, `${skill}: terminal guard before routing`).toBe(true);
      const guard = step.slice(start, routing);
      for (const mode of ['read-only', 'planning-only', 'report-only']) {
        has(guard, new RegExp(mode), `${skill}: ${mode} stops before resume`);
      }
      for (const status of [
        'draft',
        'ready-for-dev',
        'in-progress',
        'in-review',
        'built',
        'done',
        'blocked',
        'dropped'
      ]) {
        has(guard, new RegExp(`\`${status}\``), `${skill}: ${status} grants no mode override`);
      }
      has(
        guard,
        /Do not write or create a plan, frontmatter, ticket, source/i,
        `${skill}: no writes`
      );
      has(guard, /do not reset iteration|do not[^\n]*reset iteration/i, `${skill}: no reset`);
      has(guard, /STOP this workflow here/i, `${skill}: terminal non-mutating exit`);
      has(guard, /no status-based EARLY EXIT/i, `${skill}: no resume bypass`);
      has(
        guard,
        /Only an invocation that delegates changes may continue/i,
        `${skill}: delegated execution remains`
      );
    });

    it(`AC02/D01 ${skill} has pre-plan LOW entry, verified exit and request-mode negatives`, () => {
      const step = source('step-01-clarify-and-route.md');
      const lowStart = step.search(/(?:###?[^\n]*LOW|\d+\.\s*\*\*LOW)/i);
      const setPlan = step.indexOf('5. Set the plan file');
      expect(lowStart >= 0 && setPlan > lowStart, `${skill}: LOW branch before Set plan file`).toBe(
        true
      );
      const low = step.slice(lowStart, step.indexOf('\n1. Load context', lowStart));
      for (const pattern of [
        /existing.context/i,
        /no existing plan|no plan exists|without.*plan|계획.*없/i,
        /read-only/i,
        /planning-only/i,
        /verif/i,
        /incomplete/i,
        /STOP|never fall through|no fallthrough/i,
        /dummy|placeholder/i
      ]) {
        has(low, pattern, `${skill}: LOW ${pattern.source}`);
      }
      terminal(low, `${skill} LOW exit`);
      has(
        step,
        /(?:(?:plan-required|required plan(?:\/state-based)?)[^\n]*missing|missing[^\n]*required plan)[^\n]*(?:block|HALT)/i,
        `${skill}: required-plan missing execution blocks`
      );
      has(
        step,
        /without recreat|without recreation|never recreat/i,
        `${skill}: required-plan safety cannot be bypassed by recreation`
      );
      authority(step, `${skill} resume`);
      has(
        step,
        /canonical[\s\S]*unformatted|unformatted[\s\S]*canonical/i,
        `${skill}: unformatted reuse`
      );
      has(source('workflow.md'), /LOW[\s\S]*context/i, `${skill}: workflow reaches LOW`);
    });

    it(`AC03/05 ${skill} plan path preserves intent and does not impose size approval`, () => {
      const step = source('step-02-plan.md');
      has(step, /read-only\/planning-only|planning-only\/read-only/i, `${skill}: plan-only stops`);
      has(step, /ready-for-dev/, `${skill}: recorded readiness`);
      has(step, /canonical/i, `${skill}: canonical reuse`);
      has(step, /human.*intent|intent.*human/i, `${skill}: human intent preserved`);
      has(step, /re-read|reread/i, `${skill}: reread before resume`);
      authority(step, `${skill} plan`);
      const template = source('plan-template.md');
      has(template, /AGENTS\.md/, `${skill}: template inherits root`);
      has(template, /canonical/i, `${skill}: template canonical reference`);
      has(template, /task-owned|task-only/i, `${skill}: template ownership`);
    });

    it(`AC04 ${skill} implementation/review retains genuine safety and autonomous same-scope repair`, () => {
      const impl = source('step-03-implement.md');
      has(
        impl,
        /(?:empty|missing)[\s\S]{0,180}HALT|HALT[\s\S]{0,180}(?:empty|missing)/i,
        `${skill}: required plan safety`
      );
      has(impl, /task-owned|task-only/i, `${skill}: owned diff only`);
      const review = source('step-04-review.md');
      has(review, /same-scope|same scope/i, `${skill}: autonomous repair`);
      has(review, /re-run|reverify|re-verify|reverification/i, `${skill}: reverify repairs`);
      has(review, /incomplete|verification failed/i, `${skill}: failures are not success`);
      lacks(review, /Revert code changes\./, `${skill}: no whole-task revert`);
      has(review, /bad_plan/, `${skill}: technical replan remains`);
      authority(review, `${skill} review`);
      if (skill === 'bmad-build') {
        requiredReviewerBoundary(review, 'ordinary full review');
        const classify = section(review, '### Classify');
        const carry = classify.match(/^ {3}If `## Review Triage Log`[^\n]+/m)?.[0] ?? '';
        has(
          carry,
          /Carry a prior verdict and route only when current code and relevant evidence still support them/,
          'carry requires current support'
        );
        has(
          carry,
          /Same location, claim or unchanged code alone is not sufficient/,
          'same-code row is not validation'
        );
        has(
          carry,
          /Stale, missing or irrelevant evidence requires validation/,
          'stale carry is validated'
        );
        has(
          carry,
          /disproved prior verdict must be corrected with current evidence/,
          'obsolete verdict is corrected'
        );
        has(
          carry,
          /Unresolved or unapplied repairs must still be processed through grouping and routing under current scope\/ownership\/authority, then reverified/,
          'carried patch still requires repair and verification'
        );
        has(
          carry,
          /Prior rows never waive required verification or acceptance.*no finding or evidence may be dropped/,
          'carry preserves evidence without exemption'
        );
        const gap =
          classify.match(/^ {3}- For a finding from the verification-gap lens,[^\n]+/m)?.[0] ?? '';
        has(
          gap,
          /filed evidence is current, relevant to the task-owned scope and supports the claimed gap in current code/,
          'gap evidence is checked against current code and scope'
        );
        has(
          gap,
          /Stale, missing or irrelevant evidence requires validation.*lens label alone grants no verification exemption/,
          'gap lens is not trusted without validation'
        );
        has(
          gap,
          /Preserve every finding and its evidence; required verification and acceptance still apply/,
          'gap evidence retained without exemption'
        );
        lacks(
          classify,
          /skip verification|never patch or defer it again|arrives pre-verified|triage trusts the claim as filed/i,
          'no historical or lens verification bypass'
        );
        has(
          section(review, '## NEXT'),
          /incomplete required review keeps state incomplete and blocks dependent terminal\/publication/,
          'full review cannot finalize missing required review'
        );
      }
    });
  }

  it('AC08/11 D10 auto Finalize handles initial and followup publication with all negatives', () => {
    const final = section(read('mydocs/skills/bmad-build-auto/step-04-review.md'), '## Finalize');
    terminal(final, 'auto Finalize');
    has(final, /built/, 'initial built terminal');
    has(final, /done/, 'done followup terminal');
    has(final, /follow.?up/i, 'followup revalidation');
    has(final, /no.change|no.op|no changes|unchanged/i, 'no empty publication');
    has(final, /current|fresh|revalid/i, 'current verification/authority');
    lacks(final, /Do not push\./i, 'standing delegation is not unconditionally blocked');
    lacks(
      final,
      /working copy is clean|repository dirty/i,
      'unrelated dirty is not terminal failure'
    );
    const resume = read('mydocs/skills/bmad-build-auto/step-01-clarify-and-route.md');
    has(resume, /built.*done[\s\S]*fresh review/i, 'built/done routes to fresh review');
    has(resume, /reset|review_loop_iteration/, 'reset does not create authority');
  });

  it('AC08 ordinary oneshot/present apply task-only publication, not offer-only authority', () => {
    for (const file of ['step-oneshot.md', 'step-05-present.md']) {
      const text = read(`mydocs/skills/bmad-build/${file}`);
      terminal(text, file);
      lacks(
        text,
        /Offer next steps in one line: create a PR/i,
        `${file}: delegated publication not deferred`
      );
      lacks(
        text,
        /If git is available and there are uncommitted changes, commit/i,
        `${file}: no arbitrary dirty commit`
      );
      lacks(
        text,
        /Do not push to a remote unless the user asks\./i,
        `${file}: standing publication delegation is preserved`
      );
      if (file === 'step-oneshot.md') {
        requiredReviewerBoundary(text, 'ordinary oneshot review');
        has(
          section(text, '### Finalize Plan'),
          /incomplete required review[^\n]*do not mark built/,
          'oneshot missing reviewer blocks built'
        );
        has(
          section(text, '### Finalize Plan'),
          /Set `status: 'built'` only[^\n]*required review done/,
          'oneshot built requires actual review'
        );
        has(
          section(text, '### Task-Owned Publication'),
          /No affected successful publication[^\n]*incomplete required review/,
          'oneshot missing reviewer blocks publication'
        );
      }
    }
  });

  it('P1 full-route completion records built before publication in format-aware state', () => {
    const text = read('mydocs/skills/bmad-build/step-05-present.md');
    const built = section(text, '### Mark Plan Built');
    has(
      built,
      /explicitly record `status: 'built'` in the resolved state\/evidence location before publication/i,
      'full completion writes actual built state'
    );
    has(
      built,
      /authorized existing BMAD frontmatter[\s\S]*otherwise[\s\S]*existing context/i,
      'built state supports both canonical formats'
    );
    has(
      built,
      /without modifying an unformatted canonical plan/i,
      'built state leaves human plan intact'
    );
    has(
      built,
      /read-only\/planning-only\/report-only[\s\S]*incomplete required review[\s\S]*do not write `built`/i,
      'failed or non-mutating terminal cannot write success'
    );
    expect(text.indexOf('### Mark Plan Built') < text.indexOf('### Commit and Complete')).toBe(
      true
    );
  });

  it('P1 ordinary triage rows and resumed rows share the resolved context location', () => {
    const text = read('mydocs/skills/bmad-build/step-04-review.md');
    const classify = section(text, '### Classify');
    has(
      classify,
      /If `## Review Triage Log` at the resolved state\/evidence location already has rows/,
      'resumed review reads the actual log location'
    );
    has(
      classify,
      /Every finding gets one row in the Review Triage Log at the resolved state\/evidence location/,
      'all findings append in resolved state'
    );
    has(
      classify,
      /unformatted canonical plan[\s\S]*existing context without adding a section or editing the plan/,
      'unformatted log rows cannot alter the human plan'
    );
    lacks(
      classify,
      /Review Triage Log` section of `\{plan_file\}`/,
      'no forced triage section in canonical document'
    );
  });

  it('P1 deferred records require private-safe canonical references before persistence', () => {
    for (const file of ['step-02-plan.md', 'step-04-review.md', 'step-oneshot.md']) {
      const text = read(`mydocs/skills/bmad-build/${file}`);
      lacks(
        text,
        /source_plan\s*:[^\n]*\{plan_file\}/,
        `${file}: never serialize the raw plan path`
      );
      has(
        text,
        /resolve the real paths of the canonical plan(?:,| and) repository root/i,
        `${file}: symlink-aware containment`
      );
      has(
        text,
        /normalize an absolute in-repository plan path to a privacy-safe repository-relative reference/i,
        `${file}: safe absolute-to-relative conversion`
      );
      has(text, /outside the repository|outside-repository/i, `${file}: outside-root case`);
      has(
        text,
        /non-persisted current context only[^\n]*do not write/i,
        `${file}: unsafe references cannot persist`
      );
      has(
        text,
        /Never persist raw paths, private identifiers or hashes of them/i,
        `${file}: no obscured private reference`
      );
      has(
        text,
        /Do not copy or relocate the canonical plan/i,
        `${file}: privacy does not create a second plan`
      );
    }
  });

  it('P1 actual renderer prerequisites never rely on ambient installer state', () => {
    const suite = read('tests/approvalPolicyRender.optin.ts');
    const prerequisite = suite.slice(suite.indexOf('beforeAll('), suite.indexOf('afterAll('));
    expect(prerequisite.length > 0).toBe(true);
    lacks(
      prerequisite,
      /_bmad\/scripts|_bmad\/config\.toml|['"]uv['"]/,
      'Git-only prerequisite closure'
    );
    for (const name of ['render_skill.py', 'config_utils.py', 'config.toml'])
      has(
        prerequisite,
        new RegExp(`tools/bmad/${name.replace('.', '\\.')}`),
        `tracked prerequisite: ${name}`
      );
  });

  it('P1 direct planning and oneshot modes terminate before any mutable branch', () => {
    for (const file of ['step-02-plan.md', 'step-oneshot.md']) {
      const text = read(`mydocs/skills/bmad-build/${file}`);
      const guard = section(text, '### First terminal request-mode guard');
      for (const mode of ['read-only', 'planning-only', 'report-only'])
        expect(guard.includes(mode)).toBe(true);
      has(guard, /STOP/, `${file}: terminal mode`);
      has(
        guard,
        /Do not persist context[^\n]*Finalize[^\n]*publish/,
        `${file}: no mutable fallthrough`
      );
      expect(
        text.indexOf('### First terminal request-mode guard') <
          text.indexOf('### State/evidence location')
      ).toBe(true);
    }
  });

  it('P1 split is human-decided and complete deferred examples parse before persistence', () => {
    const planning = read('mydocs/skills/bmad-build/step-02-plan.md');
    has(planning, /Keep full plan \(default\)/, 'delegated full scope stays default');
    has(
      planning,
      /Only after an actual recorded human intent\/scope decision[^\n]*may you append/,
      'split writes require real human scope decision'
    );
    for (const file of ['step-02-plan.md', 'step-oneshot.md']) {
      const text = read(`mydocs/skills/bmad-build/${file}`);
      const examples = [...text.matchAll(/^[ \t]*```json\n([\s\S]*?)\n[ \t]*```$/gm)];
      expect(examples.length > 0, `${file}: complete serialization example`).toBe(true);
      for (const example of examples) {
        const document = JSON.parse(example[1]) as { deferred: Record<string, unknown>[] };
        expect(Object.keys(document)).toEqual(['deferred']);
        expect(document.deferred).toHaveLength(1);
        expect(Object.keys(document.deferred[0]).sort()).toEqual([
          'evidence',
          'id',
          'source_plan',
          'summary'
        ]);
        for (const value of Object.values(document.deferred[0]))
          expect(typeof value).toBe('string');
        expect(JSON.parse(JSON.stringify(document))).toEqual(document);
      }
      has(
        text,
        /Serialize and parse the WHOLE candidate before any atomic append\/persist/,
        `${file}: validation before mutation`
      );
      has(
        text,
        /On any parse, validation or concurrent-change failure, do not mutate/,
        `${file}: failed candidates preserve prior records`
      );
    }
  });

  it('P1 review completion needs actual successful lanes and marker-free canonical intent', () => {
    for (const skill of Object.keys(bmadFiles)) {
      const text = read(`mydocs/skills/${skill}/step-04-review.md`);
      has(
        text,
        /successful execution\/completion of every applicable required native review lane/,
        `${skill}: all required lanes actually succeed`
      );
      has(
        text,
        /error-only[^\n]*cancelled[^\n]*inconclusive/,
        `${skill}: reported failure is not successful execution`
      );
      has(
        text,
        /otherwise[^\n]*preserved canonical[^\n]*existing context/i,
        `${skill}: no canonical tag requirement`
      );
    }
    has(
      read('mydocs/skills/bmad-build/step-oneshot.md'),
      /otherwise[^\n]*preserved human canonical[^\n]*existing intent context/i,
      'oneshot marker-free intent'
    );
  });

  it('P2 external review consumers keep safe verification autonomous and risky actions gated', () => {
    for (const path of [
      'mydocs/_templates/external_pr_review.md',
      'mydocs/_templates/external_pr_review_impl.md',
      'mydocs/pr/README.md'
    ]) {
      const text = read(path);
      lacks(
        text,
        /after external PR review document approval|If you approve the verification\/auxiliary work scope|If you agree with the review direction[^\n]*proceed to verification|Approval request to task requester/i,
        `${path}: no renewed verification approval`
      );
      has(
        text,
        /같은 scope[^\n]*안전한[^\n]*재승인[^\n]*자율/,
        `${path}: safe same-scope continuation`
      );
      has(
        text,
        /untrusted[^\n]*native[^\n]*별도 위임/,
        `${path}: untrusted execution still bounded`
      );
      has(
        text,
        /Merge\/Release[^\n]*별도 권한/,
        `${path}: merge/publication authority is separate`
      );
    }
  });

  it('AC03/05 linked guides do not restore mandatory Issues, duplicate plans or stage approvals', () => {
    const external = read('mydocs/manual/external_pr_review_guide.md');
    lacks(
      external,
      /record the basis[^\n]*create a separate GitHub Issue/i,
      'external followup: no forced Issue'
    );
    has(
      external,
      /LOW[^\n]*기존 context[^\n]*새 Issue를 강제하지 않는다/,
      'external LOW uses existing context'
    );
    has(external, /Issue[^\n]*별도 생성 권한/, 'Issue creation retains actual authority');
    has(
      external,
      /untrusted 외부 코드 실행[^\n]*승인되지 않는다/,
      'untrusted execution is not review authority'
    );
    for (const path of ['mydocs/plans/README.md', 'mydocs/working/README.md']) {
      const text = read(path);
      lacks(
        text,
        /after task plan approval|request approval to enter the next Stage|^- Approval request$/im,
        `${path}: no recurring approval gate`
      );
      has(text, /기존 context/, `${path}: proportional existing tracking`);
      has(text, /HIGH/, `${path}: risky decisions still bounded`);
      has(text, /native\/tool permission/, `${path}: native boundary preserved`);
    }
    const plans = read('mydocs/plans/README.md');
    has(plans, /별도 `_impl` 계획을 강제하지 않는다/, 'folder: no second plan original');
    has(plans, /unformatted[^\n]*원래 경로·내용을 유지/, 'folder: canonical human plan preserved');
    has(plans, /기존 `_impl`[^\n]*보존·참조/, 'folder: existing implementation plans retained');
    has(
      read('mydocs/working/README.md'),
      /실패·미실행·blocked[^\n]*완료로 표시하지 않는다/,
      'folder: failed checkpoints cannot imply completion'
    );
  });

  it('AC03–08 HF skills/templates consume canonical, proportional tracking and preserved gates', () => {
    for (const path of hfFiles.filter((file) =>
      /task-(?:start|stage-report|final-report)\/|_templates\/(?:task_plan|task_impl_plan|stage_report|final_report)\.md$/.test(
        file
      )
    )) {
      const text = read(path);
      has(text, /LOW/, `${path}: LOW context`);
      has(text, /canonical/i, `${path}: canonical reference`);
      has(text, /incomplete/, `${path}: failed evidence`);
      has(text, /native/, `${path}: native permission`);
      has(text, /task-owned|task-only/i, `${path}: ownership`);
      authority(text, path);
      terminal(text, path);
    }
    for (const path of publicationFiles) {
      const text = read(path);
      has(text, /permission|권한|위임/i, `${path}: authority is explicit`);
      lacks(text, /git add (?:\.|-A)(?:\s|$)/m, `${path}: no whole-tree adoption`);
      if (path === 'mydocs/manual/pr_process_guide.md') {
        lacks(
          text,
          /If internal follow-up changes are needed during external PR review, create a separate GitHub Issue/i,
          'external review does not force a followup Issue'
        );
        has(
          text,
          /외부 PR 검토 중 필요한 내부 후속 변경은 별도 scope\/context로 구분한다/,
          'external followup keeps separate scope/context'
        );
        has(
          text,
          /검토 요청만으로 구현하거나 Issue를 생성하지 않으며.*실제 변경 위임/,
          'review request alone does not authorize implementation or Issue creation'
        );
        has(
          text,
          /LOW 후속 작업에 새 Issue를 강제하지 않는다/,
          'LOW followup does not force an Issue'
        );
      }
    }
    const report = read('mydocs/_templates/final_report.md');
    for (const token of [
      'Automated Verification',
      'Manual/Scenario Verification',
      'CI/Remote Verification',
      'Verification Limitations'
    ]) {
      has(report, new RegExp(token), `report: ${token}`);
    }
  });

  it('AC11 preserves installed-revision BMAD legal sibling, complete MIT/trademark and HF/Sisyphus notices', () => {
    const agents = read('AGENTS.md');
    const hf = section(agents, '### Hyper-Waterfall Attribution and License');
    const bmad = section(agents, '### BMAD Attribution and License');
    expect(
      hf.includes('### BMAD Attribution and License'),
      'HF notice excludes BMAD sibling heading'
    ).toBe(false);
    expect(
      hf.includes('Copyright (c) 2025 BMad Code, LLC'),
      'HF notice cannot borrow BMAD copyright/permission'
    ).toBe(false);
    expect(bmad.includes('Copyright (c) 2026 postmelee'), 'BMAD notice excludes HF copyright').toBe(
      false
    );
    expect(
      agents.indexOf('### BMAD Attribution and License') >
        agents.indexOf('### Hyper-Waterfall Attribution and License')
    ).toBe(true);
    for (const path of [
      ...deliveryPaths,
      ...runtimePaths.filter((path) => path !== 'tools/bmad/config.toml')
    ])
      expect(bmad.includes(`\`${path}\``), `legal selected source: ${path}`).toBe(true);
    expect((bmad.match(/^- `mydocs\/skills\//gm) ?? []).length).toBe(22);
    expect((bmad.match(/^- `tools\/bmad\//gm) ?? []).length).toBe(2);
    expect(bmad.includes('2fe54695d2619b666eb8a32a6cceeec209f66bf3')).toBe(true);
    expect(bmad.includes('Copyright (c) 2025 BMad Code, LLC')).toBe(true);
    expect(
      bmad.includes('This project incorporates contributions from the open source community.')
    ).toBe(true);
    expect(bmad.includes('CONTRIBUTORS.md')).toBe(true);
    expect(
      normalize(bmad).includes(normalize(permission)),
      'complete BMAD permission/disclaimer'
    ).toBe(true);
    const trademark = `TRADEMARK NOTICE:
BMad™, BMad Method™, and BMad Core™ are trademarks of BMad Code, LLC, covering all
casings and variations (including BMAD, bmad, BMadMethod, BMAD-METHOD, etc.). The use of
these trademarks in this software does not grant any rights to use the trademarks
for any other purpose.`;
    expect(normalize(bmad).includes(normalize(trademark)), 'full applicable trademark notice').toBe(
      true
    );
    expect(
      normalize(bmad).includes(
        'See [TRADEMARK.md](https://github.com/bmad-code-org/BMAD-METHOD/blob/2fe54695d2619b666eb8a32a6cceeec209f66bf3/TRADEMARK.md) for detailed guidelines.'
      )
    ).toBe(true);
    expect(hf.includes('349fa70ffe3033abe983cf8de45ab418229277d6')).toBe(true);
    expect(hf.includes('Copyright (c) 2026 postmelee')).toBe(true);
    expect(normalize(hf).includes(normalize(permission)), 'HF MIT unchanged').toBe(true);
    expect(
      agents.includes(
        'Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)'
      )
    ).toBe(true);
    expect(agents.includes('Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>')).toBe(true);
  });
});
