import { useEffect, useState } from 'react';

declare function acquireVsCodeApi(): { postMessage: (msg: unknown) => void };

interface Skill {
  id: number;
  name: string;
  success_rate: number;
  avg_tokens_saved: number;
  confidence_score: number;
  promoted: boolean;
  steps: string[];
}

interface DashboardData {
  cost_before: number;
  cost_after: number;
  token_reduction_pct: number;
  total_skills: number;
  promoted_skills: number;
  total_tokens_saved: number;
  skills: Skill[];
}

interface SimulationResult {
  extracted_skill?: { name: string };
  future_reuse?: { message: string; matched_skills?: Skill[] };
  evaluation?: { confidence_score: number; promoted: boolean };
}

const vscode = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null;

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color ?? 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function SkillRow({ skill }: { skill: Skill }) {
  const pct = (skill.success_rate * 100).toFixed(0);
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium text-slate-200">{skill.name}</p>
        <p className="text-xs text-slate-500">saves ~{skill.avg_tokens_saved} tokens/reuse</p>
      </div>
      <div className="flex items-center gap-2">
        {skill.promoted && (
          <span className="text-xs bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded-full">promoted</span>
        )}
        <span className="text-xs bg-green-900/40 text-success px-2.5 py-1 rounded-full font-semibold">{pct}%</span>
      </div>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [lastSim, setLastSim] = useState<SimulationResult | null>(null);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === 'dashboard') {
        setData(msg.data);
        setError(null);
        setSimulating(false);
      }
      if (msg.type === 'error') {
        setError(msg.message);
        setSimulating(false);
      }
      if (msg.type === 'simulation') {
        setLastSim(msg.result);
        setSimulating(false);
      }
    };
    window.addEventListener('message', handler);
    vscode?.postMessage({ type: 'refresh' });
    return () => window.removeEventListener('message', handler);
  }, []);

  const simulate = (idx = 0) => {
    setSimulating(true);
    vscode?.postMessage({ type: 'simulate', scenarioIndex: idx });
  };

  return (
    <div className="min-h-screen bg-surface p-4 max-w-sm mx-auto">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">⚡</span>
          <h1 className="text-xl font-bold text-accent">TokenOS</h1>
        </div>
        <p className="text-xs text-slate-500">AI Cost Optimizer — learn workflows, save tokens</p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 mb-4 text-xs text-danger">
          {error}
        </div>
      )}

      {/* Cost comparison */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <p className="text-xs uppercase tracking-wider text-slate-500 mb-3">Monthly AI Cost</p>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-slate-500">Before TokenOS</p>
            <p className="text-xl font-bold text-danger">${data?.cost_before?.toFixed(0) ?? '50'}</p>
          </div>
          <span className="text-slate-600 text-2xl">→</span>
          <div className="text-right">
            <p className="text-xs text-slate-500">After TokenOS</p>
            <p className="text-xl font-bold text-success">${data?.cost_after?.toFixed(0) ?? '18'}</p>
          </div>
        </div>
        <div className="text-center">
          <p className="text-4xl font-black text-accent">{data?.token_reduction_pct?.toFixed(0) ?? '64'}%</p>
          <p className="text-xs text-slate-500 mt-1">token reduction</p>
        </div>
        <div className="mt-3 h-2 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-700"
            style={{ width: `${data?.token_reduction_pct ?? 64}%` }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard label="Skills Learned" value={String(data?.total_skills ?? 0)} />
        <StatCard
          label="Tokens Saved"
          value={data ? `${(data.total_tokens_saved / 1000).toFixed(0)}k` : '320k'}
          color="text-success"
        />
      </div>

      {/* Skills list */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Skills Learned</p>
        {data?.skills?.length ? (
          data.skills.map((s) => <SkillRow key={s.id} skill={s} />)
        ) : (
          <p className="text-xs text-slate-500 py-4 text-center">
            No skills yet — run a simulation!
          </p>
        )}
      </div>

      {/* Last simulation result */}
      {lastSim?.extracted_skill && (
        <div className="bg-indigo-900/20 border border-indigo-800/50 rounded-xl p-3 mb-4 text-xs">
          <p className="text-indigo-300 font-semibold mb-1">✓ Skill Extracted</p>
          <p className="text-slate-300">{lastSim.extracted_skill.name}</p>
          {lastSim.future_reuse?.message && (
            <p className="text-slate-500 mt-1">{lastSim.future_reuse.message}</p>
          )}
          {lastSim.evaluation && (
            <p className="text-success mt-1">
              Confidence: {lastSim.evaluation.confidence_score}/100
              {lastSim.evaluation.promoted ? ' · PROMOTED' : ''}
            </p>
          )}
        </div>
      )}

      {/* Demo buttons */}
      <button
        onClick={() => simulate(0)}
        disabled={simulating}
        className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all mb-2"
      >
        {simulating ? '⏳ Simulating...' : '▶ Simulate Developer Workflow'}
      </button>
      <div className="grid grid-cols-3 gap-2">
        {['Auth Bug', 'DB Migration', 'API 500'].map((label, i) => (
          <button
            key={label}
            onClick={() => simulate(i)}
            disabled={simulating}
            className="py-2 bg-card border border-border hover:border-indigo-700 disabled:opacity-50 text-xs text-slate-400 rounded-lg transition-all"
          >
            {label}
          </button>
        ))}
      </div>

      <p className="text-center text-xs text-slate-600 mt-4">
        {data ? `${data.promoted_skills} promoted · ${data.total_skills} total skills` : 'Connecting...'}
      </p>
    </div>
  );
}
