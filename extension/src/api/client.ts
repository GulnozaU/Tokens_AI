/**
 * TokenOS API client — communicates with the FastAPI backend.
 */

import * as vscode from 'vscode';

export interface WorkflowEvent {
  task: string;
  files_changed: string[];
  commands: string[];
  ai_steps: string[];
  result: string;
  success: boolean;
  tokens_used: number;
}

export interface Skill {
  id: number;
  name: string;
  trigger_patterns: string[];
  steps: string[];
  success_rate: number;
  avg_tokens_saved: number;
  confidence_score: number;
  promoted: boolean;
  similarity?: number;
}

export interface DashboardData {
  cost_before: number;
  cost_after: number;
  token_reduction_pct: number;
  total_skills: number;
  promoted_skills: number;
  total_tokens_saved: number;
  skills: Skill[];
}

export interface OptimizeResult {
  task: string;
  strategy: string;
  optimized_prompt: string;
  reasoning: string;
  estimated_full_tokens: number;
  estimated_optimized_tokens: number;
  tokens_saved: number;
  ai_enabled: boolean;
  ai_powered: boolean;
  selected_skill: Skill | null;
  matched_skills: Skill[];
}

export interface TokenComparison {
  simulated: boolean;
  label: string;
  baseline_tokens: number;
  optimized_tokens: number;
  tokens_saved: number;
  reduction_percent: number;
  workflow_steps_avoided: number;
  ai_calls_reduced_percent: number;
}

export interface DemoResults {
  phase: string;
  scenario: string;
  simulated: boolean;
  token_comparison: TokenComparison;
  skill_created: string;
  skill_reused: boolean;
  extracted_skill?: { name: string; confidence_score: number };
  future_reuse?: { query: string; skill_reused: boolean; message: string };
}

export class TokenOSClient {
  private baseUrl: string;

  constructor() {
    const config = vscode.workspace.getConfiguration('tokenos');
    this.baseUrl = config.get<string>('apiUrl', 'http://localhost:8000');
  }

  refresh(): void {
    const config = vscode.workspace.getConfiguration('tokenos');
    this.baseUrl = config.get<string>('apiUrl', 'http://localhost:8000');
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    this.refresh();
    const url = `${this.baseUrl}${path}`;
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) {
      options.body = JSON.stringify(body);
    }
    const resp = await fetch(url, options);
    if (!resp.ok) {
      throw new Error(`TokenOS API error: ${resp.status} ${resp.statusText}`);
    }
    return resp.json() as Promise<T>;
  }

  async health(): Promise<boolean> {
    try {
      await this.request('GET', '/health');
      return true;
    } catch {
      return false;
    }
  }

  async recordEvent(event: WorkflowEvent): Promise<unknown> {
    return this.request('POST', '/api/events', event);
  }

  async searchSkills(query: string, limit = 5): Promise<{ results: Skill[] }> {
    return this.request('POST', '/api/skills/search', { query, limit });
  }

  async optimizeTask(task: string, limit = 3): Promise<OptimizeResult> {
    return this.request('POST', '/api/optimize', { task, limit });
  }

  async getDashboard(): Promise<DashboardData> {
    return this.request('GET', '/api/dashboard');
  }

  async simulateWorkflow(scenarioIndex = 0): Promise<unknown> {
    return this.request('POST', `/api/demo/simulate?scenario_index=${scenarioIndex}`);
  }

  async resetDemo(): Promise<unknown> {
    return this.request('POST', '/api/demo/reset');
  }

  async runKaggleDemo(): Promise<DemoResults> {
    return this.request<DemoResults>('POST', '/api/demo/run-kaggle');
  }

  async extractSkill(eventId: number): Promise<{ skill?: { id: number; name: string }; extracted_from?: number }> {
    return this.request('POST', `/api/events/${eventId}/extract-skill`);
  }

  async evaluateSkill(params: {
    skill_id: number;
    success?: boolean;
    execution_time_ms?: number;
    tokens_used?: number;
    tokens_saved?: number;
    notes?: string;
  }): Promise<{
    skill?: { id: number; name: string; promoted: boolean; confidence_score: number };
    promoted?: boolean;
    confidence_score?: number;
  }> {
    return this.request('POST', '/api/skills/evaluate', params);
  }
}
