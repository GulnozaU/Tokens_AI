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

interface DemoResults {
  skill_created: string;
  skill_reused: boolean;
  token_comparison: {
    baseline_tokens: number;
    optimized_tokens: number;
    tokens_saved: number;
    reduction_percent: number;
  };
}

const vscode = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null;

function SimpleResults({ results, onBack }: { results: DemoResults; onBack: () => void }) {
  const tc = results.token_comparison;
  return (
    <div className="min-h-screen bg-surface p-6 flex flex-col justify-center">
      <div className="text-center mb-6">
        <p className="text-4xl mb-2">✅</p>
        <h2 className="text-lg font-bold text-white">Demo complete</h2>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 mb-4 text-sm space-y-3">
        <p className="text-slate-300">
          <span className="text-accent font-semibold">1.</span> TokenOS fixed a JWT login bug and remembered it as{' '}
          <span className="text-white font-medium">"{results.skill_created}"</span>
        </p>
        <p className="text-slate-300">
          <span className="text-accent font-semibold">2.</span> The same bug happened again — TokenOS{' '}
          {results.skill_reused ? (
            <span className="text-success font-medium">recognized it</span>
          ) : (
            <span>looked it up</span>
          )}{' '}
          and used the saved fix
        </p>
        <p className="text-slate-300">
          <span className="text-accent font-semibold">3.</span> Second time needed{' '}
          <span className="text-success font-bold text-base">{tc.reduction_percent}% fewer tokens</span>
        </p>
      </div>

      <div className="bg-indigo-900/20 border border-indigo-800/40 rounded-xl p-4 mb-6 text-center">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Tokens saved (2nd fix)</p>
        <p className="text-3xl font-black text-success">{tc.tokens_saved.toLocaleString()}</p>
        <p className="text-xs text-slate-500 mt-1">
          {tc.baseline_tokens.toLocaleString()} → {tc.optimized_tokens.toLocaleString()}
        </p>
      </div>

      <button
        onClick={onBack}
        className="w-full py-3 bg-card border border-border hover:border-indigo-600 rounded-xl text-sm text-slate-300"
      >
        Back
      </button>
    </div>
  );
}

function DemoProgress({ step, detail }: { step: string; detail?: string }) {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6 text-center">
      <div className="w-12 h-12 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6" />
      <p className="text-base font-semibold text-white">{step}</p>
      {detail && <p className="text-sm text-slate-400 mt-3 max-w-xs">{detail}</p>}
      <p className="text-xs text-slate-600 mt-8">Sit back — TokenOS is running the demo for you</p>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoStep, setDemoStep] = useState('');
  const [demoDetail, setDemoDetail] = useState<string | undefined>();
  const [demoResults, setDemoResults] = useState<DemoResults | null>(null);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === 'dashboard') {
        setData(msg.data);
        setError(null);
      }
      if (msg.type === 'error') {
        setError(msg.message);
        setDemoRunning(false);
      }
      if (msg.type === 'demoStart') {
        setDemoRunning(true);
        setDemoResults(null);
        setError(null);
      }
      if (msg.type === 'demoProgress') {
        setDemoRunning(true);
        setDemoStep(msg.step);
        setDemoDetail(msg.detail);
      }
      if (msg.type === 'demoResults') {
        setDemoRunning(false);
        setDemoResults(msg.results);
      }
      if (msg.type === 'demoError') {
        setDemoRunning(false);
        setError(msg.message);
      }
      if (msg.type === 'demoClear') {
        setDemoResults(null);
        setDemoRunning(false);
      }
    };
    window.addEventListener('message', handler);
    vscode?.postMessage({ type: 'refresh' });
    return () => window.removeEventListener('message', handler);
  }, []);

  if (demoRunning) {
    return (
      <div className="min-h-screen bg-surface">
        <DemoProgress step={demoStep || 'Starting…'} detail={demoDetail} />
      </div>
    );
  }

  if (demoResults?.token_comparison) {
    return (
      <div className="min-h-screen bg-surface">
        <SimpleResults
          results={demoResults}
          onBack={() => {
            setDemoResults(null);
            vscode?.postMessage({ type: 'refresh' });
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface p-4 max-w-sm mx-auto flex flex-col">
      <div className="mb-6 pt-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">⚡</span>
          <h1 className="text-xl font-bold text-accent">TokenOS</h1>
        </div>
        <p className="text-sm text-slate-400">Remembers how you fix bugs — saves tokens next time</p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 mb-4 text-xs text-danger">
          {error}
        </div>
      )}

      <button
        onClick={() => vscode?.postMessage({ type: 'runDemo' })}
        className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold rounded-xl text-base transition-all mb-6 shadow-lg shadow-indigo-900/40"
      >
        ▶ Run Demo
      </button>

      <p className="text-xs text-slate-500 text-center mb-6 px-2">
        One click. TokenOS fixes a bug, learns it, hits the same bug again, and shows how many tokens it saved.
      </p>

      <div className="bg-card border border-border rounded-xl p-4 mb-4 flex-1">
        <p className="text-xs uppercase tracking-wider text-slate-500 mb-3">Your savings</p>
        <div className="flex justify-between items-end mb-2">
          <div>
            <p className="text-xs text-slate-500">Before</p>
            <p className="text-lg font-bold text-danger">${data?.cost_before?.toFixed(0) ?? '—'}</p>
          </div>
          <p className="text-2xl text-slate-600">→</p>
          <div className="text-right">
            <p className="text-xs text-slate-500">After</p>
            <p className="text-lg font-bold text-success">${data?.cost_after?.toFixed(0) ?? '—'}</p>
          </div>
        </div>
        <p className="text-center text-3xl font-black text-accent">
          {data?.token_reduction_pct?.toFixed(0) ?? '—'}%
        </p>
        <p className="text-center text-xs text-slate-500">less tokens</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">
          Skills learned ({data?.total_skills ?? 0})
        </p>
        {data?.skills?.length ? (
          data.skills.slice(0, 3).map((s) => (
            <p key={s.id} className="text-sm text-slate-300 py-1 border-b border-border last:border-0">
              {s.name}
            </p>
          ))
        ) : (
          <p className="text-xs text-slate-500 py-2">Run the demo to learn your first skill</p>
        )}
      </div>

      <p className="text-center text-xs text-slate-600 mt-4">
        {data ? 'Connected' : 'Connecting…'}
      </p>
    </div>
  );
}
