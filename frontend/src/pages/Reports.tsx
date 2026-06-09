import React, { useEffect, useState } from 'react';
import api from '../lib/axios';
import { LineChart, Activity, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

const Reports = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [aiSummary, setAiSummary] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const resMetrics = await api.get('/dashboard/metrics');
        setMetrics(resMetrics.data.kpis);

        const resAi = await api.post('/agents/analytics-report', { metrics: resMetrics.data.kpis });
        setAiSummary(resAi.data.executiveSummary);
      } catch (err) {
        console.error(err);
        toast.error('Failed to load reports.');
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white rounded-3xl p-8 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-gen-textDark flex items-center gap-3">
            <LineChart className="w-8 h-8 text-blue-500" />
            Analytics & Reports
          </h1>
          <p className="text-gen-textLight">AI-generated executive summary of collection performance.</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-8 shadow-sm">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100 flex gap-4">
               <Activity className="w-6 h-6 text-blue-600 shrink-0 mt-1" />
               <div>
                 <h3 className="text-lg font-bold text-blue-900 mb-2">AI Executive Summary</h3>
                 <p className="text-blue-800 leading-relaxed">{aiSummary}</p>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="border border-slate-100 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                     <h4 className="font-bold text-gen-textDark">Total Customers</h4>
                     <FileText className="text-slate-400" size={20} />
                  </div>
                  <p className="text-3xl font-bold">{metrics?.totalCustomers || 0}</p>
               </div>
               <div className="border border-slate-100 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                     <h4 className="font-bold text-gen-textDark">Active Cases</h4>
                     <Activity className="text-slate-400" size={20} />
                  </div>
                  <p className="text-3xl font-bold">{metrics?.activeCases || 0}</p>
               </div>
               <div className="border border-slate-100 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                     <h4 className="font-bold text-gen-textDark">Amount Recovered</h4>
                     <LineChart className="text-slate-400" size={20} />
                  </div>
                  <p className="text-3xl font-bold text-green-600">${metrics?.amountRecovered?.toLocaleString() || 0}</p>
               </div>
               <div className="border border-slate-100 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                     <h4 className="font-bold text-gen-textDark">Success Rate</h4>
                     <Activity className="text-slate-400" size={20} />
                  </div>
                  <p className="text-3xl font-bold text-blue-600">{metrics?.successRate || 0}%</p>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
