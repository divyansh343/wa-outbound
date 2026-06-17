'use client';

import { useState, useEffect } from 'react';

import {
  Users,
  MessageSquare,
  CheckCircle,
  AlertTriangle,
  Zap,
  TrendingUp,
  Activity,
  ArrowRight,
  Bell,
} from 'lucide-react';
import Link from 'next/link';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] text-slate-400">
        Syncing metrics...
      </div>
    );
  }

  const stats = data?.stats || {
    total_leads: 0,
    new_leads: 0,
    contacted_leads: 0,
    replied_leads: 0,
    failed_leads: 0,
  };

  const replyRate =
    stats.contacted_leads > 0 ? Math.round((stats.replied_leads / stats.contacted_leads) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Advanced Outbound OS</h1>
          <p className="text-slate-400 mt-1">Multi-tenant outreach command center.</p>
        </div>
        <div className="flex space-x-3">
          <Link
            href="/dashboard/campaigns"
            className="flex items-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all duration-200"
          >
            <Zap className="h-4 w-4 mr-2" /> Launch Campaign
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Users className="h-24 w-24" />
          </div>
          <p className="text-sm font-medium text-slate-400">Total Leads</p>
          <p className="text-3xl font-bold text-white mt-2">{stats.total_leads}</p>
          <div className="flex items-center text-xs text-indigo-400 mt-4">
            <TrendingUp className="h-3.5 w-3.5 mr-1" />
            <span>Lead pool active</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <MessageSquare className="h-24 w-24" />
          </div>
          <p className="text-sm font-medium text-slate-400">Total Outreached</p>
          <p className="text-3xl font-bold text-white mt-2">{stats.contacted_leads}</p>
          <div className="flex items-center text-xs text-indigo-400 mt-4">
            <Activity className="h-3.5 w-3.5 mr-1" />
            <span>Queue processing</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <CheckCircle className="h-24 w-24" />
          </div>
          <p className="text-sm font-medium text-slate-400">Replies Received</p>
          <p className="text-3xl font-bold text-emerald-400 mt-2">{stats.replied_leads}</p>
          <div className="flex items-center text-xs text-emerald-400 mt-4">
            <span>{replyRate}% Response Rate</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <AlertTriangle className="h-24 w-24" />
          </div>
          <p className="text-sm font-medium text-slate-400">Bounced / Failed</p>
          <p className="text-3xl font-bold text-rose-400 mt-2">{stats.failed_leads}</p>
          <div className="flex items-center text-xs text-rose-400 mt-4">
            <span>Failed deliveries</span>
          </div>
        </div>
      </div>

      {/* Central Dashboard Analytics & Notification Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Notifications Panel */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col h-[480px]">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <Bell className="h-5 w-5 text-indigo-400" />
              <h3 className="font-bold text-lg text-white">Systematic Activity Logs</h3>
            </div>
            <span className="text-xs text-slate-400">Real-time</span>
          </div>
          <div className="flex-1 overflow-y-auto mt-4 space-y-4 pr-1">
            {!data?.notifications || data.notifications.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                No notifications recorded yet
              </div>
            ) : (
              data.notifications.map((notif) => (
                <div
                  key={notif.id}
                  className="p-3.5 bg-slate-950 border border-slate-800/80 rounded-xl flex items-start justify-between space-x-4"
                >
                  <div>
                    <p className="text-sm text-slate-200">{notif.message}</p>
                    <span className="text-[10px] text-slate-500 block mt-1">
                      {new Date(notif.created_at).toLocaleString()}
                    </span>
                  </div>
                  {notif.type === 'reply' && (
                    <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-semibold text-emerald-400 rounded-full flex-shrink-0">
                      Needs Action
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Active Entities & Connection Statuses */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col h-[480px]">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <h3 className="font-bold text-lg text-white">WA Session Status</h3>
            <Link
              href="/dashboard/wa-accounts"
              className="text-indigo-400 hover:text-indigo-300 text-xs flex items-center"
            >
              Manage <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto mt-4 space-y-3">
            {!data?.waAccounts || data.waAccounts.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                No WA Accounts connected
              </div>
            ) : (
              data.waAccounts.map((account) => (
                <div
                  key={account.id}
                  className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{account.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {account.phone_number || 'No pairing session'}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                      account.status === 'connected'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {account.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
export const dynamic = 'force-dynamic';
