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
const macConfigSection = (builderConfig: string): string =>
  builderConfig.match(/^mac:\n(?:(?!^\S).*\n?)*/m)?.[0] ?? '';

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
    const packageJson = readProjectFile('package.json');

    // When
    const packageMacScript = packageJson.match(/"package:mac": "([^"]+)"/)?.[1] ?? '';

    // Then
    expect(packageMacScript).toContain('electron-builder --mac dmg --arm64 --publish never');
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
    const packageJson = readProjectFile('package.json');

    // When
    const packageMacScript = packageJson.match(/"package:mac": "([^"]+)"/)?.[1] ?? '';
    const verifyMacSigningScript = packageJson.match(/"verify:mac-signing": "([^"]+)"/)?.[1] ?? '';
    const preflightIndex = packageMacScript.indexOf('verify:mac-signing -- --preflight');
    const builderIndex = packageMacScript.indexOf(
      'electron-builder --mac dmg --arm64 --publish never'
    );
    const verificationIndex = packageMacScript.indexOf('verify:mac-signing -- --finalize');

    // Then
    expect(verifyMacSigningScript).toContain('src/desktop/packaging/verifyMacosSigning.ts');
    expect(preflightIndex).toBeGreaterThanOrEqual(0);
    expect(preflightIndex).toBeLessThan(builderIndex);
    expect(verificationIndex).toBeGreaterThan(builderIndex);
  });

  it('keeps signing and team inputs external to the builder-managed package script', () => {
    // Given
    const builderConfig = readProjectFile('electron-builder.yml');
    const packageJson = readProjectFile('package.json');
    const verifier = readProjectFile('src/desktop/packaging/verifyMacosSigning.ts');

    // When
    const packageMacScript = packageJson.match(/"package:mac": "([^"]+)"/)?.[1] ?? '';
    const signingSurface = `${builderConfig}\n${packageMacScript}`;

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
    const packageJson = readProjectFile('package.json');

    // When
    const packageMacScript = packageJson.match(/"package:mac": "([^"]+)"/)?.[1] ?? '';

    // Then
    expect(packageMacScript).toContain(
      'electron-builder --mac dmg --arm64 --publish never >/dev/null 2>&1'
    );
    expect(packageMacScript).toContain('TW_SIGNING_FAILED');
    expect(packageMacScript).not.toMatch(/\b(?:mktemp|PACKAGE_LOG)\b/);
    expect(packageMacScript).not.toMatch(/>[^&\s]*\.log/);
  });

  it('retains the tracked packaged-app smoke contract without adding it to the package script', () => {
    // Given
    const packageJson = readProjectFile('package.json');
    const implementationPlan = readProjectFile('mydocs/plans/task_m01x_4_impl.md');

    // When
    const packageMacScript = packageJson.match(/"package:mac": "([^"]+)"/)?.[1] ?? '';

    // Then
    expect(implementationPlan).toContain('TOKENWATCH_DB_PATH="$SMOKE_DB"');
    expect(implementationPlan).toContain('tokenwatch_desktop_renderer_loaded');
    expect(implementationPlan).toContain('hdiutil attach "$DMG_PATH" -nobrowse -readonly');
    expect(implementationPlan).toContain("require('better-sqlite3')");
    expect(packageMacScript).not.toContain('TOKENWATCH_DESKTOP_SMOKE_LOG');
  });

  it('sets the package release version to 0.1.1', () => {
    // Given
    const packageJson = readProjectFile('package.json');

    // When
    const packageVersion = packageJson.match(/"version": "([^"]+)"/)?.[1] ?? '';

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
