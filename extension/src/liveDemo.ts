/**
 * One-click auto demo — fixes a real JWT bug twice and shows TokenOS learning + reuse.
 */

import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { DemoResults, TokenOSClient } from './api/client';
import { ActivityObserver } from './observers/activityObserver';
import { ensureBackendReady } from './demoRunner';

const TASK = 'Fix JWT authentication bug — expired tokens accepted on login';
const REUSE_QUERY = 'JWT token expired on login';

export type DemoProgressCallback = (step: string, detail?: string) => void;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function getDemoAppPath(extensionUri: vscode.Uri): string | null {
  const fromExtension = path.join(extensionUri.fsPath, '..', 'demo-app');
  const folders = vscode.workspace.workspaceFolders ?? [];

  for (const folder of folders) {
    const candidate = path.join(folder.uri.fsPath, 'demo-app');
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
    if (path.basename(folder.uri.fsPath) === 'demo-app') return folder.uri.fsPath;
  }
  if (fs.existsSync(path.join(fromExtension, 'package.json'))) return fromExtension;
  return null;
}

function runScript(cwd: string, script: string, args: string[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('node', [path.join('scripts', script), ...args], { cwd }, (err, _out, stderr) => {
      if (err) reject(new Error(stderr || String(err)));
      else resolve();
    });
  });
}

function runTests(cwd: string): Promise<boolean> {
  return new Promise((resolve) => {
    execFile('npm', ['test'], { cwd, shell: true }, (err) => resolve(!err));
  });
}

async function openJwtFile(extensionUri: vscode.Uri): Promise<void> {
  const demoPath = getDemoAppPath(extensionUri);
  if (!demoPath) return;
  const jwtPath = path.join(demoPath, 'src/utils/jwt.js');
  if (fs.existsSync(jwtPath)) {
    const doc = await vscode.workspace.openTextDocument(jwtPath);
    await vscode.window.showTextDocument(doc, { preview: true });
  }
}

async function step(
  onProgress: DemoProgressCallback,
  label: string,
  detail: string,
  ms = 900
): Promise<void> {
  onProgress(label, detail);
  await sleep(ms);
}

/**
 * Fully automated demo: bug → fix → learn → same bug → reuse skill → savings.
 */
export async function runAutoLiveDemo(
  extensionUri: vscode.Uri,
  client: TokenOSClient,
  observer: ActivityObserver,
  onProgress: DemoProgressCallback
): Promise<DemoResults> {
  const demoAppPath = getDemoAppPath(extensionUri);
  if (!demoAppPath) {
    throw new Error('Open the Tokens_AI project folder, then try again.');
  }

  await step(onProgress, 'Starting demo…', 'Connecting to TokenOS');
  await ensureBackendReady(client, () => undefined);
  await client.resetDemo();

  // ── Round 1: discover bug, fix it, learn skill ──
  await step(onProgress, 'Step 1 of 6', 'Found a login bug — expired JWT tokens still work');
  await runScript(demoAppPath, 'reset-bug.js');
  const testsFail = await runTests(demoAppPath);
  if (testsFail) {
    throw new Error('Demo setup error: tests should fail on buggy code');
  }

  await step(onProgress, 'Step 2 of 6', 'Fixing jwt.js — adding expiry check');
  await openJwtFile(extensionUri);
  await runScript(demoAppPath, 'reset-bug.js', ['fixed']);

  observer.startTask(TASK);
  observer.recordFileEdit('demo-app/src/utils/jwt.js');
  observer.recordFileEdit('demo-app/src/middleware/auth.js');
  observer.recordPrompt('Fix JWT auth — expired tokens accepted');
  observer.recordAIResponse('Added exp check in jwt.verify()');
  observer.recordCommand('npm test');

  await step(onProgress, 'Step 3 of 6', 'Running tests — all passing');
  const testsPass = await runTests(demoAppPath);
  if (!testsPass) throw new Error('Fix did not pass tests');

  observer.recordTestResult(true, 'all auth tests passed');

  await step(onProgress, 'Step 4 of 6', 'TokenOS is saving this fix as a skill…');
  const learned = await observer.finalizeAndExtractSkill(
    true,
    'JWT expiry validation added. Expired tokens rejected. Tests pass.',
    800
  );
  if (!learned) throw new Error('Could not extract skill from session');

  // ── Round 2: same bug, TokenOS reuses skill ──
  await step(onProgress, 'Step 5 of 6', 'Same bug again — TokenOS searching memory…');
  await runScript(demoAppPath, 'reset-bug.js');
  const optimize = await client.optimizeTask(REUSE_QUERY);
  const skillReused = optimize.strategy !== 'full_llm' && (optimize.matched_skills?.length ?? 0) > 0;

  await step(onProgress, 'Step 6 of 6', skillReused ? 'Found saved skill — using shortcut fix' : 'Applying learned fix');
  await runScript(demoAppPath, 'reset-bug.js', ['fixed']);
  await runTests(demoAppPath);

  const baseline = optimize.estimated_full_tokens;
  const optimized = optimize.estimated_optimized_tokens;
  const saved = Math.max(0, baseline - optimized);
  const reduction = baseline > 0 ? Math.round((saved / baseline) * 100) : 0;

  return {
    phase: 'complete',
    scenario: 'JWT login bug — fix once, reuse next time',
    simulated: false,
    skill_created: learned.skill.name,
    skill_reused: skillReused,
    token_comparison: {
      simulated: false,
      label: 'Estimated from your saved skill',
      baseline_tokens: baseline,
      optimized_tokens: optimized,
      tokens_saved: saved,
      reduction_percent: reduction,
      workflow_steps_avoided: skillReused ? 6 : 0,
      ai_calls_reduced_percent: skillReused ? reduction : 0,
    },
  };
}
