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
