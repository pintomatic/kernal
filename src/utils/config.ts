import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface KernalConfig {
  dbPath: string;
}

const KERNAL_DIR = join(homedir(), '.kernal');
const CONFIG_PATH = join(KERNAL_DIR, 'config.json');
const DEFAULT_DB_PATH = join(KERNAL_DIR, 'kernal.db');

export function ensureKernalDir(): void {
  mkdirSync(KERNAL_DIR, { recursive: true });
}

export function getConfig(): KernalConfig {
  if (existsSync(CONFIG_PATH)) {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw) as KernalConfig;
  }
  return { dbPath: DEFAULT_DB_PATH };
}

export function saveConfig(config: KernalConfig): void {
  ensureKernalDir();
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function getDbPath(): string {
  return process.env.KERNAL_DB_PATH || getConfig().dbPath;
}

export function getKernalDir(): string {
  return KERNAL_DIR;
}
