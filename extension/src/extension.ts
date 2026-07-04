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
import {
  getLastDemoResults,
  resetDemoState,
  runKaggleDemo,
} from './demoRunner';
import { runAutoLiveDemo } from './liveDemo';
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
    vscode.commands.registerCommand('tokenos.runDemo', async () => {
      await vscode.commands.executeCommand('tokenos.dashboard.focus');
      dashboard.startDemoProgress();

      try {
        const results = await runAutoLiveDemo(
          context.extensionUri,
          client,
          observer,
          (step, detail) => dashboard.postDemoProgress(step, detail)
        );
        dashboard.postDemoResults(results);
        await dashboard.refreshDashboard();
        vscode.window.showInformationMessage(
          `Demo done — TokenOS saved ~${results.token_comparison.reduction_percent}% tokens on the second fix`
        );
      } catch (err) {
        dashboard.postDemoError(String(err));
        vscode.window.showErrorMessage(`TokenOS demo failed: ${err}`);
      }
    })
  );

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

  // Kaggle one-click demo
  context.subscriptions.push(
    vscode.commands.registerCommand('tokenos.runKaggleDemo', async () => {
      await vscode.commands.executeCommand('tokenos.dashboard.focus');
      dashboard.startDemoProgress();

      try {
        const results = await runKaggleDemo(client, (step, detail) => {
          dashboard.postDemoProgress(step, detail);
        });
        dashboard.postDemoResults(results);
        await dashboard.refreshDashboard();
        vscode.window.showInformationMessage(
          `TokenOS Demo complete — ${results.token_comparison.reduction_percent}% token reduction`,
          'Show Results'
        ).then((choice) => {
          if (choice === 'Show Results') {
            vscode.commands.executeCommand('tokenos.showDemoResults');
          }
        });
      } catch (err) {
        dashboard.postDemoError(String(err));
        vscode.window.showErrorMessage(`TokenOS Kaggle demo failed: ${err}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tokenos.resetDemoState', async () => {
      try {
        await resetDemoState(client, (step) => dashboard.postDemoProgress(step));
        dashboard.clearDemoResults();
        await dashboard.refreshDashboard();
        vscode.window.showInformationMessage('TokenOS: Demo state reset.');
      } catch (err) {
        vscode.window.showErrorMessage(`TokenOS reset failed: ${err}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tokenos.showDemoResults', async () => {
      await vscode.commands.executeCommand('tokenos.dashboard.focus');
      const results = getLastDemoResults();
      if (results) {
        dashboard.postDemoResults(results);
      } else {
        vscode.window.showWarningMessage(
          'No demo results yet. Run "TokenOS: Run Demo (Kaggle)" first.'
        );
      }
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

  client.health().then((ok) => {
    if (!ok) {
      vscode.window.showWarningMessage(
        'TokenOS: Backend not reachable. Run `npm run dev:backend` in the project root.',
        'Run Demo'
      ).then((choice) => {
        if (choice === 'Run Demo') {
          vscode.commands.executeCommand('tokenos.runDemo');
        }
      });
    }
  });
}

export function deactivate(): void {
  observer?.dispose();
}
