import React, { useEffect, useState } from 'react';
import api from '../lib/axios';
import { ShieldAlert, CheckCircle2, Search, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

const EscalationQueue = () => {
  const [escalatedCustomers, setEscalatedCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEscalations = async () => {
    setLoading(true);
    try {
      // The backend customerController accepts a status query parameter
      const res = await api.get('/customers?status=Escalated');
      setEscalatedCustomers(res.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load escalation queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEscalations();
  }, []);

  const handleResolve = async (id: string) => {
    try {
      await api.patch(`/customers/${id}/status`, { status: 'Active' });
      toast.success('Escalation resolved! Customer returned to Active status.');
      fetchEscalations();
    } catch (err) {
      console.error(err);
      toast.error('Failed to resolve escalation.');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-red-50 rounded-3xl p-8 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-red-100">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-red-900 flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-red-600" />
            Escalation Queue
          </h1>
          <p className="text-red-700">Review high-risk accounts flagged by the Sentiment & Escalation Agent.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchEscalations}
            className="bg-white hover:bg-red-100 text-red-700 px-6 py-3 rounded-xl font-bold transition-all shadow-sm flex items-center gap-2"
          >
            Refresh Queue
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-8 shadow-sm">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
          </div>
        ) : escalatedCustomers.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-green-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <p className="text-lg font-bold text-gen-textDark mb-2">No Active Escalations</p>
            <p className="text-gen-textLight">The AI agents are handling all current communications.</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Header Row */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b text-xs font-bold text-slate-400 uppercase tracking-wider">
              <div className="col-span-3">Customer Profile</div>
              <div className="col-span-2">Delinquency</div>
              <div className="col-span-5">AI Escalation Reason</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>
            
            <div className="divide-y divide-slate-100">
              {escalatedCustomers.map((c) => (
                <div key={c._id} className="group grid grid-cols-12 gap-4 items-center px-6 py-4 hover:bg-red-50/30 transition-colors bg-white relative">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  
                  {/* Customer Info */}
                  <div className="col-span-3 flex flex-col justify-center overflow-hidden pr-2">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-gen-textDark truncate">{c.name}</h3>
                      <span className="shrink-0 bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">
                        High Risk
                      </span>
                    </div>
                    <p className="text-xs text-gen-textLight truncate">{c.email}</p>
                  </div>

                  {/* Delinquency Info */}
                  <div className="col-span-2 flex flex-col justify-center">
                    <p className="text-sm font-bold text-gen-textDark">${c.outstandingAmount?.toLocaleString()}</p>
                    <p className="text-xs font-semibold text-orange-600">{c.daysOverdue} Days Overdue</p>
                  </div>

                  {/* Escalation Reason */}
                  <div className="col-span-5 pr-4 flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-900 font-medium leading-relaxed line-clamp-2">
                      Sentiment Agent detected highly negative/hostile sentiment or legal threats in recent communication. Human review required.
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 flex justify-end gap-2">
                    <button 
                      onClick={() => handleResolve(c._id)}
                      className="bg-white border border-slate-200 hover:bg-slate-50 text-gen-textDark px-3 py-1.5 rounded-lg font-bold transition-colors text-xs flex items-center gap-1.5 shadow-sm"
                      title="Mark as Resolved"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Resolve
                    </button>
                    <button 
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-bold transition-colors text-xs flex items-center gap-1.5 shadow-sm"
                    >
                      Review
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EscalationQueue;
