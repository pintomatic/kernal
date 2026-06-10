import { useState, useEffect } from 'react';
import { configureKernalUI } from '@kernal/ui';
// CSS variables provided by @source directive in index.css (Tailwind v4)
import { routeIntent, type View } from './lib/intentRouter';
import { getApiKey, setApiKey } from './hooks/useKernalApi';

// Configure @kernal/ui to use same-origin relative URLs with x-api-key auth
configureKernalUI({
  apiBase: '',
  getAuthHeaders: async () => {
    const key = typeof localStorage !== 'undefined' ? localStorage.getItem('kernal-api-key') || '' : '';
    return key ? { 'x-api-key': key } : {};
  },
});
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
      <div className="min-h-screen flex items-center justify-center p-4 bg-[hsl(var(--andes-bg))]">
        <div className="bg-white border border-[hsl(var(--andes-border))] rounded-2xl p-8 max-w-sm w-full shadow-[var(--andes-shadow-lg)]">
          <h1 className="text-xl font-semibold text-[hsl(var(--andes-text))] mb-1">Kernal</h1>
          <p className="text-sm text-[hsl(var(--andes-text-muted))] mb-6">Enter your API key to connect.</p>
          <form onSubmit={(e) => { e.preventDefault(); setNeedsKey(false); }}>
            <input
              type="password"
              value={apiKey}
              onChange={e => setKey(e.target.value)}
              placeholder="API key"
              className="w-full bg-[hsl(var(--andes-bg-subtle))] border border-[hsl(var(--andes-border))] rounded-lg px-4 py-2.5 text-sm text-[hsl(var(--andes-text))] placeholder-[hsl(var(--andes-text-muted))] focus:outline-none focus:border-[hsl(var(--andes-olive))] mb-4 transition-colors"
              autoFocus
            />
            <button
              type="submit"
              className="w-full bg-[hsl(var(--andes-olive))] hover:bg-[hsl(var(--andes-olive-light))] text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
            >
              Connect
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[hsl(var(--andes-bg))]">
      {/* Header */}
      <header className="border-b border-[hsl(var(--andes-border))] bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
          <h1 className="text-lg font-semibold text-[hsl(var(--andes-text))] tracking-tight">Kernal</h1>

          {/* Nav */}
          <nav className="flex gap-1 overflow-x-auto max-w-[calc(100vw-16rem)] sm:max-w-none" style={{ scrollbarWidth: 'none' }}>
            {NAV_ITEMS.map(item => (
              <button
                key={item.view}
                onClick={() => { setView(item.view); setParams({}); }}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap shrink-0 ${
                  view === item.view
                    ? 'bg-[hsl(var(--andes-olive)/0.1)] text-[hsl(var(--andes-olive-dark))] font-medium'
                    : 'text-[hsl(var(--andes-text-muted))] hover:text-[hsl(var(--andes-text))] hover:bg-[hsl(var(--andes-bg-muted))]'
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
              className="w-full bg-[hsl(var(--andes-bg-subtle))] border border-[hsl(var(--andes-border-subtle))] rounded-lg px-4 py-2 text-sm text-[hsl(var(--andes-text))] placeholder-[hsl(var(--andes-text-muted))] focus:outline-none focus:border-[hsl(var(--andes-olive))] transition-colors"
            />
          </form>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        <div key={view} className="animate-fadeIn">
          {view === 'overview' && <Overview />}
          {view === 'network' && <NetworkGraph />}
          {view === 'timeline' && <Timeline entity={params.entity} />}
          {view === 'actions' && <ActionItems />}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[hsl(var(--andes-border))] py-3 text-center text-xs text-[hsl(var(--andes-text-muted))]">
        Kernal v0.1.0 — Your knowledge, your machine.
      </footer>
    </div>
  );
}
