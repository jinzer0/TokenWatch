import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();
const expectedEntitlements = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
</dict>
</plist>
`;

const readProjectFile = (path: string): string => readFileSync(join(projectRoot, path), 'utf8');
const readPackageJson = (): { scripts: Record<string, string> } =>
  JSON.parse(readProjectFile('package.json')) as { scripts: Record<string, string> };
const macConfigSection = (builderConfig: string): string =>
  builderConfig.match(/^mac:\n(?:(?!^\S).*\n?)*/m)?.[0] ?? '';
const linuxConfigSection = (builderConfig: string): string =>
  builderConfig.match(/^linux:\n(?:(?!^\S).*\n?)*/m)?.[0] ?? '';

describe('macOS packaging policy', () => {
  it('omits a hardcoded signing identity when mac configuration is read', () => {
    // Given
    const builderConfig = readProjectFile('electron-builder.yml');

    // When
    const macConfig = macConfigSection(builderConfig);

    // Then
    expect(macConfig).not.toContain('identity: null');
    expect(macConfig).not.toMatch(/^\s*identity:\s*.+$/m);
  });

  it('enables hardened runtime and notarization directly under mac configuration', () => {
    // Given
    const builderConfig = readProjectFile('electron-builder.yml');

    // When
    const macConfig = macConfigSection(builderConfig);

    // Then
    expect(macConfig).toMatch(/^ {2}hardenedRuntime: true$/m);
    expect(macConfig).toMatch(/^ {2}notarize: true$/m);
  });

  it('configures direct mac entitlement paths while retaining the DMG target', () => {
    // Given
    const builderConfig = readProjectFile('electron-builder.yml');

    // When
    const macConfig = macConfigSection(builderConfig);

    // Then
    expect(macConfig).toMatch(/^ {2}entitlements: build\/entitlements\.mac\.plist$/m);
    expect(macConfig).toMatch(
      /^ {2}entitlementsInherit: build\/entitlements\.mac\.inherit\.plist$/m
    );
    expect(macConfig).toContain('    - target: dmg');
  });

  it('explicitly builds an arm64 DMG without publishing', () => {
    // Given
    const packageJson = readPackageJson();

    // When
    const packageMacArm64Script = packageJson.scripts['package:mac:arm64'] ?? '';
    const packageMacX64Script = packageJson.scripts['package:mac:x64'] ?? '';

    // Then
    expect(packageMacArm64Script).toContain('electron-builder --mac dmg --arm64 --publish never');
    expect(packageMacX64Script).toContain('electron-builder --mac dmg --x64 --publish never');
  });

  it('configures Linux AppImage release candidates for both desktop architectures', () => {
    // Given
    const builderConfig = readProjectFile('electron-builder.yml');
    const packageJson = readPackageJson();

    // When
    const linuxConfig = linuxConfigSection(builderConfig);

    // Then
    expect(linuxConfig).toContain('    - target: AppImage');
    expect(packageJson.scripts['verify:linux-appimage']).toContain(
      'src/desktop/packaging/verifyLinuxAppImage.ts'
    );
    expect(packageJson.scripts['package:linux:x64']).toContain(
      'electron-builder --linux AppImage --x64 --publish never'
    );
    expect(packageJson.scripts['package:linux:x64']).toContain(
      'checksum:sha256 -- release/TokenWatch-0.1.1-x86_64.AppImage'
    );
    expect(packageJson.scripts['package:linux:x64']).toContain(
      'verify:linux-appimage -- --artifact release/TokenWatch-0.1.1-x86_64.AppImage --checksum release/TokenWatch-0.1.1-x86_64.AppImage.sha256'
    );
    expect(packageJson.scripts['package:linux:arm64']).toContain(
      'electron-builder --linux AppImage --arm64 --publish never'
    );
    expect(packageJson.scripts['package:linux:arm64']).toContain(
      'verify:linux-appimage -- --artifact release/TokenWatch-0.1.1-arm64.AppImage --checksum release/TokenWatch-0.1.1-arm64.AppImage.sha256'
    );
  });

  it('requires builder-managed app and DMG signing', () => {
    // Given
    const builderConfig = readProjectFile('electron-builder.yml');

    // When
    const forceCodeSigning = builderConfig.match(/^forceCodeSigning: (.+)$/m)?.[1] ?? '';
    const dmgConfig = builderConfig.match(/^dmg:\n(?:(?!^\S).*\n?)*/m)?.[0] ?? '';

    // Then
    expect(forceCodeSigning).toBe('true');
    expect(dmgConfig).toMatch(/^ {2}sign: true$/m);
  });

  it('runs signer verification around the builder and exposes direct verification', () => {
    // Given
    const packageJson = readPackageJson();

    // When
    const packageMacArm64Script = packageJson.scripts['package:mac:arm64'] ?? '';
    const packageMacX64Script = packageJson.scripts['package:mac:x64'] ?? '';
    const verifyMacSigningScript = packageJson.scripts['verify:mac-signing'] ?? '';
    const verifyMacDmgSmokeScript = packageJson.scripts['verify:mac-dmg-smoke'] ?? '';
    const preflightIndex = packageMacArm64Script.indexOf('verify:mac-signing -- --preflight');
    const builderIndex = packageMacArm64Script.indexOf(
      'electron-builder --mac dmg --arm64 --publish never'
    );
    const verificationIndex = packageMacArm64Script.indexOf('verify:mac-signing -- --finalize');
    const smokeIndex = packageMacArm64Script.indexOf('verify:mac-dmg-smoke -- --dmg');

    // Then
    expect(verifyMacSigningScript).toContain('src/desktop/packaging/verifyMacosSigning.ts');
    expect(verifyMacDmgSmokeScript).toContain('src/desktop/packaging/verifyMacosDmgSmoke.ts');
    expect(preflightIndex).toBeGreaterThanOrEqual(0);
    expect(preflightIndex).toBeLessThan(builderIndex);
    expect(verificationIndex).toBeGreaterThan(builderIndex);
    expect(smokeIndex).toBeGreaterThan(verificationIndex);
    expect(packageMacX64Script).toContain('--finalize --app release/mac/TokenWatch.app');
    expect(packageMacX64Script).toContain(
      'verify:mac-dmg-smoke -- --dmg release/TokenWatch-0.1.1-x64.dmg --app-name TokenWatch'
    );
  });

  it('keeps signing and team inputs external to the builder-managed package script', () => {
    // Given
    const builderConfig = readProjectFile('electron-builder.yml');
    const packageJson = readPackageJson();
    const verifier = readProjectFile('src/desktop/packaging/verifyMacosSigning.ts');

    // When
    const signingSurface = `${builderConfig}\n${packageJson.scripts['package:mac:arm64'] ?? ''}\n${
      packageJson.scripts['package:mac:x64'] ?? ''
    }`;

    // Then
    expect(signingSurface).not.toMatch(/^\s*identity:\s*.+$/m);
    expect(signingSurface).not.toMatch(/\b(?=[A-Z0-9]{10}\b)(?=[A-Z0-9]*\d)[A-Z0-9]+\b/);
    expect(signingSurface).not.toContain('TOKENWATCH_EXPECTED_TEAM_ID=');
    expect(signingSurface).not.toContain('codesign');
    expect(signingSurface).not.toContain('--sign');
    expect(verifier).not.toContain('Authority=');
    expect(verifier).not.toContain('--sign');
  });

  it('suppresses builder output with a generic failure and no temporary package log', () => {
    // Given
    const packageJson = readPackageJson();

    // When
    const packageMacArm64Script = packageJson.scripts['package:mac:arm64'] ?? '';
    const packageLinuxX64Script = packageJson.scripts['package:linux:x64'] ?? '';

    // Then
    expect(packageMacArm64Script).toContain(
      'electron-builder --mac dmg --arm64 --publish never >/dev/null 2>&1'
    );
    expect(packageMacArm64Script).toContain('TW_SIGNING_FAILED');
    expect(packageLinuxX64Script).toContain('TW_LINUX_PACKAGE_FAILED');
    expect(`${packageMacArm64Script}\n${packageLinuxX64Script}`).not.toMatch(
      /\b(?:mktemp|PACKAGE_LOG)\b/
    );
    expect(`${packageMacArm64Script}\n${packageLinuxX64Script}`).not.toMatch(/>[^&\s]*\.log/);
  });

  it('retains the tracked packaged-app smoke contract without adding it to the package script', () => {
    // Given
    const packageJson = readPackageJson();
    const implementationPlan = readProjectFile('mydocs/plans/task_m01x_4_impl.md');

    // When
    const packageMacScript = packageJson.scripts['package:mac'] ?? '';

    // Then
    expect(implementationPlan).toContain('TOKENWATCH_DB_PATH="$SMOKE_DB"');
    expect(implementationPlan).toContain('tokenwatch_desktop_renderer_loaded');
    expect(implementationPlan).toContain('hdiutil attach "$DMG_PATH" -nobrowse -readonly');
    expect(implementationPlan).toContain("require('better-sqlite3')");
    expect(packageMacScript).not.toContain('TOKENWATCH_DESKTOP_SMOKE_LOG');
  });

  it('adds a tag-triggered release-candidate workflow without automatic GitHub Release publication', () => {
    // Given
    const workflow = readProjectFile('.github/workflows/release-candidate.yml');

    // Then
    expect(workflow).toContain("tags:\n      - 'v*'");
    expect(workflow).toContain('environment: tokenwatch-release-signing');
    expect(workflow).toContain('runner: macos-14');
    expect(workflow).toContain('runner: macos-13');
    expect(workflow).toContain('runner: ubuntu-24.04-arm');
    expect(workflow).toContain('package:mac:arm64');
    expect(workflow).toContain('package:mac:x64');
    expect(workflow).toContain('package:linux:x64');
    expect(workflow).toContain('package:linux:arm64');
    expect(workflow).toContain('TW_RELEASE_CANDIDATE_FAILED');
    expect(workflow).not.toContain('gh release upload');
    expect(workflow).not.toContain('softprops/action-gh-release');
    expect(workflow).not.toContain('contents: write');
  });

  it('sets the package release version to 0.1.1', () => {
    // When
    const packageVersion = readProjectFile('package.json').match(/"version": "([^"]+)"/)?.[1] ?? '';

    // Then
    expect(packageVersion).toBe('0.1.1');
  });

  it('sets the application release version to 0.1.1', () => {
    // Given
    const constants = readProjectFile('src/app/constants.ts');

    // When
    const applicationVersion = constants.match(/APP_VERSION = '([^']+)'/)?.[1] ?? '';

    // Then
    expect(applicationVersion).toBe('0.1.1');
  });

  it('uses identical allow-jit-only application and inherited entitlements', () => {
    // Given
    const applicationEntitlementsPath = 'build/entitlements.mac.plist';
    const inheritedEntitlementsPath = 'build/entitlements.mac.inherit.plist';
    const applicationEntitlementsExist = existsSync(join(projectRoot, applicationEntitlementsPath));
    const inheritedEntitlementsExist = existsSync(join(projectRoot, inheritedEntitlementsPath));

    // When
    const entitlementFilesExist = applicationEntitlementsExist && inheritedEntitlementsExist;

    // Then
    expect.soft(applicationEntitlementsExist).toBe(true);
    expect.soft(inheritedEntitlementsExist).toBe(true);
    if (!entitlementFilesExist) return;

    const applicationEntitlements = readProjectFile(applicationEntitlementsPath);
    const inheritedEntitlements = readProjectFile(inheritedEntitlementsPath);
    expect(applicationEntitlements).toBe(inheritedEntitlements);
    expect(applicationEntitlements).toBe(expectedEntitlements);
    expect(inheritedEntitlements).toBe(expectedEntitlements);
  });
});
