import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  classifyPath,
  discoverAllowedFiles,
  emptyResult,
  isDeniedPath,
  type DiscoveredFile,
  type ParseContext,
  type ParseResult,
  type ParserDiscoverOptions,
  type UsageParser
} from './base.js';

const UNSUPPORTED_WARNING = 'unsupported_usage_artifact';

export const cursorParser: UsageParser = {
  name: 'cursor',
  defaultPaths() {
    const cursorDir = join(homedir(), '.cursor');
    return [join(cursorDir, 'ai-tracking', 'ai-code-tracking.db'), join(cursorDir, 'chats')];
  },
  async discover(options: ParserDiscoverOptions): Promise<DiscoveredFile[]> {
    const roots = options.path
      ? [options.path]
      : this.defaultPaths().filter((root) => existsSync(root));
    return roots.flatMap((root) => {
      if (isDeniedPath(root)) return [];
      const kind = classifyPath(root);
      if (kind === 'directory')
        return discoverAllowedFiles(root, { maxDepth: options.path ? 4 : 5 });
      if (kind === 'json' || kind === 'jsonl' || kind === 'sqlite') return [{ path: root, kind }];
      return [];
    });
  },
  async parse(_file: DiscoveredFile, _context: ParseContext): Promise<ParseResult> {
    return emptyResult(UNSUPPORTED_WARNING);
  }
};
