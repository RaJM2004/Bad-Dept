import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Bot, CheckCircle2, Cpu, FileText, ArrowRight, Activity } from 'lucide-react';
import api from '../lib/axios';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const resMetrics = await api.get('/dashboard/metrics');
        setMetrics(resMetrics.data.kpis);

        const resLogs = await api.get('/agents/logs');
        setLogs(resLogs.data.logs || []);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 lg:space-y-8 animate-in fade-in duration-500">
      
      {/* Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Welcome Card */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-8 shadow-sm flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
          {/* Background large text watermark */}
          <div className="absolute right-10 bottom-[-20px] text-8xl font-black text-gen-bg opacity-40 pointer-events-none tracking-tighter">
            BAD DEBT
          </div>
          
          <div className="w-40 h-40 bg-gen-bg rounded-2xl flex items-center justify-center shrink-0">
            <Bot size={80} className="text-gen-button opacity-80" />
          </div>
          
          <div className="relative z-10">
            <h2 className="text-2xl font-medium text-gen-textLight mb-2">
              Hi {user?.name || 'Officer'},
            </h2>
            <h1 className="text-4xl md:text-5xl font-bold text-gen-textDark leading-tight">
              You have a lot to catchup with...
            </h1>
          </div>
        </div>

        {/* AI Engine Card */}
        <div className="bg-white rounded-3xl p-8 shadow-sm flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 bg-gen-sidebar/30 rounded-xl flex items-center justify-center mb-6">
              <Activity size={24} className="text-gen-button" />
            </div>
            <h3 className="text-xl font-bold text-gen-textDark mb-3">Autonomous Collection Engine</h3>
            <p className="text-gen-textLight text-sm leading-relaxed mb-6">
              Intelligent AI agents orchestrating high-fidelity intent detection, sentiment analysis, and automated resolution workflows.
            </p>
          </div>
          <button className="bg-gen-button hover:bg-gen-buttonHover text-white px-6 py-3 rounded-xl font-bold transition-colors w-max shadow-sm shadow-gen-button/30">
            Launch Interface
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div>
        <h3 className="text-lg font-bold text-gen-button mb-4 px-2">Collection Pipeline Status</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          
          <div className="bg-white rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[160px]">
            <div className="flex justify-between items-start">
              <h4 className="font-bold text-gen-textLight">Total Customers</h4>
              <FileText size={20} className="text-gen-textDark" />
            </div>
            <div>
              <p className="text-4xl font-bold text-gen-textDark mb-2">
                {loading ? '...' : metrics?.totalCustomers || 0}
              </p>
              <p className="text-xs text-gen-textLight">Accounts in collections queue.</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[160px]">
            <div className="flex justify-between items-start">
              <h4 className="font-bold text-gen-textLight">Success Rate</h4>
              <CheckCircle2 size={20} className="text-gen-textDark" />
            </div>
            <div>
              <p className="text-4xl font-bold text-gen-textDark mb-2">
                {loading ? '...' : `${metrics?.successRate || 0}%`}
              </p>
              <p className="text-xs text-gen-textLight">Percentage of cases settled.</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[160px]">
            <div className="flex justify-between items-start">
              <h4 className="font-bold text-gen-textLight">Active Cases</h4>
              <Cpu size={20} className="text-gen-textDark" />
            </div>
            <div>
              <p className="text-4xl font-bold text-gen-textDark mb-2">
                {loading ? '...' : metrics?.activeCases || 0}
              </p>
              <p className="text-xs text-gen-textLight">Ongoing automated AI tasks.</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[160px]">
            <div className="flex justify-between items-start">
              <h4 className="font-bold text-gen-textLight">Amount Recovered</h4>
            </div>
            <div>
              <p className="text-4xl font-bold text-gen-button mb-2">
                {loading ? '...' : `₹${metrics?.amountRecovered?.toLocaleString() || '0'}`}
              </p>
              <p className="text-xs text-gen-textLight">
                Outstanding: ₹{metrics?.outstandingAmount?.toLocaleString() || '0'}
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Ongoing Workflows */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-3xl p-8 shadow-sm min-h-[300px]">
          <h3 className="text-xl font-bold text-gen-textDark mb-6">Ongoing Recoveries</h3>
          
          <div className="space-y-4">
            {logs.slice(0, 5).map((log, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-gen-bg/50 rounded-2xl">
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${log.status === 'Success' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="font-semibold text-gen-textDark truncate max-w-[300px]">
                    {log.agentName}
                    {log.requestDetails?.customerId && ` - Customer #${log.requestDetails.customerId.substring(log.requestDetails.customerId.length - 4)}`}
                  </span>
                </div>
                <span className="text-sm font-mono text-gen-textLight shrink-0">
                  {new Date(log.createdAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
            {logs.length === 0 && (
              <p className="text-gen-textLight text-center py-4">No recent recoveries.</p>
            )}
          </div>
        </div>
        
        <div className="bg-white rounded-3xl p-8 shadow-sm min-h-[300px] flex flex-col">
          <h3 className="text-sm font-bold tracking-wider text-gen-textDark uppercase mb-6">Live System Feed</h3>
          
          <div className="bg-[#1a2b3c] rounded-2xl p-4 flex-1 min-h-[200px] max-h-[300px] font-mono text-xs text-green-400 overflow-y-auto space-y-1">
            <p className="text-blue-300">[{new Date().toLocaleTimeString()}] SYSTEM: Listening for events...</p>
            {logs.slice(0, 10).map((log, i) => (
              <p key={i} className={log.status === 'Error' ? 'text-red-400' : ''}>
                [{new Date(log.createdAt).toLocaleTimeString()}] {log.agentName.toUpperCase().replace(/\s/g, '_')}: {log.status} {log.durationMs}ms
              </p>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
