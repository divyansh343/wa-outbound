'use client';

import { useState, useEffect } from 'react';

import { Settings, RefreshCw, Layers, CheckCircle2 } from 'lucide-react';

export default function Integrations() {
  const [imApiKey, setImApiKey] = useState('');
  const [gsUrl, setGsUrl] = useState('');
  const [imSyncing, setImSyncing] = useState(false);
  const [gsSyncing, setGsSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const fetchIntegrations = async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        const data = await res.json();
        // Set values if retrieved
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const handleSyncIndiaMart = async (e) => {
    e.preventDefault();
    if (!imApiKey) return;

    setImSyncing(true);
    setStatusMsg('');

    try {
      const res = await fetch('/api/integrations/indiamart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: imApiKey }),
      });
      const data = await res.json();
      setImSyncing(false);
      if (res.ok) {
        setStatusMsg(data.message || 'IndiaMart Leads Synchronized Successfully.');
      } else {
        setStatusMsg(data.error || 'IndiaMart synchronization failed.');
      }
    } catch (err) {
      setImSyncing(false);
      setStatusMsg('Failed to establish server connection.');
    }
  };

  const handleSyncGoogleSheet = async (e) => {
    e.preventDefault();
    if (!gsUrl) return;

    setGsSyncing(true);
    setStatusMsg('');

    try {
      const res = await fetch('/api/integrations/google-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetUrl: gsUrl }),
      });
      const data = await res.json();
      setGsSyncing(false);
      if (res.ok) {
        setStatusMsg(data.message || 'Google Sheet Leads Synchronized Successfully.');
      } else {
        setStatusMsg(data.error || 'Google Sheet synchronization failed.');
      }
    } catch (err) {
      setGsSyncing(false);
      setStatusMsg('Failed to establish server connection.');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Integrations Hub</h1>
        <p className="text-slate-400 mt-1">
          Synchronize leads directly from Google Sheets, IndiaMart seller accounts or custom CRMs.
        </p>
      </div>

      {statusMsg && (
        <div className="bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-xl p-4 text-xs font-semibold">
          {statusMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* IndiaMart Integrations card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center space-x-2">
            <Layers className="h-6 w-6 text-orange-400" />
            <h3 className="font-bold text-lg text-white">IndiaMart Seller Leads Sync</h3>
          </div>
          <p className="text-xs text-slate-400">
            Synchronize leads directly from IndiaMart. Provide your IndiaMart CRM API Key to run
            cron syncing operations.
          </p>
          <form onSubmit={handleSyncIndiaMart} className="space-y-3 pt-2">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                IndiaMart CRM Key
              </label>
              <input
                type="text"
                required
                placeholder="e.g. key_12345abc"
                value={imApiKey}
                onChange={(e) => setImApiKey(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={imSyncing}
              className="w-full py-2.5 px-4 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg text-xs transition-colors flex items-center justify-center"
            >
              {imSyncing ? <RefreshCw className="h-4.5 w-4.5 animate-spin mr-2" /> : null}
              {imSyncing ? 'Syncing...' : 'Sync IndiaMart Leads'}
            </button>
          </form>
        </div>

        {/* Google Sheets Sync Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center space-x-2">
            <Layers className="h-6 w-6 text-emerald-400" />
            <h3 className="font-bold text-lg text-white">Google Sheets CSV Integration</h3>
          </div>
          <p className="text-xs text-slate-400">
            Publish your Google Sheet to the web as a CSV, and paste the CSV link below to import
            lead records on demand.
          </p>
          <form onSubmit={handleSyncGoogleSheet} className="space-y-3 pt-2">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Google Sheet CSV Export Link
              </label>
              <input
                type="url"
                required
                placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv"
                value={gsUrl}
                onChange={(e) => setGsUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={gsSyncing}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs transition-colors flex items-center justify-center"
            >
              {gsSyncing ? <RefreshCw className="h-4.5 w-4.5 animate-spin mr-2" /> : null}
              {gsSyncing ? 'Syncing...' : 'Sync Google Sheet'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
export const dynamic = 'force-dynamic';
