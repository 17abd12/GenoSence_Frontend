import fs from 'node:fs/promises';
import path from 'node:path';

export function getBackendSamplesDir() {
  return path.resolve(process.cwd(), '..', 'backend', 'samples');
}

function ensureBackendSamplePath(relativePath: string) {
  const resolvedPath = path.resolve(getBackendSamplesDir(), relativePath);
  const rootPath = getBackendSamplesDir();

  if (resolvedPath !== rootPath && !resolvedPath.startsWith(`${rootPath}${path.sep}`)) {
    throw new Error(`Invalid backend sample path: ${relativePath}`);
  }

  return resolvedPath;
}

export async function readBackendSampleText(fileName: string) {
  return fs.readFile(ensureBackendSamplePath(fileName), 'utf8');
}

export async function readBackendSampleJson<T>(fileName: string): Promise<T> {
  const raw = await readBackendSampleText(fileName);
  return JSON.parse(raw) as T;
}

export async function readBackendSampleFile(fileName: string) {
  return fs.readFile(ensureBackendSamplePath(fileName));
}

export async function listBackendSampleFiles() {
  const rootDir = getBackendSamplesDir();
  const entries: Array<{ path: string; size: number; kind: 'file' | 'directory' }> = [];

  async function walk(directoryPath: string, prefix = '') {
    const children = await fs.readdir(directoryPath, { withFileTypes: true });

    for (const child of children) {
      const relativePath = prefix ? path.posix.join(prefix, child.name) : child.name;
      const absolutePath = path.join(directoryPath, child.name);

      if (child.isDirectory()) {
        entries.push({ path: `${relativePath}/`, size: 0, kind: 'directory' });
        await walk(absolutePath, relativePath);
        continue;
      }

      const stats = await fs.stat(absolutePath);
      entries.push({ path: relativePath, size: stats.size, kind: 'file' });
    }
  }

  await walk(rootDir);
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}
