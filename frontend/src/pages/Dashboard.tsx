import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Bot, CheckCircle2, Cpu, FileText, ArrowRight, Activity } from 'lucide-react';
import api from '../lib/axios';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await api.get('/dashboard/metrics');
        setMetrics(res.data.kpis);
      } catch (err) {
        console.error('Failed to load metrics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
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
            <div className="flex items-center justify-between p-4 bg-gen-bg/50 rounded-2xl">
              <div className="flex items-center gap-4">
                <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                <span className="font-semibold text-gen-textDark">Account Lookup - Customer #C1920</span>
              </div>
              <span className="text-sm font-mono text-gen-textLight">03:12 PM</span>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-gen-bg/50 rounded-2xl">
              <div className="flex items-center gap-4">
                <div className="w-2 h-2 rounded-full bg-gen-button"></div>
                <span className="font-semibold text-gen-textDark">Intent Detection - Email Parsing</span>
              </div>
              <span className="text-sm font-mono text-gen-textLight">03:05 PM</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-3xl p-8 shadow-sm min-h-[300px]">
          <h3 className="text-sm font-bold tracking-wider text-gen-textDark uppercase mb-6">Live System Feed</h3>
          
          <div className="bg-[#1a2b3c] rounded-2xl p-4 h-[200px] font-mono text-xs text-green-400 overflow-y-auto">
            <p>[11:17:14] AGENT_LOG: Sentiment analyzed</p>
            <p>[11:16:14] SYSTEM: Login successful</p>
            <p className="text-gray-400">[11:15:00] DB_SYNC: 14 accounts updated</p>
            <p>[11:14:22] AGENT_LOG: Resolution generated</p>
            <p>[11:10:05] EMAIL_SENT: Customer #C1920</p>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
