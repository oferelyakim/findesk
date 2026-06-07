import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, Trash2, RefreshCw, Download, Building2, AlertTriangle, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import { listAnalyses, deleteAnalysis, listStressTests, deleteStressTest } from '@/lib/supabase';
import { useFinDeskStore } from '@/store';
import type { SavedAnalysis, SavedStressTest } from '@/types';

type ActiveSection = 'analyses' | 'stress';

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function SavedTab() {
  const [section, setSection] = useState<ActiveSection>('analyses');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { setActiveTab, setActiveTicker, setStressBaseFromAnalysis } = useFinDeskStore();

  const {
    data: analyses = [],
    isLoading: loadingAnalyses,
    refetch: refetchAnalyses,
  } = useQuery<SavedAnalysis[]>({
    queryKey: ['saved-analyses'],
    queryFn: listAnalyses,
    staleTime: 30 * 1000,
  });

  const {
    data: stressTests = [],
    isLoading: loadingStress,
    refetch: refetchStress,
  } = useQuery<SavedStressTest[]>({
    queryKey: ['saved-stress-tests'],
    queryFn: listStressTests,
    staleTime: 30 * 1000,
  });

  const handleDeleteAnalysis = async (id: string) => {
    await deleteAnalysis(id);
    queryClient.invalidateQueries({ queryKey: ['saved-analyses'] });
    setConfirmDeleteId(null);
  };

  const handleDeleteStress = async (id: string) => {
    await deleteStressTest(id);
    queryClient.invalidateQueries({ queryKey: ['saved-stress-tests'] });
    setConfirmDeleteId(null);
  };

  const reloadAnalysis = (a: SavedAnalysis) => {
    setActiveTicker(a.ticker);
    if (a.incomeStatements?.[0] && a.balanceSheets?.[0]) {
      const latest = a.incomeStatements[0];
      const latestBS = a.balanceSheets[0];
      setStressBaseFromAnalysis({
        ticker: a.ticker,
        revenue: latest.revenue ?? 0,
        grossProfit: latest.grossProfit ?? 0,
        ebitda: latest.ebitda ?? 0,
        interestExpense: latest.interestExpense ?? 0,
        totalDebt: latestBS.totalDebt ?? 0,
        cashAndEquivalents: latestBS.cashAndCashEquivalents ?? 0,
        accountsReceivable: latestBS.netReceivables ?? 0,
        inventory: latestBS.inventory ?? 0,
        accountsPayable: latestBS.accountPayables ?? 0,
        capex: 0,
      });
    }
    setActiveTab('company');
  };

  const reloadStress = (s: SavedStressTest) => {
    setStressBaseFromAnalysis(s.base);
    setActiveTab('stress');
  };

  const exportAllAnalyses = () => {
    if (!analyses.length) return;
    const wb = XLSX.utils.book_new();
    analyses.forEach((a) => {
      if (!a.incomeStatements?.length) return;
      const rows = a.incomeStatements.map((s) => ({
        Date: s.date,
        Ticker: a.ticker,
        Note: a.note ?? '',
        Revenue: s.revenue,
        'Gross Profit': s.grossProfit,
        EBITDA: s.ebitda,
        'Operating Income': s.operatingIncome,
        'Net Income': s.netIncome,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), a.ticker.slice(0, 31));
    });
    XLSX.writeFile(wb, 'findesk-saved-analyses.xlsx');
  };

  const isLoading = loadingAnalyses || loadingStress;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Saved Analyses</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Reload or export any previously saved work</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { refetchAnalyses(); refetchStress(); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
          {section === 'analyses' && analyses.length > 0 && (
            <button
              onClick={exportAllAnalyses}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <Download size={14} />
              Export All
            </button>
          )}
        </div>
      </div>

      {/* ── Section tabs ── */}
      <div className="flex gap-0 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', width: 'fit-content' }}>
        <button
          onClick={() => setSection('analyses')}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium"
          style={{
            background: section === 'analyses' ? 'var(--accent)' : 'var(--card)',
            color: section === 'analyses' ? '#fff' : 'var(--muted)',
          }}
        >
          <Building2 size={14} />
          Company Analyses ({analyses.length})
        </button>
        <button
          onClick={() => setSection('stress')}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium"
          style={{
            background: section === 'stress' ? 'var(--accent)' : 'var(--card)',
            color: section === 'stress' ? '#fff' : 'var(--muted)',
          }}
        >
          <AlertTriangle size={14} />
          Stress Tests ({stressTests.length})
        </button>
      </div>

      {/* ── Company analyses ── */}
      {section === 'analyses' && (
        <>
          {loadingAnalyses ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-xl skeleton" />)}
            </div>
          ) : analyses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Bookmark size={40} style={{ color: 'var(--muted)' }} className="mb-4" />
              <h2 className="font-semibold text-lg mb-2">No saved analyses yet</h2>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                Go to Company Analysis, look up a company, and click "Save Analysis"
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {analyses.map((a) => (
                <div
                  key={a.id}
                  className="rounded-xl p-4 flex items-center gap-4"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm"
                    style={{ background: 'var(--surface)', color: 'var(--accent)', border: '1px solid var(--border)', flexShrink: 0 }}>
                    {a.ticker.slice(0, 4)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{a.ticker}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                      {a.note || 'No note'} · {timeAgo(a.savedAt)}
                    </div>
                    {a.incomeStatements && (
                      <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                        {a.incomeStatements.length} period{a.incomeStatements.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => reloadAnalysis(a)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{ background: 'var(--accent)', color: '#fff' }}
                    >
                      Open <ChevronRight size={12} />
                    </button>
                    {confirmDeleteId === a.id ? (
                      <>
                        <button
                          onClick={() => handleDeleteAnalysis(a.id)}
                          className="px-3 py-1.5 rounded-lg text-xs"
                          style={{ background: 'var(--red)', color: '#fff' }}
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-3 py-1.5 rounded-lg text-xs"
                          style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(a.id)}
                        className="p-1.5 rounded-lg"
                        style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Stress tests ── */}
      {section === 'stress' && (
        <>
          {loadingStress ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-xl skeleton" />)}
            </div>
          ) : stressTests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <AlertTriangle size={40} style={{ color: 'var(--muted)' }} className="mb-4" />
              <h2 className="font-semibold text-lg mb-2">No saved stress tests yet</h2>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                Go to Credit Stress Test, fill in the inputs, and click "Save Test"
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {stressTests.map((s) => (
                <div
                  key={s.id}
                  className="rounded-xl p-4 flex items-center gap-4"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm"
                    style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.3)', flexShrink: 0 }}>
                    {(s.base.ticker || '?').slice(0, 4)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{s.base.ticker || 'Unknown ticker'}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                      Sales decline {s.assumptions.salesDeclinePct}% · Margin compression {s.assumptions.grossMarginCompressionPct}ppts · {timeAgo(s.savedAt)}
                    </div>
                    {s.result?.stressed?.cashflowCoverageMultiple != null && (
                      <div className="text-xs mt-1">
                        Stressed coverage: <span style={{ color: s.result.stressed.cashflowCoverageMultiple < 1.25 ? 'var(--red)' : s.result.stressed.cashflowCoverageMultiple < 2 ? 'var(--gold)' : 'var(--green)', fontWeight: 600 }}>
                          {s.result.stressed.cashflowCoverageMultiple.toFixed(2)}x
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => reloadStress(s)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{ background: 'var(--accent)', color: '#fff' }}
                    >
                      Open <ChevronRight size={12} />
                    </button>
                    {confirmDeleteId === s.id ? (
                      <>
                        <button
                          onClick={() => handleDeleteStress(s.id)}
                          className="px-3 py-1.5 rounded-lg text-xs"
                          style={{ background: 'var(--red)', color: '#fff' }}
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-3 py-1.5 rounded-lg text-xs"
                          style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(s.id)}
                        className="p-1.5 rounded-lg"
                        style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
