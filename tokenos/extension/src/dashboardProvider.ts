/**
 * Dashboard Webview Provider — hosts the React + Tailwind savings dashboard.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { TokenOSClient } from './api/client';

export class DashboardProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'tokenos.dashboard';

  private _view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly client: TokenOSClient
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);
    this.refreshDashboard();

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case 'refresh':
          await this.refreshDashboard();
          break;
        case 'simulate':
          await vscode.commands.executeCommand('tokenos.simulateWorkflow', msg.scenarioIndex ?? 0);
          await this.refreshDashboard();
          break;
        case 'search':
          await vscode.commands.executeCommand('tokenos.searchSkills', msg.query);
          break;
      }
    });
  }

  async refreshDashboard(): Promise<void> {
    if (!this._view) return;
    try {
      const data = await this.client.getDashboard();
      this._view.webview.postMessage({ type: 'dashboard', data });
    } catch {
      this._view.webview.postMessage({
        type: 'error',
        message: 'Cannot connect to TokenOS API. Start the backend with: docker compose up',
      });
    }
  }

  postSimulationResult(result: unknown): void {
    this._view?.webview.postMessage({ type: 'simulation', result });
    this.refreshDashboard();
  }

  private getHtml(webview: vscode.Webview): string {
    const webviewDist = path.join(this.extensionUri.fsPath, 'webview', 'dist');
    const indexPath = path.join(webviewDist, 'index.html');

    if (fs.existsSync(indexPath)) {
      let html = fs.readFileSync(indexPath, 'utf8');
      // Rewrite asset paths for webview
      html = html.replace(/(href|src)="\/assets\//g, (_m, attr) => {
        const assetUri = webview.asWebviewUri(
          vscode.Uri.file(path.join(webviewDist, 'assets'))
        );
        return `${attr}="${assetUri}/`;
      });
      return html;
    }

    // Fallback inline dashboard when webview not built yet
    return this.getFallbackHtml();
  }

  private getFallbackHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f1117;
      color: #e2e8f0;
      padding: 16px;
      min-height: 100vh;
    }
    h1 { font-size: 1.25rem; color: #818cf8; margin-bottom: 4px; }
    .subtitle { font-size: 0.75rem; color: #64748b; margin-bottom: 20px; }
    .card {
      background: #1a1d27;
      border: 1px solid #2d3148;
      border-radius: 10px;
      padding: 14px;
      margin-bottom: 12px;
    }
    .card h2 { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 8px; }
    .cost-row { display: flex; justify-content: space-between; align-items: center; }
    .cost-before { color: #f87171; font-size: 1.1rem; font-weight: 600; }
    .cost-after { color: #4ade80; font-size: 1.1rem; font-weight: 600; }
    .arrow { color: #64748b; font-size: 1.2rem; }
    .reduction {
      text-align: center;
      font-size: 2rem;
      font-weight: 700;
      color: #818cf8;
      margin: 8px 0;
    }
    .skill-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid #2d3148;
    }
    .skill-item:last-child { border-bottom: none; }
    .skill-name { font-size: 0.85rem; }
    .skill-rate {
      background: #1e3a2f;
      color: #4ade80;
      padding: 2px 8px;
      border-radius: 20px;
      font-size: 0.75rem;
    }
    .btn {
      width: 100%;
      padding: 10px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 600;
      margin-top: 8px;
    }
    .btn:hover { opacity: 0.9; }
    .status { font-size: 0.75rem; color: #64748b; text-align: center; margin-top: 12px; }
    .error { color: #f87171; font-size: 0.8rem; padding: 8px; }
  </style>
</head>
<body>
  <h1>⚡ TokenOS</h1>
  <p class="subtitle">AI Cost Optimizer</p>
  <div id="error" class="error" style="display:none"></div>
  <div class="card">
    <h2>Monthly AI Cost</h2>
    <div class="cost-row">
      <div><div style="font-size:0.7rem;color:#64748b">Before</div><div class="cost-before" id="cost-before">$50</div></div>
      <div class="arrow">→</div>
      <div><div style="font-size:0.7rem;color:#64748b">After</div><div class="cost-after" id="cost-after">$18</div></div>
    </div>
    <div class="reduction" id="reduction">64%</div>
    <div style="text-align:center;font-size:0.75rem;color:#64748b">token reduction</div>
  </div>
  <div class="card">
    <h2>Skills Learned</h2>
    <div id="skills-list"></div>
  </div>
  <button class="btn" onclick="simulate()">▶ Simulate Developer Workflow</button>
  <p class="status" id="status">Connecting to API...</p>
  <script>
    const vscode = acquireVsCodeApi();
    function simulate() {
      document.getElementById('status').textContent = 'Running simulation...';
      vscode.postMessage({ type: 'simulate', scenarioIndex: 0 });
    }
    window.addEventListener('message', e => {
      const msg = e.data;
      if (msg.type === 'dashboard') {
        const d = msg.data;
        document.getElementById('cost-before').textContent = '$' + d.cost_before.toFixed(0);
        document.getElementById('cost-after').textContent = '$' + d.cost_after.toFixed(0);
        document.getElementById('reduction').textContent = d.token_reduction_pct.toFixed(0) + '%';
        const list = document.getElementById('skills-list');
        list.innerHTML = (d.skills || []).map(s =>
          '<div class="skill-item"><span class="skill-name">' + s.name + '</span><span class="skill-rate">' + (s.success_rate*100).toFixed(0) + '%</span></div>'
        ).join('') || '<div style="color:#64748b;font-size:0.8rem">No skills yet — run a simulation!</div>';
        document.getElementById('status').textContent = d.total_skills + ' skills · ' + d.promoted_skills + ' promoted';
        document.getElementById('error').style.display = 'none';
      }
      if (msg.type === 'simulation') {
        const r = msg.result;
        document.getElementById('status').textContent = '✓ Skill extracted: ' + (r.extracted_skill?.name || 'done');
      }
      if (msg.type === 'error') {
        document.getElementById('error').style.display = 'block';
        document.getElementById('error').textContent = msg.message;
        document.getElementById('status').textContent = 'Offline';
      }
    });
    vscode.postMessage({ type: 'refresh' });
  </script>
</body>
</html>`;
  }
}
