/**
 * TokenOS VS Code Extension — main entry point.
 */

import * as vscode from 'vscode';
import { TokenOSClient } from './api/client';
import { ActivityObserver } from './observers/activityObserver';
import { DashboardProvider } from './dashboardProvider';

let client: TokenOSClient;
let observer: ActivityObserver;
let dashboard: DashboardProvider;

export function activate(context: vscode.ExtensionContext): void {
  client = new TokenOSClient();
  observer = new ActivityObserver(client);
  observer.start();

  dashboard = new DashboardProvider(context.extensionUri, client);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(DashboardProvider.viewType, dashboard)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tokenos.openDashboard', async () => {
      await vscode.commands.executeCommand('tokenos.dashboard.focus');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tokenos.searchSkills', async (query?: string) => {
      const task = query ?? await vscode.window.showInputBox({
        prompt: 'Describe your current task (TokenOS will AI-optimize before you call an LLM)',
        placeHolder: 'e.g. my login token expires',
      });
      if (!task) return;

      observer.recordPrompt(task);

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'TokenOS: AI optimizing prompt...',
            cancellable: false,
          },
          async () => client.optimizeTask(task)
        ).then((result) => {
          const aiLabel = result.ai_powered ? 'Gemini' : 'heuristic';
          const saved = result.tokens_saved;
          const content = [
            `# TokenOS AI Optimization`,
            ``,
            `**Strategy:** ${result.strategy} (${aiLabel})`,
            `**Tokens saved:** ~${saved} (${result.estimated_full_tokens} → ${result.estimated_optimized_tokens})`,
            ``,
            `## Reasoning`,
            result.reasoning,
            ``,
            `## Optimized Prompt`,
            `Copy this into your coding agent instead of a full discovery prompt:`,
            ``,
            '```',
            result.optimized_prompt,
            '```',
          ].join('\n');

          return vscode.workspace.openTextDocument({ content, language: 'markdown' })
            .then((doc) => vscode.window.showTextDocument(doc, { preview: false }));
        });
      } catch (err) {
        vscode.window.showErrorMessage(`TokenOS optimization failed: ${err}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tokenos.recordPrompt', async () => {
      const prompt = await vscode.window.showInputBox({
        prompt: 'Enter the AI prompt you sent',
      });
      if (!prompt) return;
      const response = await vscode.window.showInputBox({
        prompt: 'Paste the AI response (summary is fine)',
        placeHolder: 'e.g. Found JWT expiry bug in auth.ts, updated refresh logic',
      });
      observer.recordPrompt(prompt);
      if (response) {
        observer.recordAIResponse(response);
      }
      vscode.window.showInformationMessage('TokenOS: AI interaction recorded to current session.');
    })
  );

  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.text = '$(circuit-board) TokenOS';
  statusBar.tooltip = 'Click to open TokenOS dashboard';
  statusBar.command = 'tokenos.openDashboard';
  statusBar.show();
  context.subscriptions.push(statusBar);
}

export function deactivate(): void {
  observer?.dispose();
}
