'use client';

import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import {
  Upload,
  FileText,
  CheckCircle2,
  UserCheck2,
  RefreshCw,
  Database,
  Link2,
  Plus,
  Play,
  Trash2,
  Edit3,
  Save,
  X,
  Info,
  HelpCircle,
} from 'lucide-react';

export default function LeadsPoolManager() {
  const [activeTab, setActiveTab] = useState('leads'); // 'leads' or 'pools'
  const [leads, setLeads] = useState([]);
  const [pools, setPools] = useState([]);

  // Filtering & Pagination
  const [selectedPoolFilter, setSelectedPoolFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadingPools, setLoadingPools] = useState(true);

  // CSV upload state
  const [csvFile, setCsvFile] = useState(null);
  const [selectedUploadPoolId, setSelectedUploadPoolId] = useState('');
  const [uploading, setUploading] = useState(false);

  // Pool management state
  const [showCreatePoolModal, setShowCreatePoolModal] = useState(false);
  const [newPoolForm, setNewPoolForm] = useState({
    name: '',
    description: '',
    google_sheet_url: '',
  });
  const [editingPoolId, setEditingPoolId] = useState(null);
  const [editPoolForm, setEditPoolForm] = useState({
    name: '',
    description: '',
    google_sheet_url: '',
  });
  const [syncingPoolId, setSyncingPoolId] = useState(null);
  const [statusMsg, setStatusMsg] = useState(null);

  useEffect(() => {
    fetchPools();
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [selectedPoolFilter]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const url =
        selectedPoolFilter === 'all' ? '/api/leads' : `/api/leads?poolId=${selectedPoolFilter}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setLeads(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPools = async () => {
    setLoadingPools(true);
    try {
      const res = await fetch('/api/pools');
      if (res.ok) {
        const data = await res.json();
        setPools(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPools(false);
    }
  };

  const handleFileChange = (e) => {
    setCsvFile(e.target.files[0]);
  };

  const handleUploadCsv = async (e) => {
    e.preventDefault();
    if (!csvFile) return;

    setUploading(true);

    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const formattedLeads = results.data
          .map((row) => ({
            name: row.name || row.Name || row.SENDERNAME || 'CSV Import',
            company: row.company || row.Company || row.SENDERCOMPANY || '',
            mobile: row.mobile || row.Mobile || row.phone || row.SENDERMOBILE || '',
            email: row.email || row.Email || row.SENDEREMAIL || '',
            country: row.country || row.Country || row.SENDERCOUNTRY || 'India',
            product: row.product || row.Product || row.PRODUCTNAME || '',
            quantity: row.quantity || row.Quantity || row.REQ_QTY || '',
            strength: row.strength || row.Strength || row.STRENGTH || '',
            brand: row.brand || row.Brand || row.BRAND || '',
            notes: row.notes || row.Notes || row.NOTES || '',
            tags: row.tags || row.Tags || '',
          }))
          .filter((lead) => lead.mobile); // Must have mobile

        try {
          const res = await fetch('/api/leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              leads: formattedLeads,
              poolId: selectedUploadPoolId || null,
            }),
          });

          if (res.ok) {
            setCsvFile(null);
            fetchLeads();
            fetchPools(); // Reload pool counts
            setStatusMsg({
              type: 'success',
              text: `Imported ${formattedLeads.length} leads successfully.`,
            });
          } else {
            alert('Upload failed');
          }
        } catch (err) {
          console.error(err);
        } finally {
          setUploading(false);
        }
      },
      error: (err) => {
        setUploading(false);
        console.error(err);
      },
    });
  };

  const handleCreatePool = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/pools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPoolForm),
      });

      if (res.ok) {
        setShowCreatePoolModal(false);
        setNewPoolForm({ name: '', description: '', google_sheet_url: '' });
        fetchPools();
        setStatusMsg({ type: 'success', text: 'Lead pool created successfully.' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdatePool = async (e) => {
    e.preventDefault();
    if (!editingPoolId) return;

    try {
      const res = await fetch(`/api/pools/${editingPoolId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editPoolForm),
      });

      if (res.ok) {
        setEditingPoolId(null);
        fetchPools();
        setStatusMsg({ type: 'success', text: 'Lead pool updated successfully.' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePool = async (id) => {
    if (
      !confirm(
        'Are you sure you want to delete this pool? All leads assigned exclusively to this pool will be deleted!'
      )
    )
      return;

    try {
      const res = await fetch(`/api/pools/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchPools();
        fetchLeads();
        setStatusMsg({ type: 'success', text: 'Lead pool deleted successfully.' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSyncPool = async (poolId) => {
    setSyncingPoolId(poolId);
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/pools/${poolId}/sync`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMsg({ type: 'success', text: data.message });
        fetchLeads();
        fetchPools();
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Sync failed.' });
      }
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: 'Error syncing with Google Sheets.' });
    } finally {
      setSyncingPoolId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Header info */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Leads & Pools Hub</h1>
          <p className="text-slate-400 mt-1">
            Segment your leads into multiple pools, map them to outreach campaigns, and sync each
            pool from different Google Sheets.
          </p>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="flex border-b border-slate-800 text-sm font-semibold uppercase tracking-wider gap-8">
        <button
          onClick={() => setActiveTab('leads')}
          className={`pb-4 border-b-2 transition ${
            activeTab === 'leads'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-slate-500 hover:text-slate-350'
          }`}
        >
          Leads Catalog
        </button>
        <button
          onClick={() => setActiveTab('pools')}
          className={`pb-4 border-b-2 transition ${
            activeTab === 'pools'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-slate-500 hover:text-slate-355'
          }`}
        >
          Manage Pools ({pools.length})
        </button>
      </div>

      {/* Toast notifications */}
      {statusMsg && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between transition text-xs ${
            statusMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-450'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-450'
          }`}
        >
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* TAB 1: LEADS CATALOG */}
      {activeTab === 'leads' && (
        <div className="space-y-8">
          {/* CSV Import */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="font-bold text-lg text-white flex items-center mb-4">
              <Upload className="h-5 w-5 mr-2 text-indigo-400" />
              Import Leads to Specific Pool
            </h3>

            <form
              onSubmit={handleUploadCsv}
              className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end"
            >
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Select CSV File
                </label>
                <div className="relative border border-dashed border-slate-800 rounded-xl hover:border-slate-700 bg-slate-950 p-6 flex flex-col items-center justify-center cursor-pointer">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <FileText className="h-8 w-8 text-slate-500 mb-2" />
                  <span className="text-xs text-slate-400">
                    {csvFile ? csvFile.name : 'Drag & drop your CSV file here, or click to browse'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Target Lead Pool
                  </label>
                  <select
                    value={selectedUploadPoolId}
                    onChange={(e) => setSelectedUploadPoolId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">No Pool (Unassigned Pool)</option>
                    {pools.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={!csvFile || uploading}
                  className="w-full px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {uploading ? 'Processing...' : 'Upload Lead Batch'}
                </button>
              </div>
            </form>
          </div>

          {/* Leads Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden animate-in fade-in">
            <div className="px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <h3 className="font-bold text-lg text-white">Lead Catalog</h3>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
                  Filter Pool:
                </span>
                <select
                  value={selectedPoolFilter}
                  onChange={(e) => setSelectedPoolFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                >
                  <option value="all">All Pools</option>
                  {pools.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={fetchLeads}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-12 text-center text-slate-500 text-sm">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-indigo-400" />
                  Fetching leads catalog...
                </div>
              ) : leads.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-sm">
                  No leads found. Sync from a Google Sheet or drop a CSV to initialize lead pool
                  data.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950/50 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                      <th className="py-3 px-6">Name</th>
                      <th className="py-3 px-6">Company</th>
                      <th className="py-3 px-6">Mobile</th>
                      <th className="py-3 px-6">Product</th>
                      <th className="py-3 px-6">Source</th>
                      <th className="py-3 px-6">Lead Pool</th>
                      <th className="py-3 px-6">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {leads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-4 px-6 font-semibold text-white">{lead.name}</td>
                        <td className="py-4 px-6 text-slate-300">{lead.company || '-'}</td>
                        <td className="py-4 px-6 text-slate-400 font-mono">{lead.mobile}</td>
                        <td className="py-4 px-6 text-slate-300 truncate max-w-xs">
                          {lead.product || '-'}
                        </td>
                        <td className="py-4 px-6">
                          <span className="px-2 py-0.5 rounded-full border border-slate-800 bg-slate-950 text-[10px] text-slate-400">
                            {lead.source}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          {lead.pool_name ? (
                            <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-400 font-medium">
                              {lead.pool_name}
                            </span>
                          ) : (
                            <span className="text-slate-650 italic">Unassigned Pool</span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`px-2.5 py-1 rounded-full font-semibold border ${
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MANAGE POOLS */}
      {activeTab === 'pools' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button
              onClick={() => setShowCreatePoolModal(true)}
              className="flex items-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" /> Create Lead Pool
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {loadingPools ? (
              <div className="p-8 text-center text-slate-500 text-xs col-span-2">
                <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-indigo-400" />
                Loading lead pools...
              </div>
            ) : pools.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-sm col-span-2 bg-slate-900 border border-slate-800 rounded-2xl">
                No pools created yet. Click "Create Lead Pool" to get started.
              </div>
            ) : (
              pools.map((p) => {
                const isEditing = editingPoolId === p.id;
                return (
                  <div
                    key={p.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between min-h-[200px] relative transition hover:border-slate-700"
                  >
                    {isEditing ? (
                      <form onSubmit={handleUpdatePool} className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Edit Lead Pool
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditingPoolId(null)}
                            className="text-slate-450 hover:text-white"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div>
                          <input
                            type="text"
                            required
                            value={editPoolForm.name}
                            onChange={(e) =>
                              setEditPoolForm({ ...editPoolForm, name: e.target.value })
                            }
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            placeholder="Pool Name"
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            value={editPoolForm.description}
                            onChange={(e) =>
                              setEditPoolForm({ ...editPoolForm, description: e.target.value })
                            }
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            placeholder="Short Description"
                          />
                        </div>
                        <div>
                          <input
                            type="url"
                            value={editPoolForm.google_sheet_url}
                            onChange={(e) =>
                              setEditPoolForm({ ...editPoolForm, google_sheet_url: e.target.value })
                            }
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv"
                          />
                        </div>
                        <button
                          type="submit"
                          className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                        >
                          <Save className="h-3.5 w-3.5" /> Save Changes
                        </button>
                      </form>
                    ) : (
                      <>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Database className="h-5 w-5 text-indigo-400" />
                              <h3 className="font-bold text-white text-base">{p.name}</h3>
                            </div>
                            <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                              {p.lead_count} leads
                            </span>
                          </div>

                          <p className="text-xs text-slate-400 min-h-[30px] leading-relaxed">
                            {p.description || (
                              <span className="italic text-slate-600">No description provided</span>
                            )}
                          </p>

                          <div className="text-[10px] text-slate-400 space-y-1.5 bg-slate-950/60 p-3 rounded-xl border border-slate-850">
                            <p className="flex items-center gap-1.5 truncate">
                              <Link2 className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                              {p.google_sheet_url ? (
                                <a
                                  href={p.google_sheet_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:underline text-indigo-400 truncate"
                                >
                                  {p.google_sheet_url}
                                </a>
                              ) : (
                                <span className="italic text-slate-650">
                                  No Google Sheet linked
                                </span>
                              )}
                            </p>
                            <p className="flex items-center gap-1 text-[9px] text-slate-500">
                              Last Synced:{' '}
                              <span className="text-slate-300">
                                {p.last_synced_at
                                  ? new Date(p.last_synced_at).toLocaleString()
                                  : 'Never'}
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-800/80 pt-4 mt-6 gap-2">
                          <button
                            onClick={() => handleSyncPool(p.id)}
                            disabled={!p.google_sheet_url || syncingPoolId === p.id}
                            className="flex items-center gap-1 text-[11px] font-semibold bg-emerald-600/10 hover:bg-emerald-600 border border-emerald-500/25 text-emerald-400 hover:text-white px-3.5 py-1.5 rounded-lg disabled:opacity-40 transition-all"
                          >
                            {syncingPoolId === p.id ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <Play className="h-3 w-3" />
                            )}
                            Sync Google Sheet
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingPoolId(p.id);
                                setEditPoolForm({
                                  name: p.name,
                                  description: p.description || '',
                                  google_sheet_url: p.google_sheet_url || '',
                                });
                              }}
                              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition"
                              title="Edit Pool"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePool(p.id)}
                              className="p-2 bg-slate-800/60 hover:bg-rose-950/40 text-slate-500 hover:text-rose-450 rounded-lg transition"
                              title="Delete Pool"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* CREATE POOL MODAL */}
      {showCreatePoolModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 relative">
            <h2 className="text-xl font-bold text-white mb-4">Create Lead Pool</h2>
            <form onSubmit={handleCreatePool} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Pool Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. IndiaMART High Intent"
                  value={newPoolForm.name}
                  onChange={(e) => setNewPoolForm({ ...newPoolForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  placeholder="Describe the purpose of this lead pool..."
                  rows={2}
                  value={newPoolForm.description}
                  onChange={(e) => setNewPoolForm({ ...newPoolForm, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Google Sheet URL (Published CSV Link)
                </label>
                <input
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv"
                  value={newPoolForm.google_sheet_url}
                  onChange={(e) =>
                    setNewPoolForm({ ...newPoolForm, google_sheet_url: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-1 leading-normal">
                  <HelpCircle className="h-3 w-3 flex-shrink-0" /> Make sure you've published the
                  spreadsheet to the web as CSV, or use the direct spreadsheet URL.
                </span>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreatePoolModal(false)}
                  className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                >
                  Create Pool
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
