'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { io } from 'socket.io-client';
import {
  Send,
  User,
  Phone,
  Radio,
  Search,
  Filter,
  RefreshCw,
  Settings,
  Link2,
  UserCheck,
  AlertCircle,
  MessageSquare,
  Clock,
  Sparkles,
  X,
  ChevronRight,
  Globe,
  Building2,
  Tag,
  FileText,
  CheckCircle2,
  Shield,
  Trash2,
  Plus,
  Edit2,
  Check,
} from 'lucide-react';

export default function LiveInbox() {
  const { data: session } = useSession();
  const [leads, setLeads] = useState([]);
  const [waAccounts, setWaAccounts] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // UI states
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [selectedSenderId, setSelectedSenderId] = useState('');
  const [activeTab, setActiveTab] = useState('details'); // details, accounts

  // Edit Lead States
  const [editingDetails, setEditingDetails] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    company: '',
    email: '',
    country: '',
    product: '',
    quantity: '',
    strength: '',
    brand: '',
    status: '',
    notes: '',
    tags: '',
    lead_tier: 'COLD',
  });

  // Pairing State
  const [pairingAccountId, setPairingAccountId] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [newAccountForm, setNewAccountForm] = useState({
    name: '',
    dailyLimit: 100,
    delayMin: 15,
    delayMax: 45,
  });

  const [socket, setSocket] = useState(null);
  const messagesEndRef = useRef(null);

  // 1. Fetch leads & accounts on mount
  useEffect(() => {
    fetchLeads();
    fetchWaAccounts();

    // Socket.io for live updates
    const socketUrl = process.env.NEXT_PUBLIC_WS_URL || window.location.origin;
    const s = io(socketUrl);
    setSocket(s);

    if (session?.user?.orgId) {
      s.emit('join_org', session.user.orgId);

      s.on('activity_notification', (data) => {
        // Refresh leads list to show new message snippet
        fetchLeads();
      });

      s.on('lead_update', () => {
        fetchLeads();
      });
    }

    s.on('qr', (data) => {
      setQrCode(data.qr);
    });

    s.on('status', (data) => {
      if (data.status === 'connected') {
        setQrCode(null);
        setPairingAccountId(null);
        fetchWaAccounts();
        fetchLeads();
      }
    });

    return () => {
      s.disconnect();
    };
  }, [session]);

  // 2. Poll for QR state when pairing
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
              fetchWaAccounts();
              fetchLeads();
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

  // 3. Fetch messages whenever selected lead changes
  useEffect(() => {
    if (selectedLead) {
      fetchMessages(selectedLead.id);

      // Auto set the selected sender
      if (selectedLead.assigned_wa_account_id) {
        setSelectedSenderId(selectedLead.assigned_wa_account_id);
      } else {
        // Default to first connected account
        const firstConnected = waAccounts.find((acc) => acc.status === 'connected');
        if (firstConnected) {
          setSelectedSenderId(firstConnected.id);
        } else {
          setSelectedSenderId('');
        }
      }

      // Populate edit form
      setEditForm({
        name: selectedLead.name || '',
        company: selectedLead.company || '',
        email: selectedLead.email || '',
        country: selectedLead.country || '',
        product: selectedLead.product || '',
        quantity: selectedLead.quantity || '',
        strength: selectedLead.strength || '',
        brand: selectedLead.brand || '',
        status: selectedLead.status || 'new',
        notes: selectedLead.notes || '',
        tags: selectedLead.tags || '',
        lead_tier: selectedLead.lead_tier || 'COLD',
      });
      setEditingDetails(false);

      // Listen to this lead's room or just start polling
      const interval = setInterval(() => {
        fetchMessages(selectedLead.id);
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [selectedLead, waAccounts]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchLeads = async () => {
    try {
      const res = await fetch('/api/chats');
      if (res.ok) {
        const data = await res.json();
        setLeads(data);

        // Update currently selected lead's data if it exists in the list
        if (selectedLead) {
          const updated = data.find((l) => l.id === selectedLead.id);
          if (updated) setSelectedLead(updated);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLeads(false);
    }
  };

  const fetchWaAccounts = async () => {
    try {
      const res = await fetch('/api/wa-accounts');
      if (res.ok) {
        const data = await res.json();
        setWaAccounts(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMessages = async (leadId) => {
    try {
      const res = await fetch(`/api/messages?leadId=${leadId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedLead || !selectedSenderId) return;

    setSendingMessage(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: selectedLead.id,
          waAccountId: selectedSenderId,
          content: newMessage,
        }),
      });

      if (res.ok) {
        const msg = await res.json();
        setMessages((prev) => [...prev, msg]);
        setNewMessage('');

        // Refresh leads list to show last message snippet
        fetchLeads();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to send message');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to connect to server');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleSaveLeadDetails = async (e) => {
    e.preventDefault();
    if (!selectedLead) return;

    try {
      const res = await fetch(`/api/leads/${selectedLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (res.ok) {
        const updated = await res.json();
        setSelectedLead(updated);
        setEditingDetails(false);
        fetchLeads();
      } else {
        alert('Failed to update lead');
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

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/wa-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAccountForm),
      });

      if (res.ok) {
        setShowAddAccountModal(false);
        setNewAccountForm({ name: '', dailyLimit: 100, delayMin: 15, delayMax: 45 });
        fetchWaAccounts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAccount = async (id) => {
    if (
      !confirm(
        'Are you sure you want to delete this WhatsApp account? All session credentials will be lost.'
      )
    )
      return;
    try {
      const res = await fetch(`/api/wa-accounts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchWaAccounts();
        if (pairingAccountId === id) {
          setPairingAccountId(null);
          setQrCode(null);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Quick template messages
  const templates = [
    {
      name: 'Intro',
      text: 'Hello {{name}}, I saw your requirement for {{product}} on IndiaMART. Are you still looking for this?',
    },
    {
      name: 'Follow-up',
      text: 'Hey {{name}}, just checking back on your request for {{quantity}} of {{product}}. Let me know if you would like a quick quote.',
    },
    {
      name: 'Availability',
      text: 'Hi {{name}}, we have {{product}} by {{brand}} ready in stock. Let me know what strength ({{strength}}) you require.',
    },
  ];

  const applyTemplate = (templateText) => {
    if (!selectedLead) return;
    const text = templateText
      .replace(/{{name}}/gi, selectedLead.name || '')
      .replace(/{{company}}/gi, selectedLead.company || '')
      .replace(/{{product}}/gi, selectedLead.product || '')
      .replace(/{{quantity}}/gi, selectedLead.quantity || '')
      .replace(/{{strength}}/gi, selectedLead.strength || '')
      .replace(/{{brand}}/gi, selectedLead.brand || '');
    setNewMessage(text);
  };

  // Filters and queries mapping
  const filteredLeads = leads.filter((l) => {
    const matchesSearch =
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.mobile.includes(searchQuery) ||
      (l.company && l.company.toLowerCase().includes(searchQuery.toLowerCase()));

    if (statusFilter === 'all') return matchesSearch;
    return matchesSearch && l.status === statusFilter;
  });

  return (
    <div className="flex h-[calc(100vh-4rem)] border border-slate-800 bg-slate-950 rounded-2xl overflow-hidden -m-4">
      {/* 1. LEADS PANEL (LEFT COLUMN) */}
      <div className="w-80 border-r border-slate-800 flex flex-col bg-slate-900/60">
        <div className="p-4 space-y-3 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-white text-lg tracking-tight">Inbox Conversations</h2>
            <button
              onClick={fetchLeads}
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {['all', 'replied', 'contacted', 'new', 'failed'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 text-[10px] font-semibold rounded-full border transition uppercase tracking-wider ${
                  statusFilter === st
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Leads List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
          {loadingLeads ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-indigo-400" />
              Loading conversations...
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No chats match this criteria.
            </div>
          ) : (
            filteredLeads.map((lead) => {
              const isSelected = selectedLead?.id === lead.id;
              return (
                <div
                  key={lead.id}
                  onClick={() => setSelectedLead(lead)}
                  className={`p-4 cursor-pointer flex flex-col gap-1 transition-all border-l-2 ${
                    isSelected
                      ? 'bg-slate-800/60 border-l-indigo-500'
                      : 'hover:bg-slate-800/20 border-l-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white text-xs truncate max-w-[140px]">
                      {lead.name}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {lead.last_message_sent_at
                        ? new Date(lead.last_message_sent_at).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                          })
                        : new Date(lead.created_at).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                          })}
                    </span>
                  </div>

                  {lead.company && (
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 truncate">
                      <Building2 className="h-3 w-3 text-slate-500" /> {lead.company}
                    </span>
                  )}

                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {lead.last_message_content ? (
                      <>
                        <span className="text-slate-400 font-medium mr-1">
                          {lead.last_message_direction === 'outbound' ? 'You:' : ''}
                        </span>
                        {lead.last_message_content}
                      </>
                    ) : (
                      <span className="italic text-slate-600">No message activity</span>
                    )}
                  </p>

                  <div className="flex items-center justify-between mt-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border ${
                        lead.status === 'replied'
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : lead.status === 'contacted'
                            ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                            : lead.status === 'failed'
                              ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                              : 'bg-slate-500/10 border-slate-500/20 text-slate-400'
                      }`}
                    >
                      {lead.status}
                    </span>

                    {lead.assigned_wa_account_name && (
                      <span className="text-[9px] text-slate-500 flex items-center gap-1 font-medium bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded-md">
                        <Radio className="h-2.5 w-2.5 text-indigo-400" />
                        {lead.assigned_wa_account_name}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. CHAT STREAM (MIDDLE COLUMN) */}
      <div className="flex-1 flex flex-col bg-slate-950/20">
        {selectedLead ? (
          <>
            {/* Chat Header */}
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center font-bold">
                  {selectedLead.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm tracking-tight">
                    {selectedLead.name}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono flex items-center gap-1">
                    <Phone className="h-3 w-3 text-slate-500" /> {selectedLead.mobile}
                  </p>
                </div>
              </div>

              {/* Sender Node Selector */}
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:block">
                  Send From:
                </label>
                <select
                  value={selectedSenderId}
                  onChange={(e) => setSelectedSenderId(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition font-medium"
                >
                  <option value="" disabled>
                    Select Sender Number
                  </option>
                  {waAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id} disabled={acc.status !== 'connected'}>
                      {acc.name} ({acc.phone_number || 'Not Connected'}) [{acc.status}]
                    </option>
                  ))}
                </select>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    waAccounts.find((acc) => acc.id === selectedSenderId)?.status === 'connected'
                      ? 'bg-emerald-400 animate-pulse'
                      : 'bg-rose-500'
                  }`}
                />
              </div>
            </div>

            {/* Message Feed */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-950/40">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
                  <MessageSquare className="h-12 w-12 text-slate-700 mb-3" />
                  <p className="font-medium text-slate-400 text-sm">No Message Activity</p>
                  <p className="mt-1">Manual messages or campaign replies will appear here.</p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isOutbound = msg.direction === 'outbound';
                  return (
                    <div
                      key={msg.id || index}
                      className={`flex flex-col max-w-[70%] rounded-2xl p-3 text-xs relative group ${
                        isOutbound
                          ? 'bg-indigo-600 ml-auto text-white rounded-tr-none'
                          : 'bg-slate-900 mr-auto text-slate-200 rounded-tl-none border border-slate-800'
                      }`}
                    >
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                      <div className="flex items-center justify-between gap-4 mt-2 pt-1 border-t border-white/10 text-[9px] text-slate-400/80">
                        <span>{msg.wa_account_name ? `via ${msg.wa_account_name}` : ''}</span>
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(msg.sent_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Templates Quick Picker */}
            <div className="px-6 py-2 bg-slate-900/30 border-t border-slate-800/60 flex items-center gap-2 overflow-x-auto">
              <span className="text-[10px] font-bold text-slate-500 uppercase flex-shrink-0 tracking-wider">
                Templates:
              </span>
              {templates.map((t, idx) => (
                <button
                  key={idx}
                  onClick={() => applyTemplate(t.text)}
                  className="px-2.5 py-1 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg text-[10px] text-slate-300 font-medium transition flex-shrink-0"
                >
                  {t.name}
                </button>
              ))}
            </div>

            {/* Input Form */}
            <form
              onSubmit={handleSendMessage}
              className="p-4 border-t border-slate-800 bg-slate-900/40 flex gap-2"
            >
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={
                  selectedSenderId
                    ? 'Type WhatsApp message...'
                    : 'Please select/connect a sender WhatsApp account above to message this lead'
                }
                disabled={!selectedSenderId || sendingMessage}
                rows={2}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition resize-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || !selectedSenderId || sendingMessage}
                className="px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition flex items-center justify-center disabled:opacity-40"
              >
                {sendingMessage ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-12">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full" />
              <MessageSquare className="h-20 w-20 text-indigo-500/60 relative animate-pulse" />
            </div>
            <h3 className="text-white font-bold text-base tracking-tight mb-1">
              Outbound Live Chat Control
            </h3>
            <p className="text-slate-400 text-xs text-center max-w-sm">
              Select any lead from the left pane to view message logs, direct chat using your
              WhatsApp channels, and update records.
            </p>
          </div>
        )}
      </div>

      {/* 3. META & NODES MANAGEMENT (RIGHT COLUMN) */}
      <div className="w-80 border-l border-slate-800 flex flex-col bg-slate-900/40">
        {/* Tab Header */}
        <div className="grid grid-cols-2 border-b border-slate-800 text-center font-bold text-xs uppercase tracking-wider">
          <button
            onClick={() => setActiveTab('details')}
            className={`py-3.5 border-b-2 transition ${
              activeTab === 'details'
                ? 'border-indigo-500 text-white bg-slate-900/55'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            Lead Info
          </button>
          <button
            onClick={() => setActiveTab('accounts')}
            className={`py-3.5 border-b-2 transition ${
              activeTab === 'accounts'
                ? 'border-indigo-500 text-white bg-slate-900/55'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            WA Accounts
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* TAB A: LEAD INFO DETAILS */}
          {activeTab === 'details' && (
            <div className="space-y-6">
              {selectedLead ? (
                <>
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <span className="font-bold text-white text-sm">Outbound Attributes</span>
                    <button
                      onClick={() => setEditingDetails(!editingDetails)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
                    >
                      {editingDetails ? (
                        <>
                          <Check className="h-3.5 w-3.5" /> Done
                        </>
                      ) : (
                        <>
                          <Edit2 className="h-3.5 w-3.5" /> Edit Info
                        </>
                      )}
                    </button>
                  </div>

                  <form onSubmit={handleSaveLeadDetails} className="space-y-4">
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          Full Name
                        </label>
                        <input
                          type="text"
                          disabled={!editingDetails}
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white disabled:opacity-60 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          Company
                        </label>
                        <input
                          type="text"
                          disabled={!editingDetails}
                          value={editForm.company}
                          onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white disabled:opacity-60 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          Email Address
                        </label>
                        <input
                          type="email"
                          disabled={!editingDetails}
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white disabled:opacity-60 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          Country
                        </label>
                        <input
                          type="text"
                          disabled={!editingDetails}
                          value={editForm.country}
                          onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white disabled:opacity-60 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="border-t border-slate-800/80 my-4 pt-3 space-y-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            Product Interest
                          </label>
                          <input
                            type="text"
                            disabled={!editingDetails}
                            value={editForm.product}
                            onChange={(e) => setEditForm({ ...editForm, product: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white disabled:opacity-60 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                              Quantity
                            </label>
                            <input
                              type="text"
                              disabled={!editingDetails}
                              value={editForm.quantity}
                              onChange={(e) =>
                                setEditForm({ ...editForm, quantity: e.target.value })
                              }
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white disabled:opacity-60 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                              Strength
                            </label>
                            <input
                              type="text"
                              disabled={!editingDetails}
                              value={editForm.strength}
                              onChange={(e) =>
                                setEditForm({ ...editForm, strength: e.target.value })
                              }
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white disabled:opacity-60 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-slate-800/80 my-4 pt-3 space-y-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            Assigned Node (WA Account)
                          </label>
                          <select
                            disabled={!editingDetails}
                            value={editForm.assigned_wa_account_id || ''}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                assigned_wa_account_id: e.target.value || null,
                              })
                            }
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white disabled:opacity-60 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="">No Active Account Assigned</option>
                            {waAccounts.map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {acc.name} ({acc.phone_number || 'Disconnected'})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                              Lead Tier
                            </label>
                            <select
                              disabled={!editingDetails}
                              value={editForm.lead_tier}
                              onChange={(e) =>
                                setEditForm({ ...editForm, lead_tier: e.target.value })
                              }
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white disabled:opacity-60 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="HOT">HOT</option>
                              <option value="WARM">WARM</option>
                              <option value="COLD">COLD</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                              Lead Status
                            </label>
                            <select
                              disabled={!editingDetails}
                              value={editForm.status}
                              onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white disabled:opacity-60 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="new">New</option>
                              <option value="queued">Queued</option>
                              <option value="contacted">Contacted</option>
                              <option value="replied">Replied</option>
                              <option value="failed">Failed</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          Tags
                        </label>
                        <input
                          type="text"
                          disabled={!editingDetails}
                          placeholder="comma separated values"
                          value={editForm.tags}
                          onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white disabled:opacity-60 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          Notes / Details
                        </label>
                        <textarea
                          disabled={!editingDetails}
                          rows={3}
                          value={editForm.notes}
                          onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white disabled:opacity-60 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                        />
                      </div>
                    </div>

                    {editingDetails && (
                      <button
                        type="submit"
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition"
                      >
                        Save Lead Changes
                      </button>
                    )}
                  </form>
                </>
              ) : (
                <div className="text-center text-slate-500 text-xs py-8">
                  Select a conversation to see lead traits.
                </div>
              )}
            </div>
          )}

          {/* TAB B: WA ACCOUNTS MANAGER */}
          {activeTab === 'accounts' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="font-bold text-white text-xs uppercase tracking-wider">
                  Active Nodes
                </span>
                <button
                  onClick={() => setShowAddAccountModal(true)}
                  className="p-1 hover:bg-slate-800 text-indigo-400 hover:text-white rounded transition"
                  title="Add Account"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {/* QR pairing panel display inside sidebar */}
              {pairingAccountId && (
                <div className="bg-slate-950 border border-indigo-500/20 rounded-xl p-4 flex flex-col items-center gap-3">
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[10px] font-bold text-white flex items-center gap-1 uppercase tracking-wider">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" /> Pair QR
                    </span>
                    <button
                      onClick={() => {
                        setPairingAccountId(null);
                        setQrCode(null);
                      }}
                      className="p-0.5 hover:bg-slate-800 rounded text-slate-400"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="bg-white p-2 rounded-lg w-full flex items-center justify-center min-h-[140px]">
                    {qrCode ? (
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(qrCode)}`}
                        alt="Pairing QR"
                        className="w-32 h-32"
                      />
                    ) : (
                      <div className="flex flex-col items-center text-slate-800 text-[10px]">
                        <RefreshCw className="h-5 w-5 text-slate-800 animate-spin mb-1" />
                        Fetching QR...
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Accounts List */}
              <div className="space-y-2.5">
                {waAccounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="p-3 bg-slate-950 border border-slate-850 rounded-xl flex flex-col gap-2 relative group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white text-xs">{acc.name}</span>
                      <span
                        className={`text-[8px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-full border ${
                          acc.status === 'connected'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                        }`}
                      >
                        {acc.status}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-400 space-y-0.5">
                      <p>
                        Number:{' '}
                        <span className="text-white font-mono">
                          {acc.phone_number || 'Not Linked'}
                        </span>
                      </p>
                      <p>
                        Daily Cap: <span className="text-white">{acc.daily_limit} messages</span>
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-800/80 pt-2 mt-1">
                      {acc.status !== 'connected' ? (
                        <button
                          onClick={() => startPairing(acc.id)}
                          className="text-[9px] font-semibold bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white px-2 py-1 rounded transition-colors"
                        >
                          Generate QR
                        </button>
                      ) : (
                        <span className="text-[9px] font-semibold text-emerald-400 flex items-center">
                          <Shield className="h-3 w-3 mr-0.5" /> Linked JID
                        </span>
                      )}

                      <button
                        onClick={() => handleDeleteAccount(acc.id)}
                        className="p-1 hover:bg-rose-950/20 text-slate-500 hover:text-rose-400 rounded transition"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CREATE NEW ACCOUNT MODAL */}
      {showAddAccountModal && (
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
                  value={newAccountForm.name}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Daily Volume Limit
                </label>
                <input
                  type="number"
                  value={newAccountForm.dailyLimit}
                  onChange={(e) =>
                    setNewAccountForm({ ...newAccountForm, dailyLimit: parseInt(e.target.value) })
                  }
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
                    value={newAccountForm.delayMin}
                    onChange={(e) =>
                      setNewAccountForm({ ...newAccountForm, delayMin: parseInt(e.target.value) })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Max Delay (s)
                  </label>
                  <input
                    type="number"
                    value={newAccountForm.delayMax}
                    onChange={(e) =>
                      setNewAccountForm({ ...newAccountForm, delayMax: parseInt(e.target.value) })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddAccountModal(false)}
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
