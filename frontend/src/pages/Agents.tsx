import React, { useState, useEffect } from 'react';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import {
  Search, Shield, MessageSquare, Zap, CreditCard,
  Users, RefreshCw, FileCheck, CheckCircle2, AlertCircle,
  ChevronDown, ChevronUp, Play, ArrowDown
} from 'lucide-react';

// ── Pipeline node definitions ────────────────────────────────────────────────
const PIPELINE_NODES = [
  { key: 'screening_result',       label: 'Account Screening',        icon: Search,        color: '#3b82f6', bg: '#eff6ff' },
  { key: 'contact_strategy',       label: 'Contact Strategy',         icon: MessageSquare, color: '#8b5cf6', bg: '#f5f3ff' },
  { key: 'outreach_result',        label: 'Outreach Automation',      icon: Zap,           color: '#f59e0b', bg: '#fffbeb' },
  { key: 'payment_plan_result',    label: 'Payment Plan Agent',       icon: CreditCard,    color: '#10b981', bg: '#ecfdf5' },
  { key: 'human_collection_result',label: 'Human Collection Agent',   icon: Users,         color: '#ec4899', bg: '#fdf2f8' },
  { key: 'status_update_result',   label: 'Status Update Agent',      icon: RefreshCw,     color: '#6366f1', bg: '#eef2ff' },
  { key: 'compliance_report',      label: 'Compliance & Reporting',   icon: FileCheck,     color: '#14b8a6', bg: '#f0fdfa' },
];

