import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

// Explicit renderer/assertion evidence only. D01–10 LLM walkthroughs and native
// admission/enforcement remain separate leader-owned evidence. No workflow is executed.
const repository = fileURLToPath(new URL('../', import.meta.url));
const skills = ['bmad-build', 'bmad-build-auto'] as const;
const routes = ['auto', 'full', 'oneshot'] as const;
const reviews = ['auto', 'none', 'quick', 'thorough'] as const;
type Skill = (typeof skills)[number];
type Route = (typeof routes)[number];
type Review = (typeof reviews)[number];
interface Fixture {
  root: string;
  renderer: string;
  skillDir: string;
  sourceHashes: Record<string, string>;
}
interface Manifest {
  schema_version: number;
  skill: string;
  generation_hash: string;
  inputs: {
    source_sha256: Record<string, string>;
    renderer_sha256: string;
    resolved_values: Record<string, unknown>;
  };
  outputs: Record<string, string>;
}
interface Snapshot {
  entry: string;
  generation: string;
  manifest: Manifest;
  outputs: Record<string, string>;
}
let ownedRoot: string | undefined;
const fixtures = new Set<string>();
const sha256 = (bytes: string | Buffer): string => createHash('sha256').update(bytes).digest('hex');
function readBytes(path: string): Buffer {
  try {
    return readFileSync(path);
  } catch {
    throw new Error('Renderer fixture/source file unavailable; host paths omitted.');
  }
}
function assertText(text: string, pattern: RegExp, label: string): void {
  // Boolean assertions avoid dumping rendered paths, metadata or subprocess output.
  expect(pattern.test(text), label).toBe(true);
}
function owned(path: string): boolean {
  if (!ownedRoot) return false;
  const suffix = relative(ownedRoot, path);
  return (
    suffix !== '' &&
    suffix !== '..' &&
    !suffix.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) &&
    !isAbsolute(suffix)
  );
}
function cleanup(path: string): void {
  if (!owned(path)) throw new Error('Fixture cleanup refused: resource is not suite-owned.');
  try {
    rmSync(path, { recursive: true, force: true });
  } catch {
    throw new Error('Owned renderer fixture cleanup failed; host paths omitted.');
  }
  fixtures.delete(path);
}
function markdownFiles(directory: string, prefix = ''): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) return markdownFiles(join(directory, entry.name), name);
      return entry.isFile() && name.endsWith('.md') && entry.name !== 'SKILL.md' ? [name] : [];
    })
    .sort();
}
function fixture(skill: Skill): Fixture {
  try {
    return createFixture(skill);
  } catch {
    throw new Error(
      'local-renderer prerequisite blocked: owned synthetic fixture or required local skill sources unavailable; host paths omitted.'
    );
  }
}
function createFixture(skill: Skill): Fixture {
  if (!ownedRoot)
    throw new Error('local-renderer prerequisite blocked: temporary fixture unavailable.');
  const root = realpathSync(mkdtempSync(join(ownedRoot, 'case-')));
  fixtures.add(root);
  const scripts = join(root, '_bmad/scripts');
  const skillDir = join(root, 'mydocs/skills', skill);
  mkdirSync(scripts, { recursive: true });
  mkdirSync(skillDir, { recursive: true });
  // Copy only actual required renderer helpers and skill rendering inputs. Never
  // copy root custom/user settings, wrappers, installer state or user generations.
  for (const name of ['render_skill.py', 'config_utils.py']) {
    copyFileSync(join(repository, '_bmad/scripts', name), join(scripts, name));
  }
  const sourceDir = join(repository, 'mydocs/skills', skill);
  copyFileSync(join(sourceDir, 'customize.toml'), join(skillDir, 'customize.toml'));
  const sourceHashes: Record<string, string> = {};
  for (const name of markdownFiles(sourceDir)) {
    const destination = join(skillDir, name);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(join(sourceDir, name), destination);
    sourceHashes[name] = sha256(readBytes(destination));
  }
  writeFileSync(
    join(root, '_bmad/config.toml'),
    'output_folder = "{project-root}/_bmad-output"\n[core]\nactive_initiative = ""\n'
  );
  copyFileSync(join(repository, 'AGENTS.md'), join(root, 'AGENTS.md'));
  return { root, renderer: join(scripts, 'render_skill.py'), skillDir, sourceHashes };
}
// One existing-runtime recipe, not a fallback: run the unchanged renderer with
// installed Python/Jinja. The wrapper's PEP723 --script/cache bootstrap path
// is a separate unverified surface and is not exercised by this suite.
function existingPython(args: string[], cwd: string) {
  const result = spawnSync(
    'uv',
    ['run', '--offline', '--no-python-downloads', '--no-project', '--', 'python3', ...args],
    {
      cwd,
      encoding: 'utf8',
      timeout: 90_000,
      maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1', UV_NO_PROGRESS: '1' }
    }
  );
  if (result.stderr.trim()) {
    console.warn(
      'Existing local Python renderer runtime emitted stderr diagnostics; raw details withheld to preserve host-path/stack privacy.'
    );
  }
  return result;
}
function invoke(renderer: string, args: string[], cwd: string) {
  return existingPython([renderer, ...args], cwd);
}
function render(f: Fixture, assignments: string[] = []): Snapshot {
  const result = invoke(
    f.renderer,
    [
      '--project-root',
      f.root,
      '--skill',
      f.skillDir,
      ...assignments.flatMap((assignment) => ['--set', assignment])
    ],
    f.root
  );
  expect(
    !result.error && result.status === 0,
    'Actual local renderer must succeed; output intentionally not dumped.'
  ).toBe(true);
  const line = result.stdout.trim();
  expect(
    /^read and follow [^\n]+\/workflow\.md$/.test(line),
    'Renderer stdout is the workflow instruction, not a metadata report.'
  ).toBe(true);
  const entry = line.slice('read and follow '.length);
  expect(isAbsolute(entry) && owned(entry), 'Workflow must resolve inside the owned fixture.').toBe(
    true
  );
  const generation = dirname(entry);
  expect(
    relative(join(f.root, '_bmad/render'), generation).startsWith('..'),
    'Generation must be under fixture render directory.'
  ).toBe(false);
  let manifest: Manifest;
  try {
    manifest = JSON.parse(
      readBytes(join(generation, 'manifest.json')).toString('utf8')
    ) as Manifest;
  } catch {
    throw new Error('Actual renderer manifest is missing or invalid; private paths omitted.');
  }
  expect(manifest.schema_version, 'manifest schema').toBe(1);
  expect(manifest.skill, 'manifest skill').toBe(f.skillDir.split(/[\\/]/).at(-1));
  expect(/^[a-f0-9]{20}$/.test(manifest.generation_hash), 'generation identity').toBe(true);
  expect(generation.endsWith(manifest.generation_hash), 'stdout uses immutable generation').toBe(
    true
  );
  expect(manifest.inputs.source_sha256, 'public current source hashes').toEqual(f.sourceHashes);
  expect(manifest.inputs.renderer_sha256, 'actual local renderer hash').toBe(
    sha256(readBytes(f.renderer))
  );
  expect(
    manifest.inputs.renderer_sha256,
    'copied renderer matches current installed renderer'
  ).toBe(sha256(readBytes(join(repository, '_bmad/scripts/render_skill.py'))));
  const originals = join(repository, 'mydocs/skills', manifest.skill);
  for (const [name, hash] of Object.entries(f.sourceHashes)) {
    expect(hash, `current installed source: ${name}`).toBe(
      sha256(readBytes(join(originals, name)))
    );
  }
  const outputs: Record<string, string> = {};
  for (const [name, hash] of Object.entries(manifest.outputs)) {
    const path = resolve(generation, name);
    expect(
      owned(path) && !relative(generation, path).startsWith('..'),
      `safe manifest filename: ${name}`
    ).toBe(true);
    const bytes = readBytes(path);
    expect(sha256(bytes), `manifest output hash: ${name}`).toBe(hash);
    outputs[name] = bytes.toString('utf8');
  }
  expect('workflow.md' in outputs, 'workflow output exists').toBe(true);
  for (const [name, text] of Object.entries(outputs)) {
    expect(/\{[{%]/.test(text), `${name}: no unresolved Jinja`).toBe(false);
    const escaped = generation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const links = [...text.matchAll(new RegExp(`${escaped}/([A-Za-z0-9_./-]+\\.md)`, 'g'))];
    for (const link of links)
      expect(link[1] in outputs, `${name}: rendered sibling link exists`).toBe(true);
  }
  expect(
    outputs['workflow.md'].includes(join(generation, 'step-01-clarify-and-route.md')),
    'workflow reaches rendered step01'
  ).toBe(true);
  return { entry, generation, manifest, outputs };
}
function safety(snapshot: Snapshot, skill: Skill, route: Route, review: Review): void {
  const files = snapshot.outputs;
  const step = files['step-01-clarify-and-route.md'];
  for (const file of [
    'step-02-plan.md',
    'step-03-implement.md',
    'step-04-review.md',
    'step-oneshot.md'
  ]) {
    if (!(file in files)) continue;
    const text = files[file];
    const storage = text.split('### State/evidence location\n')[1]?.split(/\n#{1,3} /)[0] ?? '';
    assertText(
      storage,
      /Only an existing BMAD-format plan with authorized task-owned metadata/i,
      `${skill}/${file}: rendered format and authority`
    );
    assertText(
      storage,
      /Otherwise[\s\S]*unformatted[\s\S]*unchanged[\s\S]*existing context/i,
      `${skill}/${file}: rendered canonical context`
    );
    assertText(
      storage,
      /all state\/evidence reads and writes/i,
      `${skill}/${file}: rendered resume reads same state`
    );
    assertText(
      storage,
      /baseline_revision[\s\S]*status[\s\S]*review[\s\S]*notes/i,
      `${skill}/${file}: rendered metadata coverage`
    );
    expect(
      /Capture `baseline_revision`[^\n]*into `\{plan_file\}` frontmatter|Change `\{plan_file\}` status to[^\n]*frontmatter|^Write [^\n]*to `\{plan_file\}` frontmatter/m.test(
        text
      ),
      `${skill}/${file}: no unconditional canonical mutation`
    ).toBe(false);
  }
  if (skill === 'bmad-build') {
    for (const file of ['step-02-plan.md', 'step-04-review.md', 'step-oneshot.md']) {
      const text = files[file];
      if (!text) continue;
      expect(
        /source_plan\s*:[^\n]*\{plan_file\}/.test(text),
        `${file}: no rendered raw plan serialization`
      ).toBe(false);
      const hasDeferredBranch =
        file === 'step-02-plan.md' ? route !== 'oneshot' : review !== 'none';
      if (!hasDeferredBranch) continue;
      assertText(
        text,
        /resolve the real paths of the canonical plan and repository root/i,
        `${file}: rendered containment checks`
      );
      assertText(
        text,
        /normalize an absolute in-repository plan path to a privacy-safe repository-relative reference/i,
        `${file}: rendered safe canonical reference`
      );
      assertText(
        text,
        /non-persisted current context only[^\n]*do not write/i,
        `${file}: rendered unsafe-reference persistence blocked`
      );
      assertText(
        text,
        /Never persist raw paths, private identifiers or hashes of them/i,
        `${file}: rendered privacy boundary`
      );
      assertText(
        text,
        /Do not copy or relocate the canonical plan/i,
        `${file}: rendered no duplicate plan`
      );
    }
  }
  const present = files['step-05-present.md'];
  if (present) {
    const built =
      present.split('### Mark Plan Built\n')[1]?.split('\n### Commit and Complete')[0] ?? '';
    assertText(
      built,
      /explicitly record `status: 'built'` in the resolved state\/evidence location before publication/i,
      'rendered full route records built'
    );
    assertText(
      built,
      /authorized existing BMAD frontmatter[\s\S]*otherwise[\s\S]*existing context/i,
      'rendered built supports both canonical formats'
    );
    assertText(
      built,
      /without modifying an unformatted canonical plan/i,
      'rendered built preserves canonical content'
    );
    assertText(
      built,
      /read-only\/planning-only\/report-only[\s\S]*incomplete required review[\s\S]*do not write `built`/i,
      'rendered terminal rejects unauthorized or failed success'
    );
  }
  const ordinaryReview =
    skill === 'bmad-build' && review !== 'none' ? files['step-04-review.md'] : undefined;
  if (ordinaryReview) {
    assertText(
      ordinaryReview,
      /If `## Review Triage Log` at the resolved state\/evidence location already has rows/,
      'rendered resume uses resolved log'
    );
    assertText(
      ordinaryReview,
      /Every finding gets one row in the Review Triage Log at the resolved state\/evidence location/,
      'rendered findings use resolved log'
    );
    assertText(
      ordinaryReview,
      /unformatted canonical plan[\s\S]*existing context without adding a section or editing the plan/,
      'rendered triage cannot mutate the human plan'
    );
    expect(
      /Review Triage Log` section of `\{plan_file\}`/.test(ordinaryReview),
      'no rendered forced triage section'
    ).toBe(false);
  }
  const guardStart = step.indexOf('## Request-mode guard');
  const routingStart = step.indexOf('## Intent check');
  expect(
    guardStart >= 0 && routingStart > guardStart,
    `${skill}/${route}/${review}: terminal mode guard precedes status routing`
  ).toBe(true);
  const guard = step.slice(guardStart, routingStart);
  for (const mode of ['read-only', 'planning-only', 'report-only']) {
    assertText(guard, new RegExp(mode), `${skill}: rendered ${mode} stop`);
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
    assertText(
      guard,
      new RegExp(`\`${status}\``),
      `${skill}: rendered ${status} cannot bypass mode`
    );
  }
  assertText(
    guard,
    /Do not write or create a plan, frontmatter, ticket, source/i,
    `${skill}: no writes`
  );
  assertText(guard, /do not[^\n]*reset iteration/i, `${skill}: no followup reset`);
  assertText(guard, /STOP this workflow here/i, `${skill}: rendered terminal mode exit`);
  assertText(guard, /no status-based EARLY EXIT/i, `${skill}: rendered no resume bypass`);
  assertText(
    guard,
    /Only an invocation that delegates changes may continue/i,
    `${skill}: rendered delegated path preserved`
  );
  const lowStart = step.search(/(?:###?[^\n]*LOW|\d+\.\s*\*\*LOW)/i);
  expect(
    lowStart >= 0 && lowStart < step.indexOf('5. Set the plan file'),
    `${skill}/${route}/${review}: pre-plan LOW is reachable`
  ).toBe(true);
  const low = step.slice(lowStart, step.indexOf('\n1. Load context', lowStart));
  for (const pattern of [
    /existing.context/i,
    /no existing plan|no plan exists|without.*plan|계획.*없/i,
    /read-only/i,
    /planning-only/i,
    /verif/i,
    /incomplete/i,
    /STOP|never fall through|no fallthrough/i,
    /dummy|placeholder/i,
    /task-owned|task-only/i,
    /push/i,
    /PR/,
    /native/i
  ])
    assertText(low, pattern, `${skill}: rendered LOW ${pattern.source}`);
  assertText(
    step,
    /(?:(?:plan-required|required plan(?:\/state-based)?)[^\n]*missing|missing[^\n]*required plan)[^\n]*(?:block|HALT)/i,
    `${skill}: full/resume missing plan execution blocks`
  );
  assertText(
    step,
    /without recreat|without recreation|never recreat/i,
    `${skill}: missing plan cannot be recreated to bypass safety`
  );
  assertText(step, /canonical/i, `${skill}: canonical reuse`);
  const reviewFile =
    skill === 'bmad-build' && route === 'oneshot' ? 'step-oneshot.md' : 'step-04-review.md';
  for (const file of [
    'workflow.md',
    'step-01-clarify-and-route.md',
    'step-02-plan.md',
    reviewFile
  ]) {
    const text = files[file];
    for (const pattern of [
      /AGENTS\.md/,
      /native/i,
      /HIGH/,
      /targets/,
      /actions/,
      /impact/,
      /recovery_conditions/,
      /missing|absent/i,
      /denied/i,
      /reuse|reusable/i,
      /changed/i
    ]) {
      assertText(text, pattern, `${skill}/${file}: rendered authority ${pattern.source}`);
    }
    expect(
      /\*\*ALWAYS(?:\*\*)?\s+(WAIT|HALT)|HALT on a dirty tree|require a clean working tree|Do not run (?:them|subagents) in the background|Stop and ask the user before continuing\./i.test(
        text
      ),
      `${skill}/${file}: no legacy unconditional gate`
    ).toBe(false);
    expect(
      /If token count exceeded 1600[^\n]*(?:HALT|wait (?:for|until)[^\n]*approv|stop (?:for|until)[^\n]*approv)|HALT and give the user a choice:[\s\S]{0,800}Approve and continue/i.test(
        text
      ),
      `${skill}/${file}: sizing warnings must not stop for whole-plan approval`
    ).toBe(false);
  }
  const plan = files['step-02-plan.md'];
  if (route !== 'auto') {
    assertText(plan, new RegExp(`route: '${route}'`), `${skill}: pinned ${route}`);
    assertText(plan, /route_source(?:: 'pinned'|` is `pinned`)/, `${skill}: route provenance`);
  } else {
    assertText(plan, /route_source(?:: 'auto'|` is `auto`)/, `${skill}: auto route provenance`);
    assertText(plan, /oneshot/, `${skill}: auto oneshot branch`);
    assertText(plan, /full/, `${skill}: auto full branch`);
  }
  assertText(plan, /planning-only|read-only/i, `${skill}: planning mode cannot implement`);
  if (skill === 'bmad-build') {
    expect('step-03-implement.md' in files, 'full/auto implementation output').toBe(
      route !== 'oneshot'
    );
    expect('step-04-review.md' in files, 'full/auto review output').toBe(route !== 'oneshot');
    expect('step-05-present.md' in files, 'full/auto terminal output').toBe(route !== 'oneshot');
    expect('step-oneshot.md' in files, 'oneshot/auto implementation output').toBe(route !== 'full');
    const implementation = files[route === 'oneshot' ? 'step-oneshot.md' : 'step-03-implement.md'];
    const precondition =
      implementation.split(/\n#{2,3} Preconditions?\n/i)[1]?.split(/\n#{1,3} /)[0] ?? '';
    assertText(precondition, /non-empty|nonempty|empty/i, 'required path must be nonempty');
    assertText(precondition, /exists|existing/i, 'required plan must exist');
    assertText(
      precondition,
      /missing[\s\S]*(?:block|HALT)|HALT[\s\S]*missing/i,
      'missing required plan must block execution'
    );
    assertText(
      implementation,
      /without recreat|without recreation|never recreat/i,
      'required-plan block cannot recreate a substitute'
    );
    for (const name of ['step-04-review.md', 'step-oneshot.md']) {
      const text = files[name];
      if (!text || review === 'none') continue;
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
        assertText(
          unavailable,
          pattern,
          `${name}: rendered unavailable reviewer ${pattern.source}`
        );
      expect(
        /write[^\n]*(?:beside|full prompt)|separate session|paste back|replaced inline by that file's contents/i.test(
          text
        ),
        `${name}: no rendered prompt artifact or cross-session export fallback`
      ).toBe(false);
      assertText(
        text,
        /launch[\s\S]*await (?:for )?all results before triage/i,
        `${name}: available native launch/await preserved`
      );
      if (name === 'step-04-review.md') {
        const classify = text.split('### Classify\n')[1]?.split('\n## NEXT')[0] ?? '';
        const carry = classify.match(/^ {3}If `## Review Triage Log`[^\n]+/m)?.[0] ?? '';
        for (const pattern of [
          /Carry a prior verdict and route only when current code and relevant evidence still support them/,
          /Same location, claim or unchanged code alone is not sufficient/,
          /Stale, missing or irrelevant evidence requires validation/,
          /disproved prior verdict must be corrected with current evidence/,
          /Unresolved or unapplied repairs must still be processed through grouping and routing under current scope\/ownership\/authority, then reverified/,
          /Prior rows never waive required verification or acceptance.*no finding or evidence may be dropped/
        ])
          assertText(carry, pattern, `rendered carry: ${pattern.source}`);
        const gap =
          classify.match(/^ {3}- For a finding from the verification-gap lens,[^\n]+/m)?.[0] ?? '';
        for (const pattern of [
          /filed evidence is current, relevant to the task-owned scope and supports the claimed gap in current code/,
          /Stale, missing or irrelevant evidence requires validation.*lens label alone grants no verification exemption/,
          /Preserve every finding and its evidence; required verification and acceptance still apply/
        ])
          assertText(gap, pattern, `rendered gap evidence: ${pattern.source}`);
        expect(
          /skip verification|never patch or defer it again|arrives pre-verified|triage trusts the claim as filed/i.test(
            classify
          ),
          'no rendered historical or lens verification bypass'
        ).toBe(false);
        assertText(
          text.split('## NEXT\n')[1] ?? '',
          /No successful built\/publication[^\n]*incomplete required review/,
          'rendered full review blocks missing required review'
        );
      } else {
        const final =
          text.split('### Finalize Plan\n')[1]?.split('\n### Task-Owned Publication')[0] ?? '';
        assertText(
          final,
          /incomplete required review[^\n]*do not mark built/,
          'rendered oneshot missing reviewer blocks built'
        );
        assertText(
          final,
          /Set `status: 'built'` only[^\n]*required review done/,
          'rendered oneshot built requires actual review'
        );
        assertText(
          text.split('### Task-Owned Publication\n')[1] ?? '',
          /No affected successful publication[^\n]*incomplete required review/,
          'rendered oneshot missing reviewer blocks publication'
        );
      }
    }
  } else {
    assertText(
      files['step-03-implement.md'],
      /(?:empty|missing)[\s\S]{0,180}HALT|HALT[\s\S]{0,180}(?:empty|missing)/i,
      'auto implementation required-plan safety'
    );
    assertText(step, /built.*done[\s\S]*fresh review/i, 'built/done followup is fresh review');
    const final = files['step-04-review.md'].split('## Finalize')[1] ?? '';
    for (const pattern of [
      /built/,
      /done/,
      /follow.?up/i,
      /task-owned|task-only/i,
      /exact filename/i,
      /pending/i,
      /unrelated/i,
      /read-only/i,
      /planning-only/i,
      /verif/i,
      /fail/i,
      /native/i,
      /remote/i,
      /base/i,
      /head/i,
      /(?:existing|previous)[\s-]+(?:task[\s-]+)?PR\b/i,
      /commit/i,
      /push/i,
      /no.change|no.op|no changes|unchanged/i,
      /Merge\/Release/i,
      /formal/i,
      /Issue close/i,
      /tag/i,
      /cleanup/i
    ]) {
      assertText(final, pattern, `auto initial/followup Finalize: ${pattern.source}`);
    }
    expect(
      /Do not push\.|working copy is clean|finalization left repository dirty/i.test(final),
      'no blanket Finalize publication/dirty gate'
    ).toBe(false);
  }
  const renderedReview = files[reviewFile];
  expect(
    /^\s*`{1,2}(?:yaml|markdown|text)\b/m.test(renderedReview),
    'review examples are not damaged fence fragments'
  ).toBe(false);
  const fences = renderedReview.match(/^\s*```[^\n]*$/gm) ?? [];
  expect(fences.length % 2 === 0, 'rendered review code fences are balanced').toBe(true);
  if (review === 'none') {
    assertText(renderedReview, /review: 'none'/, 'none records no lenses');
    assertText(renderedReview, /lenses_ran: \[\]/, 'none records empty lens set');
    expect(
      /#### (?:Quick|Blind Hunter)/.test(renderedReview),
      'none omits rendered lens instructions'
    ).toBe(false);
    assertText(renderedReview, /verif/i, 'review none still requires verification');
    if (skill === 'bmad-build') {
      assertText(
        renderedReview,
        /Review `none` never waives required verification or acceptance checks|Neither review `none` nor prior status waives verification/,
        'ordinary review none explicitly grants no verification exemption'
      );
    }
    assertText(
      renderedReview,
      /fail|incomplete/i,
      'review none cannot publish failed verification'
    );
  } else {
    const expected =
      review === 'auto'
        ? route === 'oneshot'
          ? 'quick'
          : route === 'full' || skill === 'bmad-build'
            ? 'thorough'
            : undefined
        : review;
    if (expected)
      assertText(renderedReview, new RegExp(`review: '${expected}'`), 'resolved review branch');
    else {
      assertText(renderedReview, /Quick set/, 'auto route quick review witness');
      assertText(renderedReview, /Thorough set/, 'auto route thorough review witness');
    }
    assertText(renderedReview, /### Review/, 'review lenses branch');
    if (skill === 'bmad-build' && route === 'auto' && review === 'auto') {
      assertText(
        files['step-oneshot.md'],
        /review: 'quick'/,
        'ordinary auto route has quick oneshot review as well'
      );
    }
  }
}

beforeAll(() => {
  try {
    for (const path of [
      '_bmad/scripts/render_skill.py',
      '_bmad/scripts/config_utils.py',
      '_bmad/config.toml',
      ...skills.flatMap((skill) => [
        `mydocs/skills/${skill}/customize.toml`,
        `mydocs/skills/${skill}/workflow.md`
      ])
    ]) {
      if (!statSync(join(repository, path)).isFile())
        throw new Error('missing required local file');
    }
    const version = spawnSync('uv', ['--version'], { encoding: 'utf8', timeout: 10_000 });
    if (version.error || version.status !== 0) throw new Error('uv unavailable');
    ownedRoot = realpathSync(mkdtempSync(join(tmpdir(), 'approval-render-')));
    const f = fixture('bmad-build');
    // Explicitly validate the existing runtime, without PEP723 dependency
    // resolution, project synchronization, Python downloads or installation.
    const runtime = existingPython(
      [
        '-c',
        [
          'import sys, re, jinja2',
          'version = re.match(r"^(\\d+)\\.(\\d+)", jinja2.__version__)',
          'assert sys.version_info >= (3, 11)',
          'assert version is not None and tuple(map(int, version.groups())) >= (3, 1)',
          'print("approval-render-existing-runtime-ready")'
        ].join('\n')
      ],
      f.root
    );
    if (
      runtime.error ||
      runtime.status !== 0 ||
      runtime.stdout.trim() !== 'approval-render-existing-runtime-ready'
    )
      throw new Error('existing Python/Jinja2 runtime unavailable');
    const probe = invoke(f.renderer, ['--help'], f.root);
    if (probe.error || probe.status !== 0 || !probe.stdout.includes('--project-root'))
      throw new Error('Python/Jinja2 renderer environment unavailable');
    cleanup(f.root);
  } catch {
    throw new Error(
      'local-renderer prerequisite blocked: required local renderer/helpers/config/customize sources, uv, existing python3 >=3.11 and installed Jinja2 >=3.1 must already be available. No installation or successful skip was performed. Wrapper --script/cache bootstrap is not verified by this suite.'
    );
  }
}, 120_000);

afterEach(() => {
  for (const path of [...fixtures]) cleanup(path);
});
afterAll(() => {
  for (const path of [...fixtures]) cleanup(path);
  if (ownedRoot) {
    // This root was created by this suite, not an installed generation/config dir.
    try {
      rmSync(ownedRoot, { recursive: true, force: true });
    } catch {
      throw new Error('Owned renderer suite cleanup failed; host paths omitted.');
    }
    ownedRoot = undefined;
  }
});

describe('explicit actual local renderer contracts (not workflow execution)', () => {
  for (const skill of skills) {
    it(`${skill} real defaults, current hashes, immutable generation reuse and LOW/full/resume witnesses`, () => {
      const f = fixture(skill);
      expect(existsSync(join(f.root, '_bmad-output')), 'no existing plan/output fixture').toBe(
        false
      );
      const first = render(f);
      expect(first.manifest.inputs.resolved_values['customization.workflow.route']).toBe('auto');
      expect(first.manifest.inputs.resolved_values['customization.workflow.review']).toBe('quick');
      safety(first, skill, 'auto', 'quick');
      const before = sha256(readBytes(join(first.generation, 'manifest.json')));
      const again = render(f);
      expect(again.entry === first.entry, 'same inputs reuse immutable generation').toBe(true);
      expect(sha256(readBytes(join(first.generation, 'manifest.json')))).toBe(before);
      expect(
        existsSync(join(f.root, '_bmad-output')),
        'renderer did not execute LOW development/plan/publication'
      ).toBe(false);
    });
    for (const route of routes)
      for (const review of reviews) {
        it(`${skill} route=${route}, review=${review}: actual branch and preserved safety`, () => {
          const f = fixture(skill);
          const snapshot = render(f, [`workflow.route=${route}`, `workflow.review=${review}`]);
          expect(snapshot.manifest.inputs.resolved_values['customization.workflow.route']).toBe(
            route
          );
          expect(snapshot.manifest.inputs.resolved_values['customization.workflow.review']).toBe(
            review
          );
          safety(snapshot, skill, route, review);
          expect(
            existsSync(join(f.root, '_bmad-output')),
            'no development/publication workflow executed'
          ).toBe(false);
        });
      }
    for (const assignment of ['workflow.route=invalid', 'workflow.undeclared=value']) {
      it(`${skill} rejects ${assignment} with nonzero HALT and no generation`, () => {
        const f = fixture(skill);
        const result = invoke(
          f.renderer,
          ['--project-root', f.root, '--skill', f.skillDir, '--set', assignment],
          f.root
        );
        expect(
          !result.error && result.status !== null && result.status !== 0,
          'negative is renderer rejection, not subprocess failure'
        ).toBe(true);
        expect(/^HALT:/m.test(result.stdout), 'invalid input halts explicitly').toBe(true);
        expect(existsSync(join(f.root, '_bmad/render')), 'negative publishes no generation').toBe(
          false
        );
      });
    }
  }
});
