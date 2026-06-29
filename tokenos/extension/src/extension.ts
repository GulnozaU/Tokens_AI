/**
 * TokenOS VS Code Extension — main entry point.
 *
 * Architecture:
 *   ActivityObserver → records workflow events
 *   Skill Extraction → via backend API agents
 *   Skill Retrieval → embedding search before AI requests
 *   Dashboard → React webview panel
 *   Demo Mode → simulate full workflow for presentations
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

  // Open dashboard command
  context.subscriptions.push(
    vscode.commands.registerCommand('tokenos.openDashboard', async () => {
      await vscode.commands.executeCommand('tokenos.dashboard.focus');
    })
  );

  // Simulate developer workflow (demo mode)
  context.subscriptions.push(
    vscode.commands.registerCommand('tokenos.simulateWorkflow', async (scenarioIndex?: number) => {
      const idx = typeof scenarioIndex === 'number' ? scenarioIndex : 0;
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'TokenOS: Simulating developer workflow...',
          cancellable: false,
        },
        async () => {
          try {
            const result = await client.simulateWorkflow(idx) as {
              extracted_skill?: { name: string };
              future_reuse?: { message: string };
            };
            dashboard.postSimulationResult(result);
            const skillName = result.extracted_skill?.name ?? 'Skill';
            const reuseMsg = result.future_reuse?.message ?? '';
            vscode.window.showInformationMessage(
              `TokenOS: Extracted "${skillName}" — ${reuseMsg}`,
              'View Dashboard'
            ).then((choice) => {
              if (choice === 'View Dashboard') {
                vscode.commands.executeCommand('tokenos.dashboard.focus');
              }
            });
          } catch (err) {
            vscode.window.showErrorMessage(
              `TokenOS simulation failed. Is the backend running? (${err})`
            );
          }
        }
      );
    })
  );

  // Search skills for current task (skill retrieval before AI request)
  context.subscriptions.push(
    vscode.commands.registerCommand('tokenos.searchSkills', async (query?: string) => {
      const task = query ?? await vscode.window.showInputBox({
        prompt: 'Describe your current task (TokenOS will search for reusable skills)',
        placeHolder: 'e.g. my login token expires',
      });
      if (!task) return;

      observer.recordPrompt(task);

      try {
        const { results } = await client.searchSkills(task);
        if (!results.length) {
          vscode.window.showInformationMessage('TokenOS: No matching skills — full LLM workflow required.');
          return;
        }
        const best = results[0];
        const items = results.map((s) => ({
          label: s.name,
          description: `${((s.similarity ?? 0) * 100).toFixed(0)}% match · saves ~${s.avg_tokens_saved} tokens`,
          detail: s.steps.join(' → '),
          skill: s,
        }));
        const picked = await vscode.window.showQuickPick(items, {
          title: `TokenOS found ${results.length} skill(s) for: "${task}"`,
          placeHolder: 'Select a skill to reuse',
        });
        if (picked) {
          const steps = picked.skill.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
          const doc = await vscode.workspace.openTextDocument({
            content: `# Reusing Skill: ${picked.skill.name}\n\n## Steps\n${steps}\n\n## Estimated tokens saved: ${picked.skill.avg_tokens_saved}\n`,
            language: 'markdown',
          });
          await vscode.window.showTextDocument(doc, { preview: true });
        }
      } catch (err) {
        vscode.window.showErrorMessage(`TokenOS search failed: ${err}`);
      }
    })
  );

  // Record mock AI prompt
  context.subscriptions.push(
    vscode.commands.registerCommand('tokenos.recordPrompt', async () => {
      const prompt = await vscode.window.showInputBox({
        prompt: 'Enter the AI prompt to record (mock)',
      });
      if (!prompt) return;
      observer.recordPrompt(prompt);
      observer.recordAIResponse('Mock AI response: analyzed the issue and suggested a fix.');
      vscode.window.showInformationMessage('TokenOS: Prompt recorded to current session.');
    })
  );

  // Status bar
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.text = '$(circuit-board) TokenOS';
  statusBar.tooltip = 'Click to open TokenOS dashboard';
  statusBar.command = 'tokenos.openDashboard';
  statusBar.show();
  context.subscriptions.push(statusBar);

  // Check API health on startup
  client.health().then((ok) => {
    if (!ok) {
      vscode.window.showWarningMessage(
        'TokenOS: Backend not reachable. Run `docker compose up` or `uvicorn app.main:app` in backend/',
        'Simulate Anyway'
      ).then((choice) => {
        if (choice === 'Simulate Anyway') {
          vscode.commands.executeCommand('tokenos.simulateWorkflow');
        }
      });
    }
  });
}

export function deactivate(): void {
  observer?.dispose();
}
