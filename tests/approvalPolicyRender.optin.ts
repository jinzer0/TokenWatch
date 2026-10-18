import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
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
        `workflow.quick_lenses=[{id="quick", name="Quick", instruction=${instruction}}]`
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
        `[[workflow.quick_lenses]]\nid = "quick"\nname = "Quick"\ninstruction = ${instruction}\n`
      );
    }
  }
  return { assignments, overrides, input };
}
function privateRejection(
  f: Fixture,
  prior: Snapshot,
  inputs: string[],
  assignments: string[] = [],
  cwd = f.root,
  overrides?: string
): void {
  const before = new Map(inputs.map((path) => [path, readBytes(path)]));
  const oldOutputs = new Map(
    ['manifest.json', ...Object.keys(prior.outputs)].map((name) => [
      name,
      readBytes(join(prior.generation, name))
    ])
  );
  const generations = readdirSync(dirname(prior.generation)).sort();
  const result = invoke(
    f.renderer,
    [
      '--project-root',
      f.root,
      '--skill',
      f.skillDir,
      ...(overrides ? ['--overrides', overrides] : []),
      ...assignments.flatMap((value) => ['--set', value])
    ],
    cwd
  );
  expect(!result.error && result.status === 1, 'encoded private input fails closed').toBe(true);
  expect(result.stdout === 'HALT: BMAD rendering failed.\n' && result.stderr === '').toBe(true);
  expect(
    [...before].every(([path, bytes]) => readBytes(path).equals(bytes)),
    'inputs unchanged'
  ).toBe(true);
  expect(
    [...oldOutputs].every(([name, bytes]) => readBytes(join(prior.generation, name)).equals(bytes)),
    'prior snapshot and manifest unchanged'
  ).toBe(true);
  expect(readdirSync(dirname(prior.generation)).sort()).toEqual(generations);
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
      if (link[1].split('/').some((part) => part === '.' || part === '..')) {
        const suffix = relative(f.root, resolve(f.root, `${reference}/${link[1]}`));
        expect(
          !isAbsolute(suffix) &&
            suffix !== '..' &&
            !suffix.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`),
          `${name}: parent reference is contained, not a generated sibling`
        ).toBe(true);
        continue;
      }
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
  // Reuse the default and 24 route/review witnesses. These assertions inspect
  // actual rendered instructions, not LLM lifecycle execution/native enforcement.
  const lifecycle =
    skill === 'bmad-build'
      ? (files['workflow.md']
          .split('## Durable original review provenance (before intermediate effects)')[1]
          ?.split('## READY FOR DEVELOPMENT STANDARD')[0] ?? '')
      : (files['step-04-review.md']
          .split('### Durable original review provenance (before intermediate effects)')[1]
          ?.split('Record status `in-review`')[0] ?? '');
  for (const pattern of [
    /exact canonical path AND task/,
    /append-only `review_cycle`|`review_cycle`[\s\S]*append-only/,
    /interruption\/repeated resume/,
    /intermediate `in-review` 또는 다른 task/,
    /missing original review provenance/,
    /atomic append/,
    /re-read/,
    /write-denied, non-durable\/missing context, concurrent change, validation\/readback failure/,
    /dependent effects만 차단/,
    /provenance failed write는 status를 바꿀 수 없/,
    /`\{followup_pass\} = true` iff original status is `built` or `done`/,
    /그 외에는 false/,
    /route pin과 review pin은 별도 runtime 선택이며 provenance를 만들거나 바꾸지 않는다/,
    /frontmatter 추가, human body\/heading\/path 변환·복사·번역/,
    /raw private path\/identifier 또는 그 hash 저장은 금지/
  ])
    assertText(lifecycle, pattern, `${skill}: rendered durable original ${pattern.source}`);
  const directReview = files['step-04-review.md'];
  const directReviewGuard =
    directReview.split('## INSTRUCTIONS')[1]?.split('### State/evidence location')[0] ?? '';
  assertText(
    directReviewGuard,
    /read-only\/planning-only\/report-only/i,
    'rendered direct review guard before provenance'
  );
  assertText(directReviewGuard, /STOP/, 'rendered direct review has no mutable fallthrough');
  const originalIndex = directReview.indexOf('### Durable original review provenance');
  expect(
    originalIndex >= 0 && originalIndex < directReview.indexOf('Record status `in-review`'),
    'rendered original precedes intermediate review effects'
  ).toBe(true);
  const final =
    skill === 'bmad-build'
      ? (files['step-05-present.md']
          .split('### Mark Plan Built')[1]
          ?.split('### Commit and Complete')[0] ?? '')
      : (directReview.split('## Finalize')[1] ?? '');
  for (const pattern of [
    /SAME selected/,
    /open `review_cycle`|open cycle/,
    /resume_incoming_status/,
    /missing\/conflicting\/foreign/,
    /final status와 해당 cycle/,
    /원자적으로[\s\S]*re-read/,
    /`done`[\s\S]*verified follow-up만 `done`/,
    /`built` 원본은 `built`, fresh\/in-progress\/absent 원본도 성공 시 `built`/,
    /성공 status를 쓰거나 원본을 clear하지 않고 incomplete/,
    /completion[\s\S]*append/,
    /이전 원본\/로그[\s\S]*삭제/,
    /interruption, HALT, retry/,
    /(?:다음[\s\S]*cycle[\s\S]*재사용하지 않|완료된 cycle은 다음 실제 delegated review의 원본으로 재사용하지 않)/
  ])
    assertText(final, pattern, `${skill}: rendered terminal provenance ${pattern.source}`);
  if (skill === 'bmad-build') {
    assertText(
      final,
      /presentation 시점의 현재 status를 original로 capture하지 않는다/,
      'presentation consumes durable original, never current in-review'
    );
    assertText(
      final,
      /open cycle 없는 terminal presentation[\s\S]*새 review\/status 전이를 만들지 않는다/,
      'terminal presentation cannot start a review'
    );
    if (route !== 'full') {
      const oneshot = files['step-oneshot.md'];
      assertText(
        oneshot,
        /direct oneshot 재진입도 최초 `resume_incoming_status`와 `followup_pass`를 재사용/,
        'oneshot consumes original after interrupted resume'
      );
      expect(
        oneshot.indexOf('atomic append하고 re-read') <
          oneshot.indexOf('Record `baseline_revision`'),
        'oneshot durable original before implementation effects'
      ).toBe(true);
      assertText(
        oneshot.split('### Finalize Plan')[1] ?? '',
        /final status와 해당 cycle completion[\s\S]*atomic persist하고 re-read[\s\S]*missing\/conflicting\/foreign provenance/,
        'oneshot atomic completion and association failure guard'
      );
    }
  }
  const implementation = files['step-03-implement.md'];
  const implementationGuard =
    implementation.split('## INSTRUCTIONS')[1]?.split('### State/evidence location')[0] ?? '';
  assertText(
    implementationGuard,
    /read-only\/planning-only\/report-only/i,
    'direct implementation mode guard precedes provenance'
  );
  assertText(implementationGuard, /terminate|STOP/, 'direct implementation mode guard exits');
  const implementationProvenance =
    implementation
      .split('### Durable original review provenance (before intermediate effects)')[1]
      ?.split('### Baseline')[0] ?? '';
  for (const pattern of [
    /SAME selected exact canonical path AND task/,
    /현재 `done`\/`built`에 실제 delegated follow-up이 없으면[\s\S]*nonmutating terminal evidence만 보고한 뒤 STOP/,
    /follow-up이 review만 위임하면 구현을 재시작하지 않고 step-04로 이동[\s\S]*baseline\/status\/metadata를 쓰지 않는다/,
    /최초 `resume_incoming_status`와 cycle 연결을 re-read하여 그대로 재사용/,
    /`\{followup_pass\} = true` iff original status is `built` or `done`; 그 외에는 false/,
    /intermediate `in-review`\/`in-progress` 또는 다른 task\/context 값으로 교체하지 않는다/,
    /authorized terminal technical repair[\s\S]*atomic append하고 re-read[\s\S]*뒤에만 아래 effects를 허용/,
    /새 비terminal 구현은 cycle을 꾸며 만들지 않으며/,
    /association\/cycle이 missing\/conflicting\/foreign이면 dependent effects만 차단/,
    /write-denied, non-durable context, concurrent change, validation\/readback failure[\s\S]*independent safe analysis는 계속/,
    /step-03은 cycle을 clear\/close하지 않는다/
  ])
    assertText(
      implementationProvenance,
      pattern,
      `${skill}: actual rendered direct implementation original ${pattern.source}`
    );
  expect(
    implementation.indexOf('### Durable original review provenance') <
      implementation.indexOf('Record `baseline_revision`'),
    'direct implementation original before baseline effects'
  ).toBe(true);
  expect(
    implementation.indexOf('### Durable original review provenance') <
      implementation.search(/record status `in-progress`/i),
    'direct implementation original before intermediate status'
  ).toBe(true);
  const boundary =
    implementation.split('### Privacy-safe implementation handoff')[1]?.split('### Implement')[0] ??
    '';
  for (const pattern of [
    /Outside-repository canonical intent remains leader-only/,
    /Before ANY child\/tool implementation dispatch[\s\S]*entire substituted instruction and every referenced input/,
    /require exact-root containment, safe task ownership, safe path strings and sanitized contents\/ranges/,
    /If a safe payload cannot preserve material acceptance meaning[\s\S]*block dependent completion\/publication/,
    /unknown or unsafe prior context makes it ineligible for reuse/,
    /Workers implement only their bounded slices[\s\S]*never edit canonical state, run gates\/formatters or further delegate/
  ])
    assertText(
      boundary,
      pattern,
      `${skill}: actual rendered implementation preflight ${pattern.source}`
    );
  if (skill !== 'bmad-build-auto' || route !== 'oneshot') {
    expect(
      implementation.indexOf('Before ANY child/tool implementation dispatch, preflight') <
        implementation.indexOf('Launch a subagent with no prior conversation context'),
      'entire payload preflight before implementation recipe'
    ).toBe(true);
    const tail =
      implementation.split(
        'Launch a subagent with no prior conversation context, with this prompt:'
      )[1] ?? '';
    const end =
      'Missing material criteria block the affected implementation, never imply acceptance or scope reduction.';
    expect(tail.includes(end), 'actual default child contract end is present').toBe(true);
    const worker = tail.split(end)[0];
    assertText(
      worker,
      /Implementation contract: \{implementation_contract\}/,
      'rendered worker receives safe contract'
    );
    assertText(
      worker,
      /Approved repository-relative source\/hunk references: \{implementation_files\}/,
      'rendered worker receives only approved refs'
    );
    expect(
      /\{(?:plan_file|plan_path|verbatim_intent|claims_file|diff_file|project-root|skill-root)\}/.test(
        worker
      ),
      'actual child prompt does not export leader runtime aliases'
    ).toBe(false);
  }
  if (review !== 'none')
    assertText(
      files['step-04-review.md'],
      /Before any implementation repair dispatch or worker re-engagement[\s\S]*preflight the entire repair instruction and every referenced input/,
      'resumed repair reapplies payload and reference preflight'
    );
  for (const name of ['step-04-review.md', 'step-oneshot.md']) {
    const text = files[name];
    if (!text || !text.includes('Runtime review placeholders')) continue;
    assertText(
      text,
      /Outside-repository canonical intent remains leader-only/,
      `${name}: private intent stays with leader`
    );
    assertText(
      text,
      /Before ANY child\/tool reviewer launch[\s\S]*entire substituted instruction and every referenced input/,
      `${name}: no unsafe override dispatch`
    );
    assertText(
      text,
      /Required review stays incomplete and dependent completion\/publication remains blocked/,
      `${name}: unsafe handoff cannot pass`
    );
    assertText(
      text,
      /Required review is complete only when every such lane successfully executed/,
      `${name}: lane reply is not successful completion`
    );
    assertText(
      text,
      /failed, error-only[\s\S]*cancelled or inconclusive required lanes leave review incomplete/,
      `${name}: errors do not clear required review`
    );
    expect(
      /\{(?:verbatim_intent|diff_file|claims_file)\}|substituted absolute/.test(text),
      `${name}: obsolete private payload instructions absent`
    ).toBe(false);
    expect(
      /^Review content: \{review_scope\}/m.test(text),
      `${name}: actual default labels match bundled reader`
    ).toBe(false);
    for (const placeholder of [
      'review_acceptance',
      'review_scope',
      'review_files',
      'review_prompt'
    ])
      expect(text.includes(`{${placeholder}}`)).toBe(true);
  }
  for (const name of ['review-prompts/edge-case-hunter.md', 'review-prompts/verification-gap.md']) {
    const text = files[name];
    assertText(
      text,
      /Review content and verification facts:/,
      `${name}: consumes real sanitized default labels`
    );
    expect(
      /Read current canonical human intent|Read the canonical claims source|\*\*claims_file\*\*/.test(
        text
      ),
      `${name}: no canonical fallback in rendered closure`
    ).toBe(false);
  }
  assertText(
    files['workflow.md'],
    /snapshot reference[\s\S]*repository-root-relative/,
    `${skill}: rendered steps have repository base`
  );
  assertText(
    files['workflow.md'],
    /loading reference alone is relative to the unchanged caller cwd/,
    `${skill}: rendered entry loading has caller base`
  );
  expect(
    files['workflow.md'].includes('absolute snapshot path'),
    'obsolete nested-cwd convention is absent'
  ).toBe(false);
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
      /required verification\/acceptance and required review are satisfied[\s\S]*`done`인 verified follow-up만 `done`으로 복원[\s\S]*`built` 원본은 `built`, fresh\/in-progress\/absent 원본도 성공 시 `built`/i,
      'rendered eligible completion may record built without downgrading done'
    );
    assertText(
      built,
      /authorized task-owned BMAD metadata 또는 기존 durable associated canonical context\/task만 사용/,
      'rendered built supports both canonical formats'
    );
    assertText(
      built,
      /missing\/conflicting\/foreign association[\s\S]*새 artifact\/frontmatter나 human body\/path 변환 없이/,
      'rendered built preserves canonical content'
    );
    assertText(
      built,
      /read-only\/planning-only\/report-only[\s\S]*incomplete required review[\s\S]*do not write `built`/i,
      'rendered terminal rejects unauthorized or failed success'
    );
    assertText(
      built,
      /incoming `done`을 `done`으로 보존하고 `built`도 그대로 두며 새 review\/status 전이를 만들지 않는다/,
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
      /If 리뷰 분류 기록 at the resolved state\/evidence location already has rows/,
      'rendered resume uses resolved log'
    );
    assertText(
      ordinaryReview,
      /Every finding gets one row in 리뷰 분류 기록 at the resolved state\/evidence location/,
      'rendered findings use resolved log'
    );
    assertText(
      ordinaryReview,
      /unformatted canonical plan[\s\S]*existing context without adding a section or editing the plan/,
      'rendered triage cannot mutate the human plan'
    );
    expect(
      /(?:Review Triage Log|리뷰 분류 기록)` section of `\{plan_file\}`/.test(ordinaryReview),
      'no rendered forced triage section'
    ).toBe(false);
  }
  if (skill === 'bmad-build-auto') {
    const guard =
      files['step-04-review.md']
        .split('## INSTRUCTIONS')[1]
        ?.split('### State/evidence location')[0] ?? '';
    assertText(guard, /read-only\/planning-only\/report-only/, 'rendered direct auto review modes');
    assertText(
      guard,
      /STOP here before[\s\S]*Finalize/,
      'rendered direct auto review terminal exit'
    );
    expect(/then apply Finalize/.test(guard), 'no rendered Finalize handoff').toBe(false);
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
  if (skill === 'bmad-build-auto') {
    const clarify = files['step-01-clarify-and-route.md'];
    const implement = files['step-03-implement.md'];
    const activeReview = files['step-04-review.md'];
    expect(
      clarify.indexOf('### Effective implementation route') <
        clarify.indexOf('### Existing-state dispatch'),
      'auto entry resolves route before recorded-status dispatch'
    ).toBe(true);
    assertText(
      clarify,
      /ready-for-dev` or `in-progress`[\s\S]*only resolved `\{effective_route\} = full\|oneshot`[\s\S]*Unresolved route blocks dependent implementation without fallthrough/,
      'auto ready and in-progress cannot fall into full'
    );
    assertText(
      clarify,
      /incoming verified `done` remains `done`/,
      'auto terminal continuity survives route validation'
    );
    expect(
      implement.indexOf('### Select exactly one effective route BEFORE effects') <
        implement.indexOf('### Baseline'),
      'auto route selected before writes or handoff'
    );
    assertText(
      implement,
      /Any other rendered branch is dormant instructions, never executed or required/,
      'both emitted implementation branches are not two active workers'
    );
    expect(
      implement.includes('#### Oneshot (active ONLY when `{effective_route} = oneshot`)')
    ).toBe(route !== 'full');
    expect(implement.includes('#### Full (active ONLY when `{effective_route} = full`)')).toBe(
      route !== 'oneshot'
    );
    assertText(
      implement,
      /Recheck the SAME selected association and invocation pin or recorded `\{effective_route\} = full\|oneshot` before active review dispatch/,
      'implementation-to-review revalidates current selection'
    );
    expect(
      activeReview.indexOf('### Effective implementation route and review depth') <
        activeReview.indexOf('Record status `in-review`'),
      'auto review resolves route and depth before status'
    );
    assertText(
      activeReview,
      /Revalidate effective implementation route independently of review depth before every bad_plan, patch, failed-verification repair, resume and Finalize/,
      'repair cannot fall into another implementation route'
    );
    if (review !== 'none')
      assertText(
        activeReview,
        /FIRST recheck `\{effective_route\}` and exact selected state\/evidence association before any bad_plan\/patch\/failed-verification repair/,
        'active triage repeats route preflight before repair'
      );
    if (route === 'auto') {
      assertText(
        clarify,
        /Missing, unknown or conflicting route leaves it unresolved/,
        'missing stored route is not fresh default'
      );
      assertText(
        implement,
        /Missing, unknown or conflicting route blocks dependent implementation\/repair/,
        'legacy implementation fallback is forbidden'
      );
      assertText(
        activeReview,
        /Missing, unknown or conflicting route blocks dependent active review\/repair/,
        'direct review resume cannot evade selection'
      );
    }
    if (route === 'auto' && review === 'auto') {
      assertText(
        activeReview,
        /Quick set — active ONLY when `\{effective_review\} = quick`/,
        'runtime quick selected from effective oneshot'
      );
      assertText(
        activeReview,
        /Thorough set — active ONLY when `\{effective_review\} = thorough`/,
        'runtime thorough selected from effective full'
      );
      assertText(
        activeReview,
        /Both groups are rendered for runtime selection, not both required/,
        'dormant lenses do not become required'
      );
    }
    assertText(
      plan,
      /Never overwrite an existing recorded `route`\/`route_source`/,
      `${skill}: stored provenance never replaced by invocation`
    );
    if (route !== 'auto') {
      assertText(
        plan,
        new RegExp(`effective_route} = ${route}`),
        `${skill}: invocation selects effective route`
      );
      assertText(
        plan,
        /effective_route_source} = pinned/,
        `${skill}: invocation-only pinned provenance`
      );
    } else {
      assertText(
        plan,
        /effective_route_source} = recorded/,
        `${skill}: existing state uses actual recorded route`
      );
      assertText(
        plan,
        /ONLY for a genuine fresh route choice[\s\S]*effective_route_source} = auto/,
        `${skill}: fresh selection is not resume fallback`
      );
    }
    assertText(
      plan,
      /record the actual selected `route: 'oneshot'` or `route: 'full'` and `route_source` from runtime/,
      `${skill}: fresh metadata records resolved selection`
    );
  } else if (route !== 'auto') {
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
        const carry = classify.match(/^ {3}If 리뷰 분류 기록[^\n]+/m)?.[0] ?? '';
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
          /현재 required verification\/acceptance 만족, 모든 applicable required native review lane의 successful execution\/completion 및 actual authority가 있을 때만[\s\S]*`built`를 선택/,
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
  if (skill === 'bmad-build' && review !== 'none') {
    const resumedReview = files['step-04-review.md'];
    const depth =
      review === 'auto'
        ? route === 'oneshot'
          ? 'quick'
          : route === 'full'
            ? 'thorough'
            : undefined
        : review;
    if (depth)
      assertText(
        resumedReview,
        new RegExp(`review: '${depth}'`),
        'direct step04 resume uses effective pinned depth'
      );
    else {
      assertText(
        resumedReview,
        /Quick group[\s\S]*effective_review[\s\S]*quick/,
        'recorded oneshot direct review branch exists'
      );
      assertText(
        resumedReview,
        /Thorough group[\s\S]*effective_review[\s\S]*thorough/,
        'recorded full direct review branch exists'
      );
    }
    const repairs =
      resumedReview
        .split('**bad_plan** — Same-scope technical correction')[1]
        ?.split('**defer**')[0] ?? '';
    assertText(
      repairs,
      /effective implementation route/,
      'repair route is independent of review depth'
    );
    if (route !== 'full')
      expect(
        repairs.includes(`${snapshot.reference}/step-oneshot.md`),
        'oneshot technical repair link exists'
      ).toBe(true);
    if (route !== 'oneshot')
      expect(
        repairs.includes(`${snapshot.reference}/step-03-implement.md`),
        'full technical repair link exists'
      ).toBe(true);
  }
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
          : route === 'full'
            ? 'thorough'
            : undefined
        : review;
    if (expected)
      assertText(renderedReview, new RegExp(`review: '${expected}'`), 'resolved review branch');
    else {
      assertText(renderedReview, /Quick (?:set|group)/, 'auto route quick review witness');
      assertText(renderedReview, /Thorough (?:set|group)/, 'auto route thorough review witness');
      if (skill === 'bmad-build') {
        assertText(
          renderedReview,
          /Select exactly one lens group[\s\S]*BEFORE writing `in-review`/,
          'runtime review depth is selected before effects'
        );
        assertText(
          renderedReview,
          /dormant groups are not required and must not be launched/,
          'inactive rendered lenses are not completion blockers'
        );
        assertText(
          renderedReview,
          /Unknown, conflicting or missing needed route evidence blocks dependent review/,
          'no guessed full review on invalid recorded route'
        );
      }
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
  for (const key of ['id', 'code']) {
    it(`keyed merge preserves nested unspecified fields order and inputs for ${key}`, () => {
      const f = fixture('bmad-build');
      const script = `
import json, sys
sys.path.insert(0, sys.argv[1])
from config_utils import structural_merge
key = sys.argv[2]
base = [{key: "first", "name": "Declared", "instruction": "initial", "metadata": {"keep": True, "values": [1]}}, {key: "second", "name": "Untouched"}]
override = [{key: "first", "instruction": "", "metadata": {"values": [2]}}, {key: "third", "name": "Added"}]
before = json.dumps([base, override])
result = structural_merge(base, override)
assert result == [{key: "first", "name": "Declared", "instruction": "", "metadata": {"keep": True, "values": [1, 2]}}, {key: "second", "name": "Untouched"}, {key: "third", "name": "Added"}]
assert json.dumps([base, override]) == before
print("keyed-merge-ok")
`;
      const result = existingPython(['-c', script, dirname(f.renderer), key], f.root);
      expect(result.status === 0 && result.stdout.trim() === 'keyed-merge-ok').toBe(true);
    });
  }
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
            if (row[1] === 'done') {
              const branches = row[2].split('그 외에는');
              expect(branches.length).toBe(2);
              expect(branches[0].includes('실제 delegated follow-up review가 있으면')).toBe(true);
              expect(branches[0].includes(`${snapshot.reference}/step-04-review.md`)).toBe(true);
              expect(branches[0].includes('step-05-present.md')).toBe(false);
              expect(branches[1].includes(`${snapshot.reference}/step-05-present.md`)).toBe(true);
              expect(branches.every((branch) => branch.includes('**EARLY EXIT**'))).toBe(true);
            }
            if (route === 'auto' && ['ready-for-dev', 'in-progress'].includes(row[1])) {
              expect(
                row[2].includes(`${snapshot.reference}/step-oneshot.md`),
                'auto resume retains direct implementation branch'
              ).toBe(true);
              expect(
                row[2].includes(`${snapshot.reference}/step-03-implement.md`),
                'auto resume retains full implementation branch'
              ).toBe(true);
              expect(
                row[2].includes('effective_route'),
                'auto resume chooses recorded effective route at runtime'
              ).toBe(true);
            }
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
    for (const surface of ['instruction', 'persistent', 'overrides'] as const) {
      it(`${skill} rejects signature-free private customization bodies on ${surface}`, () => {
        const f = fixture(skill);
        const prior = render(f);
        const input = join(
          f.root,
          surface === 'persistent' ? `_bmad/custom/${skill}.user.toml` : 'synthetic-override.toml'
        );
        mkdirSync(dirname(input), { recursive: true });
        const bodies = [
          'Synthetic confidential request with no identifying prefix',
          'Synthetic confidential answer with no identifying prefix',
          'SELECT synthetic_value FROM synthetic_records;',
          'SyntheticError: synthetic failure\n    at syntheticFunction (synthetic.js:12:3)',
          '{"synthetic_records":[{"synthetic_note":"private fixture body"}]}',
          'synthetic_record_id synthetic_raw_value',
          '%53ynthetic%20encoded%20private%20body'
        ];
        for (const body of bodies) {
          for (const key of [
            'persistent_facts',
            'activation_steps_prepend',
            'activation_steps_append',
            'on_complete'
          ]) {
            const value = key === 'on_complete' ? body : [body];
            const assignments =
              surface === 'instruction' ? [`workflow.${key}=${JSON.stringify(value)}`] : [];
            if (surface !== 'instruction')
              writeFileSync(input, `[workflow]\n${key} = ${JSON.stringify(value)}\n`);
            privateRejection(
              f,
              prior,
              surface === 'instruction' ? [] : [input],
              assignments,
              f.root,
              surface === 'overrides' ? input : undefined
            );
          }
        }
      });
    }
    it(`${skill} captures only references without reading or hashing their bodies`, () => {
      const f = fixture(skill);
      const reference = 'synthetic-contract.md';
      const path = join(f.root, reference);
      const firstBody = 'Synthetic private fixture body that must never be copied';
      writeFileSync(path, firstBody);
      const assignments = [
        'workflow.route=full',
        ...['persistent_facts', 'activation_steps_prepend', 'activation_steps_append'].map(
          (key) => `workflow.${key}=["file:${reference}"]`
        ),
        `workflow.on_complete="file:${reference}"`,
        `workflow.implementation_handoff="file:${reference}"`,
        `workflow.quick_lenses=[{id="quick",name="Quick",instruction="file:${reference}"}]`
      ];
      const first = render(f, assignments);
      writeFileSync(path, 'Different synthetic private fixture body');
      const second = render(f, assignments);
      expect(
        first.entry === second.entry &&
          JSON.stringify(first.manifest) === JSON.stringify(second.manifest)
      ).toBe(true);
      const captured = JSON.stringify([first.manifest, first.outputs]);
      expect(captured.includes(firstBody) || captured.includes(sha256(firstBody))).toBe(false);
      expect(captured.includes(`file:${reference}`)).toBe(true);
      for (const bad of [
        'file:missing.md',
        'file:AGENTS.md trailing private body',
        'file:*.md',
        'file:%41GENTS.md',
        'file:../outside.md'
      ]) {
        privateRejection(f, first, [], [`workflow.on_complete=${JSON.stringify(bad)}`]);
      }
      const outside = fixture(skill);
      symlinkSync(join(outside.root, 'AGENTS.md'), join(f.root, 'synthetic-escape.md'));
      privateRejection(f, first, [], ['workflow.on_complete="file:synthetic-escape.md"']);
    });
    it(`${skill} rejects private review labels conditions and recipes before capture`, () => {
      const f = fixture(skill);
      const prior = render(f);
      for (const field of ['id', 'name', 'instruction', 'when']) {
        const layer: Record<string, string> = {
          id: 'quick',
          name: 'Quick',
          instruction: 'file:AGENTS.md'
        };
        layer[field] = 'Synthetic signature-free private content';
        const fields = Object.entries(layer)
          .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
          .join(',');
        privateRejection(f, prior, [], [`workflow.quick_lenses=[{${fields}}]`]);
      }
      privateRejection(
        f,
        prior,
        [],
        [
          'workflow.route=full',
          'workflow.implementation_handoff="Synthetic signature-free private content"'
        ]
      );
    });

    for (const reference of [
      '../',
      '../shared/reference.md',
      'nested/../../private/session.json',
      './nested/./../../../private/session.json',
      '..\\private\\session.json',
      'nested\\..\\../..\\private/session.json',
      'file:../../private/session.json',
      'file:nested/../../private/session.json',
      'file:..\\..\\private\\session.json',
      'file:../../private/*.json',
      'nested/../../private/*.json',
      '%2E%2E%2Fprivate/session.json',
      'nested/%252E%252E/../../private/session.json',
      '&#46;&#46;&#47;private/session.json',
      '．．／private/session.json',
      '%5Cu002e%5Cu002e%5Cu002fprivate/session.json',
      '{skill-root}/../../../../../private',
      '{skill-root}/../../../../../private/session.json',
      '**{skill-root}/../../../../../private/session.json**',
      '%7Bskill-root%7D/%2E%2E/../../../../../private/session.json',
      'synthetic-link/session.json',
      'file:synthetic-link',
      'file:synthetic-link/*.json',
      'synthetic-link/../private/session.json',
      'file:a+b/reference.md',
      'a+b/reference.md',
      'file:a=b/reference.md',
      'file:a,b/reference.md',
      'file:a;b/reference.md',
      'file:a(b)/reference.md',
      'file:a[b]/reference.md',
      'file:a{b}/reference.md',
      '{skill-root}/synthetic-link/session.json'
    ]) {
      for (const surface of proseSurfaces) {
        it(`${skill} relative containment rejects ${reference} on ${surface}`, () => {
          const f = fixture(skill);
          const prior = render(f);
          const outside = fixture(skill);
          symlinkSync(outside.root, join(f.root, 'synthetic-link'));
          symlinkSync(outside.root, join(f.root, 'a+b'));
          for (const name of ['a=b', 'a,b', 'a;b', 'a(b)', 'a[b]', 'a{b}']) {
            symlinkSync(outside.root, join(f.root, name));
          }
          symlinkSync(outside.root, join(f.skillDir, 'synthetic-link'));
          const pending = join(dirname(prior.generation), 'pending');
          mkdirSync(pending);
          symlinkSync(outside.root, join(pending, 'synthetic-link'));
          const candidate = privacyProse(f, skill, surface, `Read ${reference}`);
          privateRejection(
            f,
            prior,
            [candidate.input, join(f.skillDir, 'customize.toml')],
            candidate.assignments,
            f.root,
            candidate.overrides
          );
          expect(existsSync(join(outside.root, 'private')), 'no reference target created').toBe(
            false
          );
        });
      }
    }
    it(`${skill} default render ignores an unrelated root review-prompts symlink outside the checkout`, () => {
      const f = fixture(skill);
      const prior = render(f);
      const outside = fixture(skill);
      const target = join(outside.skillDir, 'review-prompts');
      const alias = join(f.root, 'review-prompts');
      const targetBefore = new Map(
        markdownFiles(target).map((name) => [name, readBytes(join(target, name))])
      );
      const actualPrompts = join(f.skillDir, 'review-prompts');
      const promptsBefore = new Map(
        markdownFiles(actualPrompts).map((name) => [name, readBytes(join(actualPrompts, name))])
      );
      const generationBefore = new Map(
        ['manifest.json', ...Object.keys(prior.outputs)].map((name) => [
          name,
          readBytes(join(prior.generation, name))
        ])
      );
      symlinkSync(target, alias);
      const linkBefore = readlinkSync(alias);
      const current = render(f);
      expect(
        current.entry === prior.entry,
        'unreferenced root alias does not change default generation'
      ).toBe(true);
      expect(current.manifest).toEqual(prior.manifest);
      expect(current.outputs).toEqual(prior.outputs);
      expect(
        [...generationBefore].every(([name, bytes]) =>
          readBytes(join(current.generation, name)).equals(bytes)
        ),
        'generated outputs and manifest unchanged bytewise'
      ).toBe(true);
      expect(
        realpathSync(actualPrompts) === actualPrompts,
        'actual skill review prompts stay contained'
      ).toBe(true);
      expect(
        [...promptsBefore].every(([name, bytes]) =>
          readBytes(join(actualPrompts, name)).equals(bytes)
        ),
        'actual skill prompts unchanged'
      ).toBe(true);
      expect(
        lstatSync(alias).isSymbolicLink() &&
          readlinkSync(alias) === linkBefore &&
          realpathSync(alias) === target,
        'unrelated root symlink remains untouched'
      ).toBe(true);
      expect(markdownFiles(target)).toEqual([...targetBefore.keys()]);
      expect(
        [...targetBefore].every(([name, bytes]) => readBytes(join(target, name)).equals(bytes)),
        'outside symlink target remains unchanged'
      ).toBe(true);
    });
    for (const literal of [
      '"review-prompts/edge-case-hunter.md"',
      "'review-prompts/edge-case-hunter.md'",
      '"review-prompts/edge\\x2dcase-hunter.md"'
    ]) {
      it(`${skill} literal source origin preserves effective bytes for ${literal}`, () => {
        const f = fixture(skill);
        const candidate = privacyProse(f, skill, 'source', `{{ rendered(${literal}) }}`);
        const prior = render(f);
        const outside = fixture(skill);
        symlinkSync(join(outside.skillDir, 'review-prompts'), join(f.root, 'review-prompts'));
        const snapshot = render(f);
        expect(snapshot.manifest).toEqual(prior.manifest);
        expect(snapshot.outputs).toEqual(prior.outputs);
        expect(
          snapshot.outputs['plan-template.md'].includes(
            `${snapshot.reference}/review-prompts/edge-case-hunter.md`
          )
        ).toBe(true);
        expect(sha256(readBytes(candidate.input))).toBe(f.sourceHashes['plan-template.md']);
      });
    }
    for (const expression of [
      '{{ rendered("review-prompts/edge-case-hunter.md") ~ "review-prompts/edge-case-hunter.md" }}',
      '{# {{ rendered("review-prompts/edge-case-hunter.md") }} #}',
      '{% raw %}{{ rendered("review-prompts/edge-case-hunter.md") }}{% endraw %}'
    ]) {
      it(`${skill} literal source origin never exempts ordinary strings comments or raw text ${expression}`, () => {
        const f = fixture(skill);
        const prior = render(f);
        const outside = fixture(skill);
        symlinkSync(join(outside.skillDir, 'review-prompts'), join(f.root, 'review-prompts'));
        const candidate = privacyProse(f, skill, 'source', expression);
        privateRejection(f, prior, [candidate.input]);
      });
    }
    for (const surface of proseSurfaces) {
      it(`${skill} relative containment preserves parent references and native bindings on ${surface}`, () => {
        const f = fixture(skill);
        const prior = render(f);
        mkdirSync(join(f.root, 'synthetic-real'));
        symlinkSync(join(f.root, 'synthetic-real'), join(f.root, 'synthetic-alias'));
        symlinkSync(join(f.root, 'synthetic-real'), join(f.root, 'synthetic+alias'));
        for (const name of [
          'synthetic=alias',
          'synthetic,alias',
          'synthetic;alias',
          'synthetic(alias)',
          'synthetic[alias]',
          'synthetic{alias}'
        ]) {
          symlinkSync(join(f.root, 'synthetic-real'), join(f.root, name));
        }
        const prose =
          'mydocs/../shared/reference.md ./mydocs/../shared/native.md ' +
          'mydocs\\..\\shared\\native.md file:mydocs/../shared/fact.md ' +
          'file:mydocs/../shared/*.md mydocs/../shared/*.json ' +
          'synthetic-alias/nonexistent.md ' +
          'file:synthetic+alias/nonexistent.md synthetic+alias/nonexistent.md file:nested+public/nonexistent.md ' +
          'file:synthetic=alias/nonexistent.md file:synthetic,alias/nonexistent.md file:synthetic;alias/nonexistent.md ' +
          'file:synthetic(alias)/nonexistent.md file:synthetic[alias]/nonexistent.md file:synthetic{alias}/nonexistent.md ' +
          'mydocs/%2E%2E/shared/encoded.md {skill-root}/../shared/reference.md ' +
          'prd-*/prd-*.md synthetic-?.md/reference.md a / b ' +
          'https://example.com/docs/../../public?route=../public ' +
          'https&#58;&#47;&#47;example.com/docs/../../public?route=../public ' +
          'https%3A%2F%2Fexample.com%2Fdocs%2F..%2F..%2Fpublic%3Froute%3D..%2Fpublic';
        const candidate = privacyProse(f, skill, surface, prose);
        const inputBefore = readBytes(candidate.input);
        if (surface !== 'source') {
          privateRejection(
            f,
            prior,
            [candidate.input],
            candidate.assignments,
            f.root,
            candidate.overrides
          );
          return;
        }
        const snapshot = render(f, candidate.assignments, candidate.overrides);
        expect(
          readBytes(candidate.input).equals(inputBefore),
          'positive input bytes remain unchanged'
        ).toBe(true);
        const output =
          snapshot.outputs[surface === 'source' ? 'plan-template.md' : 'step-04-review.md'];
        const origin = `mydocs/skills/${skill}`;
        expect(
          output.includes(prose.replaceAll('{skill-root}', origin)),
          'safe spellings retained bytewise'
        ).toBe(true);
        expect(existsSync(join(f.root, 'shared')), 'safe nonexistent target not created').toBe(
          false
        );
        expect(
          existsSync(join(f.root, 'synthetic-real', 'nonexistent.md')),
          'contained carrier target not created'
        ).toBe(false);
        expect(
          existsSync(join(f.root, 'nested+public')),
          'nonexistent plus directory not created'
        ).toBe(false);
      });
    }
    it(`${skill} relative containment distinguishes installed and generated skill origins`, () => {
      const f = fixture(skill);
      const reference = '{skill-root}/../../../../shared/reference.md';
      const defaults = join(f.skillDir, 'customize.toml');
      writeFileSync(
        defaults,
        readBytes(defaults)
          .toString('utf8')
          .replace(
            'Report unmet acceptance criteria, broken rules, and bugs.',
            `Read ${reference}\nReport unmet acceptance criteria, broken rules, and bugs.`
          )
      );
      const prior = render(f);
      expect(
        prior.outputs['step-04-review.md'].includes(
          `${prior.reference}/../../../../shared/reference.md`
        )
      ).toBe(true);
      const source = privacyProse(f, skill, 'source', `Read ${reference}`);
      privateRejection(f, prior, [source.input]);
    });
    for (const lookup of ['direct', 'short'] as const) {
      for (const kind of ['value', 'name', 'ancestor', 'defaults', 'synthesis'] as const) {
        it(`${skill} relative containment rejects consumed ${kind} ${lookup}`, () => {
          const f = fixture(skill);
          const prior = render(f);
          const source = join(f.skillDir, 'plan-template.md');
          const config = join(f.root, '_bmad/config.toml');
          const defaults = join(f.skillDir, 'customize.toml');
          const escape = '../private/session.json';
          const key = kind === 'name' ? escape : 'synthetic_reference';
          const ancestor = kind === 'ancestor' ? escape : 'public';
          const assembled = '"." ~ "." ~ "/" ~ "private/session.json"';
          const selectedKey = kind === 'name' ? assembled : JSON.stringify(key);
          const selectedAncestor = kind === 'ancestor' ? assembled : JSON.stringify(ancestor);
          let expression =
            lookup === 'short'
              ? `config[${selectedKey}]`
              : `config[${selectedAncestor}][${selectedKey}]`;
          const inputs = [source];
          if (kind === 'defaults') {
            writeFileSync(
              defaults,
              readBytes(defaults)
                .toString('utf8')
                .replace(
                  '[workflow]\n',
                  `[workflow]\nsynthetic_reference = ${JSON.stringify(escape)}\n`
                )
            );
            expression = 'workflow.synthetic_reference';
            inputs.push(defaults);
          } else if (kind === 'synthesis') {
            expression = '"." ~ "." ~ "/" ~ "private" ~ "/" ~ "session.json"';
          } else {
            mkdirSync(dirname(config), { recursive: true });
            writeFileSync(
              config,
              `[${JSON.stringify(ancestor)}]\n${JSON.stringify(key)} = ${JSON.stringify(kind === 'value' ? escape : 'public')}\n`
            );
            inputs.push(config);
          }
          writeFileSync(source, `${readBytes(source).toString('utf8')}\n{{ ${expression} }}\n`);
          privateRejection(f, prior, inputs);
        });
      }
    }
    for (const prefix of ['case-ＳＹＮＴＨＥＴＩＣ-', 'case-é-']) {
      it(`${skill} encoded path Unicode checkout identity ${prefix}`, () => {
        const f = fixture(skill, prefix);
        const literal = privacyProse(f, skill, 'instruction', 'file:AGENTS.md');
        const prior = render(f, literal.assignments);
        expect(prior.outputs['step-04-review.md'].includes('file:AGENTS.md')).toBe(true);
        const candidate = privacyProse(
          f,
          skill,
          'instruction',
          `Read https://example.com/view?source=${encodeURIComponent(`${f.root}/private.md`)}`
        );
        privateRejection(f, prior, [], candidate.assignments);
      });
    }
    it(`${skill} encoded path root and nested cwd preserve public bytes and reject private input`, () => {
      const f = fixture(skill);
      const nested = join(f.root, 'synthetic/nested');
      mkdirSync(nested, { recursive: true });
      const safe = privacyProse(f, skill, 'instruction', 'file:AGENTS.md');
      const root = render(f, safe.assignments);
      const child = render(f, safe.assignments, undefined, nested);
      expect(
        root.entry === child.entry &&
          JSON.stringify(root.manifest) === JSON.stringify(child.manifest)
      ).toBe(true);
      const unsafe = privacyProse(
        f,
        skill,
        'instruction',
        'Read %2Fhome%2Fsynthetic-owner%2Fprivate.md'
      );
      privateRejection(f, root, [], unsafe.assignments);
      privateRejection(f, root, [], unsafe.assignments, nested);
    });
    for (const layer of [
      '_bmad/config.toml',
      '_bmad/custom/config.toml',
      '_bmad/custom/config.user.toml'
    ]) {
      for (const ancestor of [
        '/home/synthetic-owner',
        '%2Fhome%2Fsynthetic-owner',
        `ghp_${'A'.repeat(36)}`,
        `%67hp_${'A'.repeat(36)}`,
        'synthetic_public'
      ]) {
        for (const lookup of ['direct', 'short']) {
          it(`${skill} encoded path selected identity ${layer} ${ancestor} ${lookup}`, () => {
            const f = fixture(skill);
            const prior = render(f);
            const input = join(f.root, layer);
            mkdirSync(dirname(input), { recursive: true });
            writeFileSync(input, `[${JSON.stringify(ancestor)}]\ntask_label = "public"\n`);
            const source = join(f.skillDir, 'plan-template.md');
            const expression =
              lookup === 'short'
                ? 'config.task_label'
                : `config[${JSON.stringify(ancestor.slice(0, 4))} ~ ${JSON.stringify(ancestor.slice(4))}].task_label`;
            const text = `${readBytes(source).toString('utf8')}\n{{ ${expression} }}\n`;
            writeFileSync(source, text);
            if (ancestor === 'synthetic_public') {
              f.sourceHashes['plan-template.md'] = sha256(text);
              f.templateHashes['plan-template.md'] = sha256(text);
              const snapshot = render(f);
              expect(
                snapshot.manifest.inputs.resolved_values['config.synthetic_public.task_label'] ===
                  'public'
              ).toBe(true);
              expect(snapshot.outputs['plan-template.md'].includes('public')).toBe(true);
            } else privateRejection(f, prior, [input, source]);
          });
        }
      }
    }
    it(`${skill} preserves encoded path public relative output mapping keys`, () => {
      const f = fixture(skill);
      const name = 'public%20notes.md';
      const text = '# 공개 합성 자료\n';
      writeFileSync(join(f.skillDir, name), text);
      f.sourceHashes[name] = sha256(text);
      f.templateHashes[name] = sha256(text);
      const snapshot = render(f);
      expect(snapshot.outputs[name] === text, 'safe encoded filename and bytes preserved').toBe(
        true
      );
    });
    for (const layer of [
      '_bmad/config.toml',
      '_bmad/custom/config.toml',
      '_bmad/custom/config.user.toml'
    ]) {
      for (const key of ['output_folder', 'active_initiative']) {
        it(`${skill} preserves encoded path safe relative setting ${layer} ${key}`, () => {
          const f = fixture(skill);
          const input = join(f.root, layer);
          mkdirSync(dirname(input), { recursive: true });
          const text = `[core]\n${key} = "reports%20draft"\n`;
          writeFileSync(input, text);
          const snapshot = render(f);
          expect(
            snapshot.manifest.inputs.resolved_values[`config.core.${key}`] === 'reports%20draft'
          ).toBe(true);
          expect(readBytes(input).toString('utf8') === text, 'safe relative input preserved').toBe(
            true
          );
        });
      }
    }
    for (const spelling of [
      '%2Fhome%2Fsynthetic-owner%2Fprivate.md',
      '&#47;home&#47;synthetic-owner&#47;private.md',
      '／home／synthetic-owner／private.md',
      '%5Cu002fhome%5Cu002fsynthetic-owner%5Cu002fprivate.md',
      'https://example.com/report?path=/home/synthetic-owner/private.md',
      `ghp_${'A'.repeat(36)}`,
      `github_pat_${'A'.repeat(22)}_${'B'.repeat(59)}`
    ]) {
      it(`${skill} rejects encoded path in consumed shipped defaults ${spelling}`, () => {
        const f = fixture(skill);
        const prior = render(f);
        const defaults = join(f.skillDir, 'customize.toml');
        const source = join(f.skillDir, 'plan-template.md');
        const text = readBytes(defaults).toString('utf8');
        expect(text.includes('[workflow]\n')).toBe(true);
        writeFileSync(
          defaults,
          text.replace(
            '[workflow]\n',
            `[workflow]\nsynthetic_privacy = ${JSON.stringify(`Read ${spelling}`)}\n`
          )
        );
        writeFileSync(
          source,
          `${readBytes(source).toString('utf8')}\n{{ workflow.synthetic_privacy }}\n`
        );
        privateRejection(f, prior, [defaults, source]);
      });
    }
    for (const layer of [
      '_bmad/config.toml',
      '_bmad/custom/config.toml',
      '_bmad/custom/config.user.toml'
    ]) {
      for (const key of ['output_folder', 'active_initiative']) {
        for (const spelling of [
          '%2Fhome%2Fsynthetic-owner',
          '%2E%2E%2Fsynthetic-private',
          '%7E%2Fsynthetic-private',
          '&#47;home&#47;synthetic-owner',
          '／home／synthetic-owner',
          '\\u002fhome\\u002fsynthetic-owner'
        ]) {
          it(`${skill} rejects encoded path setting ${layer} ${key} ${spelling}`, () => {
            const f = fixture(skill);
            const prior = render(f);
            const input = join(f.root, layer);
            mkdirSync(dirname(input), { recursive: true });
            writeFileSync(input, `[core]\n${key} = ${JSON.stringify(spelling)}\n`);
            privateRejection(f, prior, [input]);
          });
        }
      }
    }
    for (const filename of [
      '%2Fhome%2Fsynthetic-owner%2Fprivate.md',
      '&#47;home&#47;synthetic-owner&#47;private.md',
      `ghp_${'A'.repeat(36)}.md`,
      `github_pat_${'A'.repeat(22)}_${'B'.repeat(59)}.md`
    ]) {
      it(`${skill} rejects encoded path in output mapping key ${filename}`, () => {
        const f = fixture(skill);
        const prior = render(f);
        const source = join(f.skillDir, filename);
        writeFileSync(source, '# 합성 검증 자료\n');
        privateRejection(f, prior, [source]);
      });
    }
    for (const layer of [
      'tools/bmad/config.toml',
      '_bmad/config.toml',
      '_bmad/custom/config.toml',
      '_bmad/custom/config.user.toml'
    ]) {
      for (const [form, value] of [
        ['uri', 'https://example.com/report?path=/home/synthetic-owner/private.md'],
        ['token', `ghp_${'A'.repeat(36)}`]
      ]) {
        for (const lookup of ['direct', 'short']) {
          it(`${skill} rejects neutral typed privacy ${layer} ${form} ${lookup}`, () => {
            const f = fixture(skill);
            const source = join(f.skillDir, 'plan-template.md');
            const text = `${readBytes(source).toString('utf8')}\n{{ ${lookup === 'short' ? 'config.task_label' : 'config.public.task_label'} }}\n`;
            writeFileSync(source, text);
            f.sourceHashes['plan-template.md'] = sha256(text);
            f.templateHashes['plan-template.md'] = sha256(text);
            const input = join(f.root, layer);
            mkdirSync(dirname(input), { recursive: true });
            const base = existsSync(input) ? readBytes(input).toString('utf8') : '';
            writeFileSync(input, `${base}\n[public]\ntask_label = "public"\n`);
            const prior = render(f);
            expect(prior.outputs['plan-template.md'].includes('public')).toBe(true);
            writeFileSync(input, `${base}\n[public]\ntask_label = ${JSON.stringify(value)}\n`);
            privateRejection(f, prior, [source, input]);
          });
        }
      }
    }
    for (const [form, expression, prose] of [
      ['token', `"ghp_" ~ "${'A'.repeat(36)}"`, `ghp_${'A'.repeat(36)}`],
      [
        'uri',
        '"https://example.com/report?path=" ~ "/" ~ "home" ~ "/" ~ "synthetic-owner" ~ "/" ~ "private.md"',
        'https://example.com/report?path=/home/synthetic-owner/private.md'
      ]
    ]) {
      it(`${skill} rejects late assembled privacy ${form} with valid concatenation control`, () => {
        const f = fixture(skill);
        const source = join(f.skillDir, 'plan-template.md');
        const base = readBytes(source).toString('utf8');
        const control = `${base}\n{{ "public-" ~ "reference" }}\n`;
        writeFileSync(source, control);
        f.sourceHashes['plan-template.md'] = sha256(control);
        f.templateHashes['plan-template.md'] = sha256(control);
        const prior = render(f);
        expect(prior.outputs['plan-template.md'].includes('public-reference')).toBe(true);
        writeFileSync(source, `${base}\n{{ ${expression} }}\n`);
        privateRejection(f, prior, [source]);
      });
      it(`${skill} rejects fresh privacy ${form} without publication artifacts`, () => {
        const f = fixture(skill);
        const source = join(f.skillDir, 'workflow.md');
        const before = readBytes(source);
        const result = invoke(
          f.renderer,
          [
            '--project-root',
            f.root,
            '--skill',
            f.skillDir,
            '--set',
            `workflow.persistent_facts=[${JSON.stringify(prose)}]`
          ],
          f.root
        );
        expect(
          !result.error &&
            result.status === 1 &&
            result.stdout === 'HALT: BMAD rendering failed.\n' &&
            result.stderr === ''
        ).toBe(true);
        expect(existsSync(join(f.root, '_bmad/render'))).toBe(false);
        expect(readBytes(source).equals(before)).toBe(true);
      });
    }
    it(`${skill} actually renders Korean canonical headings with unchanged native schema`, () => {
      const f = fixture(skill);
      try {
        const snapshot = render(f, ['workflow.route=full']);
        const plan = readBytes(join(snapshot.generation, 'plan-template.md')).toString('utf8');
        for (const heading of [
          '의도',
          '경계와 제약',
          'I/O 및 경계 사례 행렬',
          '코드 맵',
          '작업과 수용 기준',
          '구현 기록',
          '계획 변경 기록',
          '리뷰 분류 기록',
          '설계 기록',
          '검증'
        ]) {
          expect(plan.includes(`## ${heading}`), 'Korean canonical output section').toBe(true);
        }
        expect(
          /^## (?:Intent|Implementation Notes|Plan Change Log|Review Triage Log|Verification)$/m.test(
            plan
          ),
          'obsolete emitted headings removed'
        ).toBe(false);
        for (const key of [
          'title',
          'type',
          'ticket',
          'created',
          'status',
          'baseline_revision',
          'route',
          'route_source',
          'risk',
          'review',
          'review_source',
          'lenses_ran',
          'review_loop_iteration',
          'context'
        ]) {
          expect(new RegExp(`^${key}:`, 'm').test(plan), 'fixed machine schema retained').toBe(
            true
          );
        }
        expect(
          plan.includes(skill === 'bmad-build' ? '<frozen-after-approval' : '<intent-contract>'),
          'native intent ownership marker retained'
        ).toBe(true);
      } finally {
        cleanup(f.root);
      }
    });
    for (const surface of ['instruction', 'persistent', 'overrides'] as const) {
      for (const alias of [
        '{plan_file}',
        '{plan_path}',
        '{verbatim_intent}',
        '{claims_file}',
        '{diff_file}',
        '{project-root}',
        '{skill-root}',
        '{ plan_file }',
        '%7Bplan_file%7D',
        '&#123;plan_file&#125;'
      ]) {
        it(`${skill} implementation handoff rejects private alias ${alias} on ${surface}`, () => {
          const f = fixture(skill);
          const prior = render(f, ['workflow.route=full']);
          const previous = new Map(
            ['manifest.json', ...Object.keys(prior.outputs)].map((name) => [
              name,
              readBytes(join(prior.generation, name))
            ])
          );
          const generations = readdirSync(dirname(prior.generation));
          const defaults = readBytes(join(f.skillDir, 'customize.toml'));
          const instruction = `Load ${alias}; synthetic forbidden worker instruction.`;
          let input: string | undefined;
          let overrides: string | undefined;
          const assignments = ['workflow.route=full'];
          if (surface === 'instruction')
            assignments.push(`workflow.implementation_handoff=${JSON.stringify(instruction)}`);
          else {
            input =
              surface === 'persistent'
                ? join(f.root, '_bmad/custom', `${skill}.user.toml`)
                : join(fixture(skill).root, 'synthetic-implementation-override.toml');
            mkdirSync(dirname(input), { recursive: true });
            writeFileSync(
              input,
              `[workflow]\nimplementation_handoff = ${JSON.stringify(instruction)}\n`
            );
            if (surface === 'overrides') overrides = input;
          }
          const before = input ? readBytes(input) : undefined;
          const result = invoke(
            f.renderer,
            [
              '--project-root',
              f.root,
              '--skill',
              f.skillDir,
              ...(overrides ? ['--overrides', overrides] : []),
              ...assignments.flatMap((value) => ['--set', value])
            ],
            f.root
          );
          expect(
            !result.error &&
              result.status === 1 &&
              result.stdout === 'HALT: BMAD rendering failed.\n' &&
              result.stderr === '',
            'consumed unsafe implementation recipe rejected before capture/publication'
          ).toBe(true);
          expect(readBytes(join(f.skillDir, 'customize.toml')).equals(defaults)).toBe(true);
          if (input) expect(readBytes(input).equals(before!)).toBe(true);
          expect(readdirSync(dirname(prior.generation))).toEqual(generations);
          expect(
            [...previous].every(([name, bytes]) =>
              readBytes(join(prior.generation, name)).equals(bytes)
            )
          ).toBe(true);
        });
      }
      it(`${skill} implementation handoff preserves safe customized fields on ${surface}`, () => {
        const f = fixture(skill);
        const instruction = 'file:AGENTS.md';
        let input: string | undefined;
        let overrides: string | undefined;
        const assignments = ['workflow.route=full'];
        if (surface === 'instruction')
          assignments.push(`workflow.implementation_handoff=${JSON.stringify(instruction)}`);
        else {
          input =
            surface === 'persistent'
              ? join(f.root, '_bmad/custom', `${skill}.user.toml`)
              : join(fixture(skill).root, 'synthetic-safe-implementation-override.toml');
          mkdirSync(dirname(input), { recursive: true });
          writeFileSync(
            input,
            `[workflow]\nimplementation_handoff = ${JSON.stringify(instruction)}\n`
          );
          if (surface === 'overrides') overrides = input;
        }
        const before = input ? readBytes(input) : undefined;
        const snapshot = render(f, assignments, overrides);
        expect(snapshot.outputs['step-03-implement.md'].includes(instruction)).toBe(true);
        expect(
          snapshot.manifest.inputs.resolved_values['customization.workflow.implementation_handoff']
        ).toBe(instruction);
        assertText(
          snapshot.outputs['step-03-implement.md'],
          /preflight the entire substituted instruction and every referenced input/,
          'safe override still governed by consumer boundary'
        );
        if (input) expect(readBytes(input).equals(before!)).toBe(true);
      });
    }
    for (const layer of [
      '_bmad/config.toml',
      '_bmad/custom/config.toml',
      '_bmad/custom/config.user.toml'
    ]) {
      for (const field of ['output_folder', 'active_initiative'] as const) {
        for (const form of [
          'parent',
          'nested-parent',
          'backslash-parent',
          'uri',
          'drive-relative',
          'symlink',
          'dangling-symlink',
          'absolute-initiative'
        ] as const) {
          it(`${skill} rejects path config ${layer} ${field} ${form} before publication`, () => {
            const f = fixture(skill);
            const outside = fixture(skill);
            const prior = render(f);
            const priorBytes = new Map(
              readdirSync(prior.generation, { recursive: true })
                .filter(
                  (name): name is string =>
                    typeof name === 'string' && statSync(join(prior.generation, name)).isFile()
                )
                .map((name) => [name, readBytes(join(prior.generation, name))])
            );
            const generations = readdirSync(dirname(prior.generation));
            const sentinel = join(outside.root, 'synthetic-sentinel');
            writeFileSync(sentinel, 'synthetic untouched evidence');
            const base = field === 'output_folder' ? f.root : join(f.root, 'synthetic-output');
            mkdirSync(base, { recursive: true });
            if (form === 'symlink' || form === 'dangling-symlink')
              symlinkSync(
                form === 'symlink' ? outside.root : join(outside.root, 'not-created'),
                join(base, 'synthetic-link')
              );
            const value =
              form === 'parent'
                ? '../private'
                : form === 'nested-parent'
                  ? 'nested/../../private'
                  : form === 'backslash-parent'
                    ? '..\\private'
                    : form === 'uri'
                      ? 'https://example.com/unsupported-output'
                      : form === 'drive-relative'
                        ? 'C:synthetic'
                        : form === 'absolute-initiative'
                          ? join(
                              field === 'active_initiative' ? f.root : outside.root,
                              'synthetic-initiative'
                            )
                          : 'synthetic-link/private';
            const path = join(f.root, layer);
            mkdirSync(dirname(path), { recursive: true });
            const content = `[core]\noutput_folder = ${JSON.stringify(field === 'output_folder' ? value : 'synthetic-output')}\nactive_initiative = ${JSON.stringify(field === 'active_initiative' ? value : '')}\n`;
            writeFileSync(path, content);
            const inputBytes = readBytes(path);
            const outsideListing = readdirSync(outside.root);
            const result = invoke(
              f.renderer,
              ['--project-root', f.root, '--skill', f.skillDir],
              f.root
            );
            expect(
              !result.error &&
                result.status === 1 &&
                result.stdout === 'HALT: BMAD rendering failed.\n' &&
                result.stderr === '',
              'configuration containment fixed private failure'
            ).toBe(true);
            expect(
              readBytes(path).equals(inputBytes),
              'present configuration remains immutable'
            ).toBe(true);
            expect(readdirSync(dirname(prior.generation))).toEqual(generations);
            expect(
              [...priorBytes].every(([name, bytes]) =>
                readBytes(join(prior.generation, name)).equals(bytes)
              ),
              'previous generation is unchanged'
            ).toBe(true);
            expect(readdirSync(outside.root)).toEqual(outsideListing);
            expect(readBytes(sentinel).toString()).toBe('synthetic untouched evidence');
            expect(existsSync(join(outside.root, 'not-created'))).toBe(false);
          });
        }
      }
      for (const form of ['relative', 'normalized', 'root-empty', 'contained-symlink'] as const) {
        it(`${skill} preserves contained path config ${layer} ${form}`, () => {
          const f = fixture(skill);
          const output =
            form === 'root-empty'
              ? '.'
              : form === 'normalized'
                ? './synthetic-output//./'
                : 'synthetic-output';
          const initiative =
            form === 'root-empty'
              ? ''
              : form === 'normalized'
                ? './nested//synthetic-initiative/.'
                : 'nested/synthetic-initiative';
          if (form === 'contained-symlink') {
            mkdirSync(join(f.root, 'synthetic-real'), { recursive: true });
            symlinkSync(join(f.root, 'synthetic-real'), join(f.root, 'synthetic-output'));
          }
          const path = join(f.root, layer);
          mkdirSync(dirname(path), { recursive: true });
          const content = `[core]\noutput_folder = ${JSON.stringify(output)}\nactive_initiative = ${JSON.stringify(initiative)}\n`;
          writeFileSync(path, content);
          const before = readBytes(path);
          const snapshot = render(f);
          const values = snapshot.manifest.inputs.resolved_values;
          expect(values['config.core.output_folder']).toBe(
            form === 'root-empty'
              ? '.'
              : form === 'contained-symlink'
                ? 'synthetic-real'
                : 'synthetic-output'
          );
          expect(values['config.core.active_initiative']).toBe(
            form === 'root-empty' ? '' : 'nested/synthetic-initiative'
          );
          expect(readBytes(path).equals(before)).toBe(true);
          expect(
            existsSync(
              join(
                f.root,
                form === 'contained-symlink' ? 'synthetic-real/nested' : 'synthetic-output/nested'
              )
            ),
            'render does not create configured application output'
          ).toBe(false);
        });
      }
    }
    for (const layer of [
      '_bmad/config.toml',
      '_bmad/custom/config.toml',
      '_bmad/custom/config.user.toml'
    ]) {
      for (const key of [
        'api_key',
        'Authorization',
        'password',
        'api%5Fkey',
        'ＡＰＩ＿ＫＥＹ',
        'private.key',
        'oauth',
        'oauth2',
        'pat',
        'GitHub_PAT'
      ]) {
        for (const lookup of ['direct', 'short'] as const) {
          it(`${skill} rejects consumed typed credential ${layer} ${key} ${lookup} before input capture`, () => {
            const f = fixture(skill);
            const source = join(f.skillDir, 'plan-template.md');
            const text =
              readBytes(source).toString('utf8') +
              `\nSynthetic consumed placeholder: {{ ${lookup === 'direct' ? 'config.core' : 'config'}[${JSON.stringify(key)}] }}\n`;
            writeFileSync(source, text);
            f.sourceHashes['plan-template.md'] = sha256(text);
            f.templateHashes['plan-template.md'] = sha256(text);
            const config = join(f.root, layer);
            mkdirSync(dirname(config), { recursive: true });
            writeFileSync(config, `[core]\n${JSON.stringify(key)} = "{synthetic_credential}"\n`);
            const prior = render(f);
            expect(prior.manifest.inputs.resolved_values[`config.core.${key}`]).toBe(
              '{synthetic_credential}'
            );
            const previous = new Map(
              ['manifest.json', ...Object.keys(prior.outputs)].map((name) => [
                name,
                readBytes(join(prior.generation, name))
              ])
            );
            const generations = readdirSync(dirname(prior.generation));
            const candidate = `[core]\n${JSON.stringify(key)} = "synthetic-secret"\n`;
            writeFileSync(config, candidate);
            const result = invoke(
              f.renderer,
              ['--project-root', f.root, '--skill', f.skillDir],
              f.root
            );
            expect(
              !result.error &&
                result.status === 1 &&
                result.stdout === 'HALT: BMAD rendering failed.\n' &&
                result.stderr === '',
              'typed credential cannot be stored under a safe-looking value'
            ).toBe(true);
            expect(readBytes(config).toString('utf8')).toBe(candidate);
            expect(readBytes(source).toString('utf8')).toBe(text);
            expect(readdirSync(dirname(prior.generation))).toEqual(generations);
            expect(
              [...previous].every(([name, bytes]) =>
                readBytes(join(prior.generation, name)).equals(bytes)
              )
            ).toBe(true);
          });
        }
      }
    }
    for (const layer of [
      '_bmad/config.toml',
      '_bmad/custom/config.toml',
      '_bmad/custom/config.user.toml'
    ]) {
      for (const key of ['auth', 'password', 'oauth', 'pat']) {
        for (const lookup of ['direct', 'short']) {
          it(`${skill} rejects selected nested typed credential ${layer} ${key} ${lookup}`, () => {
            const f = fixture(skill);
            const source = join(f.skillDir, 'plan-template.md');
            const field =
              lookup === 'direct'
                ? `config.core[${JSON.stringify(key)}].synthetic_inner`
                : 'config.synthetic_inner';
            const text =
              readBytes(source).toString('utf8') + `\nSynthetic consumed field: {{ ${field} }}\n`;
            writeFileSync(source, text);
            f.sourceHashes['plan-template.md'] = sha256(text);
            f.templateHashes['plan-template.md'] = sha256(text);
            const config = join(f.root, layer);
            mkdirSync(dirname(config), { recursive: true });
            writeFileSync(config, `[core.${key}]\nsynthetic_inner = "{synthetic_credential}"\n`);
            const prior = render(f);
            const previous = new Map(
              ['manifest.json', ...Object.keys(prior.outputs)].map((name) => [
                name,
                readBytes(join(prior.generation, name))
              ])
            );
            const generations = readdirSync(dirname(prior.generation));
            const candidate = `[core.${key}]\nsynthetic_inner = "synthetic-secret"\n`;
            writeFileSync(config, candidate);
            const result = invoke(
              f.renderer,
              ['--project-root', f.root, '--skill', f.skillDir],
              f.root
            );
            expect(
              !result.error &&
                result.status === 1 &&
                result.stdout === 'HALT: BMAD rendering failed.\n' &&
                result.stderr === '',
              'credential ancestor cannot disappear from captured leaf identity'
            ).toBe(true);
            expect(readBytes(config).toString('utf8')).toBe(candidate);
            expect(readBytes(source).toString('utf8')).toBe(text);
            expect(readdirSync(dirname(prior.generation))).toEqual(generations);
            expect(
              [...previous].every(([name, bytes]) =>
                readBytes(join(prior.generation, name)).equals(bytes)
              )
            ).toBe(true);
          });
        }
      }
    }
    // Carrier/format rows cross four publication inputs and both skills.
    // Paths are invented sentinels, never actual machine/user locations.
    for (const [form, prose] of [
      ['posix', 'Read /synthetic-private-machine/work/file.md'],
      [
        'web-machine-path-query',
        'Read https://example.com/report?path=/home/synthetic-owner/private.md'
      ],
      [
        'web-machine-path-arbitrary',
        'Read https://example.com/report?file=/synthetic-private-machine/private.md'
      ],
      [
        'web-machine-path-angle-value',
        'Read https://example.com/report?path=%3C%2Fforeign-owner%2Fprivate.md%3E'
      ],
      [
        'web-machine-path-array-value',
        'Read https://example.com/report?path=%5B%22%2Fforeign-owner%2Fprivate.md%22%5D'
      ],
      [
        'web-machine-path-single-angle',
        'Read https://example.com/report?path=%3C%2Fforeign-owner%3E'
      ],
      [
        'web-machine-path-json-native',
        `Read https://example.com/report?meta=${encodeURIComponent(JSON.stringify({ path: '/foreign-owner/private.md', q: 'a /b' }))}`
      ],
      [
        'web-machine-path-json-array',
        `Read https://example.com/report?meta=${encodeURIComponent(JSON.stringify([{ path: '/foreign-owner/private.md', q: 'a /b' }]))}`
      ],
      [
        'web-machine-path-json-duplicate',
        `Read https://example.com/report?meta=${encodeURIComponent('{"path":"/foreign-owner/private.md","path":"public.md"}')}`
      ],
      [
        'web-machine-path-native-object-duplicate',
        `Read https://example.com/report?path=${encodeURIComponent('{"note":"/foreign-owner/private.md","note":"public.md"}')}`
      ],
      ['web-machine-path-path', 'Read https://example.com/home/synthetic-owner/private.md'],
      [
        'web-machine-path-fragment',
        'Read https://example.com/report#/view?path=/home/synthetic-owner/private.md'
      ],
      [
        'web-machine-path-encoded',
        'Read https://example.com/report?path=%2Fhome%2Fsynthetic-owner%2Fprivate.md'
      ],
      [
        'web-machine-path-double',
        'Read https://example.com/report?path=%252Fhome%252Fsynthetic-owner%252Fprivate.md'
      ],
      [
        'web-machine-path-json',
        'Read https://example.com/report?data=%7B%22route%22%3A%22%2Fhome%2Fsynthetic-owner%2Fprivate.md%22%7D'
      ],
      [
        'web-machine-path-windows',
        'Read https://example.com/report?path=Z%3A%5Csynthetic-owner%5Cprivate.md'
      ],
      [
        'web-machine-path-drive-relative',
        'Read https://example.com/report?path=Z%3Asynthetic-private.md'
      ],
      [
        'web-machine-path-unc',
        'Read https://example.com/report?path=%2F%2Fsynthetic-server%2Fshare%2Fprivate.md'
      ],
      [
        'web-machine-path-home',
        'Read https://example.com/report?path=%7E%2Fsynthetic-private%2Ffile.md'
      ],
      [
        'web-machine-path-home-variable',
        'Read https://example.com/report?path=%24HOME%2Fsynthetic-private%2Ffile.md'
      ],
      [
        'web-machine-path-file-uri',
        'Read https://example.com/report?next=file%3A%2F%2F%2Fsynthetic-private%2Ffile.md'
      ],
      [
        'web-machine-path-nested',
        'Read https://example.com/report?next=https%3A%2F%2Fpublic.example%2Fhome%2Fsynthetic-owner%2Fprivate.md'
      ],
      [
        'web-machine-path-dot',
        'Read https://example.com/public/../home/synthetic-owner/private.md'
      ],
      [
        'web-machine-path-entity',
        'Read https://example.com/report?path=&#47;home&#47;synthetic-owner&#47;private.md'
      ],
      [
        'web-machine-path-fullwidth',
        'Read https://example.com/report?path=／home／synthetic-owner／private.md'
      ],
      [
        'web-machine-path-unicode',
        'Read https://example.com/report?path=%5Cu002fhome%5Cu002fsynthetic-owner%5Cu002fprivate.md'
      ],
      ['standalone-github-classic', `Read ghp_${'A'.repeat(36)}`],
      ['standalone-github-fine', `Read github_pat_${'A'.repeat(22)}_${'B'.repeat(59)}`],
      ['standalone-github-oauth', `Read gho_${'A'.repeat(36)}`],
      ['standalone-github-user', `Read ghu_${'A'.repeat(36)}`],
      ['standalone-github-install', `Read ghs_${'A'.repeat(36)}`],
      ['standalone-github-refresh', `Read ghr_${'A'.repeat(76)}`],
      [
        'standalone-github-install-jwt',
        `Read ghs_123456_eyJ${'A'.repeat(24)}.eyJ${'B'.repeat(24)}.${'C'.repeat(32)}`
      ],
      ['standalone-gitlab', `Read glpat-${'A'.repeat(20)}`],
      ['standalone-npm', `Read npm_${'A'.repeat(36)}`],
      ['standalone-pypi', `Read pypi-AgEIcHlwaS5vcmc${'A'.repeat(60)}`],
      ['standalone-openai', `Read sk-${'A'.repeat(20)}T3BlbkFJ${'B'.repeat(20)}`],
      ['standalone-openai-project', `Read sk-proj-${'A'.repeat(48)}`],
      ['standalone-openai-service', `Read sk-svcacct-${'A'.repeat(48)}`],
      ['standalone-anthropic', `Read sk-ant-api03-${'A'.repeat(80)}`],
      ['standalone-anthropic-session', `Read sk-ant-sid01-${'A'.repeat(80)}`],
      ['standalone-stripe', `Read sk_live_${'A'.repeat(24)}`],
      ['standalone-stripe-restricted', `Read rk_test_${'A'.repeat(24)}`],
      ['standalone-stripe-test', `Read sk_test_${'A'.repeat(24)}`],
      ['standalone-stripe-live-restricted', `Read rk_live_${'A'.repeat(24)}`],
      ['standalone-slack', `Read xoxb-123456789012-123456789012-${'A'.repeat(24)}`],
      [
        'standalone-slack-user',
        `Read xoxp-123456789012-123456789012-123456789012-${'A'.repeat(32)}`
      ],
      ['standalone-google', `Read AIza${'A'.repeat(35)}`],
      [
        'standalone-encoded',
        `Read ${encodeURIComponent(`ghp_${'A'.repeat(36)}`).replace('ghp_', '%67%68%70%5F')}`
      ],
      ['standalone-entity', `Read ghp&#95;${'A'.repeat(36)}`],
      ['standalone-fullwidth', `Read ｇｈｐ＿${'Ａ'.repeat(36)}`],
      ['standalone-unicode', `Read %5Cu0067hp_${'A'.repeat(36)}`],
      ['standalone-uri', `Read https://example.com/${`ghp_${'A'.repeat(36)}`}?note=public`],
      ['intermediate-placeholder-percent', 'api_key=<placeholder>%20synthetic-private-material'],
      ['intermediate-placeholder-entity', 'api_key=<placeholder>&#32;synthetic-private-material'],
      [
        'intermediate-placeholder-unicode',
        'api_key=<placeholder>\\u0020synthetic-private-material'
      ],
      ['intermediate-placeholder-key', 'api%5Fkey=<placeholder>%20synthetic-private-material'],
      ['intermediate-placeholder-operator', 'api_key%3D<placeholder>%20synthetic-private-material'],
      [
        'intermediate-placeholder-all',
        encodeURIComponent('api_key=<placeholder> synthetic-private-material')
      ],
      [
        'intermediate-placeholder-html-key',
        'api&#95;key&#61;&lt;placeholder&gt;&#32;synthetic-private-material'
      ],
      [
        'intermediate-placeholder-syntax',
        '%74oken%20%3D%20%3Cplaceholder%3E%20synthetic-private-material'
      ],
      [
        'intermediate-placeholder-literal-gap',
        'api_key%3D <placeholder>%20synthetic-private-material'
      ],
      [
        'intermediate-placeholder-literal-colon',
        'api_key%3A <placeholder>%20synthetic-private-material'
      ],
      ['encoded-path-posix', 'Read %2Fhome%2Fsynthetic-owner%2Fprivate.md'],
      [
        'encoded-path-json-duplicate',
        '{"note":"%2Fhome%2Fsynthetic-owner%2Fprivate.md","note":"public"}'
      ],
      [
        'encoded-path-json-nested-duplicate',
        '{"data":{"note":"%2Fhome%2Fsynthetic-owner%2Fprivate.md","note":"public"}}'
      ],
      [
        'encoded-path-json-escaped-duplicate',
        '{"note":"%2Fhome%2Fsynthetic-owner%2Fprivate.md","\\u006eote":"public"}'
      ],
      ['encoded-path-lowercase', 'Read %2fhome%2fsynthetic-owner%2fprivate.md'],
      ['encoded-path-nested-percent', 'Read %252Fhome%252Fsynthetic-owner%252Fprivate.md'],
      ['encoded-path-drive', 'Read Z%3A%5Csynthetic-owner%5Cprivate.md'],
      ['encoded-path-drive-relative', 'Read Z%3Asynthetic-private.md'],
      ['encoded-path-unc', 'Read %5C%5Csynthetic-server%5Cprivate%5Cfile.md'],
      ['encoded-path-home', 'Read %7E%2Fsynthetic-private%2Ffile.md'],
      ['encoded-path-home-variable', 'Read %24HOME%2Fsynthetic-private%2Ffile.md'],
      ['encoded-path-home-braced', 'Read %24%7BHOME%7D%2Fsynthetic-private%2Ffile.md'],
      ['encoded-path-windows-home', 'Read %25USERPROFILE%25%5Csynthetic-private%5Cfile.md'],
      ['encoded-path-decimal-entity', 'Read &#47;home&#47;synthetic-owner&#47;private.md'],
      ['encoded-path-hex-entity', 'Read &#x2f;home&#x2f;synthetic-owner&#x2f;private.md'],
      ['encoded-path-named-entity', 'Read &sol;home&sol;synthetic-owner&sol;private.md'],
      [
        'encoded-path-nested-entity',
        'Read &amp;sol;home&amp;sol;synthetic-owner&amp;sol;private.md'
      ],
      [
        'encoded-path-percent-entity',
        'Read %26%23x2f%3Bhome%26%23x2f%3Bsynthetic-owner%26%23x2f%3Bprivate.md'
      ],
      ['encoded-path-entity-percent', 'Read &#37;2Fhome&#37;2Fsynthetic-owner&#37;2Fprivate.md'],
      ['encoded-path-fullwidth', 'Read ／home／synthetic-owner／private.md'],
      ['encoded-path-fullwidth-drive', 'Read Ｚ：＼synthetic-owner＼private.md'],
      [
        'encoded-path-percent-fullwidth',
        'Read %EF%BC%8Fhome%EF%BC%8Fsynthetic-owner%EF%BC%8Fprivate.md'
      ],
      ['encoded-path-json-unicode', 'Read \\u002fhome\\u002fsynthetic-owner\\u002fprivate.md'],
      [
        'encoded-path-percent-unicode',
        'Read %5Cu002fhome%5Cu002fsynthetic-owner%5Cu002fprivate.md'
      ],
      ['encoded-path-file-uri', 'Read file%3A%2F%2F%2Fhome%2Fsynthetic-owner%2Fprivate.md'],
      ['encoded-path-emphasis', 'Read **%2Fhome%2Fsynthetic-owner%2Fprivate.md**'],
      ['encoded-path-markdown', 'Read [synthetic](%2Fhome%2Fsynthetic-owner%2Fprivate.md)'],
      ['encoded-path-angle', 'Read <%2Fhome%2Fsynthetic-owner%2Fprivate.md>'],
      [
        'encoded-path-uri-userinfo',
        'Read https%3A%2F%2Fsynthetic-user%3Asynthetic-secret%40example.com%2Fwork'
      ],
      [
        'encoded-path-uri-quote-userinfo',
        'Read https%3A%2F%2Fsynthetic-user%27%3Asynthetic-secret%40example.com%2Fwork'
      ],
      [
        'encoded-path-uri-raw-quote-userinfo',
        "Read https://synthetic-user':synthetic-secret@example.com/work"
      ],
      [
        'encoded-path-uri-intermediate-userinfo',
        'Read https%3A%2F%2Fsynthetic-user%3Asynthetic%252Fsecret%40example.com%2Fwork'
      ],
      [
        'encoded-path-uri-mixed-operator-userinfo',
        'Read https&#58;&#47;&#47;synthetic-user%2F:synthetic-secret@public.example/guide'
      ],
      [
        'encoded-path-uri-encoded-scheme-ssh',
        'Read https://example.com/work?next=%73%73%68&#58;&#47;&#47;synthetic-owner%2Fsynthetic-secret%40public.example%2Fguide'
      ],
      [
        'encoded-path-uri-real-nested-authority',
        'Read https://example.com/work?next=%73%73%68%3A%2F%2Fsynthetic-owner%252Fsynthetic-secret%40public.example%2Fguide'
      ],
      [
        'encoded-path-uri-encoded-scheme-http',
        'Read https://example.com/work?next=%68%74%74%70%73&#58;&#47;&#47;synthetic-owner%2Fsynthetic-secret%40public.example%2Fguide'
      ],
      [
        'encoded-path-uri-quoted-code',
        'Read https%3A%2F%2Fexample.com%2Fwork%3Fq%3D%22public%22%26code%3Dsynthetic-secret'
      ],
      [
        'encoded-path-uri-raw-quote-code',
        'Read https%3A%2F%2Fexample.com%2Fwork%3Fq%3D"public%20query"%26code%3Dsynthetic-secret'
      ],
      [
        'encoded-path-uri-nested-userinfo',
        'Read https%3A%2F%2Fexample.com%2Fwork%3Fnext%3Dhttps%3A%2F%2Fsynthetic-user%3Asynthetic-secret%40public.example%2Fguide'
      ],
      [
        'encoded-path-uri-nested-raw-userinfo',
        'Read https://example.com/work?next=https://synthetic-user:synthetic-secret@public.example/guide'
      ],
      [
        'encoded-path-uri-nested-ssh-userinfo',
        'Read https://example.com/work?next=ssh%3A%2F%2Fsynthetic-user%3Asynthetic-secret%40public.example%2Fguide'
      ],
      [
        'encoded-path-known-root-uri-controls',
        'synthetic dynamic root hidden by URI parser normalization'
      ],
      ['encoded-path-known-root-url', 'synthetic dynamic encoded root in public URL'],
      [
        'encoded-path-over-budget',
        `Read ${Array.from({ length: 10 }).reduce<string>((value) => encodeURIComponent(value), '/home/synthetic-owner/private.md')}`
      ],
      ['encoded-path-contained-root', 'synthetic dynamic encoded checkout reference'],
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
      ['bold-credential-uri', 'Read **https://synthetic-user:synthetic-secret@example.com/work**'],
      ['query-access-token', 'Read https://example.com/work?access_token=synthetic-secret'],
      ['fragment-access-token', 'Read https://example.com/work#access_token=synthetic-secret'],
      ['query-api-key', 'Read https://example.com/work?apiKey=synthetic-secret'],
      ['query-client-secret', 'Read https://example.com/work?client-secret=synthetic-secret'],
      ['fragment-auth-code', 'Read https://example.com/work#/auth?code=synthetic-secret'],
      ['encoded-token-key', 'Read https://example.com/work?access%5Ftoken=synthetic-secret'],
      ['double-encoded-token', 'Read https://example.com/work?access%255Ftoken=synthetic-secret'],
      [
        'aws-signed-url',
        'Read https://example.com/work?X-Amz-Credential=synthetic-secret&X-Amz-Signature=synthetic-signature'
      ],
      [
        'google-signed-url',
        'Read https://example.com/work?X-Goog-Credential=synthetic-secret&X-Goog-Signature=synthetic-signature'
      ],
      [
        'azure-signed-url',
        'Read https://example.com/work?sv=synthetic-version&sig=synthetic-signature'
      ],
      [
        'cloudfront-signed-url',
        'Read https://example.com/work?Key-Pair-Id=synthetic-id&Signature=synthetic-signature'
      ],
      ['semicolon-token-query', 'Read https://example.com/work?mode=public;token=synthetic-secret'],
      [
        'html-escaped-token-query',
        'Read https://example.com/work?mode=public&amp;access_token=synthetic-secret'
      ],
      [
        'nested-credential-url',
        'Read https://example.com/work?redirect=https%3A%2F%2Fexample.com%2Fauth%3Frefresh_token%3Dsynthetic-secret'
      ],
      ['bold-query-token', 'Read **https://example.com/work?access_token=synthetic-secret**'],
      [
        'multiword-query-token',
        'Read **https://example.com/work?access_token=synthetic-secret is private**'
      ],
      [
        'encoded-json-token',
        'Read https://example.com/work?data=%7B%22access_token%22%3A%22synthetic-secret%22%7D'
      ],
      [
        'escaped-json-key',
        'Read https://example.com/work?data=%7B%22access_%5Cu0074oken%22%3A%22synthetic-secret%22%7D'
      ],
      [
        'double-escaped-json-key',
        'Read https://example.com/work?data=%7B%22access_%255Cu0074oken%22%3A%22synthetic-secret%22%7D'
      ],
      ['html-entity-token-key', 'Read https://example.com/work?access_t&#111;ken=synthetic-secret'],
      [
        'encoded-entity-token-key',
        'Read https://example.com/work?access_t%26%23111%3Bken=synthetic-secret'
      ],
      [
        'nested-html-entity-key',
        'Read https://example.com/work?access_t&amp;#111;ken=synthetic-secret'
      ],
      ['encoded-userinfo-uri', 'Read https://synthetic-user%3Asynthetic-secret%40example.com/work'],
      ['plaintext-bearer', 'Authorization: Bearer synthetic-secret'],
      ['credential-alias-oauth', 'oauth=synthetic-secret'],
      ['credential-alias-pat', 'pat=ghp_synthetic-secret'],
      ['credential-alias-oauth2', 'oauth2=synthetic-secret'],
      ['credential-alias-github-pat', 'GITHUB_PAT=ghp_synthetic-secret'],
      ['credential-alias-gitlab-pat', 'GitLabPat=glpat-synthetic-secret'],
      ['credential-alias-gh-pat', 'GH_PAT=ghp_synthetic-secret'],
      ['credential-alias-json-oauth', '{"OAuth":"synthetic-secret"}'],
      ['credential-alias-json-pat', '{"PAT":"ghp_synthetic-secret"}'],
      ['credential-alias-percent-oauth', '%6Fauth=synthetic-secret'],
      ['credential-alias-percent-pat', '%70%61%74=ghp_synthetic-secret'],
      ['credential-alias-entity-oauth', 'o&#97;uth=synthetic-secret'],
      ['credential-alias-entity-pat', 'p&#97;t=ghp_synthetic-secret'],
      ['credential-alias-unicode-pat', '{"\\u0070at":"ghp_synthetic-secret"}'],
      ['credential-alias-query-oauth', 'https://example.com/work?oauth=synthetic-secret'],
      ['credential-alias-fragment-oauth', 'https://example.com/work#oauth=synthetic-secret'],
      ['credential-alias-query-pat', 'https://example.com/work?pat=ghp_synthetic-secret'],
      ['credential-alias-fragment-pat', 'https://example.com/work#pat=ghp_synthetic-secret'],
      ['credential-alias-query-encoded-oauth', 'https://example.com/work?%6Fauth=synthetic-secret'],
      [
        'credential-alias-query-encoded-pat',
        'https://example.com/work?%70%61%74=ghp_synthetic-secret'
      ],
      ['credential-alias-fullwidth-oauth', 'ｏａｕｔｈ=synthetic-secret'],
      ['plaintext-basic', 'Authorization: Basic c3ludGhldGljLXNlY3JldA=='],
      ['plaintext-api-assignment', 'Use api_key=synthetic-secret'],
      ['plaintext-api-header', 'X-Api-Key: synthetic-secret'],
      ['plaintext-json-assignment', '{"api_key":"synthetic-secret"}'],
      ['plaintext-uppercase', 'API_KEY = synthetic-secret'],
      ['plaintext-password', 'password: synthetic-secret'],
      ['plaintext-client-secret', 'client_secret=synthetic-secret'],
      ['plaintext-refresh-token', 'refresh_token=synthetic-secret'],
      ['plaintext-id-token', 'idToken=synthetic-secret'],
      ['plaintext-escaped-json-key', '{"api\\u005Fkey":"synthetic-secret"}'],
      ['plaintext-entity-key', 'api&#95;key=synthetic-secret'],
      ['plaintext-percent-key', 'api%5Fkey=synthetic-secret'],
      ['plaintext-whitespace-header', 'Authorization :\tBearer synthetic-secret'],
      ['plaintext-cookie', 'Cookie: synthetic-session=synthetic-secret'],
      ['plaintext-set-cookie', 'Set-Cookie: synthetic-session=synthetic-secret'],
      ['plaintext-env-api-key', 'export API_KEY="synthetic-secret"'],
      ['plaintext-quoted-empty-prefix', 'export API_KEY=""synthetic-secret'],
      ['plaintext-shell-brace-suffix', 'export API_KEY=""}synthetic-secret'],
      ['plaintext-shell-bracket-suffix', 'export API_KEY=""]synthetic-secret'],
      ['plaintext-shell-comma-suffix', 'export API_KEY="",synthetic-secret'],
      ['plaintext-triple-quoted-value', 'api_key="""\nsynthetic-secret\n"""'],
      ['plaintext-nested-double-multiline', 'note = """\napi_key=synthetic-secret\n"""'],
      [
        'plaintext-nested-single-multiline',
        "note = '''\nAuthorization: Bearer synthetic-secret\n'''"
      ],
      ['plaintext-opener-double-multiline', 'note = """api_key=synthetic-secret\n"""'],
      [
        'plaintext-opener-single-multiline',
        "note = '''Authorization: Bearer synthetic-secret\n'''"
      ],
      ['plaintext-bearer-crlf', 'Bearer synthetic-secret\r\n'],
      ['plaintext-basic-crlf', 'Basic c3ludGhldGljLXNlY3JldA==\r\n'],
      ['plaintext-bearer-encoded-crlf', 'Bearer synthetic-secret%0D%0A'],
      ['plaintext-basic-encoded-crlf', 'Basic c3ludGhldGljLXNlY3JldA==%0D%0A'],
      ['plaintext-quoted-space-key', '{"api key":"synthetic-secret"}'],
      [
        'plaintext-pgp-private',
        '-----BEGIN PGP PRIVATE KEY BLOCK-----\nsynthetic-fake-key\n-----END PGP PRIVATE KEY BLOCK-----'
      ],
      ['plaintext-quoted-placeholder-suffix', 'api_key="{synthetic_credential}"synthetic-secret'],
      ['plaintext-single-quoted-space-key', "{'api key':'synthetic-secret'}"],
      [
        'plaintext-private-key',
        '-----BEGIN PRIVATE KEY-----\nsynthetic-fake-key\n-----END PRIVATE KEY-----'
      ],
      ['plaintext-attached-placeholder', 'api_key={synthetic_credential}synthetic-secret'],
      ['plaintext-folded-authorization', 'Authorization: Bearer\n synthetic-secret'],
      ['plaintext-encoded-fold', 'Authorization: Bearer%0A%20synthetic-secret'],
      ['plaintext-standalone-bearer', 'Bearer synthetic-secret'],
      ['plaintext-proxy-authorization', 'Proxy-Authorization: Basic c3ludGhldGljLXNlY3JldA==']
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
            form === 'quoted-inroot-spaces'
              ? `Read "${f.root}/synthetic path/file.md"`
              : form === 'encoded-path-contained-root'
                ? `Read ${encodeURIComponent(`${f.root}/AGENTS.md`)}`
                : form === 'encoded-path-known-root-uri-controls'
                  ? `Read https://example.com/view?source=${encodeURIComponent(`${f.root.replace('case-', 'ca\nse-')}/private.md`)}`
                  : form === 'encoded-path-known-root-url'
                    ? `Read https://example.com/view?source=${encodeURIComponent(`${f.root}/private.md`)}`
                    : prose;
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
        const prior = render(f);
        const prose =
          'Read [public](https://example.com/docs/reference?mode=public#section), ' +
          '<http://example.org/docs/reference> and [local](mydocs/skills/reference.md), ' +
          '[encoded public](https://example.com/public%20docs/%E2%9C%93?mode=public%2Fview), ' +
          'https://example.com/assets/a%20%2Fb.svg https://example.com/docs/%2Fguide.md ' +
          'https://example.com/search?q=%22a%20%2Fb%22 https://example.com/view?data=%7B%22route%22%3A%22%2Fpublic%22%7D ' +
          'https://example.com/redirect?next=https%3A%2F%2Fpublic.example%2Fguide ' +
          'https://example.com/redirect?next=git%3A%2F%2Fpublic.example%2Fguide ' +
          'https&#58;&#47;&#47;public.example/guide%2Fsection ' +
          'https://example.com/work?next=%73%73%68&#58;&#47;&#47;public.example/guide%2Fsection ' +
          'https://example.com/work?next=%73%73%68%3A%2F%2Fpublic.example%2Fpublic%40route%2Fguide ' +
          '{"url":"https://example.com/work?q=public","code":"public-example"} ' +
          '{"url": "https://example.com/work?q=public", "code": "public-example"} ' +
          'https%3A%2F%2Fexample.com%2Fpublic%3Fmode%3Dpublic ' +
          'mydocs/public%20notes.md and mydocs/public&#32;notes.md; 75% complete; ' +
          '[IPv6](https://[2001:db8::1]/docs/reference), ' +
          '[relative](./AGENTS.md), mydocs/../shared/reference.md and {skill-root}/review-prompts/edge-case-hunter.md. ' +
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
          'token_count=12; code=public; token usage and API key policy are public descriptions; ' +
          'https://example.com/home https://example.com/guide?route=/public ' +
          'https://example.com/guide?path=mydocs/public.md ' +
          'https://example.com/guide?path=mydocs/public.md&route=/public ' +
          'https://example.com/guide?path=%3Cmydocs%2Fpublic.md%3E ' +
          'https://example.com/guide?path=%5B%22mydocs%2Fpublic.md%22%5D ' +
          `https://example.com/report?meta=${encodeURIComponent(JSON.stringify({ path: 'src/public.md', q: 'a /b' }))} ` +
          `https://example.com/report?meta=${encodeURIComponent(JSON.stringify({ path: ['src/public.md'], q: 'a /b' }))} ` +
          'ghp_... github_pat_<redacted> ghp_{synthetic_token} ghs_<placeholder> ' +
          `ghp_${'A'.repeat(35)} github_pat_${'A'.repeat(22)}_${'B'.repeat(58)} ` +
          'npm_<redacted> glpat-... sk-proj-{synthetic_token} AIza<placeholder> ' +
          `pk_live_${'A'.repeat(24)} AKIA${'A'.repeat(16)} ` +
          'api_key=%7Bsynthetic_credential%7D; ' +
          'api_key=&lt;redacted&gt;; ' +
          'api_key%20%3D%20%3Cplaceholder%3E; api_key%3D %7Bsynthetic_credential%7D; ' +
          'oauth={synthetic_credential}; pat=<redacted>; oauth_count=4; compat=public; ' +
          'api_key={synthetic_credential}; Authorization: Bearer {synthetic_credential}; password=<redacted>; ' +
          'Proxy-Authorization: Basic {synthetic_credential}; ' +
          '\nBasic authentication is required.\nBearer tokens must never be logged.\n' +
          '-----BEGIN PGP PUBLIC KEY BLOCK-----\nsynthetic-public-key\n-----END PGP PUBLIC KEY BLOCK-----\n' +
          '{"api_key":"","password":"{synthetic_credential}"}\n' +
          'api_key="""\n"""\napi_key="""\n{synthetic_credential}"""\n' +
          "password='''\n'''\npassword='''\n{synthetic_credential}'''\n" +
          `Basic ${'A'.repeat(64)} authentication is required.\n` +
          `**${f.root}/AGENTS.md** _${f.root}/AGENTS.md_`;
        const { assignments, overrides, input } = privacyProse(f, skill, surface, prose);
        const before = readBytes(input);
        const defaults = readBytes(join(f.skillDir, 'customize.toml'));
        if (surface !== 'source') {
          privateRejection(f, prior, [input], assignments, f.root, overrides);
          return;
        }
        const snapshot = render(f, assignments, overrides);
        const output =
          snapshot.outputs[surface === 'source' ? 'plan-template.md' : 'step-04-review.md'];
        expect(
          output.includes('https://example.com/docs/reference?mode=public#section') &&
            output.includes('https://example.com/public%20docs/%E2%9C%93?mode=public%2Fview') &&
            output.includes(
              'https://example.com/assets/a%20%2Fb.svg https://example.com/docs/%2Fguide.md'
            ) &&
            output.includes(
              'https://example.com/search?q=%22a%20%2Fb%22 https://example.com/view?data=%7B%22route%22%3A%22%2Fpublic%22%7D'
            ) &&
            output.includes(
              'https://example.com/redirect?next=https%3A%2F%2Fpublic.example%2Fguide'
            ) &&
            output.includes(
              'https://example.com/redirect?next=git%3A%2F%2Fpublic.example%2Fguide'
            ) &&
            output.includes('https&#58;&#47;&#47;public.example/guide%2Fsection') &&
            output.includes(
              'https://example.com/work?next=%73%73%68&#58;&#47;&#47;public.example/guide%2Fsection'
            ) &&
            output.includes(
              'https://example.com/work?next=%73%73%68%3A%2F%2Fpublic.example%2Fpublic%40route%2Fguide'
            ) &&
            output.includes(
              '{"url":"https://example.com/work?q=public","code":"public-example"}'
            ) &&
            output.includes(
              '{"url": "https://example.com/work?q=public", "code": "public-example"}'
            ) &&
            output.includes('https%3A%2F%2Fexample.com%2Fpublic%3Fmode%3Dpublic') &&
            output.includes(
              'mydocs/public%20notes.md and mydocs/public&#32;notes.md; 75% complete;'
            ) &&
            output.includes('api_key={synthetic_credential}') &&
            output.includes('Authorization: Bearer {synthetic_credential}') &&
            output.includes('token_count=12') &&
            output.includes('https://example.com/home https://example.com/guide?route=/public') &&
            output.includes('https://example.com/guide?path=mydocs/public.md') &&
            output.includes('https://example.com/guide?path=mydocs/public.md&route=/public') &&
            output.includes('https://example.com/guide?path=%3Cmydocs%2Fpublic.md%3E') &&
            output.includes('https://example.com/guide?path=%5B%22mydocs%2Fpublic.md%22%5D') &&
            output.includes(
              `https://example.com/report?meta=${encodeURIComponent(JSON.stringify({ path: 'src/public.md', q: 'a /b' }))}`
            ) &&
            output.includes(
              `https://example.com/report?meta=${encodeURIComponent(JSON.stringify({ path: ['src/public.md'], q: 'a /b' }))}`
            ) &&
            output.includes(
              'ghp_... github_pat_<redacted> ghp_{synthetic_token} ghs_<placeholder>'
            ) &&
            output.includes(
              `ghp_${'A'.repeat(35)} github_pat_${'A'.repeat(22)}_${'B'.repeat(58)}`
            ) &&
            output.includes(`pk_live_${'A'.repeat(24)} AKIA${'A'.repeat(16)}`) &&
            output.includes('api_key=%7Bsynthetic_credential%7D') &&
            output.includes('api_key=&lt;redacted&gt;') &&
            output.includes(
              'api_key%20%3D%20%3Cplaceholder%3E; api_key%3D %7Bsynthetic_credential%7D;'
            ) &&
            output.includes('oauth={synthetic_credential}') &&
            output.includes('pat=<redacted>') &&
            output.includes('oauth_count=4; compat=public') &&
            output.includes('Basic authentication is required.') &&
            output.includes('Bearer tokens must never be logged.') &&
            output.includes('-----BEGIN PGP PUBLIC KEY BLOCK-----') &&
            output.includes('{"api_key":"","password":"{synthetic_credential}"}') &&
            output.includes('api_key="""\n{synthetic_credential}"""') &&
            output.includes("password='''\n{synthetic_credential}'''") &&
            output.includes(`Basic ${'A'.repeat(64)} authentication is required.`) &&
            output.includes('http://example.org/docs/reference') &&
            output.includes('https://[2001:db8::1]/docs/reference') &&
            output.includes('mydocs/skills/reference.md') &&
            output.includes('./AGENTS.md') &&
            output.includes('mydocs/../shared/reference.md') &&
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
        const boundRoot = `mydocs/skills/${skill}`;
        expect(
          output.includes(`${boundRoot}/review-prompts/edge-case-hunter.md`),
          'relative binding survives classification beside whitespace-separated emphasis'
        ).toBe(true);
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
          const instruction = 'file:AGENTS.md';
          const snapshot = render(f, [
            `workflow.quick_lenses=[{id="quick", name="Quick", instruction=${JSON.stringify(instruction)}}]`
          ]);
          expect(
            snapshot.outputs['plan-template.md'].includes('Synthetic reference: ./AGENTS.md'),
            'recognized source reference retains its repository target'
          ).toBe(true);
          expect(
            snapshot.outputs['step-04-review.md'].includes('file:AGENTS.md'),
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
                  `workflow.quick_lenses=[{id="quick", name="Quick", instruction=${JSON.stringify(`Read ${reference}`)}}]`
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
                `workflow.quick_lenses=[{id="quick", name="Quick", instruction=${JSON.stringify(`Read ${reference}`)}}]`
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
        `workflow.quick_lenses=[{id="quick", name="Quick", instruction="file:AGENTS.md"}]`
      ]);
      expect(
        snapshot.outputs[name].includes('./AGENTS.md') &&
          snapshot.outputs[name].includes(`mydocs/skills/${skill}/workflow.md`),
        'source references normalized and bound'
      ).toBe(true);
      expect(
        snapshot.outputs['step-04-review.md'].includes('file:AGENTS.md'),
        'custom instruction retains only a repository reference'
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
          `workflow.quick_lenses=[{id="quick", name="Quick", instruction="file:AGENTS.md"}]`
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

    for (const layer of [
      '_bmad/config.toml',
      '_bmad/custom/config.toml',
      '_bmad/custom/config.user.toml',
      'persistent',
      'persistent-user',
      'explicit'
    ]) {
      for (const error of ['PermissionError', 'OSError']) {
        it(`${skill} inaccessible optional ${layer} ${error} is not absence`, () => {
          const f = fixture(skill);
          const before = render(f);
          const priorManifest = sha256(readBytes(join(before.generation, 'manifest.json')));
          const priorEntry = sha256(readBytes(before.entry));
          const generations = readdirSync(dirname(before.generation)).sort();
          const target = layer.startsWith('persistent')
            ? join(
                f.root,
                '_bmad/custom',
                `${skill}${layer === 'persistent-user' ? '.user' : ''}.toml`
              )
            : join(f.root, layer === 'explicit' ? 'synthetic-override.toml' : layer);
          mkdirSync(dirname(target), { recursive: true });
          writeFileSync(target, '[core]\nactive_initiative = "synthetic-initiative"\n');
          const inputHash = sha256(readBytes(target));
          // Simulate Python 3.14 predicates suppressing a stat failure. This
          // probes the actual CLI without depending on host/root permissions.
          const wrapper = `import pathlib, runpy, sys
renderer, root, skill, target, error, explicit = sys.argv[1:]
original_stat = pathlib.Path.stat
original_exists = pathlib.Path.exists
original_symlink = pathlib.Path.is_symlink
def blocked_stat(self, *args, **kwargs):
    if str(self) == target:
        raise PermissionError("synthetic unavailable layer") if error == "PermissionError" else OSError("synthetic unavailable layer")
    return original_stat(self, *args, **kwargs)
pathlib.Path.stat = blocked_stat
pathlib.Path.exists = lambda self, *args, **kwargs: False if str(self) == target else original_exists(self, *args, **kwargs)
pathlib.Path.is_symlink = lambda self: False if str(self) == target else original_symlink(self)
sys.argv = [renderer, "--project-root", root, "--skill", skill]
if explicit == "yes":
    sys.argv += ["--overrides", target]
runpy.run_path(renderer, run_name="__main__")
`;
          const result = existingPython(
            [
              '-c',
              wrapper,
              f.renderer,
              f.root,
              f.skillDir,
              target,
              error,
              layer === 'explicit' ? 'yes' : 'no'
            ],
            f.root
          );
          expect(!result.error && result.status === 1, 'unavailable layer fails closed').toBe(true);
          expect(result.stdout === 'HALT: BMAD rendering failed.\n').toBe(true);
          expect(result.stderr === '').toBe(true);
          expect(sha256(readBytes(target)) === inputHash, 'input preserved').toBe(true);
          expect(
            sha256(readBytes(join(before.generation, 'manifest.json'))) === priorManifest
          ).toBe(true);
          expect(sha256(readBytes(before.entry)) === priorEntry).toBe(true);
          expect(readdirSync(dirname(before.generation)).sort()).toEqual(generations);
        });
      }
    }

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

    for (const layer of ['project', 'user', 'overrides', 'assignment'] as const) {
      it(`${skill} rejects unknown review-layer fields from ${layer}`, () => {
        const f = fixture(skill);
        const prior = render(f);
        const input =
          layer === 'project' || layer === 'user'
            ? join(f.root, '_bmad/custom', `${skill}${layer === 'user' ? '.user' : ''}.toml`)
            : join(f.root, 'synthetic-unknown-field.toml');
        mkdirSync(dirname(input), { recursive: true });
        for (const key of ['instrution', 'unknown_field', 'metadata']) {
          const assignments =
            layer === 'assignment' ? [`workflow.quick_lenses=[{id="quick",${key}=""}]`] : [];
          if (layer !== 'assignment')
            writeFileSync(input, `[[workflow.quick_lenses]]\nid="quick"\n${key}=""\n`);
          privateRejection(
            f,
            prior,
            layer === 'assignment' ? [] : [input],
            assignments,
            f.root,
            layer === 'overrides' ? input : undefined
          );
        }
      });
      it(`${skill} partial keyed lens overrides preserve declared fields from ${layer}`, () => {
        const f = fixture(skill);
        const defaults = join(f.skillDir, 'customize.toml');
        const original = readBytes(defaults);
        const input =
          layer === 'project' || layer === 'user'
            ? join(f.root, '_bmad/custom', `${skill}${layer === 'user' ? '.user' : ''}.toml`)
            : join(f.root, 'synthetic-partial.toml');
        mkdirSync(dirname(input), { recursive: true });
        for (const instruction of ['', 'file:AGENTS.md']) {
          const assignments =
            layer === 'assignment'
              ? [`workflow.quick_lenses=[{id="quick",instruction=${JSON.stringify(instruction)}}]`]
              : [];
          if (layer !== 'assignment')
            writeFileSync(
              input,
              `[[workflow.quick_lenses]]\nid="quick"\ninstruction=${JSON.stringify(instruction)}\n`
            );
          const before = layer === 'assignment' ? undefined : readBytes(input);
          const snapshot = render(f, assignments, layer === 'overrides' ? input : undefined);
          expect(
            snapshot.manifest.inputs.resolved_values['customization.workflow.quick_lenses']
          ).toEqual([{ id: 'quick', name: 'Quick', instruction }]);
          expect(
            snapshot.outputs['step-04-review.md'].includes(
              instruction ? 'file:AGENTS.md' : 'No active review layers.'
            )
          ).toBe(true);
          expect(readBytes(defaults).equals(original)).toBe(true);
          if (before) expect(readBytes(input).equals(before)).toBe(true);
        }
      });
    }

    it(`${skill} permits a single-ID cross-layer override outside shipped source directories`, () => {
      const f = fixture(skill);
      const outside = fixture(skill);
      const defaults = join(f.skillDir, 'customize.toml');
      const before = sha256(readBytes(defaults));
      const overrides = join(outside.root, 'synthetic-override.toml');
      const candidate =
        '[[workflow.quick_lenses]]\nid = "quick"\nname = "Quick"\ninstruction = "file:AGENTS.md"\n';
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
          name: 'Quick',
          instruction: 'file:AGENTS.md'
        }
      ]);
      assertText(
        snapshot.outputs['step-04-review.md'],
        /file:AGENTS\.md/,
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
            '[[workflow.quick_lenses]]\nid = "quick"\nname = "Quick"\ninstruction = "Synthetic duplicate witness."\n';
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
