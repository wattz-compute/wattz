import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { ensureHome, nodeStatePath } from '../config/path';

export interface NodeState {
  pid: number;
  startedAt: number;
  model: string;
  bind: string;
  ollamaEndpoint: string;
  operator: string;
}

export async function saveNodeState(state: NodeState): Promise<void> {
  await ensureHome();
  await writeFile(nodeStatePath(), `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

export async function readNodeState(): Promise<NodeState | undefined> {
  const path = nodeStatePath();
  if (!existsSync(path)) return undefined;
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw) as NodeState;
}

export function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EPERM') return true;
    return false;
  }
}
