/**
 * Dashboard Webview Provider — hosts the React savings dashboard.
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
      if (msg.type === 'refresh') {
        await this.refreshDashboard();
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
        message: 'Cannot connect to TokenOS API.',
      });
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const webviewDist = path.join(this.extensionUri.fsPath, 'webview', 'dist');
    const indexPath = path.join(webviewDist, 'index.html');

    if (fs.existsSync(indexPath)) {
      let html = fs.readFileSync(indexPath, 'utf8');
      html = html.replace(/(href|src)="\/assets\//g, (_m, attr) => {
        const assetUri = webview.asWebviewUri(
          vscode.Uri.file(path.join(webviewDist, 'assets'))
        );
        return `${attr}="${assetUri}/`;
      });
      return html;
    }

    return `<!DOCTYPE html><html><body style="background:#0f1117;color:#94a3b8;padding:16px;font-family:sans-serif">
      <p>Run <code>npm run build:webview</code> in extension/</p>
    </body></html>`;
  }
}
