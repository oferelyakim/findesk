import type { User } from '@supabase/supabase-js';
import { BarChart2, Building2, AlertTriangle, Bookmark, LogOut, TrendingUp } from 'lucide-react';
import { useFinDeskStore } from '@/store';
import { signOut } from '@/lib/supabase';
import type { AppTab } from '@/types';

interface LayoutProps {
  user: User;
  children: React.ReactNode;
}

const TABS: { id: AppTab; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'sp500',   label: 'S&P 500',          icon: TrendingUp,    description: 'Index weight changes & movers' },
  { id: 'company', label: 'Company Analysis',  icon: Building2,     description: 'P&L, balance sheet, ratios' },
  { id: 'stress',  label: 'Stress Test',       icon: AlertTriangle, description: 'Credit & cashflow stress model' },
  { id: 'saved',   label: 'Saved',             icon: Bookmark,      description: 'Your saved analyses' },
];

export default function Layout({ user, children }: LayoutProps) {
  const { activeTab, setActiveTab } = useFinDeskStore();

  const handleSignOut = async () => {
    try { await signOut(); } catch { /* ignore */ }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* ── Top header ── */}
      <header
        className="flex items-center justify-between px-6 py-3 sticky top-0 z-50"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <BarChart2 size={22} style={{ color: 'var(--accent)' }} />
          <span className="font-bold text-lg tracking-tight">
            Fin<span style={{ color: 'var(--accent)' }}>Desk</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            {user.email}
          </span>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1 px-3 py-1.5 rounded text-xs transition-colors"
            style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}
            title="Sign out"
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </header>

      {/* ── Tab bar ── */}
      <nav
        className="flex gap-0 px-6 sticky top-[49px] z-40"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all border-b-2"
            style={{
              borderBottomColor: activeTab === id ? 'var(--accent)' : 'transparent',
              color: activeTab === id ? 'var(--accent)' : 'var(--muted)',
            }}
            title={TABS.find((t) => t.id === id)?.description}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </nav>

      {/* ── Content ── */}
      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 md:px-6 py-6">
        {children}
      </main>

      <footer className="text-center py-4 text-xs" style={{ color: 'var(--muted)', borderTop: '1px solid var(--border)' }}>
        FinDesk · Investment Analytics · Data: FMP + Alpaca · For informational purposes only
      </footer>
    </div>
  );
}
