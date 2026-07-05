import { useEffect, useState } from 'react';

declare function acquireVsCodeApi(): { postMessage: (msg: unknown) => void };

interface Skill {
  id: number;
  name: string;
  success_rate: number;
  avg_tokens_saved: number;
  confidence_score: number;
  promoted: boolean;
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

const vscode = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null;

function SkillRow({ skill }: { skill: Skill }) {
  const pct = (skill.success_rate * 100).toFixed(0);
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium text-slate-200">{skill.name}</p>
        <p className="text-xs text-slate-500">saves ~{skill.avg_tokens_saved} tokens/reuse</p>
      </div>
      <span className="text-xs bg-green-900/40 text-success px-2 py-0.5 rounded-full font-semibold">{pct}%</span>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === 'dashboard') {
        setData(msg.data);
        setError(null);
      }
      if (msg.type === 'error') {
        setError(msg.message);
      }
    };
    window.addEventListener('message', handler);
    vscode?.postMessage({ type: 'refresh' });
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <div className="min-h-screen bg-surface p-4 max-w-sm mx-auto">
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">⚡</span>
          <h1 className="text-xl font-bold text-accent">TokenOS</h1>
        </div>
        <p className="text-xs text-slate-500">AI Cost Optimizer</p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 mb-4 text-xs text-danger">
          {error}
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <p className="text-xs uppercase tracking-wider text-slate-500 mb-3">Monthly AI Cost</p>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-slate-500">Before</p>
            <p className="text-xl font-bold text-danger">${data?.cost_before?.toFixed(0) ?? '—'}</p>
          </div>
          <span className="text-slate-600 text-2xl">→</span>
          <div className="text-right">
            <p className="text-xs text-slate-500">After</p>
            <p className="text-xl font-bold text-success">${data?.cost_after?.toFixed(0) ?? '—'}</p>
          </div>
        </div>
        <p className="text-center text-4xl font-black text-accent">
          {data?.token_reduction_pct?.toFixed(0) ?? '—'}%
        </p>
        <p className="text-center text-xs text-slate-500">token reduction</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">
          Skills ({data?.total_skills ?? 0})
        </p>
        {data?.skills?.length ? (
          data.skills.map((s) => <SkillRow key={s.id} skill={s} />)
        ) : (
          <p className="text-xs text-slate-500 py-4 text-center">No skills yet</p>
        )}
      </div>

      <p className="text-center text-xs text-slate-600 mt-4">
        {data ? `${data.promoted_skills} promoted` : 'Connecting…'}
      </p>
    </div>
  );
}
