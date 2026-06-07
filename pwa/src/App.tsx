import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useFinDeskStore } from '@/store';
import Layout from '@/components/Layout';
import AuthGate from '@/components/AuthGate';
import SP500Tab from '@/components/SP500Tab';
import CompanyTab from '@/components/CompanyTab';
import StressTestTab from '@/components/StressTestTab';
import SavedTab from '@/components/SavedTab';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const activeTab = useFinDeskStore((s) => s.activeTab);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--bg)' }}>
        <div className="text-center">
          <div className="text-2xl font-bold mb-2" style={{ color: 'var(--accent)' }}>FinDesk</div>
          <div className="text-sm" style={{ color: 'var(--muted)' }}>Loading…</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthGate onAuth={setUser} />;
  }

  return (
    <Layout user={user}>
      {activeTab === 'sp500'   && <SP500Tab />}
      {activeTab === 'company' && <CompanyTab />}
      {activeTab === 'stress'  && <StressTestTab />}
      {activeTab === 'saved'   && <SavedTab />}
    </Layout>
  );
}
