'use client';

import { useState, useEffect } from 'react';
import {
  Sparkles,
  Calendar,
  Zap,
  AlertCircle,
  Trash2,
  Edit,
  Play,
  Pause,
  X,
  Check,
  ChevronRight,
  Plus,
  RefreshCw,
  Users,
  Send,
} from 'lucide-react';

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [waAccounts, setWaAccounts] = useState([]);

  // Form states
  const [editingCampaignId, setEditingCampaignId] = useState(null);
  const [name, setName] = useState('');
  const [messageTemplate, setMessageTemplate] = useState(
    'Hi {{name}}, I noticed your earlier inquiry for {{product}}. Is this requirement still open? We may have something suitable for you.'
  );
  const [selectedWaAccounts, setSelectedWaAccounts] = useState([]);
  const [scheduleTime, setScheduleTime] = useState('');
  const [delayMin, setDelayMin] = useState(15);
  const [delayMax, setDelayMax] = useState(45);
  const [followupTemplates, setFollowupTemplates] = useState([]);
  const [autoResponses, setAutoResponses] = useState([]);
  const [triggerLeadCount, setTriggerLeadCount] = useState('all');

  // UI states
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('outreach'); // outreach | frequency | followups | responses
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Manual Trigger Outreach States
  const [triggerModalOpen, setTriggerModalOpen] = useState(false);
  const [selectedCampaignToTrigger, setSelectedCampaignToTrigger] = useState(null);
  const [manualTriggerLeadCount, setManualTriggerLeadCount] = useState('10');
  const [triggeringOutreach, setTriggeringOutreach] = useState(false);
  const [availableNewLeads, setAvailableNewLeads] = useState(0);
  const [pools, setPools] = useState([]);
  const [selectedPoolIdToTrigger, setSelectedPoolIdToTrigger] = useState('');

  useEffect(() => {
    fetchCampaigns();
    fetchWaAccounts();
    fetchNewLeadsCount();
  }, []);

  const fetchNewLeadsCount = async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        const data = await res.json();
        setAvailableNewLeads(parseInt(data.stats.new_leads) || 0);
        setPools(data.pools || []);
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    }
  };

  const fetchCampaigns = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/campaigns');
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data);
      }
    } catch (err) {
      console.error('Failed to fetch campaigns:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const fetchWaAccounts = async () => {
    try {
      const res = await fetch('/api/wa-accounts');
      if (res.ok) {
        const data = await res.json();
        setWaAccounts(data.filter((acc) => acc.status === 'connected'));
      }
    } catch (err) {
      console.error('Failed to fetch WhatsApp accounts:', err);
    }
  };

  // Modal opening handlers
  const handleOpenCreateModal = () => {
    setEditingCampaignId(null);
    setName('');
    setMessageTemplate(
      'Hi {{name}}, I noticed your earlier inquiry for {{product}}. Is this requirement still open? We may have something suitable for you.'
    );
    setSelectedWaAccounts([]);
    setScheduleTime('');
    setDelayMin(15);
    setDelayMax(45);
    setFollowupTemplates([]);
    setAutoResponses([]);
    setTriggerLeadCount('all');
    setActiveTab('outreach');
    setModalOpen(true);
  };

  const handleOpenEditModal = (campaign) => {
    setEditingCampaignId(campaign.id);
    setName(campaign.name || '');
    setMessageTemplate(campaign.message_template || '');
    setSelectedWaAccounts(campaign.accounts ? campaign.accounts.map((acc) => acc.id) : []);
    setScheduleTime(
      campaign.schedule_time ? new Date(campaign.schedule_time).toISOString().substring(0, 16) : ''
    );
    setDelayMin(
      campaign.delay_min !== undefined && campaign.delay_min !== null ? campaign.delay_min : 15
    );
    setDelayMax(
      campaign.delay_max !== undefined && campaign.delay_max !== null ? campaign.delay_max : 45
    );
    setFollowupTemplates(campaign.followup_templates || []);
    setAutoResponses(campaign.auto_responses || []);
    setActiveTab('outreach');
    setModalOpen(true);
  };

  const handleCreateOrUpdateCampaign = async (e) => {
    e.preventDefault();
    if (selectedWaAccounts.length === 0) {
      alert('Please select at least one WhatsApp account.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name,
        messageTemplate,
        waAccountIds: selectedWaAccounts,
        scheduleTime: scheduleTime || null,
        delayMin: parseInt(delayMin, 10),
        delayMax: parseInt(delayMax, 10),
        followupTemplates,
        autoResponses,
        triggerLeadCount: triggerLeadCount === 'all' ? 'all' : parseInt(triggerLeadCount, 10),
      };

      const endpoint = editingCampaignId ? `/api/campaigns/${editingCampaignId}` : '/api/campaigns';
      const method = editingCampaignId ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      setLoading(false);
      if (res.ok) {
        setModalOpen(false);
        fetchCampaigns();
        fetchNewLeadsCount();
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Failed to save campaign');
      }
    } catch (err) {
      setLoading(false);
      console.error(err);
      alert('An error occurred while saving the campaign.');
    }
  };

  const handleTriggerOutreach = async (e) => {
    e.preventDefault();
    if (!selectedCampaignToTrigger) return;

    setTriggeringOutreach(true);
    try {
      const res = await fetch(`/api/campaigns/${selectedCampaignToTrigger.id}/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadCount: parseInt(manualTriggerLeadCount, 10),
          poolId: selectedPoolIdToTrigger || null,
        }),
      });

      setTriggeringOutreach(false);
      if (res.ok) {
        setTriggerModalOpen(false);
        fetchCampaigns();
        fetchNewLeadsCount();
        alert('Outreach successfully triggered for the selected number of leads!');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to trigger outreach');
      }
    } catch (err) {
      setTriggeringOutreach(false);
      console.error(err);
      alert('An error occurred while triggering outreach.');
    }
  };

  const toggleCampaignStatus = async (campaign) => {
    const newStatus = campaign.status === 'active' ? 'paused' : 'active';
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchCampaigns();
      } else {
        alert('Failed to update status');
      }
    } catch (err) {
      console.error('Error toggling status:', err);
    }
  };

  const handleDeleteCampaign = async (id) => {
    if (!confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) {
      return;
    }
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchCampaigns();
      } else {
        alert('Failed to delete campaign');
      }
    } catch (err) {
      console.error('Error deleting campaign:', err);
    }
  };

  const toggleAccountSelection = (id) => {
    setSelectedWaAccounts((prev) =>
      prev.includes(id) ? prev.filter((accId) => accId !== id) : [...prev, id]
    );
  };

  // Follow-up sequence managers
  const addFollowupStep = () => {
    setFollowupTemplates((prev) => [
      ...prev,
      {
        delayHours: 24,
        content:
          'Hi {{name}}, following up on our previous inquiry. Would you be available for a brief call?',
      },
    ]);
  };

  const removeFollowupStep = (index) => {
    setFollowupTemplates((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updateFollowupStep = (index, key, value) => {
    setFollowupTemplates((prev) =>
      prev.map((step, idx) => (idx === index ? { ...step, [key]: value } : step))
    );
  };

  // Auto-response managers
  const addAutoResponse = () => {
    setAutoResponses((prev) => [
      ...prev,
      {
        keyword: 'interested',
        matchType: 'contains',
        replyText: 'Awesome! Glad to hear. Can we schedule a quick call today?',
      },
    ]);
  };

  const removeAutoResponse = (index) => {
    setAutoResponses((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updateAutoResponse = (index, key, value) => {
    setAutoResponses((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [key]: value } : item))
    );
  };

  // Compute aggregate statistics
  const totalCampaigns = campaigns.length;
  const aggregateLeads = campaigns.reduce((acc, c) => acc + (parseInt(c.total_leads) || 0), 0);
  const aggregateReplies = campaigns.reduce((acc, c) => acc + (parseInt(c.replied_leads) || 0), 0);
  const aggregateSent =
    campaigns.reduce((acc, c) => acc + (parseInt(c.contacted_leads) || 0), 0) + aggregateReplies;
  const averageReplyRate =
    aggregateSent > 0 ? ((aggregateReplies / aggregateSent) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-8 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Outbound Campaigns <Sparkles className="h-6 w-6 text-indigo-400" />
          </h1>
          <p className="text-slate-400 mt-1">
            Build, test, and manage automated WhatsApp customer outreach sequences.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchCampaigns}
            className={`p-2.5 rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 transition-all ${
              refreshing ? 'animate-spin' : ''
            }`}
            title="Refresh list"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg hover:shadow-indigo-600/20"
          >
            <Plus className="h-4 w-4 mr-2" /> Launch Campaign
          </button>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700/80 transition-all shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Total Campaigns
          </p>
          <div className="flex items-baseline justify-between mt-2">
            <h3 className="text-3xl font-bold text-white">{totalCampaigns}</h3>
            <span className="text-xs font-medium text-slate-500 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-md">
              Deployed
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700/80 transition-all shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Total Leads Reached
          </p>
          <div className="flex items-baseline justify-between mt-2">
            <h3 className="text-3xl font-bold text-white">{aggregateLeads}</h3>
            <span className="text-xs font-medium text-indigo-400 bg-indigo-950/20 border border-indigo-900/30 px-2 py-0.5 rounded-md">
              Audience
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700/80 transition-all shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Total Replies
          </p>
          <div className="flex items-baseline justify-between mt-2">
            <h3 className="text-3xl font-bold text-emerald-400">{aggregateReplies}</h3>
            <span className="text-xs font-medium text-emerald-400 bg-emerald-950/20 border border-emerald-900/30 px-2 py-0.5 rounded-md">
              Inbound
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700/80 transition-all shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Avg. Response Rate
          </p>
          <div className="flex items-baseline justify-between mt-2">
            <h3 className="text-3xl font-bold text-indigo-400">{averageReplyRate}%</h3>
            <span className="text-xs font-medium text-indigo-400 bg-indigo-950/20 border border-indigo-900/30 px-2 py-0.5 rounded-md">
              Conversion
            </span>
          </div>
        </div>
      </div>

      {/* Info Alert Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-start space-x-3 text-sm text-slate-300">
        <AlertCircle className="h-5 w-5 text-indigo-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-white text-sm">Campaign Mechanics</p>
          <p className="text-slate-400 mt-1">
            Leads in the lead pool are distributed round-robin across checked connected WhatsApp
            accounts. All campaigns check for response events in real-time; when a customer replies,
            further follow-up stages are immediately cancelled, and auto-responses are evaluated.
          </p>
        </div>
      </div>

      {/* Campaigns Listing */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <h3 className="font-bold text-lg text-white">Campaign Directory</h3>
          <span className="text-xs text-slate-500 font-medium">
            Showing {campaigns.length} campaigns
          </span>
        </div>

        <div className="divide-y divide-slate-800">
          {campaigns.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              No outbound campaigns found. Create your first campaign sequence to begin messaging.
            </div>
          ) : (
            campaigns.map((c) => {
              const processedCount =
                (parseInt(c.contacted_leads) || 0) +
                (parseInt(c.replied_leads) || 0) +
                (parseInt(c.failed_leads) || 0);
              const total = parseInt(c.total_leads) || 0;
              const progressPercentage = total > 0 ? Math.round((processedCount / total) * 100) : 0;
              const replyRate =
                processedCount > 0
                  ? (((parseInt(c.replied_leads) || 0) / processedCount) * 100).toFixed(1)
                  : '0.0';

              return (
                <div key={c.id} className="p-6 hover:bg-slate-950/40 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    {/* Left: Info */}
                    <div className="space-y-2 max-w-xl">
                      <div className="flex items-center gap-3">
                        <h4
                          className="font-bold text-white text-lg hover:text-indigo-400 transition-colors cursor-pointer"
                          onClick={() => handleOpenEditModal(c)}
                        >
                          {c.name}
                        </h4>
                        <span
                          className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                            c.status === 'active'
                              ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                              : 'bg-slate-500/10 border-slate-500/20 text-slate-400'
                          }`}
                        >
                          {c.status}
                        </span>
                      </div>

                      <p className="text-xs text-slate-400 font-mono truncate bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800/60 max-w-lg">
                        Initial message: {c.message_template}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
                        <span className="font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-[10px]">
                          ID: {c.id.substring(0, 8)}
                        </span>
                        {c.schedule_time && (
                          <span className="text-indigo-400 flex items-center">
                            <Calendar className="h-3.5 w-3.5 mr-1" />
                            {new Date(c.schedule_time).toLocaleString()}
                          </span>
                        )}
                        <span className="flex items-center text-slate-400">
                          <Users className="h-3.5 w-3.5 mr-1" />
                          {c.accounts ? c.accounts.length : 0} nodes
                        </span>
                        {c.followup_templates && c.followup_templates.length > 0 && (
                          <span className="bg-indigo-950/20 text-indigo-400 border border-indigo-900/30 px-2 py-0.5 rounded text-[10px]">
                            {c.followup_templates.length} follow-up steps
                          </span>
                        )}
                        {c.auto_responses && c.auto_responses.length > 0 && (
                          <span className="bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 px-2 py-0.5 rounded text-[10px]">
                            {c.auto_responses.length} auto-replies
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle: Performance Bar / Analytics */}
                    <div className="flex-1 max-w-sm">
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                        <span>Campaign Outreach Progress</span>
                        <span className="font-semibold text-white">
                          {processedCount} / {total} Leads ({progressPercentage}%)
                        </span>
                      </div>

                      {/* Bar indicator */}
                      <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800/80">
                        <div
                          className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${progressPercentage}%` }}
                        />
                      </div>

                      {/* Small stats strip */}
                      <div className="grid grid-cols-4 gap-2 text-center mt-2.5">
                        <div className="bg-slate-950 rounded-lg p-1.5 border border-slate-800/40">
                          <p className="text-[10px] text-slate-500 font-semibold uppercase">
                            Queued
                          </p>
                          <p className="text-xs font-bold text-slate-300">{c.queued_leads || 0}</p>
                        </div>
                        <div className="bg-slate-950 rounded-lg p-1.5 border border-slate-800/40">
                          <p className="text-[10px] text-slate-500 font-semibold uppercase">Sent</p>
                          <p className="text-xs font-bold text-indigo-400">
                            {c.contacted_leads || 0}
                          </p>
                        </div>
                        <div className="bg-slate-950 rounded-lg p-1.5 border border-slate-800/40">
                          <p className="text-[10px] text-slate-500 font-semibold uppercase">
                            Replied
                          </p>
                          <p className="text-xs font-bold text-emerald-400">
                            {c.replied_leads || 0}
                          </p>
                        </div>
                        <div className="bg-slate-950 rounded-lg p-1.5 border border-slate-800/40">
                          <p className="text-[10px] text-slate-500 font-semibold uppercase">
                            Reply Rate
                          </p>
                          <p className="text-xs font-bold text-indigo-300">{replyRate}%</p>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setSelectedCampaignToTrigger(c);
                          setManualTriggerLeadCount('10');
                          fetchNewLeadsCount();
                          setTriggerModalOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-900/30 bg-emerald-950/20 text-emerald-400 hover:bg-emerald-950/40 hover:text-emerald-300 transition-all text-xs font-semibold"
                        title="Trigger Manual Outreach"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>Trigger</span>
                      </button>

                      <button
                        onClick={() => toggleCampaignStatus(c)}
                        className={`p-2 rounded-xl border transition-all ${
                          c.status === 'active'
                            ? 'border-amber-900/30 bg-amber-950/20 text-amber-400 hover:bg-amber-950/40'
                            : 'border-indigo-900/30 bg-indigo-950/20 text-indigo-400 hover:bg-indigo-950/40'
                        }`}
                        title={c.status === 'active' ? 'Pause Campaign' : 'Resume Campaign'}
                      >
                        {c.status === 'active' ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </button>

                      <button
                        onClick={() => handleOpenEditModal(c)}
                        className="p-2 rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                        title="Edit Configuration"
                      >
                        <Edit className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteCampaign(c.id)}
                        className="p-2 rounded-xl border border-red-950/40 bg-red-950/20 text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-all"
                        title="Delete Campaign"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Create / Edit Campaign Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-850 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Zap className="h-5 w-5 text-indigo-400" />
                {editingCampaignId ? 'Edit Outbound Campaign' : 'Create Outbound Campaign'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Tabs Row */}
            <div className="flex border-b border-slate-800 bg-slate-950/40">
              <button
                type="button"
                onClick={() => setActiveTab('outreach')}
                className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                  activeTab === 'outreach'
                    ? 'border-indigo-500 text-white bg-slate-900/10'
                    : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-900/5'
                }`}
              >
                1. Outreach Details
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('frequency')}
                className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                  activeTab === 'frequency'
                    ? 'border-indigo-500 text-white bg-slate-900/10'
                    : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-900/5'
                }`}
              >
                2. Frequency & Delays
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('followups')}
                className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all relative ${
                  activeTab === 'followups'
                    ? 'border-indigo-500 text-white bg-slate-900/10'
                    : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-900/5'
                }`}
              >
                3. Follow-Ups
                {followupTemplates.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.2 bg-indigo-500 text-[10px] text-white rounded-full">
                    {followupTemplates.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('responses')}
                className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all relative ${
                  activeTab === 'responses'
                    ? 'border-indigo-500 text-white bg-slate-900/10'
                    : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-900/5'
                }`}
              >
                4. Auto-Responses
                {autoResponses.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.2 bg-emerald-500 text-[10px] text-white rounded-full">
                    {autoResponses.length}
                  </span>
                )}
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleCreateOrUpdateCampaign}>
              <div className="p-6 space-y-6 max-h-[55vh] overflow-y-auto">
                {/* TAB 1: OUTREACH DETAILS */}
                {activeTab === 'outreach' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Campaign Name
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Q3 Re-engagement Sequence"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-550"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Base Message Template
                      </label>
                      <textarea
                        required
                        rows="3"
                        value={messageTemplate}
                        onChange={(e) => setMessageTemplate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-550 font-mono"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Supports tags: <code className="text-slate-300">{'{{name}}'}</code>,{' '}
                        <code className="text-slate-300">{'{{company}}'}</code>,{' '}
                        <code className="text-slate-300">{'{{product}}'}</code>,{' '}
                        <code className="text-slate-300">{'{{quantity}}'}</code>,{' '}
                        <code className="text-slate-300">{'{{strength}}'}</code>,{' '}
                        <code className="text-slate-300">{'{{brand}}'}</code>.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Select Target WhatsApp Nodes (Connected Accounts Only)
                      </label>
                      {waAccounts.length === 0 ? (
                        <div className="bg-amber-950/20 border border-amber-900/30 p-3 rounded-xl flex items-center space-x-2 text-xs text-amber-400">
                          <AlertCircle className="h-4 w-4" />
                          <span>
                            No connected WhatsApp nodes available. Connect your nodes under WhatsApp
                            Accounts first!
                          </span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 mt-1.5">
                          {waAccounts.map((acc) => (
                            <button
                              key={acc.id}
                              type="button"
                              onClick={() => toggleAccountSelection(acc.id)}
                              className={`flex items-center justify-between p-3.5 rounded-xl border text-left text-xs font-semibold transition-all ${
                                selectedWaAccounts.includes(acc.id)
                                  ? 'border-indigo-500 bg-indigo-600/10 text-white'
                                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                              }`}
                            >
                              <div>
                                <p className="font-bold">{acc.name}</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">
                                  {acc.phone_number || 'Disconnected'}
                                </p>
                              </div>
                              <span
                                className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                                  selectedWaAccounts.includes(acc.id)
                                    ? 'bg-indigo-600 border-indigo-500 text-white'
                                    : 'border-slate-700 text-transparent'
                                }`}
                              >
                                <Check className="h-2.5 w-2.5" />
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Launch Delay / Schedule Outbound (Optional)
                      </label>
                      <input
                        type="datetime-local"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-550"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Leave blank to trigger sending outreach campaign immediately.
                      </span>
                    </div>

                    {!editingCampaignId && (
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Initial Leads to Dispatch & Trigger
                        </label>
                        <select
                          value={triggerLeadCount}
                          onChange={(e) => setTriggerLeadCount(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-550"
                        >
                          <option value="all">Trigger All Available Leads (New status)</option>
                          <option value="5">Trigger first 5 leads</option>
                          <option value="10">Trigger first 10 leads</option>
                          <option value="25">Trigger first 25 leads</option>
                          <option value="50">Trigger first 50 leads</option>
                          <option value="100">Trigger first 100 leads</option>
                          <option value="0">Do not trigger now (create empty campaign)</option>
                        </select>
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          Select how many leads from the unassigned pool to queue for this campaign
                          immediately.
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: FREQUENCY & DELAYS */}
                {activeTab === 'frequency' && (
                  <div className="space-y-5">
                    <div className="bg-indigo-950/20 border border-indigo-900/30 p-4 rounded-xl text-xs text-indigo-400 space-y-2">
                      <p className="font-bold">Anti-Spam & Delivery Safeguard</p>
                      <p className="text-indigo-300/80">
                        Spacing out outbound messages helps protect your WhatsApp accounts from
                        anti-spam rate limits. The queue worker will select a random delay in
                        seconds between the minimum and maximum threshold before sending each
                        message.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Minimum Delay (Seconds)
                        </label>
                        <input
                          type="number"
                          required
                          min="1"
                          max="3600"
                          value={delayMin}
                          onChange={(e) => setDelayMin(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-550"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Maximum Delay (Seconds)
                        </label>
                        <input
                          type="number"
                          required
                          min="1"
                          max="3600"
                          value={delayMax}
                          onChange={(e) => setDelayMax(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-550"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: FOLLOW-UPS */}
                {activeTab === 'followups' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-white">Chained Follow-Up Steps</h4>
                        <p className="text-xs text-slate-500">
                          Configure sequential messages sent if the user does not reply.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={addFollowupStep}
                        className="flex items-center px-3 py-1.5 bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-semibold hover:bg-slate-700 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Step
                      </button>
                    </div>

                    {followupTemplates.length === 0 ? (
                      <div className="p-8 border border-dashed border-slate-800 rounded-2xl text-center text-slate-500 text-xs">
                        No follow-up messages added. Initial outreach is sent without further
                        follow-up stages.
                      </div>
                    ) : (
                      <div className="space-y-3.5">
                        {followupTemplates.map((step, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-950 border border-slate-850 p-4 rounded-xl relative space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                                Step #{idx + 1} Settings
                              </span>
                              <button
                                type="button"
                                onClick={() => removeFollowupStep(idx)}
                                className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-950/20 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <div className="grid grid-cols-3 gap-3 items-center">
                              <label className="text-xs font-bold text-slate-400 uppercase col-span-1">
                                Delay Send Hours
                              </label>
                              <div className="col-span-2 flex items-center space-x-2">
                                <input
                                  type="number"
                                  step="any"
                                  required
                                  min="0.001"
                                  value={step.delayHours}
                                  onChange={(e) =>
                                    updateFollowupStep(
                                      idx,
                                      'delayHours',
                                      parseFloat(e.target.value)
                                    )
                                  }
                                  className="w-24 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white text-center"
                                />
                                <span className="text-xs text-slate-500">
                                  hours after previous message
                                </span>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                Follow-up Message Template
                              </label>
                              <textarea
                                required
                                rows="2"
                                value={step.content}
                                onChange={(e) => updateFollowupStep(idx, 'content', e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: AUTO-RESPONSES */}
                {activeTab === 'responses' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-white">Keyword Auto-Responses</h4>
                        <p className="text-xs text-slate-500">
                          Trigger immediate answers when users reply with matching words.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={addAutoResponse}
                        className="flex items-center px-3 py-1.5 bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-semibold hover:bg-slate-700 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Response
                      </button>
                    </div>

                    {autoResponses.length === 0 ? (
                      <div className="p-8 border border-dashed border-slate-800 rounded-2xl text-center text-slate-500 text-xs">
                        No auto-replies configured. Incoming messages are logged and trigger
                        dashboard notifications.
                      </div>
                    ) : (
                      <div className="space-y-3.5">
                        {autoResponses.map((item, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                                Auto-Reply #{idx + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeAutoResponse(idx)}
                                className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-950/20 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                  Keyword Trigger
                                </label>
                                <input
                                  type="text"
                                  required
                                  placeholder="e.g. price (or * for default)"
                                  value={item.keyword}
                                  onChange={(e) =>
                                    updateAutoResponse(idx, 'keyword', e.target.value)
                                  }
                                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                  Match Rule
                                </label>
                                <select
                                  value={item.matchType}
                                  onChange={(e) =>
                                    updateAutoResponse(idx, 'matchType', e.target.value)
                                  }
                                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                                >
                                  <option value="contains">Contains Word</option>
                                  <option value="exact">Exact Match</option>
                                  <option value="default">Fallback / Default (*)</option>
                                </select>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                Auto-Reply Content
                              </label>
                              <textarea
                                required
                                rows="2"
                                placeholder="Response message templates support variables like {{name}}"
                                value={item.replyText}
                                onChange={(e) =>
                                  updateAutoResponse(idx, 'replyText', e.target.value)
                                }
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Actions Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/20">
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (activeTab === 'outreach') setActiveTab('frequency');
                      else if (activeTab === 'frequency') setActiveTab('followups');
                      else if (activeTab === 'followups') setActiveTab('responses');
                      else setActiveTab('outreach');
                    }}
                    className="px-3 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors flex items-center"
                  >
                    Next Tab <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </button>
                </div>

                <div className="flex space-x-2.5">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl disabled:opacity-50 transition-all shadow-md shadow-indigo-600/10"
                  >
                    {loading
                      ? 'Saving Campaign...'
                      : editingCampaignId
                        ? 'Update Campaign'
                        : 'Deploy Campaign'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Trigger Outreach Modal */}
      {triggerModalOpen && selectedCampaignToTrigger && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-850 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-md font-bold text-white flex items-center gap-2">
                <Send className="h-4.5 w-4.5 text-emerald-400" />
                <span>Trigger Campaign Outreach</span>
              </h2>
              <button
                onClick={() => setTriggerModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleTriggerOutreach}>
              <div className="p-6 space-y-4">
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-850 space-y-1">
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                    Campaign
                  </p>
                  <p className="text-sm font-bold text-white">{selectedCampaignToTrigger.name}</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Select Target Lead Pool
                  </label>
                  <select
                    value={selectedPoolIdToTrigger}
                    onChange={(e) => setSelectedPoolIdToTrigger(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">All Pools (Combined)</option>
                    {pools.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.new_leads} new leads)
                      </option>
                    ))}
                  </select>
                </div>

                {(() => {
                  const activePool = pools.find((p) => p.id === selectedPoolIdToTrigger);
                  const currentAvailable = activePool ? activePool.new_leads : availableNewLeads;
                  return (
                    <>
                      <div className="bg-emerald-950/20 border border-emerald-900/30 p-3.5 rounded-xl flex items-center space-x-2 text-xs text-emerald-400">
                        <Sparkles className="h-4 w-4 shrink-0" />
                        <span>
                          Available leads in{' '}
                          {activePool ? `pool "${activePool.name}"` : 'all pools'}:{' '}
                          <strong className="text-white">{currentAvailable}</strong> leads
                        </span>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Number of leads to dispatch
                        </label>
                        <input
                          type="number"
                          required
                          min="1"
                          max={currentAvailable > 0 ? currentAvailable : 1000}
                          value={manualTriggerLeadCount}
                          onChange={(e) => setManualTriggerLeadCount(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-550"
                        />
                        <span className="text-[10px] text-slate-500 mt-1.5 block">
                          The queue worker will fetch this number of leads from the selected pool,
                          assign them round-robin to the mapped WhatsApp nodes, and start the
                          outbound sequence.
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/20 flex justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setTriggerModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    triggeringOutreach ||
                    (pools.find((p) => p.id === selectedPoolIdToTrigger)?.new_leads ??
                      availableNewLeads) === 0
                  }
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl disabled:opacity-50 transition-all shadow-md shadow-emerald-600/10 flex items-center gap-1.5"
                >
                  {triggeringOutreach ? 'Triggering...' : 'Start Outreach'}
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
