import * as dotenv from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

function resolveApiRoot() {
  const currentWorkingDirectory = process.cwd();
  const normalizedDirectory = currentWorkingDirectory.replace(/\\/g, '/');

  if (normalizedDirectory.endsWith('/apps/api')) {
    return currentWorkingDirectory;
  }

  return resolve(currentWorkingDirectory, 'apps/api');
}

export const apiRoot = resolveApiRoot();
export const workspaceRoot = resolve(apiRoot, '../..');
export const workspaceEnvPath = resolve(workspaceRoot, '.env');
export const apiEnvPath = resolve(apiRoot, '.env');

const envPaths = [workspaceEnvPath, apiEnvPath];

for (const envPath of envPaths) {
  if (!existsSync(envPath)) {
    continue;
  }

  // Root .env wins; the app-local .env remains a backward-compatible fallback.
  dotenv.config({ path: envPath, quiet: true });
}
