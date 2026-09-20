import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function sha256Line(artifactPath: string): string {
  const digest = createHash('sha256').update(readFileSync(artifactPath)).digest('hex');
  return `${digest}  ${basename(artifactPath)}\n`;
}

export function writeSha256File(artifactPath: string): void {
  writeFileSync(`${artifactPath}.sha256`, sha256Line(artifactPath));
}

function runCli(): void {
  const artifactPath = process.argv[2];
  if (artifactPath === undefined || artifactPath.length === 0) {
    process.stderr.write('TW_CHECKSUM_FAILED\n');
    process.exitCode = 1;
    return;
  }
  try {
    writeSha256File(artifactPath);
  } catch {
    process.stderr.write('TW_CHECKSUM_FAILED\n');
    process.exitCode = 1;
  }
}

const invokedScript = process.argv[1];
if (invokedScript !== undefined && resolve(invokedScript) === fileURLToPath(import.meta.url)) {
  runCli();
}
