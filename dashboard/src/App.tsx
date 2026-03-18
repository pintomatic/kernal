import { useState, useEffect } from 'react';
import { routeIntent, type View } from './lib/intentRouter';
import { getApiKey, setApiKey } from './hooks/useKernalApi';
import Overview from './components/Overview';
import NetworkGraph from './components/NetworkGraph';
import Timeline from './components/Timeline';
import ActionItems from './components/ActionItems';

const NAV_ITEMS: Array<{ view: View; label: string; icon: string }> = [
  { view: 'overview', label: 'Overview', icon: '📊' },
  { view: 'network', label: 'Network', icon: '🕸️' },
  { view: 'timeline', label: 'Timeline', icon: '📅' },
  { view: 'actions', label: 'Actions', icon: '✅' },
];

export default function App() {
  const [view, setView] = useState<View>('overview');
  const [params, setParams] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [apiKey, setKey] = useState(getApiKey());
  const [needsKey, setNeedsKey] = useState(!getApiKey());

  useEffect(() => {
    if (apiKey) {
      setApiKey(apiKey);
      setNeedsKey(false);
    }
  }, [apiKey]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    const result = routeIntent(query);
    setView(result.view);
    setParams(result.params);
    setQuery('');
  };

  if (needsKey) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-sm w-full">
          <h1 className="text-xl font-semibold text-zinc-100 mb-1">Kernal</h1>
          <p className="text-sm text-zinc-500 mb-6">Enter your API key to connect.</p>
          <form onSubmit={(e) => { e.preventDefault(); setNeedsKey(false); }}>
            <input
              type="password"
              value={apiKey}
              onChange={e => setKey(e.target.value)}
              placeholder="API key"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 mb-4"
              autoFocus
            />
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
            >
              Connect
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
          <h1 className="text-lg font-semibold text-zinc-100 tracking-tight">Kernal</h1>

          {/* Nav */}
          <nav className="flex gap-1">
            {NAV_ITEMS.map(item => (
              <button
                key={item.view}
                onClick={() => { setView(item.view); setParams({}); }}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  view === item.view
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                }`}
              >
                <span className="mr-1.5">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          {/* Command Bar */}
          <form onSubmit={handleSubmit} className="flex-1 max-w-md ml-auto">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Ask Kernal anything..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
            />
          </form>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {view === 'overview' && <Overview />}
        {view === 'network' && <NetworkGraph />}
        {view === 'timeline' && <Timeline entity={params.entity} />}
        {view === 'actions' && <ActionItems />}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-3 text-center text-xs text-zinc-600">
        Kernal v0.1.0 — Your knowledge, your machine.
      </footer>
    </div>
  );
}
