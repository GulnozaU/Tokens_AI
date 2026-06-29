/**
 * Activity Observer — monitors developer workflow events for skill extraction.
 *
 * Watches:
 *   - File edits (onDidSaveTextDocument)
 *   - Terminal commands (onDidWriteTerminalData — mock capture)
 *   - Git changes (via git extension API or file watcher)
 *   - User prompts (via command — mock initially)
 *   - Test results (parsed from terminal output)
 */

import * as vscode from 'vscode';
import { TokenOSClient, WorkflowEvent } from '../api/client';

export interface ObservedSession {
  task: string;
  files_changed: string[];
  commands: string[];
  ai_steps: string[];
  startTime: Date;
}

export class ActivityObserver {
  private client: TokenOSClient;
  private session: ObservedSession | null = null;
  private disposables: vscode.Disposable[] = [];
  private enabled: boolean;

  constructor(client: TokenOSClient) {
    this.client = client;
    const config = vscode.workspace.getConfiguration('tokenos');
    this.enabled = config.get<boolean>('enableObserver', true);
  }

  start(): void {
    if (!this.enabled) return;

    // File save observer
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument((doc) => {
        if (!this.session) {
          this.session = this.newSession('Auto-detected file edit workflow');
        }
        const rel = vscode.workspace.asRelativePath(doc.uri);
        if (!this.session.files_changed.includes(rel)) {
          this.session.files_changed.push(rel);
        }
        this.session.ai_steps.push(`edited file: ${rel}`);
      })
    );

    // Terminal command observer (captures written data as command proxy)
    this.disposables.push(
      vscode.window.onDidOpenTerminal(() => {
        if (!this.session) {
          this.session = this.newSession('Terminal workflow');
        }
      })
    );

    // Git commit observer via SCM
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (!this.session) return;
        const rel = vscode.workspace.asRelativePath(e.document.uri);
        if (!this.session.files_changed.includes(rel)) {
          this.session.files_changed.push(rel);
        }
      })
    );

    // Config change
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('tokenos.enableObserver')) {
          const config = vscode.workspace.getConfiguration('tokenos');
          this.enabled = config.get<boolean>('enableObserver', true);
        }
      })
    );
  }

  private newSession(task: string): ObservedSession {
    return {
      task,
      files_changed: [],
      commands: [],
      ai_steps: [],
      startTime: new Date(),
    };
  }

  startTask(task: string): void {
    this.session = this.newSession(task);
  }

  recordPrompt(prompt: string): void {
    if (!this.session) {
      this.session = this.newSession(prompt);
    } else {
      this.session.task = prompt;
    }
    this.session.ai_steps.push(`user prompt: ${prompt}`);
  }

  recordAIResponse(response: string): void {
    if (!this.session) return;
    const summary = response.length > 120 ? response.slice(0, 120) + '...' : response;
    this.session.ai_steps.push(`AI response: ${summary}`);
  }

  recordCommand(command: string): void {
    if (!this.session) {
      this.session = this.newSession('Command workflow');
    }
    if (!this.session.commands.includes(command)) {
      this.session.commands.push(command);
    }
  }

  recordTestResult(passed: boolean, output: string): void {
    if (!this.session) return;
    this.session.ai_steps.push(`tests ${passed ? 'passed' : 'failed'}: ${output.slice(0, 80)}`);
  }

  async finalize(success: boolean, result: string, tokensUsed = 0): Promise<unknown | null> {
    if (!this.session) return null;

    const event: WorkflowEvent = {
      task: this.session.task,
      files_changed: this.session.files_changed,
      commands: this.session.commands,
      ai_steps: this.session.ai_steps,
      result,
      success,
      tokens_used: tokensUsed,
    };

    try {
      const recorded = await this.client.recordEvent(event);
      this.session = null;
      return recorded;
    } catch (err) {
      vscode.window.showErrorMessage(`TokenOS: Failed to record event — ${err}`);
      return null;
    }
  }

  getCurrentSession(): ObservedSession | null {
    return this.session;
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