// ── Helper to render a node result card ────────────────────────────────────
const NodeResultCard: React.FC<{
  node: typeof PIPELINE_NODES[0];
  data: any;
  index: number;
  isLast: boolean;
}> = ({ node, data, index, isLast }) => {
  const [expanded, setExpanded] = useState(false);
  const Icon = node.icon;
  const isSkipped = !data || Object.keys(data).length === 0;

  const renderSummary = () => {
    if (!data) return 'Skipped';
    switch (node.key) {
      case 'screening_result':
        return `Priority: ${data.priority} · ${data.eligible ? '✅ Eligible' : '⏸ Hold'} · ${data.recommended_next_step}`;
      case 'contact_strategy':
        return `Channel: ${data.preferred_channel} · Tone: ${data.tone} · Follow-up in ${data.follow_up_in_days}d`;
      case 'outreach_result':
        return `${data.sent ? '✅ Sent via' : '❌ Failed'} ${data.channel_used} · Follow-up: ${data.follow_up_date || 'N/A'}`;
      case 'payment_plan_result':
        return data.plan_type
          ? `${data.plan_type} · ₹${data.approved_monthly_amount?.toLocaleString()}/mo × ${data.duration_months} months`
          : `Status: ${data.status || 'N/A'}`;
      case 'human_collection_result':
        return `Officer ${data.email_sent ? 'notified' : 'pending'} · Review: ${data.review_date || 'N/A'}`;
      case 'status_update_result':
        return `Status → ${data.new_customer_status} · DB: ${data.db_updated ? '✅' : '⚠️'} · Sheets: ${data.sheets_synced ? '✅' : '⚠️'}`;
      case 'compliance_report':
        return `${data.compliant ? '✅ Compliant' : '⚠️ Issues Found'} · FDCPA: ${data.fdcpa_compliant ? '✅' : '❌'} · HIPAA: ${data.hipaa_compliant ? '✅' : '❌'}`;
      default:
        return JSON.stringify(data).substring(0, 80) + '…';
    }
  };

  return (
    <div className="flex flex-col items-center w-full">
      {/* Connection line from previous node */}
      {index > 0 && (
        <div className="flex flex-col items-center my-1">
          <div className="w-0.5 h-6 bg-slate-200" />
          <ArrowDown className="w-4 h-4 text-slate-300" />
        </div>
      )}

      <div
        className="w-full rounded-2xl border-2 overflow-hidden transition-all duration-300"
        style={{ borderColor: isSkipped ? '#e2e8f0' : node.color, background: isSkipped ? '#f8fafc' : node.bg }}
      >
        {/* Node header */}
        <button
          onClick={() => !isSkipped && setExpanded(e => !e)}
          className="w-full flex items-center gap-3 p-4 text-left"
          disabled={isSkipped}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-bold text-sm" style={{ color: isSkipped ? '#94a3b8' : '#1e293b' }}>
                Node {index + 1}: {node.label}
              </p>
              {!isSkipped && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
              {isSkipped && <span className="text-xs font-medium px-2 py-0.5 bg-slate-200 text-slate-500 rounded-full">Skipped</span>}
            </div>
            {!isSkipped && (
              <p className="text-xs text-slate-600 mt-0.5 truncate">{renderSummary()}</p>
            )}
          </div>
          {!isSkipped && (
            expanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          )}
        </button>

        {/* Expanded detail */}
        {expanded && !isSkipped && (
          <div className="px-4 pb-4 border-t border-slate-100">
            <pre className="text-xs font-mono text-slate-700 bg-white rounded-xl p-4 mt-3 overflow-x-auto max-h-48 border">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main Agents page ─────────────────────────────────────────────────────────
const Agents: React.FC = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'pipeline' | 'quick' | 'history'>('pipeline');
  
  // History state
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Quick-test state (old single-agent flow)
  const [message, setMessage] = useState('');
  const [quickResult, setQuickResult] = useState<any>(null);
  const [quickLoading, setQuickLoading] = useState(false);

  useEffect(() => {
    api.get('/customers').then(r => {
      setCustomers(r.data);
      if (r.data.length > 0) setSelectedCustomer(r.data[0]._id);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      setHistoryLoading(true);
      api.get('/agents/logs').then(r => {
        setHistoryLogs(r.data.logs || []);
      }).catch(console.error).finally(() => setHistoryLoading(false));
    }
  }, [activeTab]);

  // ── Run full LangGraph pipeline ──────────────────────────────────────────
  const handleRunPipeline = async () => {
    if (!selectedCustomer) return toast.error('Select a customer first.');
    setLoading(true);
    setResult(null);
    setLogs([]);
    try {
      const res = await api.post('/agents/run-pipeline', { customer_id: selectedCustomer });
      setResult(res.data);
      setLogs(res.data.pipeline_logs || []);
      if (res.data.pipeline_complete) {
        toast.success('🤖 LangGraph pipeline completed successfully!');
      } else {
        toast.error('Pipeline finished with errors. Check logs below.');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Pipeline failed to run.');
    } finally {
      setLoading(false);
    }
  };

  // ── Quick test (single communication agent) ──────────────────────────────
  const handleQuickTest = async () => {
    if (!selectedCustomer || !message.trim()) {
      return toast.error('Select a customer and enter a message.');
    }
    setQuickLoading(true);
    setQuickResult(null);
    try {
      const res = await api.post('/agents/log', {
        customerId: selectedCustomer,
        sender: 'Customer',
        messageType: 'Email',
        content: message,
      });
      setQuickResult(res.data.analysis);
      toast.success('Agents analyzed message!');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to process message');
    } finally {
      setQuickLoading(false);
    }
  };

  const selectedCust = customers.find(c => c._id === selectedCustomer);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div className="bg-white rounded-3xl p-8 shadow-sm">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gen-textDark">AI Agent Pipeline</h1>
        <p className="text-gen-textLight text-lg mt-2">
          Trigger the full 7-node LangGraph pipeline — Account Screening → Contact Strategy → Outreach → Payment Plan → Human Collection → Status Update → Compliance.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-3 bg-white rounded-2xl p-2 shadow-sm w-fit">
        <button
          onClick={() => setActiveTab('pipeline')}
          className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'pipeline' ? 'bg-gen-button text-white shadow' : 'text-gen-textLight hover:bg-gen-bg'}`}
        >
          Full Pipeline
        </button>
        <button
          onClick={() => setActiveTab('quick')}
          className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'quick' ? 'bg-gen-button text-white shadow' : 'text-gen-textLight hover:bg-gen-bg'}`}
        >
          Quick Test
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'history' ? 'bg-slate-800 text-white shadow' : 'text-gen-textLight hover:bg-gen-bg'}`}
        >
          Audit History
        </button>
      </div>

      {activeTab === 'pipeline' && (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

          {/* Left: Controls */}
          <div className="xl:col-span-2 flex flex-col gap-6">
            <div className="bg-white rounded-3xl p-8 shadow-sm space-y-6">
              <h2 className="text-xl font-bold text-gen-textDark">Select Account</h2>

              <div>
                <label className="block text-sm font-bold text-slate-600 mb-2">Customer</label>
                <select
                  className="w-full p-3 rounded-xl bg-gen-bg text-gen-textDark border-none outline-none focus:ring-2 focus:ring-gen-button"
                  value={selectedCustomer}
                  onChange={e => setSelectedCustomer(e.target.value)}
                >
                  {customers.map(c => (
                    <option key={c._id} value={c._id}>
                      {c.name} — ₹{c.outstandingAmount?.toLocaleString() || 0} overdue
                    </option>
                  ))}
                </select>
              </div>

              {/* Account summary */}
              {selectedCust && (
                <div className="bg-slate-50 rounded-2xl p-5 space-y-3 border border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Account Preview</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Status', value: selectedCust.status },
                      { label: 'Outstanding', value: `₹${(selectedCust.outstandingAmount || 0).toLocaleString()}` },
                      { label: 'Days Overdue', value: `${selectedCust.daysOverdue || 0}d` },
                      { label: 'Risk Score', value: `${selectedCust.riskScore || 0}/100` },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-white rounded-xl p-3 border border-slate-100">
                        <p className="text-xs text-slate-400 font-medium">{label}</p>
                        <p className="font-bold text-slate-800 mt-0.5">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleRunPipeline}
                disabled={loading || !selectedCustomer}
                className="w-full bg-gen-button hover:bg-gen-buttonHover text-white py-4 rounded-xl font-bold transition-all shadow-sm flex items-center justify-center gap-3 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Running Pipeline…
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Run Full Pipeline
                  </>
                )}
              </button>
            </div>

            {/* Pipeline log terminal */}
            {logs.length > 0 && (
              <div className="bg-[#0f172a] rounded-3xl p-6 shadow-sm border border-slate-800">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 font-mono">📟 Pipeline Logs</p>
                <div className="space-y-1.5 max-h-[400px] overflow-y-auto font-mono text-xs pr-2">
                  {logs.map((log, i) => (
                    <p key={i} className={`leading-relaxed py-0.5 ${log.includes('❌') ? 'text-red-400' : log.includes('✅') ? 'text-green-400' : log.includes('⚠️') ? 'text-yellow-400' : 'text-slate-300'}`}>
                      {log}
                    </p>
                  ))}
                </div>
                {result?.duration_ms && (
                  <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-slate-500 text-xs font-mono">
                    <span>STATUS: COMPLETE</span>
                    <span>⏱ Total: {(result.duration_ms / 1000).toFixed(2)}s</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Pipeline visualization */}
          <div className="xl:col-span-3 bg-white rounded-3xl p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gen-textDark">Pipeline Execution</h2>
              {result?.pipeline_complete && (
                <span className="flex items-center gap-1.5 text-green-600 font-bold text-sm bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
                  <CheckCircle2 className="w-4 h-4" /> Complete
                </span>
              )}
              {result?.error_message && (
                <span className="flex items-center gap-1.5 text-red-600 font-bold text-sm bg-red-50 px-3 py-1.5 rounded-full border border-red-200">
                  <AlertCircle className="w-4 h-4" /> Error
                </span>
              )}
            </div>

            {!result ? (
              <div className="flex flex-col items-center justify-center min-h-[500px] text-center gap-4 bg-slate-50 rounded-3xl border border-slate-100">
                <div className="w-20 h-20 bg-white shadow-sm rounded-2xl flex items-center justify-center">
                  <Play className="w-10 h-10 text-gen-button opacity-50" />
                </div>
                <p className="text-lg font-bold text-slate-600">Pipeline Idle</p>
                <p className="text-sm text-slate-500 max-w-xs">Select a customer and click "Run Full Pipeline" to watch all 7 agents execute in sequence.</p>
              </div>
            ) : (
              <div className="space-y-0 overflow-y-auto max-h-[calc(100vh-200px)] pr-2">
                {PIPELINE_NODES.map((node, i) => (
                  <NodeResultCard
                    key={node.key}
                    node={node}
                    data={result[node.key]}
                    index={i}
                    isLast={i === PIPELINE_NODES.length - 1}
                  />
                ))}

                {/* Compliance executive summary */}
                {result.compliance_report?.executive_summary && (
                  <div className="mt-6 p-6 bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-100 rounded-3xl shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <FileCheck className="w-5 h-5 text-teal-600" />
                      <p className="text-sm font-bold text-teal-800 uppercase tracking-wider">Executive Summary</p>
                    </div>
                    <p className="text-slate-700 leading-relaxed font-medium">{result.compliance_report.executive_summary}</p>
                    {result.compliance_report.compliance_doc_url && (
                      <a href={result.compliance_report.compliance_doc_url} target="_blank" rel="noreferrer" className="inline-block mt-4 text-sm font-bold text-teal-600 hover:text-teal-700 underline">
                        View Full Report in Google Docs &rarr;
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'quick' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quick test input */}
          <div className="bg-white rounded-3xl p-8 shadow-sm flex flex-col gap-6">
            <div>
              <h2 className="text-2xl font-bold text-gen-textDark mb-1">Incoming Communication</h2>
              <p className="text-sm text-gen-textLight">Simulate an email from a customer to test intent & sentiment agents</p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="text-sm font-bold text-gen-textDark mb-2 block">Select Customer</label>
                <select
                  className="w-full p-3 rounded-xl bg-gen-bg text-gen-textDark border-none outline-none focus:ring-2 focus:ring-gen-button"
                  value={selectedCustomer}
                  onChange={e => setSelectedCustomer(e.target.value)}
                >
                  {customers.map(c => (
                    <option key={c._id} value={c._id}>{c.name} — ₹{c.outstandingAmount || 0} overdue</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-bold text-gen-textDark mb-2 block">Customer Message</label>
                <textarea
                  className="w-full p-4 rounded-xl bg-gen-bg text-gen-textDark border-none outline-none focus:ring-2 focus:ring-gen-button min-h-[140px] resize-y"
                  placeholder="E.g. I lost my job and cannot pay this right now. Please give me some time."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                />
              </div>
              <button
                onClick={handleQuickTest}
                disabled={quickLoading}
                className="w-full bg-gen-button hover:bg-gen-buttonHover text-white px-6 py-4 rounded-xl font-bold transition-all shadow-sm disabled:opacity-70"
              >
                {quickLoading ? 'AI Agents Analyzing…' : 'Process with AI Agents'}
              </button>
            </div>
          </div>

          {/* Quick test results */}
          <div className="bg-white rounded-3xl p-8 shadow-sm flex flex-col gap-6">
            <div>
              <h2 className="text-2xl font-bold text-gen-textDark mb-1">Agent Execution Results</h2>
              <p className="text-sm text-gen-textLight">Real-time analysis from Groq AI models</p>
            </div>

            <div className="flex-1">
              {!quickResult ? (
                <div className="h-full min-h-[400px] flex items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 text-gen-textLight italic bg-slate-50">
                  Workflow Idle. Enter a message to watch agents execute.
                </div>
              ) : (
                <div className="flex flex-col items-center py-4 space-y-4 animate-in slide-in-from-bottom-4 duration-700">
                  {/* Input trigger */}
                  <div className="w-full max-w-sm bg-slate-800 text-white rounded-xl p-4 shadow-lg">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Trigger: Incoming Message</p>
                    <p className="text-sm font-medium">"{message.substring(0, 60)}…"</p>
                  </div>
                  <div className="h-5 w-0.5 bg-blue-300" />

                  {/* Intent */}
                  <div className="w-full max-w-sm bg-white rounded-xl p-4 shadow-md border-2 border-blue-500">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-xs font-bold text-blue-600 uppercase">Intent Detection</p>
                    </div>
                    <p className="text-sm font-bold text-slate-800">{quickResult.intent?.category}</p>
                    <p className="text-xs text-slate-500 font-mono">Confidence: {((quickResult.intent?.confidence || 0) * 100).toFixed(1)}%</p>
                  </div>
                  <div className="h-5 w-0.5 bg-blue-300" />

                  {/* Sentiment */}
                  <div className={`w-full max-w-sm bg-white rounded-xl p-4 shadow-md border-2 ${quickResult.sentiment?.shouldEscalate ? 'border-red-500' : 'border-orange-400'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <p className={`text-xs font-bold uppercase ${quickResult.sentiment?.shouldEscalate ? 'text-red-500' : 'text-orange-500'}`}>Sentiment Analysis</p>
                    </div>
                    <p className="text-sm font-bold text-slate-800">{quickResult.sentiment?.category}</p>
                    {quickResult.sentiment?.shouldEscalate && (
                      <p className="text-xs font-bold text-red-600 mt-1">🚨 ESCALATION FLAGGED</p>
                    )}
                  </div>
                  <div className="h-5 w-0.5 bg-blue-300" />

                  {/* Resolution */}
                  <div className="w-full max-w-sm bg-white rounded-xl p-4 shadow-md border-2 border-green-500">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-xs font-bold text-green-600 uppercase">Resolution Logic</p>
                    </div>
                    <p className="text-sm font-bold text-slate-800">{quickResult.resolution?.recommendedAction}</p>
                    <p className="text-xs text-slate-600 mt-1">{quickResult.resolution?.paymentSchedule}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-3xl p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gen-textDark mb-1">Pipeline Audit History</h2>
              <p className="text-sm text-gen-textLight">View past AI pipeline runs and detailed technical logs.</p>
            </div>
            <button
              onClick={() => {
                setHistoryLoading(true);
                api.get('/agents/logs').then(r => setHistoryLogs(r.data.logs || [])).finally(() => setHistoryLoading(false));
              }}
              className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${historyLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {historyLoading && historyLogs.length === 0 ? (
            <div className="py-20 text-center text-slate-400 flex flex-col items-center">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-500 rounded-full animate-spin mb-4" />
              Loading history...
            </div>
          ) : historyLogs.length === 0 ? (
            <div className="py-20 text-center text-slate-400 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
              No pipeline history found. Run a pipeline to see logs here.
            </div>
          ) : (
            <div className="space-y-4">
              {historyLogs.filter(log => log.agentName === "Pipeline Run" || log.agentName === "Communication Log").map((log, index) => {
                const customerId = log.requestDetails?.customer_id || log.requestDetails?.customerId;
                const cust = customers.find(c => c._id === customerId);
                const summary = log.responseDetails?.summary || {};
                const executiveSummary = log.responseDetails?.executive_summary;
                
                // For Communication Logs
                const isCommLog = log.agentName === "Communication Log";
                const analysis = log.responseDetails || {};
                
                return (
                  <div key={log.id} className={`border rounded-2xl overflow-hidden ${isCommLog ? 'border-blue-200 bg-blue-50/20' : 'border-slate-200 bg-white'}`}>
                    <div className={`p-5 flex flex-wrap items-center justify-between gap-4 ${isCommLog ? 'bg-blue-50/50' : 'bg-slate-50'}`}>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${log.status === 'Success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {log.agentName}
                          </span>
                          <span className="font-bold text-slate-800 text-lg">
                            {summary.customer || cust?.name || 'Unknown Customer'}
                          </span>
                          <span className="text-slate-400 text-sm font-mono">
                            {new Date(log.createdAt).toLocaleString()}
                          </span>
                        </div>
                        {!isCommLog ? (
                          <p className="text-sm text-slate-500 font-medium">
                            {summary.channel_used && `Channel: ${summary.channel_used} • `}
                            {summary.payment_plan && `Plan: ${summary.payment_plan} • `}
                            {summary.priority && `Priority: ${summary.priority}`}
                          </p>
                        ) : (
                          <p className="text-sm text-blue-600 font-medium">
                            Analyzed incoming customer message
                          </p>
                        )}
                      </div>
                      
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Run Duration</span>
                        <span className="font-mono text-slate-700">{log.durationMs ? (log.durationMs / 1000).toFixed(2) + 's' : 'N/A'}</span>
                      </div>
                    </div>

                    <div className="p-6 border-t border-slate-100">
                      {!isCommLog ? (
                        executiveSummary ? (
                          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                            <p className="text-xs font-bold text-teal-600 uppercase tracking-wider mb-2">AI Executive Summary</p>
                            <p className="text-sm text-slate-700 leading-relaxed font-medium">{executiveSummary}</p>
                          </div>
                        ) : (
                          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 text-center">
                            <p className="text-sm text-slate-500 italic">No summary generated for this run.</p>
                          </div>
                        )
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                            <p className="text-xs font-bold text-blue-500 uppercase mb-1">Intent</p>
                            <p className="text-sm font-bold text-slate-800">{analysis.intent?.category}</p>
                          </div>
                          <div className={`bg-white p-4 rounded-xl border shadow-sm ${analysis.sentiment?.shouldEscalate ? 'border-red-200' : 'border-orange-100'}`}>
                            <p className={`text-xs font-bold uppercase mb-1 ${analysis.sentiment?.shouldEscalate ? 'text-red-500' : 'text-orange-500'}`}>Sentiment</p>
                            <p className="text-sm font-bold text-slate-800">{analysis.sentiment?.category}</p>
                            {analysis.sentiment?.shouldEscalate && <p className="text-xs font-bold text-red-600 mt-1">🚨 Escalated to Officer</p>}
                          </div>
                          <div className="bg-white p-4 rounded-xl border border-green-100 shadow-sm">
                            <p className="text-xs font-bold text-green-500 uppercase mb-1">Resolution Plan</p>
                            <p className="text-sm font-bold text-slate-800">{analysis.resolution?.recommendedAction}</p>
                            <p className="text-xs text-slate-500 mt-1">{analysis.resolution?.paymentSchedule}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default Agents;
