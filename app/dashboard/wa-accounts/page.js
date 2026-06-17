'use client';

import { useState, useEffect } from 'react';

import { Radio, Plus, Shield, ShieldAlert, Sparkles, RefreshCw, Trash2 } from 'lucide-react';
import { io } from 'socket.io-client';

export default function WaAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [name, setName] = useState('');
  const [dailyLimit, setDailyLimit] = useState(100);
  const [delayMin, setDelayMin] = useState(15);
  const [delayMax, setDelayMax] = useState(45);
  const [modalOpen, setModalOpen] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  const [pairingAccountId, setPairingAccountId] = useState(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    fetchAccounts();

    const socketUrl = process.env.NEXT_PUBLIC_WS_URL || window.location.origin;
    const s = io(socketUrl);
    setSocket(s);

    s.on('qr', (data) => {
      setQrCode(data.qr);
    });

    s.on('status', (data) => {
      if (data.status === 'connected') {
        setQrCode(null);
        setPairingAccountId(null);
        fetchAccounts();
      }
    });
  }, []);

  // Short-polling fallback for robust QR fetching
  useEffect(() => {
    let interval;
    if (pairingAccountId) {
      const poll = async () => {
        try {
          const res = await fetch(`/api/wa-accounts/qr?id=${pairingAccountId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'connected') {
              setQrCode(null);
              setPairingAccountId(null);
              fetchAccounts();
            } else if (data.qr_code) {
              setQrCode(data.qr_code);
            }
          }
        } catch (err) {
          console.error('QR Polling error:', err);
        }
      };
      poll();
      interval = setInterval(poll, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [pairingAccountId]);

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/wa-accounts');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/wa-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, dailyLimit, delayMin, delayMax }),
      });

      if (res.ok) {
        setName('');
        setModalOpen(false);
        fetchAccounts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startPairing = async (accountId) => {
    setPairingAccountId(accountId);
    setQrCode(null);
    if (socket) {
      socket.emit('join_wa', accountId);
    }

    try {
      await fetch('/api/wa-accounts/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waAccountId: accountId }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAccount = async (id) => {
    if (
      !confirm(
        'Are you sure you want to delete this WhatsApp account? All session credentials and data for this node will be removed.'
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/wa-accounts/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchAccounts();
        if (pairingAccountId === id) {
          setPairingAccountId(null);
          setQrCode(null);
        }
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to delete WhatsApp account');
      }
    } catch (err) {
      console.error('Error deleting WhatsApp account:', err);
      alert('An error occurred while deleting the account.');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">WhatsApp Accounts</h1>
          <p className="text-slate-400 mt-1">
            Manage and connect WhatsApp instances for campaign outreach.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" /> Add WA Account
        </button>
      </div>

      {/* Pairing Display block */}
      {pairingAccountId && (
        <div className="bg-slate-900 border border-indigo-500/20 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-3 max-w-md">
            <h3 className="text-lg font-bold text-white flex items-center">
              <Sparkles className="h-5 w-5 text-indigo-400 mr-2 animate-pulse" />
              Pair WhatsApp Account
            </h3>
            <p className="text-sm text-slate-300">
              Scan this QR code from your phone using WhatsApp &gt; Linked Devices to authorize
              session outbound actions.
            </p>
            <button
              onClick={() => {
                setPairingAccountId(null);
                setQrCode(null);
              }}
              className="text-xs text-rose-400 hover:underline"
            >
              Cancel Pairing Setup
            </button>
          </div>
          <div className="bg-white p-4 rounded-xl flex items-center justify-center min-w-[200px] min-h-[200px]">
            {qrCode ? (
              <div className="flex flex-col items-center space-y-3">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCode)}`}
                  alt="WhatsApp QR Code"
                  className="w-48 h-48 rounded-lg shadow-md"
                />
                <span className="text-[10px] text-slate-500 font-semibold">
                  Scan with WhatsApp Linked Devices
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center text-slate-800 text-xs">
                <RefreshCw className="h-6 w-6 text-slate-800 animate-spin mb-2" />
                Requesting QR code...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Accounts List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map((acc) => (
          <div
            key={acc.id}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between h-56 relative overflow-hidden group"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Radio
                    className={`h-4 w-4 ${acc.status === 'connected' ? 'text-emerald-400' : 'text-slate-500'}`}
                  />
                  <h3 className="font-bold text-white text-base">{acc.name}</h3>
                </div>
                <span
                  className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                    acc.status === 'connected'
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                      : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                  }`}
                >
                  {acc.status}
                </span>
              </div>

              <div className="mt-4 space-y-1.5 text-xs text-slate-400">
                <p>
                  Phone:{' '}
                  <span className="text-white font-mono">{acc.phone_number || 'Not Linked'}</span>
                </p>
                <p>
                  Daily Cap Limit: <span className="text-white">{acc.daily_limit} messages</span>
                </p>
                <p>
                  Delay Range:{' '}
                  <span className="text-white">
                    {acc.delay_min}s - {acc.delay_max}s
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between">
              {acc.status !== 'connected' ? (
                <button
                  onClick={() => startPairing(acc.id)}
                  className="text-xs font-semibold bg-indigo-600/20 border border-indigo-500/30 hover:bg-indigo-600 text-indigo-400 hover:text-white px-3 py-1.5 rounded-lg transition-all"
                >
                  Generate QR Link
                </button>
              ) : (
                <span className="text-xs font-semibold text-emerald-400 flex items-center">
                  <Shield className="h-3.5 w-3.5 mr-1" /> Active Session
                </span>
              )}

              <button
                onClick={() => handleDeleteAccount(acc.id)}
                className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-950/20 transition-all"
                title="Delete Account"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Account Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 relative">
            <h2 className="text-xl font-bold text-white mb-4">Add WhatsApp Account</h2>
            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Account Display Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sales Agent 1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Daily Volume Limit
                </label>
                <input
                  type="number"
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(parseInt(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Min Delay (s)
                  </label>
                  <input
                    type="number"
                    value={delayMin}
                    onChange={(e) => setDelayMin(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Max Delay (s)
                  </label>
                  <input
                    type="number"
                    value={delayMax}
                    onChange={(e) => setDelayMax(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export const dynamic = 'force-dynamic';
