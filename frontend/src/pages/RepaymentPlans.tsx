import React, { useEffect, useState } from 'react';
import api from '../lib/axios';
import toast from 'react-hot-toast';

const RepaymentPlans: React.FC = () => {
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
  const [proposedAmount, setProposedAmount] = useState('');
  const [hardshipReason, setHardshipReason] = useState('');
  const [negotiating, setNegotiating] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleNegotiate = async () => {
    if (!proposedAmount) return toast.error('Enter proposed amount');
    setNegotiating(true);
    setResult(null);
    try {
      const res = await api.post('/agents/repayment-plan', {
        customerId: selectedCustomer._id,
        proposedAmount: Number(proposedAmount),
        hardshipReason
      });
      setResult(res.data);
      if (res.data.status === 'Accepted') {
        toast.success('AI accepted and saved the repayment plan!');
        fetchCustomers(); // Refresh the table to show updated status
      } else {
        toast.success('AI evaluated the repayment plan.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to negotiate repayment plan');
    } finally {
      setNegotiating(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 relative">
      <div className="bg-white rounded-3xl p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-gen-textDark mb-2">Repayment Plans</h1>
        <p className="text-gen-textLight mb-8">AI-driven negotiation for monthly installment plans.</p>

        {loading ? (
          <p className="text-gen-textLight">Loading customers...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-gen-textLight">
                  <th className="pb-4 pr-4">Name</th>
                  <th className="pb-4 px-4">Status</th>
                  <th className="pb-4 px-4">Overdue Days</th>
                  <th className="pb-4 px-4 text-right">Outstanding Amount</th>
                  <th className="pb-4 pl-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c._id} className="border-b last:border-0 hover:bg-gen-bg/50">
                    <td className="py-4 pr-4 font-semibold">{c.name}</td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${c.status === 'Active' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-mono text-orange-600">{c.daysOverdue || 0} days</td>
                    <td className="py-4 px-4 text-right font-bold">₹{c.outstandingAmount?.toLocaleString()}</td>
                    <td className="py-4 pl-4 text-center">
                      <button 
                        onClick={() => { setSelectedCustomer(c); setResult(null); setProposedAmount(''); setHardshipReason(''); }}
                        className="bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-lg font-bold text-xs"
                      >
                        Negotiate
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
              <h2 className="text-xl font-bold">Negotiate with {selectedCustomer.name}</h2>
              <button onClick={() => setSelectedCustomer(null)} className="text-slate-400 font-bold p-2">✕</button>
            </div>
            
            <div className="p-8 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Proposed Monthly Amount (₹)</label>
                <input 
                  type="number" 
                  value={proposedAmount}
                  onChange={(e) => setProposedAmount(e.target.value)}
                  className="w-full px-4 py-2 border rounded-xl"
                  placeholder="e.g. 5000"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Hardship Reason</label>
                <input 
                  type="text" 
                  value={hardshipReason}
                  onChange={(e) => setHardshipReason(e.target.value)}
                  className="w-full px-4 py-2 border rounded-xl"
                  placeholder="e.g. Medical emergency"
                />
              </div>

              <button 
                onClick={handleNegotiate}
                disabled={negotiating || !proposedAmount}
                className="w-full bg-gen-button text-white font-bold py-3 rounded-xl hover:bg-gen-buttonHover disabled:opacity-50"
              >
                {negotiating ? 'AI is analyzing...' : 'Submit to AI Agent'}
              </button>

              {result && (
                <div className="mt-6 p-4 rounded-xl border bg-slate-50">
                  <h3 className="font-bold mb-2">AI Response: <span className={result.status === 'Accepted' ? 'text-green-600' : 'text-orange-600'}>{result.status}</span></h3>
                  <p className="text-sm"><strong>Approved Monthly:</strong> ₹{result.approvedMonthlyAmount}</p>
                  <p className="text-sm"><strong>Duration:</strong> {result.durationMonths} months</p>
                  <p className="text-sm mt-2 text-slate-600 italic">"{result.reasoning}"</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RepaymentPlans;
