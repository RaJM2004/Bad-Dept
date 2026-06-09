import React, { useEffect, useState } from 'react';
import api from '../lib/axios';
import toast from 'react-hot-toast';

const DisputeManagement: React.FC = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCustomers = async () => {
    try {
      const res = await api.get('/customers');
      setCustomers(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleDispute = async () => {
    if (!disputeReason) return toast.error('Enter dispute claim');
    setAnalyzing(true);
    setResult(null);
    try {
      const res = await api.post('/agents/dispute', {
        customerId: selectedCustomer._id,
        disputeReason
      });
      setResult(res.data);
      if (res.data.action === 'Escalate to Officer') {
        toast.error('AI escalated this dispute!');
      } else {
        toast.success('AI handled the dispute.');
      }
      fetchCustomers(); // Refresh the table to show updated status
    } catch (err) {
      console.error(err);
      toast.error('Failed to process dispute');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 relative">
      <div className="bg-white rounded-3xl p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-gen-textDark mb-2">Dispute Management</h1>
        <p className="text-gen-textLight mb-8">AI-driven analysis and resolution of customer disputes.</p>

        {loading ? (
          <p className="text-gen-textLight">Loading customers...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-gen-textLight">
                  <th className="pb-4 pr-4">Name</th>
                  <th className="pb-4 px-4">Status</th>
                  <th className="pb-4 px-4 text-right">Outstanding Amount</th>
                  <th className="pb-4 pl-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c._id} className="border-b last:border-0 hover:bg-gen-bg/50">
                    <td className="py-4 pr-4 font-semibold">{c.name}</td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${
                        c.status === 'Escalated' ? 'bg-red-50 text-red-600' : 
                        c.status === 'Disputed' ? 'bg-orange-50 text-orange-600' : 
                        'bg-blue-50 text-blue-600'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right font-bold">₹{c.outstandingAmount?.toLocaleString()}</td>
                    <td className="py-4 pl-4 text-center">
                      <button 
                        onClick={() => { setSelectedCustomer(c); setResult(null); setDisputeReason(''); }}
                        className="bg-red-50 text-red-600 hover:bg-red-600 hover:text-white px-4 py-2 rounded-lg font-bold text-xs"
                      >
                        File Dispute
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedCustomer && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold">Dispute for {selectedCustomer.name}</h2>
              <button onClick={() => setSelectedCustomer(null)} className="text-slate-400 font-bold p-2">✕</button>
            </div>
            
            <div className="p-8 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Dispute Reason / Customer Claim</label>
                <textarea 
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  className="w-full px-4 py-2 border rounded-xl min-h-[100px]"
                  placeholder="e.g. I already paid this bill last month or I plan to sue."
                />
              </div>

              <button 
                onClick={handleDispute}
                disabled={analyzing || !disputeReason}
                className="w-full bg-gen-button text-white font-bold py-3 rounded-xl hover:bg-gen-buttonHover disabled:opacity-50"
              >
                {analyzing ? 'AI is analyzing...' : 'Submit to AI Agent'}
              </button>

              {result && (
                <div className={`mt-6 p-4 rounded-xl border ${result.action === 'Escalate to Officer' ? 'bg-red-50 border-red-200' : 'bg-slate-50'}`}>
                  <h3 className="font-bold mb-2">AI Action: <span className={result.action === 'Escalate to Officer' ? 'text-red-600' : 'text-blue-600'}>{result.action}</span></h3>
                  <p className="text-sm"><strong>Response to Customer:</strong></p>
                  <p className="text-sm mt-1 text-slate-600 italic">"{result.responseToCustomer}"</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DisputeManagement;
