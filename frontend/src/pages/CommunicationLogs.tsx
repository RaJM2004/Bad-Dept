import React, { useEffect, useState } from 'react';
import api from '../lib/axios';
import { Menu, Activity, ShieldAlert, FileText, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const CommunicationLogs = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await api.get('/agents/logs');
        setLogs(res.data.logs || []);
      } catch (err) {
        console.error(err);
        toast.error('Failed to load AI execution logs.');
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const getAgentColor = (agentName: string) => {
    switch (agentName) {
      case 'Intent Detection': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'Account Lookup': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Sentiment & Escalation': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Resolution Generator': return 'bg-green-100 text-green-700 border-green-200';
      case 'Communication Coordinator': return 'bg-slate-100 text-slate-700 border-slate-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white rounded-3xl p-8 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-gen-textDark flex items-center gap-3">
            <Activity className="w-8 h-8 text-blue-500" />
            AI Execution Logs
          </h1>
          <p className="text-gen-textLight">Real-time audit trail of all AI agent decisions and actions.</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-8 shadow-sm">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-10 h-10 text-slate-300" />
            </div>
            <p className="text-lg font-bold text-gen-textDark mb-2">No AI Logs Found</p>
            <p className="text-gen-textLight">Trigger an AI action in the Inbox or Customer portfolio to generate logs.</p>
          </div>
        ) : (
          <div className="relative border-l-2 border-slate-100 ml-4 space-y-8 pb-4">
            {logs.map((log, idx) => (
              <div key={log.id || log._id || idx} className="relative pl-8">
                {/* Timeline Dot */}
                <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white ${log.status === 'Success' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getAgentColor(log.agentName)}`}>
                        {log.agentName}
                      </span>
                      <span className="text-sm font-medium text-gen-textLight">
                        {log.durationMs}ms
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-slate-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Input Context</p>
                      <pre className="bg-white p-3 rounded-xl border border-slate-200 text-xs text-gen-textLight overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {JSON.stringify(log.requestDetails || {}, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">AI Output / Decision</p>
                      <pre className="bg-white p-3 rounded-xl border border-slate-200 text-xs text-gen-textDark font-medium overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {JSON.stringify(log.responseDetails || {}, null, 2)}
                      </pre>
                    </div>
                  </div>

                  {log.errorMessage && (
                    <div className="mt-4 bg-red-50 text-red-700 p-3 rounded-xl text-sm border border-red-100 flex items-start gap-2">
                      <ShieldAlert className="w-5 h-5 shrink-0" />
                      <p>{log.errorMessage}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommunicationLogs;
