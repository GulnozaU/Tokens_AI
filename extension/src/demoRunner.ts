/**
 * Kaggle Demo Runner — one-click deterministic demo orchestration.
 */

import { spawn } from 'child_process';
import * as vscode from 'vscode';
import { DemoResults, TokenOSClient } from './api/client';

export type DemoProgressCallback = (step: string, detail?: string) => void;

const DEMO_STEPS = [
  'Checking backend health...',
  'Resetting demo state...',
  'Simulating AI coding session (JWT auth bug)...',
  'Extracting skill from workflow...',
  'Running similarity search...',
  'Reusing existing skill...',
  'Computing token savings...',
] as const;

const DEMO_SCENARIO_FILES = [
  'src/middleware/auth.ts',
  'src/utils/jwt.ts',
  '.env.example',
];

let lastDemoResults: DemoResults | null = null;
let demoOutputChannel: vscode.OutputChannel | undefined;

function getDemoOutputChannel(): vscode.OutputChannel {
  if (!demoOutputChannel) {
    demoOutputChannel = vscode.window.createOutputChannel('TokenOS Demo');
  }
  return demoOutputChannel;
}

function logDemoStep(step: string, detail?: string): void {
  const channel = getDemoOutputChannel();
  channel.appendLine(`▸ ${step}`);
  if (detail) {
    channel.appendLine(`  ${detail}`);
  }
}

export function getLastDemoResults(): DemoResults | null {
  return lastDemoResults;
}

export function setLastDemoResults(results: DemoResults | null): void {
  lastDemoResults = results;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(client: TokenOSClient, maxAttempts = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    if (await client.health()) {
      return true;
    }
    await sleep(1000);
  }
  return false;
}

function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

async function tryStartBackend(onProgress: DemoProgressCallback): Promise<void> {
  const root = getWorkspaceRoot();
  if (!root) {
    return;
  }

  onProgress('Starting backend server...', 'npm run dev:backend');

  const child = spawn('npm', ['run', 'dev:backend'], {
    cwd: root,
    shell: true,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

export async function ensureBackendReady(
  client: TokenOSClient,
  onProgress: DemoProgressCallback
): Promise<void> {
  onProgress(DEMO_STEPS[0]);

  if (await client.health()) {
    return;
  }

  await tryStartBackend(onProgress);

  const ready = await waitForHealth(client);
  if (!ready) {
    throw new Error(
      'Backend not reachable. Run `npm run dev:backend` or `docker compose up` in the project root.'
    );
  }
}

export async function runKaggleDemo(
  client: TokenOSClient,
  onProgress: DemoProgressCallback
): Promise<DemoResults> {
  const channel = getDemoOutputChannel();
  channel.clear();
  channel.show(true);
  channel.appendLine('TokenOS Kaggle Demo — JWT Authentication Bug Fix');
  channel.appendLine('(Simulated session for presentation — no real AI calls)\n');

  const report = (step: string, detail?: string) => {
    logDemoStep(step, detail);
    onProgress(step, detail);
  };

  await ensureBackendReady(client, report);

  report(DEMO_STEPS[1]);
  await client.resetDemo();

  report(DEMO_STEPS[2], `Files touched: ${DEMO_SCENARIO_FILES.join(', ')}`);
  await sleep(600);

  for (const step of DEMO_STEPS.slice(3, -1)) {
    report(step);
    await sleep(500);
  }

  report(DEMO_STEPS[DEMO_STEPS.length - 1]);
  const results = await client.runKaggleDemo();
  lastDemoResults = results;

  const tc = results.token_comparison;
  channel.appendLine('\n── Demo complete ──');
  if (tc) {
    channel.appendLine(
      `Saved ${tc.tokens_saved.toLocaleString()} tokens (${tc.reduction_percent}% reduction)`
    );
    channel.appendLine(`Skill created: ${results.skill_created}`);
    channel.appendLine(`Skill reused: ${results.skill_reused ? 'YES' : 'NO'}`);
  }

  return results;
}

export async function resetDemoState(
  client: TokenOSClient,
  onProgress?: DemoProgressCallback
): Promise<void> {
  onProgress?.('Checking backend...');
  await ensureBackendReady(client, onProgress ?? (() => undefined));
  onProgress?.('Resetting demo state...');
  await client.resetDemo();
  lastDemoResults = null;
}
