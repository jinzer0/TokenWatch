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
  symlinkSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
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
const proseSurfaces = ['source', 'instruction', 'persistent', 'overrides'] as const;
type ProseSurface = (typeof proseSurfaces)[number];
interface Fixture {
  root: string;
  renderer: string;
  skillDir: string;
  sourceHashes: Record<string, string>;
  templateHashes: Record<string, string>;
}
interface Manifest {
  schema_version: number;
  skill: string;
  project_root: string;
  skill_root: string;
  generation_hash: string;
  inputs: {
    project_root: string;
    skill_root: string;
    template_sha256: Record<string, string>;
    renderer_sha256: string;
    config_utils_sha256: string;
    resolved_values: Record<string, unknown>;
  };
  outputs: Record<string, string>;
}
interface Snapshot {
  entry: string;
  instruction: string;
  reference: string;
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
function fixture(skill: Skill, prefix = 'case-'): Fixture {
  try {
    return createFixture(skill, prefix);
  } catch {
    throw new Error(
      'local-renderer prerequisite blocked: owned synthetic fixture or required local skill sources unavailable; host paths omitted.'
    );
  }
}
function createFixture(skill: Skill, prefix: string): Fixture {
  if (!ownedRoot)
    throw new Error('local-renderer prerequisite blocked: temporary fixture unavailable.');
  const root = realpathSync(mkdtempSync(join(ownedRoot, prefix)));
  fixtures.add(root);
  const scripts = join(root, 'tools/bmad');
  const skillDir = join(root, 'mydocs/skills', skill);
  mkdirSync(scripts, { recursive: true });
  mkdirSync(skillDir, { recursive: true });
  // Copy the tracked closure, never local installer/user state or generations.
  for (const name of ['render_skill.py', 'config_utils.py', 'config.toml']) {
    copyFileSync(join(repository, 'tools/bmad', name), join(scripts, name));
  }
  const sourceDir = join(repository, 'mydocs/skills', skill);
  copyFileSync(join(sourceDir, 'customize.toml'), join(skillDir, 'customize.toml'));
  copyFileSync(join(sourceDir, 'SKILL.md'), join(skillDir, 'SKILL.md'));
  const sourceHashes: Record<string, string> = {};
  const templateHashes: Record<string, string> = {};
  for (const name of markdownFiles(sourceDir)) {
    const destination = join(skillDir, name);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(join(sourceDir, name), destination);
    sourceHashes[name] = sha256(readBytes(destination));
    templateHashes[name] = sha256(readBytes(destination).toString('utf8').replaceAll(root, '.'));
  }
  copyFileSync(join(repository, 'AGENTS.md'), join(root, 'AGENTS.md'));
  return {
    root,
    renderer: join(scripts, 'render_skill.py'),
    skillDir,
    sourceHashes,
    templateHashes
  };
}
// Execute the shipped entrypoint recipe with explicit installed Python/Jinja
// prerequisites. No uv/bootstrap, installer config or network is needed.
function existingPython(args: string[], cwd: string) {
  const result = spawnSync('python3', args, {
    cwd,
    encoding: 'utf8',
    timeout: 90_000,
    maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }
  });
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
function privacyProse(f: Fixture, skill: Skill, surface: ProseSurface, prose: string) {
  const assignments: string[] = [];
  let overrides: string | undefined;
  let input = join(f.skillDir, 'plan-template.md');
  if (surface === 'source') {
    const source = `${readBytes(input).toString('utf8')}\n${prose}\n`;
    writeFileSync(input, source);
    f.sourceHashes['plan-template.md'] = sha256(source);
    f.templateHashes['plan-template.md'] = sha256(source.replaceAll(f.root, '.'));
  } else {
    const instruction = JSON.stringify(prose);
    if (surface === 'instruction') {
      assignments.push(
        `workflow.quick_lenses=[{id="quick", name="Synthetic Quick", instruction=${instruction}}]`
      );
    } else {
      if (surface === 'persistent') {
        const custom = join(f.root, '_bmad/custom');
        mkdirSync(custom, { recursive: true });
        input = join(custom, `${skill}.user.toml`);
      } else {
        input = join(fixture(skill).root, 'synthetic-prose-override.toml');
        overrides = input;
      }
      writeFileSync(
        input,
        `[[workflow.quick_lenses]]\nid = "quick"\nname = "Synthetic Quick"\ninstruction = ${instruction}\n`
      );
    }
  }
  return { assignments, overrides, input };
}
function render(
  f: Fixture,
  assignments: string[] = [],
  overrides?: string,
  cwd = f.root
): Snapshot {
  const result = invoke(
    f.renderer,
    [
      '--project-root',
      f.root,
      '--skill',
      f.skillDir,
      ...(overrides ? ['--overrides', overrides] : []),
      ...assignments.flatMap((assignment) => ['--set', assignment])
    ],
    cwd
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
  const instruction = line.slice('read and follow '.length);
  const entry = resolve(cwd, instruction);
  expect(
    !isAbsolute(instruction) && owned(entry),
    'Workflow must resolve inside the owned fixture.'
  ).toBe(true);
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
  expect(manifest.schema_version, 'manifest schema').toBe(3);
  expect(
    manifest.project_root === '.' && manifest.inputs.project_root === '.',
    'relative project identity'
  ).toBe(true);
  expect(
    manifest.skill_root === `mydocs/skills/${manifest.skill}` &&
      manifest.inputs.skill_root === manifest.skill_root,
    'relative skill identity'
  ).toBe(true);
  expect(
    'project_slug' in manifest ||
      'root_hash' in manifest ||
      'project_slug' in manifest.inputs ||
      'root_hash' in manifest.inputs,
    'no checkout fingerprint fields'
  ).toBe(false);
  expect(manifest.skill, 'manifest skill').toBe(f.skillDir.split(/[\\/]/).at(-1));
  expect(/^[a-f0-9]{20}$/.test(manifest.generation_hash), 'generation identity').toBe(true);
  expect(generation.endsWith(manifest.generation_hash), 'stdout uses immutable generation').toBe(
    true
  );
  expect(manifest.inputs.template_sha256, 'effective privacy-normalized template hashes').toEqual(
    f.templateHashes
  );
  expect('source_sha256' in manifest.inputs, 'no raw source hash compatibility alias').toBe(false);
  expect(manifest.inputs.renderer_sha256, 'actual local renderer hash').toBe(
    sha256(readBytes(f.renderer))
  );
  expect(manifest.inputs.config_utils_sha256, 'actual helper identity').toBe(
    sha256(readBytes(join(dirname(f.renderer), 'config_utils.py')))
  );
  expect(manifest.inputs.renderer_sha256, 'copied renderer matches current tracked runtime').toBe(
    sha256(readBytes(join(repository, 'tools/bmad/render_skill.py')))
  );
  for (const [name, hash] of Object.entries(f.sourceHashes)) {
    expect(hash, `current installed source: ${name}`).toBe(
      sha256(readBytes(join(f.skillDir, name)))
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
  const reference = relative(f.root, generation).split('\\').join('/');
  expect(
    reference === `_bmad/render/${manifest.skill}/${manifest.generation_hash}`,
    'location-independent namespace'
  ).toBe(true);
  const publicBytes = [
    result.stdout,
    readBytes(join(generation, 'manifest.json')).toString('utf8'),
    ...Object.values(outputs)
  ];
  for (const text of publicBytes) {
    expect(
      [f.root, basename(f.root), sha256(f.root).slice(0, 12)].some((value) => text.includes(value)),
      'all public bytes omit checkout location and fingerprints'
    ).toBe(false);
  }
  expect(result.stderr.length === 0, 'successful renderer has empty stderr').toBe(true);
  for (const [name, text] of Object.entries(outputs)) {
    expect(/\{[{%]/.test(text), `${name}: no unresolved Jinja`).toBe(false);
    const escaped = reference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const links = [...text.matchAll(new RegExp(`${escaped}/([A-Za-z0-9_./-]+\\.md)`, 'g'))];
    for (const link of links) {
      expect(link[1] in outputs, `${name}: rendered sibling link exists`).toBe(true);
      expect(
        existsSync(resolve(f.root, `${reference}/${link[1]}`)),
        `${name}: repository-relative link resolves`
      ).toBe(true);
    }
  }
  expect(
    outputs['workflow.md'].includes(`${reference}/step-01-clarify-and-route.md`),
    'workflow reaches rendered step01'
  ).toBe(true);
  return { entry, instruction, reference, generation, manifest, outputs };
}
function safety(snapshot: Snapshot, skill: Skill, route: Route, review: Review): void {
  const files = snapshot.outputs;
  const step = files['step-01-clarify-and-route.md'];
  const selector =
    step
      .split('## Canonical state/evidence selection (only after the request-mode guard)\n')[1]
      ?.split('\n## Intent check')[0] ?? '';
  assertText(
    selector,
    /exact selected canonical path AND task/,
    `${skill}: contextual state cannot borrow another plan`
  );
  assertText(
    selector,
    /BEFORE testing any status, ordinary-intent fallback, LOW entry, slug assignment or NEXT/,
    `${skill}: contextual dispatch precedes fallback and resets`
  );
  assertText(
    selector,
    /No plan\/state mutation precedes dispatch/,
    `${skill}: status selection is not implementation`
  );
  assertText(
    selector,
    /Only genuinely absent recorded status permits ordinary-intent routing/,
    `${skill}: invalid or terminal state cannot become new intent`
  );
  for (const origin of [
    'explicit file',
    'recent conversation',
    'artifacts',
    'ticket resolution',
    'existing-path collision',
    'markerless-plan fallback'
  ])
    expect(selector.includes(origin)).toBe(true);
  for (const writer of [
    'step-01-clarify-and-route.md',
    'step-02-plan.md',
    'step-04-review.md',
    'step-oneshot.md'
  ]) {
    if (skill !== 'bmad-build' || !(writer in files)) continue;
    for (const example of files[writer].matchAll(/^[ \t]*```json\n([\s\S]*?)\n[ \t]*```$/gm)) {
      const document = JSON.parse(example[1]) as { deferred: Record<string, unknown>[] };
      expect(Object.keys(document)).toEqual(['deferred']);
      for (const entry of document.deferred)
        expect(Object.keys(entry).sort()).toEqual(['evidence', 'id', 'source_plan', 'summary']);
    }
  }
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
        /resolve the real paths of the canonical plan(?:,| and) repository root/i,
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
      /Other eligible incoming states[\s\S]*may explicitly record `status: 'built'`[\s\S]*before authorized publication/i,
      'rendered eligible completion may record built without downgrading done'
    );
    assertText(
      built,
      /supported existing BMAD plan[\s\S]*otherwise[\s\S]*existing context/i,
      'rendered built supports both canonical formats'
    );
    assertText(
      built,
      /never borrow another plan's context or add frontmatter/i,
      'rendered built preserves canonical content'
    );
    assertText(
      built,
      /read-only\/planning-only\/report-only[\s\S]*incomplete required review[\s\S]*do not write `built`/i,
      'rendered terminal rejects unauthorized or failed success'
    );
    assertText(
      built,
      /preserve incoming `done` as `done`[\s\S]*do not rewrite it to `built`/,
      'rendered done terminal is preserved'
    );
    assertText(
      built,
      /Historical completion never substitutes for current evidence/,
      'rendered done still needs current verified evidence'
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
    expect(
      'step-03-implement.md' in files,
      'every route retains authorized review repair target'
    ).toBe(true);
    expect('step-04-review.md' in files, 'every route can resume required review').toBe(true);
    expect('step-05-present.md' in files, 'every route can resume terminal reporting').toBe(true);
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
          /incomplete required review keeps state incomplete and blocks dependent terminal\/publication/,
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
      'tools/bmad/render_skill.py',
      'tools/bmad/config_utils.py',
      'tools/bmad/config.toml',
      ...skills.flatMap((skill) => [
        `mydocs/skills/${skill}/customize.toml`,
        `mydocs/skills/${skill}/workflow.md`
      ])
    ]) {
      if (!statSync(join(repository, path)).isFile())
        throw new Error('missing required local file');
    }
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
      'renderer prerequisite blocked: tracked runtime closure, python3 >=3.11 and installed Jinja2 >=3.1 must be available. No installation or successful skip was performed.'
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
  for (const route of ['auto', 'full', 'oneshot'] as const) {
    for (const review of ['auto', 'none', 'quick', 'thorough'] as const) {
      it(`normal ${route}/${review}: every existing state dispatches to an available phase without replanning`, () => {
        const f = fixture('bmad-build');
        const snapshot = render(f, [`workflow.route=${route}`, `workflow.review=${review}`]);
        const step = snapshot.outputs['step-01-clarify-and-route.md'];
        const rows = [...step.matchAll(/^\|[ \t]+`([^`]+)`[ \t]+\|[ \t]+(.+?)[ \t]+\|$/gm)];
        expect(rows.map((row) => row[1])).toEqual([
          'draft',
          'ready-for-dev',
          'in-progress',
          'in-review',
          'built',
          'done',
          'blocked',
          'dropped'
        ]);
        const targets: Record<string, string> = {
          draft: 'step-02-plan.md',
          'ready-for-dev': route === 'oneshot' ? 'step-oneshot.md' : 'step-03-implement.md',
          'in-progress': route === 'oneshot' ? 'step-oneshot.md' : 'step-03-implement.md',
          'in-review': 'step-04-review.md',
          built: 'step-04-review.md',
          done: 'step-05-present.md'
        };
        for (const row of rows) {
          if (row[1] === 'blocked' || row[1] === 'dropped') {
            expect(row[2].includes('**HALT**')).toBe(true);
            expect(/step-\d/.test(row[2])).toBe(false);
          } else {
            const target = targets[row[1]];
            expect(row[2].includes('**EARLY EXIT**')).toBe(true);
            expect(row[2].includes(`${snapshot.reference}/${target}`)).toBe(true);
            expect(target in snapshot.outputs).toBe(true);
            if (['in-review', 'built', 'done'].includes(row[1]))
              expect(/step-02-plan|step-03-implement|step-oneshot/.test(row[2])).toBe(false);
          }
        }
        expect(
          snapshot.outputs['step-04-review.md'].includes(`${snapshot.reference}/step-05-present.md`)
        ).toBe(true);
        assertText(
          step,
          /For any selected existing plan[^\n]*Canonical state\/evidence selection/,
          'artifact choices select associated context first'
        );
        assertText(
          step,
          /find's `plan`[^\n]*Canonical state\/evidence selection[^\n]*before testing status or fallback/,
          'ticket choices select associated context first'
        );
        safety(snapshot, 'bmad-build', route, review);
      });
    }
  }
  for (const skill of skills) {
    // 29 spellings x four publication inputs x two skills = 232 negatives.
    // Paths are invented sentinels, never actual machine/user locations.
    for (const [form, prose] of [
      ['posix', 'Read /synthetic-private-machine/work/file.md'],
      ['windows-drive', 'Read Z:\\synthetic-private-machine\\work\\file.md'],
      ['windows-forward', 'Read Z:/synthetic-private-machine/work/file.md'],
      ['drive-relative', 'Read Z:synthetic-private-machine\\file.md'],
      ['unc', 'Read \\\\synthetic-private-host\\synthetic-share\\file.md'],
      ['unc-forward', 'Read //synthetic-private-host/synthetic-share/file.md'],
      ['backslash-root', 'Read \\synthetic-private-machine\\file.md'],
      ['home', 'Read ~/synthetic-private-machine/file.md'],
      ['named-home', 'Read ~synthetic-private-user/work/file.md'],
      ['home-backslash', 'Read ~\\synthetic-private-machine\\file.md'],
      ['quoted-spaces', 'Read "/synthetic private machine/work file.md"; keep private.'],
      ['quoted-inroot-spaces', 'Synthetic owned-root path assembled below.'],
      ['delimiters', 'Read [/synthetic-private-machine/work], (/synthetic-private-machine/file).'],
      ['file-uri', 'Read file:///synthetic-private-machine/work/file.md'],
      ['unknown-uri', 'Read synthetic+private://synthetic-private-host/work/file.md'],
      ['malformed-web', 'Read https:\\synthetic-private-machine\\work\\file.md'],
      ['bold-path', 'Read **/synthetic-private-machine/work/file.md**'],
      ['italic-path', 'Read */synthetic-private-machine/work/file.md*'],
      ['underscore-path', 'Read _/synthetic-private-machine/work/file.md_'],
      ['double-underscore-path', 'Read __/synthetic-private-machine/work/file.md__'],
      ['code-path', 'Read `/synthetic-private-machine/work/file.md`'],
      ['link-path', 'Read [private](/synthetic-private-machine/work/file.md)'],
      ['incomplete-bold-path', 'Read **/synthetic-private-machine/work/file.md'],
      ['incomplete-home-var', 'Read **$HOME/synthetic-private-machine/work/file.md'],
      ['incomplete-braced-home-var', 'Read **${HOME}/synthetic-private-machine/work/file.md'],
      ['incomplete-userprofile-var', 'Read **%USERPROFILE%/synthetic-private-machine/work/file.md'],
      ['incomplete-homepath-var', 'Read **%HOMEPATH%/synthetic-private-machine/work/file.md'],
      ['bold-file-uri', 'Read **file:///synthetic-private-machine/work/file.md**'],
      ['bold-credential-uri', 'Read **https://synthetic-user:synthetic-secret@example.com/work**']
    ] as const) {
      for (const surface of proseSurfaces) {
        it(`${skill} rejects foreign ${form} on ${surface} before publication`, () => {
          const f = fixture(skill);
          const prior = render(f);
          const priorBytes = new Map(
            ['manifest.json', ...Object.keys(prior.outputs)].map((name) => [
              name,
              readBytes(join(prior.generation, name))
            ])
          );
          const generations = readdirSync(dirname(prior.generation));
          const candidateProse =
            form === 'quoted-inroot-spaces' ? `Read "${f.root}/synthetic path/file.md"` : prose;
          const { assignments, overrides, input } = privacyProse(f, skill, surface, candidateProse);
          const readonlyInputs = new Map(
            [
              ...markdownFiles(f.skillDir).map((name) => join(f.skillDir, name)),
              join(f.skillDir, 'customize.toml'),
              join(dirname(f.renderer), 'config.toml'),
              input
            ].map((path) => [path, readBytes(path)])
          );
          const result = invoke(
            f.renderer,
            [
              '--project-root',
              f.root,
              '--skill',
              f.skillDir,
              ...(overrides ? ['--overrides', overrides] : []),
              ...assignments.flatMap((assignment) => ['--set', assignment])
            ],
            f.root
          );
          expect(
            !result.error &&
              result.status === 1 &&
              result.stdout === 'HALT: BMAD rendering failed.\n' &&
              result.stderr === '',
            'fixed private rejection; subprocess diagnostics never dumped'
          ).toBe(true);
          expect(
            JSON.stringify(readdirSync(dirname(prior.generation))) === JSON.stringify(generations),
            'no generation or staging publication'
          ).toBe(true);
          expect(
            [...readonlyInputs].every(([path, bytes]) => readBytes(path).equals(bytes)),
            'all source/config/customization inputs remain byte-identical'
          ).toBe(true);
          expect(
            [...priorBytes].every(([name, bytes]) =>
              readBytes(join(prior.generation, name)).equals(bytes)
            ),
            'all prior snapshot and manifest bytes remain unchanged'
          ).toBe(true);
          const priorPublic = [
            JSON.stringify(prior.manifest),
            ...Object.values(prior.outputs)
          ].join('\n');
          expect(
            priorPublic.includes(candidateProse) || priorPublic.includes(sha256(candidateProse)),
            'rejected foreign prose and its hash never enter prior public identity'
          ).toBe(false);
        });
      }
    }
    for (const surface of proseSurfaces) {
      it(`${skill} preserves HTTP/HTTPS and repo-relative prose on ${surface}`, () => {
        const f = fixture(skill);
        const prose =
          'Read [public](https://example.com/docs/reference?mode=public#section), ' +
          '<http://example.org/docs/reference> and [local](mydocs/skills/reference.md), ' +
          '[IPv6](https://[2001:db8::1]/docs/reference), ' +
          '[relative](./AGENTS.md), ../shared/reference.md and {skill-root}/review-prompts/edge-case-hunter.md. ' +
          '<intent-contract>synthetic intent</intent-contract> ' +
          '<frozen-after-approval>synthetic scope</frozen-after-approval> ' +
          '`route: oneshot` **MANDATORY: preserve ordinary marked prose** ' +
          'Read prd-*/prd-*.md, architecture-*/architecture-*.md, synthetic-file-/reference.md ' +
          'and synthetic-?.md/reference.md. ' +
          '**https://example.com/bold** *http://example.org/italic* ' +
          '_https://example.com/underscore_ __http://example.org/strong__ ' +
          '`https://example.com/code` **prd-*/prd-*.md** ' +
          'Read **https://example.com/docs is the public reference** ' +
          'and **http://example.org/docs is the public reference** ' +
          `**${f.root}/AGENTS.md** _${f.root}/AGENTS.md_`;
        const { assignments, overrides, input } = privacyProse(f, skill, surface, prose);
        const before = readBytes(input);
        const defaults = readBytes(join(f.skillDir, 'customize.toml'));
        const snapshot = render(f, assignments, overrides);
        const output =
          snapshot.outputs[surface === 'source' ? 'plan-template.md' : 'step-04-review.md'];
        expect(
          output.includes('https://example.com/docs/reference?mode=public#section') &&
            output.includes('http://example.org/docs/reference') &&
            output.includes('https://[2001:db8::1]/docs/reference') &&
            output.includes('mydocs/skills/reference.md') &&
            output.includes('./AGENTS.md') &&
            output.includes('../shared/reference.md') &&
            output.includes('<intent-contract>synthetic intent</intent-contract>') &&
            output.includes('<frozen-after-approval>synthetic scope</frozen-after-approval>') &&
            output.includes('prd-*/prd-*.md') &&
            output.includes('architecture-*/architecture-*.md') &&
            output.includes('synthetic-file-/reference.md') &&
            output.includes('synthetic-?.md/reference.md') &&
            output.includes('**https://example.com/bold**') &&
            output.includes('*http://example.org/italic*') &&
            output.includes('_https://example.com/underscore_') &&
            output.includes('__http://example.org/strong__') &&
            output.includes('`https://example.com/code`') &&
            output.includes('**https://example.com/docs is the public reference**') &&
            output.includes('**http://example.org/docs is the public reference**') &&
            output.includes('**prd-*/prd-*.md**') &&
            output.includes('**./AGENTS.md** _./AGENTS.md_'),
          'public schemes, XML markup and relative filenames/globs survive unchanged'
        ).toBe(true);
        const boundRoot = surface === 'source' ? `mydocs/skills/${skill}` : snapshot.reference;
        expect(
          output.includes(`${boundRoot}/review-prompts/edge-case-hunter.md`),
          'relative binding survives classification beside whitespace-separated emphasis'
        ).toBe(true);
        if (surface !== 'source') {
          const resolved = snapshot.manifest.inputs.resolved_values[
            'customization.workflow.quick_lenses'
          ] as { instruction: string }[];
          expect(
            resolved[0].instruction === prose.replaceAll(f.root, '.'),
            'manifest retains normalized unbound prose across repeated render passes'
          ).toBe(true);
        }
        expect(
          readBytes(input).equals(before) &&
            readBytes(join(f.skillDir, 'customize.toml')).equals(defaults),
          'legitimate prose and declarations stay read-only'
        ).toBe(true);
      });
    }
    it(`${skill} checkout spaces preserve safe default and absolute config paths`, () => {
      const f = fixture(skill, 'case with spaces-');
      render(f);
      mkdirSync(join(f.root, '_bmad'), { recursive: true });
      const config = join(f.root, '_bmad/config.toml');
      const contents = `[core]\noutput_folder = ${JSON.stringify(join(f.root, 'output with spaces'))}\n`;
      writeFileSync(config, contents);
      const snapshot = render(f);
      expect(JSON.stringify(snapshot.manifest).includes(f.root)).toBe(false);
      expect(Object.values(snapshot.outputs).some((text) => text.includes(f.root))).toBe(false);
      expect(readBytes(config).toString('utf8')).toBe(contents);
    });
    for (const spelling of ['redundant-separators', 'backslashes', 'dot-segments'] as const) {
      it(`${skill} ${spelling} source/config/instruction references normalize across relocated roots`, () => {
        const checkouts = [fixture(skill), fixture(skill)];
        const snapshots = checkouts.map((f) => {
          const canonical = `${f.root}/AGENTS.md`;
          const reference =
            spelling === 'redundant-separators'
              ? canonical.replaceAll('/', '//')
              : spelling === 'backslashes'
                ? canonical.replaceAll('/', '\\')
                : `${f.root.replaceAll('/', '/./')}/mydocs/../AGENTS.md`;
          const path = join(f.skillDir, 'plan-template.md');
          const original = readBytes(path).toString('utf8');
          const source = `${original}\nSynthetic reference: ${reference}\n`;
          const effective = `${original}\nSynthetic reference: ./AGENTS.md\n`;
          writeFileSync(path, source);
          f.sourceHashes['plan-template.md'] = sha256(source);
          f.templateHashes['plan-template.md'] = sha256(effective);
          mkdirSync(join(f.root, '_bmad'));
          const configPath = join(f.root, '_bmad/config.toml');
          const config = `[core]\noutput_folder = ${JSON.stringify(reference)}\n`;
          writeFileSync(configPath, config);
          const instruction = `Read ${reference} and {skill-root}/review-prompts/edge-case-hunter.md`;
          const snapshot = render(f, [
            `workflow.quick_lenses=[{id="quick", name="Synthetic Quick", instruction=${JSON.stringify(instruction)}}]`
          ]);
          expect(
            snapshot.outputs['plan-template.md'].includes('Synthetic reference: ./AGENTS.md'),
            'recognized source reference retains its repository target'
          ).toBe(true);
          expect(
            snapshot.outputs['step-04-review.md'].includes('Read ./AGENTS.md and '),
            'recognized instruction reference retains its repository target'
          ).toBe(true);
          expect(
            snapshot.manifest.inputs.resolved_values['config.core.output_folder'] === 'AGENTS.md',
            'config reference retains its repository target'
          ).toBe(true);
          expect(
            [
              snapshot.instruction,
              JSON.stringify(snapshot.manifest),
              ...Object.values(snapshot.outputs)
            ].some(
              (text) =>
                text.includes(reference) || text.includes(JSON.stringify(reference).slice(1, -1))
            ),
            'original path spelling is absent from public bytes'
          ).toBe(false);
          expect(
            readBytes(path).toString('utf8') === source &&
              readBytes(configPath).toString('utf8') === config,
            'normalization preserves both input byte streams'
          ).toBe(true);
          expect(
            snapshot.manifest.inputs.template_sha256['plan-template.md'] === sha256(effective),
            'hash binds effective template before skill-root binding'
          ).toBe(true);
          return snapshot;
        });
        expect(
          snapshots[0].instruction === snapshots[1].instruction &&
            snapshots[0].manifest.generation_hash === snapshots[1].manifest.generation_hash,
          'equivalent relocated references share stdout and generation identity'
        ).toBe(true);
        expect(
          readBytes(join(snapshots[0].generation, 'manifest.json')).equals(
            readBytes(join(snapshots[1].generation, 'manifest.json'))
          ) && JSON.stringify(snapshots[0].outputs) === JSON.stringify(snapshots[1].outputs),
          'equivalent relocated references share all persistent public bytes'
        ).toBe(true);
      });
    }

    for (const form of ['external-alias', 'file-uri'] as const) {
      it(`${skill} rejects ${form} source and instruction references without altering prior snapshots`, () => {
        for (const surface of ['source', 'instruction'] as const) {
          const f = fixture(skill);
          const prior = render(f);
          const beforeManifest = readBytes(join(prior.generation, 'manifest.json'));
          const aliasFixture = fixture(skill);
          const alias = join(aliasFixture.root, 'checkout-alias');
          symlinkSync(f.root, alias);
          const reference =
            form === 'external-alias' ? `${alias}/AGENTS.md` : `file://${f.root}/AGENTS.md`;
          const path = join(f.skillDir, 'plan-template.md');
          if (surface === 'source')
            writeFileSync(
              path,
              `${readBytes(path).toString('utf8')}\nSynthetic reference: ${reference}\n`
            );
          const before = sha256(readBytes(path));
          const generations = readdirSync(dirname(prior.generation));
          const assignments =
            surface === 'instruction'
              ? [
                  '--set',
                  `workflow.quick_lenses=[{id="quick", name="Synthetic Quick", instruction=${JSON.stringify(`Read ${reference}`)}}]`
                ]
              : [];
          const result = invoke(
            f.renderer,
            ['--project-root', f.root, '--skill', f.skillDir, ...assignments],
            f.root
          );
          expect(
            !result.error &&
              result.status === 1 &&
              result.stdout === 'HALT: BMAD rendering failed.\n' &&
              result.stderr === ''
          ).toBe(true);
          expect(readdirSync(dirname(prior.generation))).toEqual(generations);
          expect(readBytes(join(prior.generation, 'manifest.json')).equals(beforeManifest)).toBe(
            true
          );
          expect(sha256(readBytes(path))).toBe(before);
        }
      });
    }

    it(`${skill} refuses ambiguous symlink dot traversal in source and instruction without publication`, () => {
      for (const surface of ['source', 'instruction'] as const) {
        const f = fixture(skill);
        const outside = fixture(skill);
        symlinkSync(outside.root, join(f.root, 'synthetic-link'));
        const reference = `${f.root}/synthetic-link/../AGENTS.md`;
        const path = join(f.skillDir, 'plan-template.md');
        const source = `${readBytes(path).toString('utf8')}\nSynthetic ambiguous reference: ${reference}\n`;
        if (surface === 'source') writeFileSync(path, source);
        const before = sha256(readBytes(path));
        const assignments =
          surface === 'instruction'
            ? [
                '--set',
                `workflow.quick_lenses=[{id="quick", name="Synthetic Quick", instruction=${JSON.stringify(`Read ${reference}`)}}]`
              ]
            : [];
        const result = invoke(
          f.renderer,
          ['--project-root', f.root, '--skill', f.skillDir, ...assignments],
          f.root
        );
        expect(
          !result.error &&
            result.status === 1 &&
            result.stdout === 'HALT: BMAD rendering failed.\n' &&
            result.stderr === '',
          'ambiguous traversal has fixed private failure'
        ).toBe(true);
        expect(
          existsSync(join(f.root, '_bmad/render')),
          'ambiguous traversal publishes nothing'
        ).toBe(false);
        expect(
          sha256(readBytes(path)) === before,
          'ambiguous traversal preserves source bytes'
        ).toBe(true);
      }
    });

    it(`${skill} resolves stdout against root and nested caller cwd without changing public bytes`, () => {
      const f = fixture(skill);
      const root = render(f);
      const cwd = join(f.root, 'synthetic/nested');
      mkdirSync(cwd, { recursive: true });
      const nested = render(f, [], undefined, cwd);
      expect(
        root.instruction === `${root.reference}/workflow.md`,
        'root caller relative instruction'
      ).toBe(true);
      expect(
        nested.instruction === `../../${root.reference}/workflow.md`,
        'nested caller relative instruction'
      ).toBe(true);
      expect(
        nested.entry === root.entry && existsSync(nested.entry),
        'both instructions reach the same real workflow'
      ).toBe(true);
      expect(
        JSON.stringify(nested.manifest) === JSON.stringify(root.manifest) &&
          JSON.stringify(nested.outputs) === JSON.stringify(root.outputs),
        'cwd never changes persistent bytes'
      ).toBe(true);
    });

    it(`${skill} rejects outside caller cwd before any publication`, () => {
      const f = fixture(skill);
      const outside = fixture(skill);
      const sources = Object.fromEntries(
        markdownFiles(f.skillDir).map((name) => [name, sha256(readBytes(join(f.skillDir, name)))])
      );
      const result = invoke(
        f.renderer,
        ['--project-root', f.root, '--skill', f.skillDir],
        outside.root
      );
      expect(
        !result.error &&
          result.status === 1 &&
          result.stdout === 'HALT: BMAD rendering failed.\n' &&
          result.stderr === '',
        'outside cwd has fixed private failure'
      ).toBe(true);
      expect(existsSync(join(f.root, '_bmad/render')), 'outside cwd publishes nothing').toBe(false);
      expect(
        Object.entries(sources).every(
          ([name, hash]) => sha256(readBytes(join(f.skillDir, name))) === hash
        ),
        'failure preserves all sources'
      ).toBe(true);
    });

    it(`${skill} converts concrete contained absolute config without changing input`, () => {
      const f = fixture(skill);
      mkdirSync(join(f.root, '_bmad'));
      const path = join(f.root, '_bmad/config.toml');
      const config = `[core]\noutput_folder = ${JSON.stringify(join(f.root, 'synthetic-output'))}\n`;
      writeFileSync(path, config);
      const snapshot = render(f);
      expect(
        snapshot.manifest.inputs.resolved_values['config.core.output_folder'] ===
          'synthetic-output',
        'absolute contained config becomes repository-relative'
      ).toBe(true);
      expect(readBytes(path).toString('utf8') === config, 'config remains read-only').toBe(true);
    });

    it(`${skill} rejects concrete outside-root absolute consumed config without disclosure`, () => {
      const f = fixture(skill);
      const outside = fixture(skill);
      mkdirSync(join(f.root, '_bmad'));
      const path = join(f.root, '_bmad/config.toml');
      const config = `[core]\noutput_folder = ${JSON.stringify(join(outside.root, 'synthetic-output'))}\n`;
      writeFileSync(path, config);
      const result = invoke(f.renderer, ['--project-root', f.root, '--skill', f.skillDir], f.root);
      expect(
        !result.error &&
          result.status === 1 &&
          result.stdout === 'HALT: BMAD rendering failed.\n' &&
          result.stderr === '',
        'outside config path has fixed private failure'
      ).toBe(true);
      expect(existsSync(join(f.root, '_bmad/render')), 'outside config publishes nothing').toBe(
        false
      );
      expect(readBytes(path).toString('utf8') === config, 'rejected config remains read-only').toBe(
        true
      );
      expect(
        Object.entries(f.sourceHashes).every(
          ([name, hash]) => sha256(readBytes(join(f.skillDir, name))) === hash
        ),
        'failure preserves sources'
      ).toBe(true);
    });

    it(`${skill} normalizes source templates and custom bound instructions before persistence`, () => {
      const f = fixture(skill);
      const name = 'plan-template.md';
      const path = join(f.skillDir, name);
      const source = `${readBytes(path).toString('utf8')}\nSynthetic source reference: ${f.root}/AGENTS.md\nSynthetic installed skill: {skill-root}/workflow.md\n`;
      writeFileSync(path, source);
      f.sourceHashes[name] = sha256(source);
      f.templateHashes[name] = sha256(source.replaceAll(f.root, '.'));
      const snapshot = render(f, [
        `workflow.quick_lenses=[{id="quick", name="Synthetic Quick", instruction="Read ${f.root}/AGENTS.md and {skill-root}/review-prompts/edge-case-hunter.md"}]`
      ]);
      expect(
        snapshot.outputs[name].includes('./AGENTS.md') &&
          snapshot.outputs[name].includes(`mydocs/skills/${skill}/workflow.md`),
        'source references normalized and bound'
      ).toBe(true);
      expect(
        snapshot.outputs['step-04-review.md'].includes(
          `${snapshot.reference}/review-prompts/edge-case-hunter.md`
        ),
        'custom instruction binds repository-relative generation'
      ).toBe(true);
      expect(
        snapshot.manifest.inputs.template_sha256[name] === sha256(source.replaceAll(f.root, '.')) &&
          snapshot.manifest.inputs.template_sha256[name] !== sha256(source),
        'template hash binds effective private-location-free representation, not raw input'
      ).toBe(true);
      expect(
        readBytes(path).toString('utf8') === source,
        'source normalization never mutates input'
      ).toBe(true);
    });

    it(`${skill} identical consumed fields in relocated owned checkouts have identical public bytes`, () => {
      const first = fixture(skill);
      const second = fixture(skill);
      const snapshots = [first, second].map((f) => {
        mkdirSync(join(f.root, '_bmad'));
        const path = join(f.root, '_bmad/config.toml');
        const config = `[core]\noutput_folder = ${JSON.stringify(join(f.root, 'synthetic-output'))}\n`;
        writeFileSync(path, config);
        const sourcePath = join(f.skillDir, 'plan-template.md');
        const source = `${readBytes(sourcePath).toString('utf8')}\nSynthetic source root: ${f.root}/AGENTS.md\n`;
        writeFileSync(sourcePath, source);
        f.sourceHashes['plan-template.md'] = sha256(source);
        f.templateHashes['plan-template.md'] = sha256(source.replaceAll(f.root, '.'));
        const snapshot = render(f, [
          `workflow.quick_lenses=[{id="quick", name="Synthetic Quick", instruction="Read ${f.root}/AGENTS.md and {skill-root}/review-prompts/edge-case-hunter.md"}]`
        ]);
        expect(
          readBytes(path).toString('utf8') === config,
          'relocated config stays read-only'
        ).toBe(true);
        expect(
          readBytes(sourcePath).toString('utf8') === source,
          'relocated root-bearing source stays unchanged'
        ).toBe(true);
        return snapshot;
      });
      expect(
        snapshots[0].instruction === snapshots[1].instruction,
        'stdout has no location fingerprint'
      ).toBe(true);
      expect(
        readBytes(join(snapshots[0].generation, 'manifest.json')).equals(
          readBytes(join(snapshots[1].generation, 'manifest.json'))
        ),
        'manifest bytes and generation identity are relocation invariant'
      ).toBe(true);
      expect(
        JSON.stringify(snapshots[0].outputs) === JSON.stringify(snapshots[1].outputs),
        'all rendered bytes are relocation invariant'
      ).toBe(true);
      expect(
        JSON.stringify(snapshots[0].manifest.inputs.template_sha256) ===
          JSON.stringify(snapshots[1].manifest.inputs.template_sha256),
        'root-bearing source public template hashes are relocation invariant'
      ).toBe(true);
    });

    it(`${skill} executes the discovered entry command with no installer directory`, () => {
      const f = fixture(skill);
      expect(existsSync(join(f.root, '_bmad')), 'checkout has no installer state').toBe(false);
      const entry = readBytes(join(f.skillDir, 'SKILL.md')).toString('utf8');
      const command = entry.match(/```bash\n([^\n]+)\n```/)?.[1] ?? '';
      const args = (command.match(/"[^"]*"|[^\s"]+/g) ?? []).map((token) =>
        token
          .replace(/^"|"$/g, '')
          .replaceAll('{project-root}', f.root)
          .replaceAll('{skill-root}', f.skillDir)
      );
      expect(args[0], 'shipped command runtime').toBe('python3');
      expect(args.slice(1), 'shipped command binds actual closure and canonical skill').toEqual([
        f.renderer,
        '--project-root',
        f.root,
        '--skill',
        f.skillDir
      ]);
      const result = existingPython(args.slice(1), f.root);
      expect(!result.error && result.status === 0, 'actual entry command succeeds').toBe(true);
      const snapshot = render(f);
      expect(
        result.stdout === `read and follow ${snapshot.instruction}\n`,
        'entry command uses actual immutable workflow'
      ).toBe(true);
      safety(snapshot, skill, 'auto', 'quick');
      expect(
        existsSync(join(f.root, '_bmad/config.toml')),
        'no installer configuration synthesized'
      ).toBe(false);
    });

    it(`${skill} honors read-only user configuration precedence`, () => {
      const f = fixture(skill);
      const custom = join(f.root, '_bmad/custom');
      mkdirSync(custom, { recursive: true });
      const central = '[core]\noutput_folder = "{project-root}/custom-output"\n';
      const user = '[core]\nactive_initiative = "synthetic-initiative"\n';
      writeFileSync(join(f.root, '_bmad/config.toml'), central);
      writeFileSync(join(custom, 'config.user.toml'), user);
      const snapshot = render(f);
      expect(
        snapshot.manifest.inputs.resolved_values['config.core.output_folder'] === 'custom-output',
        'project override beats shipped default'
      ).toBe(true);
      expect(snapshot.manifest.inputs.resolved_values['config.core.active_initiative']).toBe(
        'synthetic-initiative'
      );
      expect(
        readBytes(join(f.root, '_bmad/config.toml')).toString('utf8') === central,
        'project config unchanged'
      ).toBe(true);
      expect(
        readBytes(join(custom, 'config.user.toml')).toString('utf8') === user,
        'user config unchanged'
      ).toBe(true);
    });

    it(`${skill} changing the helper invalidates generation identity`, () => {
      const f = fixture(skill);
      const before = render(f);
      const helper = join(dirname(f.renderer), 'config_utils.py');
      const priorManifest = sha256(readBytes(join(before.generation, 'manifest.json')));
      const priorEntry = sha256(readBytes(before.entry));
      writeFileSync(
        helper,
        `${readBytes(helper).toString('utf8')}\n# synthetic helper identity change\n`
      );
      const after = render(f);
      expect(after.entry !== before.entry, 'helper changes cannot reuse a generation').toBe(true);
      expect(
        sha256(readBytes(join(before.generation, 'manifest.json'))) === priorManifest &&
          sha256(readBytes(before.entry)) === priorEntry,
        'new identity preserves the prior generation unchanged'
      ).toBe(true);
    });

    it(`${skill} permits a single-ID cross-layer override outside shipped source directories`, () => {
      const f = fixture(skill);
      const outside = fixture(skill);
      const defaults = join(f.skillDir, 'customize.toml');
      const before = sha256(readBytes(defaults));
      const overrides = join(outside.root, 'synthetic-override.toml');
      const candidate =
        '[[workflow.quick_lenses]]\nid = "quick"\nname = "Synthetic Quick"\ninstruction = "Synthetic cross-layer review witness."\n';
      writeFileSync(overrides, candidate);
      const snapshot = render(f, [], overrides);
      expect(
        [
          snapshot.instruction,
          JSON.stringify(snapshot.manifest),
          ...Object.values(snapshot.outputs)
        ].some((text) => text.includes(outside.root) || text.includes(basename(overrides))),
        'authorized external override filename is never persisted or printed'
      ).toBe(false);
      expect(
        snapshot.manifest.inputs.resolved_values['customization.workflow.quick_lenses']
      ).toEqual([
        {
          id: 'quick',
          name: 'Synthetic Quick',
          instruction: 'Synthetic cross-layer review witness.'
        }
      ]);
      assertText(
        snapshot.outputs['step-04-review.md'],
        /Synthetic cross-layer review witness\./,
        'legitimate lens override renders'
      );
      expect(sha256(readBytes(defaults)), 'shipped declarations remain unchanged').toBe(before);
      expect(
        readBytes(overrides).toString('utf8') === candidate,
        'external invocation input remains unchanged'
      ).toBe(true);
    });

    it(`${skill} ignores valid alternate helper bytecode and hashes executed source bytes`, () => {
      const f = fixture(skill);
      const helper = join(dirname(f.renderer), 'config_utils.py');
      const helperHash = sha256(readBytes(helper));
      const sentinel = join(f.root, 'synthetic-cache-executed');
      const alternate = join(f.root, 'synthetic-cache-source.py');
      writeFileSync(
        alternate,
        `${readBytes(helper).toString('utf8')}\nPath(${JSON.stringify(sentinel)}).write_text("synthetic cache executed")\n`
      );
      const prepared = existingPython(
        [
          '-c',
          [
            'import importlib.util, pathlib, py_compile, sys',
            'cache = importlib.util.cache_from_source(sys.argv[1])',
            'pathlib.Path(cache).parent.mkdir(parents=True, exist_ok=True)',
            'py_compile.compile(sys.argv[2], cfile=cache, dfile=sys.argv[1], doraise=True, invalidation_mode=py_compile.PycInvalidationMode.UNCHECKED_HASH)',
            'print(cache)'
          ].join('\n'),
          helper,
          alternate
        ],
        f.root
      );
      expect(
        !prepared.error && prepared.status === 0 && prepared.stderr.length === 0,
        'valid synthetic helper cache prepared'
      ).toBe(true);
      const cache = prepared.stdout.trim();
      expect(
        isAbsolute(cache) && owned(cache) && relative(f.root, cache).split(/[\\/]/)[0] === 'tools',
        'cache remains in this synthetic fixture'
      ).toBe(true);
      const cacheBytes = readBytes(cache);
      expect(cacheBytes.readUInt32LE(4), 'cache uses valid unchecked-hash invalidation').toBe(1);
      const cacheHash = sha256(cacheBytes);
      const snapshot = render(f);
      expect(
        snapshot.manifest.inputs.config_utils_sha256,
        'manifest binds executed canonical helper bytes'
      ).toBe(helperHash);
      expect(existsSync(sentinel), 'alternate cached helper never executes').toBe(false);
      expect(sha256(readBytes(cache)), 'cached input remains unchanged').toBe(cacheHash);
      expect(sha256(readBytes(helper)), 'canonical helper source remains unchanged').toBe(
        helperHash
      );
    });

    for (const failure of [
      'missing-defaults',
      'malformed-user',
      'missing-helper',
      'missing-prompt',
      'missing-jinja',
      'foreign-skill',
      'escaped-source',
      'escaped-output',
      'unsafe-template',
      'empty-entry',
      'omitted-link',
      'duplicate-override',
      'corrupt-generation',
      'foreign-helper',
      'escaped-defaults',
      'escaped-customize',
      'duplicate-quick-invocation',
      'duplicate-quick-persistent',
      'duplicate-quick-defaults',
      'duplicate-mixed-quick-invocation',
      'duplicate-mixed-quick-persistent'
    ] as const) {
      it(`${skill} fails closed for ${failure} without private error dumps`, () => {
        const f = fixture(skill);
        let assignments: string[] = [];
        let skillDir = f.skillDir;
        let overrides: string | undefined;
        let sentinel: string | undefined;
        const unchanged = new Map<string, string>();
        if (failure === 'foreign-helper') {
          const outside = fixture(skill);
          sentinel = join(outside.root, 'synthetic-helper-executed');
          const foreign = join(outside.root, 'synthetic-helper.py');
          writeFileSync(
            foreign,
            `from pathlib import Path\nPath(${JSON.stringify(sentinel)}).write_text("synthetic body executed")\n`
          );
          const helper = join(dirname(f.renderer), 'config_utils.py');
          rmSync(helper);
          symlinkSync(foreign, helper);
        }
        if (failure === 'escaped-defaults' || failure === 'escaped-customize') {
          const outside = fixture(skill);
          const shipped =
            failure === 'escaped-defaults'
              ? join(dirname(f.renderer), 'config.toml')
              : join(f.skillDir, 'customize.toml');
          const foreign =
            failure === 'escaped-defaults'
              ? join(dirname(outside.renderer), 'config.toml')
              : join(outside.skillDir, 'customize.toml');
          unchanged.set(foreign, sha256(readBytes(foreign)));
          rmSync(shipped);
          symlinkSync(foreign, shipped);
        }
        if (
          failure === 'duplicate-quick-invocation' ||
          failure === 'duplicate-quick-persistent' ||
          failure === 'duplicate-quick-defaults' ||
          failure === 'duplicate-mixed-quick-invocation' ||
          failure === 'duplicate-mixed-quick-persistent'
        ) {
          const defaults = join(f.skillDir, 'customize.toml');
          const duplicate =
            '[[workflow.quick_lenses]]\nid = "quick"\nname = "Synthetic Quick"\ninstruction = "Synthetic duplicate witness."\n';
          let candidate: string;
          if (failure === 'duplicate-quick-defaults') {
            candidate = defaults;
            writeFileSync(candidate, `${readBytes(defaults).toString('utf8')}\n${duplicate}`);
          } else {
            unchanged.set(defaults, sha256(readBytes(defaults)));
            if (
              failure === 'duplicate-quick-persistent' ||
              failure === 'duplicate-mixed-quick-persistent'
            ) {
              const custom = join(f.root, '_bmad/custom');
              mkdirSync(custom, { recursive: true });
              candidate = join(custom, `${skill}.user.toml`);
            } else {
              const outside = fixture(skill);
              candidate = join(outside.root, 'synthetic-duplicate.toml');
              overrides = candidate;
            }
            const mixed =
              failure === 'duplicate-mixed-quick-invocation' ||
              failure === 'duplicate-mixed-quick-persistent';
            writeFileSync(
              candidate,
              mixed
                ? `${duplicate}code = "synthetic-first"\n${duplicate}code = "synthetic-second"\n`
                : duplicate + duplicate
            );
          }
          unchanged.set(candidate, sha256(readBytes(candidate)));
        }
        if (failure === 'foreign-skill') skillDir = fixture(skill).skillDir;
        if (failure === 'escaped-output') {
          const outside = fixture(skill);
          mkdirSync(join(outside.root, '_bmad'));
          symlinkSync(join(outside.root, '_bmad'), join(f.root, '_bmad'));
        }
        if (failure === 'unsafe-template')
          writeFileSync(
            join(f.skillDir, 'workflow.md'),
            '{{ cycler.__init__.__globals__.os.getcwd() }}\n'
          );
        if (failure === 'escaped-source') {
          const outside = fixture(skill);
          rmSync(join(f.skillDir, 'workflow.md'));
          symlinkSync(join(outside.skillDir, 'workflow.md'), join(f.skillDir, 'workflow.md'));
        }
        if (failure === 'missing-defaults') rmSync(join(dirname(f.renderer), 'config.toml'));
        if (failure === 'missing-helper') rmSync(join(dirname(f.renderer), 'config_utils.py'));
        if (failure === 'missing-prompt')
          rmSync(join(f.skillDir, 'review-prompts/edge-case-hunter.md'));
        if (failure === 'malformed-user') {
          mkdirSync(join(f.root, '_bmad/custom'), { recursive: true });
          writeFileSync(join(f.root, '_bmad/custom/config.user.toml'), '[broken');
        }
        if (failure === 'empty-entry') writeFileSync(join(f.skillDir, 'workflow.md'), '');
        if (failure === 'omitted-link') {
          writeFileSync(join(f.skillDir, 'workflow.md'), '{{ rendered("synthetic-empty.md") }}\n');
          writeFileSync(join(f.skillDir, 'synthetic-empty.md'), '');
        }
        if (failure === 'duplicate-override')
          assignments = ['workflow.route=full', 'workflow.route=oneshot'];
        if (failure === 'corrupt-generation') {
          const prior = render(f);
          writeFileSync(prior.entry, 'synthetic corruption');
        }
        const args = [
          f.renderer,
          '--project-root',
          f.root,
          '--skill',
          skillDir,
          ...(overrides ? ['--overrides', overrides] : []),
          ...assignments.flatMap((value) => ['--set', value])
        ];
        const result = existingPython(failure === 'missing-jinja' ? ['-S', ...args] : args, f.root);
        expect(!result.error && result.status === 1, 'renderer failure is explicit').toBe(true);
        expect(result.stdout === 'HALT: BMAD rendering failed.\n', 'fixed bounded diagnostic').toBe(
          true
        );
        expect(
          result.stderr.length === 0 &&
            !result.stdout.includes(f.root) &&
            !/Traceback|\[broken/.test(result.stdout),
          'no paths, raw config or stack leaks'
        ).toBe(true);
        if (sentinel)
          expect(existsSync(sentinel), 'foreign helper body never executes').toBe(false);
        for (const [path, hash] of unchanged) {
          expect(
            sha256(readBytes(path)),
            'rejection preserves candidate inputs and declarations'
          ).toBe(hash);
        }
        if (failure !== 'corrupt-generation') {
          expect(existsSync(join(f.root, '_bmad/render')), 'failure does not publish').toBe(false);
        }
      });
    }

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
