import React, { useEffect, useState } from 'react';
import api from '../lib/axios';
import toast from 'react-hot-toast';

const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
    fetchCustomers();
  }, []);

  const [sheetInput, setSheetInput] = useState('');

  const handleImport = async () => {
    try {
      setLoading(true);
      
      // Extract spreadsheet ID if they pasted a full URL
      let spreadsheetId = sheetInput.trim();
      if (spreadsheetId.includes('/d/')) {
        const matches = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (matches && matches[1]) {
          spreadsheetId = matches[1];
        }
      }

      const res = await api.post('/sheets/import', { spreadsheetId });
      if (res.data.isRealImport) {
        toast.success(`Successfully imported ${res.data.importedCount} records from your Google Sheet!`);
      } else {
        toast.success(`Successfully loaded ${res.data.importedCount} test records into the platform!`);
      }
      // Re-fetch customers
      const refreshRes = await api.get('/customers');
      setCustomers(refreshRes.data);
      setSheetInput('');
    } catch (err: any) {
      console.error(err);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Failed to sync with Google Sheets. Please check permissions or ID.';
      toast.error(errorMessage, { duration: 6000 });
    } finally {
      setLoading(false);
    }
  };

  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [resolution, setResolution] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const handleGenerateResolution = async (customer: any) => {
    setSelectedCustomer(customer);
    setAnalyzing(true);
    setResolution(null);
    try {
      // Step 1: Run Resolution Agent
      const res = await api.post('/agents/resolution', {
        customerId: customer._id,
        customerIntent: 'Payment Plan Request', // Simulating an intent for the demo
        customerSentiment: 'Neutral'
      });
      setResolution(res.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate AI resolution');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSendPaymentEmail = async () => {
    if (!selectedCustomer || !resolution) return;
    setSendingEmail(true);
    try {
      // Generate highly persuasive email using Groq AI
      const emailRes = await api.post('/agents/generate-email', {
        customerId: selectedCustomer._id,
        recommendedAction: resolution.recommendedAction,
        paymentSchedule: resolution.paymentSchedule,
        riskScore: resolution.riskScore,
      });

      const aiGeneratedBody = emailRes.data.emailBody;

      // Send the email via Gmail API
      const res = await api.post('/gmail/send', {
        customerId: selectedCustomer._id,
        subject: `Important: Action Required for Outstanding Balance (₹${selectedCustomer.outstandingAmount.toLocaleString()})`,
        body: aiGeneratedBody,
        type: 'Payment Resolution'
      });
      
      if (res.data.isRealSent) {
        toast.success(`Real email sent successfully to ${selectedCustomer.email} via Gmail API!`);
      } else {
        toast.success('Simulated Email Sent! (Enable Gmail API in Google Cloud to send real emails)');
      }
      setSelectedCustomer(null);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to send email. Please check your Gmail API permissions.');
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 relative">
      <div className="bg-white rounded-3xl p-8 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-gen-textDark">Customer Portfolios</h1>
          <p className="text-gen-textLight">Manage accounts, view payment plans, and track collection progress.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <input 
            type="text" 
            placeholder="Paste Google Sheet URL..." 
            className="flex-1 md:w-64 px-4 py-3 rounded-xl bg-gen-bg border-none focus:ring-2 focus:ring-gen-button text-sm"
            value={sheetInput}
            onChange={(e) => setSheetInput(e.target.value)}
          />
          <button 
            onClick={handleImport}
            disabled={loading || !sheetInput.trim()}
            className="bg-gen-button hover:bg-gen-buttonHover text-white px-6 py-3 rounded-xl font-bold transition-all shadow-sm shadow-gen-button/30 disabled:opacity-70 flex items-center shrink-0"
          >
            {loading ? 'Syncing...' : 'Sync Sheet'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-8 shadow-sm">
        {loading ? (
          <p className="text-gen-textLight">Loading customers...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b text-sm font-bold text-gen-textLight">
                  <th className="pb-4 pr-4">Name</th>
                  <th className="pb-4 px-4">Email</th>
                  <th className="pb-4 px-4">Status</th>
                  <th className="pb-4 px-4">Overdue Days</th>
                  <th className="pb-4 px-4 text-right">Outstanding Amount</th>
                  <th className="pb-4 pl-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {customers.map((c) => (
                  <tr key={c._id} className="border-b last:border-0 hover:bg-gen-bg/50 transition-colors">
                    <td className="py-4 pr-4 font-semibold text-gen-textDark">{c.name}</td>
                    <td className="py-4 px-4 text-gen-textLight">{c.email}</td>
                    <td className="py-4 px-4">
                      <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 font-semibold text-xs uppercase">
                        {c.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-mono text-orange-600">
                      {c.daysOverdue || 0} days
                    </td>
                    <td className="py-4 px-4 text-right font-bold text-gen-button">
                      ₹{c.outstandingAmount?.toLocaleString() || '0.00'}
                    </td>
                    <td className="py-4 pl-4 text-center">
                      <button 
                        onClick={() => handleGenerateResolution(c)}
                        className="bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-lg font-bold text-xs transition-colors"
                      >
                        AI Resolution
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {customers.length === 0 && (
              <p className="text-center py-8 text-gen-textLight">No customers found.</p>
            )}
          </div>
        )}
      </div>

      {/* AI Resolution Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-gen-textDark">AI Collection Strategy</h2>
              <button onClick={() => setSelectedCustomer(null)} className="text-slate-400 hover:text-slate-600 font-bold p-2">✕</button>
            </div>
            
            <div className="p-8">
              <div className="mb-6 pb-6 border-b flex justify-between items-end">
                <div>
                  <p className="text-sm text-gen-textLight mb-1">Customer</p>
                  <p className="font-bold text-lg">{selectedCustomer.name}</p>
                  <p className="text-sm text-slate-500">{selectedCustomer.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gen-textLight mb-1">Outstanding Debt</p>
                  <p className="font-bold text-2xl text-gen-button">₹{selectedCustomer.outstandingAmount.toLocaleString()}</p>
                  <p className="text-sm text-orange-600 font-mono">{selectedCustomer.daysOverdue} Days Overdue</p>
                </div>
              </div>

              {analyzing ? (
                <div className="py-12 flex flex-col items-center justify-center gap-4">
                  <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                  <p className="text-slate-600 font-medium">Groq AI is analyzing account history and generating the optimal recovery plan...</p>
                </div>
              ) : resolution ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                      <p className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-2">Recommended Strategy</p>
                      <p className="font-bold text-lg text-slate-800">{resolution.recommendedAction}</p>
                    </div>
                    <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100">
                      <p className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-2">Account Risk Score</p>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-orange-500" style={{ width: `${resolution.riskScore}%` }}></div>
                        </div>
                        <span className="font-bold font-mono">{resolution.riskScore}/100</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-5 rounded-2xl border">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Payment Schedule Details</p>
                    <p className="font-medium text-slate-800">{resolution.paymentSchedule}</p>
                  </div>
                  
                  <div className="bg-slate-50 p-5 rounded-2xl border">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">AI Reasoning</p>
                    <p className="text-sm text-slate-600 leading-relaxed">{resolution.reasoning}</p>
                  </div>

                  <div className="pt-6 mt-6 border-t flex justify-end gap-3">
                    <button 
                      onClick={() => setSelectedCustomer(null)}
                      className="px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSendPaymentEmail}
                      disabled={sendingEmail}
                      className="bg-gen-button hover:bg-gen-buttonHover text-white px-8 py-3 rounded-xl font-bold transition-all shadow-sm flex items-center gap-2"
                    >
                      {sendingEmail ? 'Sending...' : 'Email Payment Link'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
