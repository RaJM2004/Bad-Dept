import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import api from '../lib/axios';
import toast from 'react-hot-toast';

const Agents: React.FC = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await api.get('/customers');
        setCustomers(res.data);
        if (res.data.length > 0) {
          setSelectedCustomer(res.data[0]._id);
        }
      } catch (error) {
        console.error('Failed to fetch customers:', error);
      }
    };
    fetchCustomers();
  }, []);

  const handleRunAgents = async () => {
    if (!selectedCustomer || !message.trim()) {
      toast.error('Please select a customer and enter a message.');
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const res = await api.post('/agents/log', {
        customerId: selectedCustomer,
        sender: 'Customer',
        messageType: 'Email',
        content: message
      });
      setResult(res.data.analysis);
      toast.success('Agents processed message successfully!');
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Failed to process message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 lg:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2 bg-white rounded-3xl p-8 shadow-sm">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gen-textDark">AI Agents Playground</h1>
        <p className="text-gen-textLight text-lg">
          Simulate incoming customer communications and watch the AI agents orchestrate Intent Detection, Sentiment Analysis, and Resolution Generation.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        {/* Input Section */}
        <div className="bg-white rounded-3xl p-8 shadow-sm flex flex-col gap-6">
          <div>
            <h2 className="text-2xl font-bold text-gen-textDark mb-1">Incoming Communication</h2>
            <p className="text-sm text-gen-textLight">Simulate an email or SMS from a customer</p>
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="text-sm font-bold text-gen-textDark mb-2 block">Select Customer</label>
              <select
                className="w-full p-3 rounded-xl bg-gen-bg text-gen-textDark border-none outline-none focus:ring-2 focus:ring-gen-button transition-all"
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
              >
                {customers.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} - ₹{c.outstandingAmount || 0} overdue
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-bold text-gen-textDark mb-2 block">Customer Message</label>
              <textarea
                className="w-full p-4 rounded-xl bg-gen-bg text-gen-textDark border-none outline-none focus:ring-2 focus:ring-gen-button transition-all min-h-[140px] resize-y"
                placeholder="E.g. I lost my job and cannot pay this right now. Please give me some time."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            <button
              className="w-full bg-gen-button hover:bg-gen-buttonHover text-white px-6 py-4 rounded-xl font-bold transition-all shadow-sm shadow-gen-button/30 disabled:opacity-70"
              onClick={handleRunAgents}
              disabled={loading}
            >
              {loading ? 'AI Agents Analyzing...' : 'Process with AI Agents'}
            </button>
          </div>
        </div>

        {/* Output Section */}
        <div className="bg-white rounded-3xl p-8 shadow-sm flex flex-col gap-6">
          <div>
            <h2 className="text-2xl font-bold text-gen-textDark mb-1">Agent Execution Results</h2>
            <p className="text-sm text-gen-textLight">Real-time analysis from the Groq AI models</p>
          </div>
          
          <div className="flex-1 relative">
            {!result ? (
              <div className="h-full min-h-[400px] flex items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 text-gen-textLight italic bg-slate-50">
                Workflow Idle. Select a customer and process a message to watch the AI nodes execute.
              </div>
            ) : (
              <div className="flex flex-col items-center py-4 space-y-6 animate-in slide-in-from-bottom-4 duration-700">
                
                {/* Node 1: Input */}
                <div className="w-full max-w-sm bg-slate-800 text-white rounded-xl p-4 shadow-lg border border-slate-700 relative z-10">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-2">Trigger: Incoming Message</p>
                  <p className="text-sm font-medium">"{message.substring(0, 60)}..."</p>
                </div>

                <div className="h-6 w-0.5 bg-blue-300"></div>

                {/* Node 2: Intent */}
                <div className="w-full max-w-sm bg-white rounded-xl p-4 shadow-md border-2 border-[#2e6fca] relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-[#2e6fca] text-white p-1 rounded-md text-xs">🧠</span>
                    <p className="text-xs font-bold text-[#2e6fca] uppercase">Intent Detection Node</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg">
                    <p className="text-sm font-bold text-slate-800">{result.intent.category}</p>
                    <p className="text-xs text-slate-500 font-mono">Confidence: {(result.intent.confidence * 100).toFixed(1)}%</p>
                  </div>
                </div>

                <div className="h-6 w-0.5 bg-blue-300"></div>

                {/* Split Path: Account + Sentiment */}
                <div className="w-full max-w-lg flex gap-4 relative z-10">
                  <div className="flex-1 bg-white rounded-xl p-4 shadow-md border-2 border-slate-300">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-slate-600 text-white p-1 rounded-md text-xs">🗄️</span>
                      <p className="text-xs font-bold text-slate-600 uppercase">Account Context</p>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <p className="text-sm font-bold text-slate-800">Fetched profile</p>
                    </div>
                  </div>

                  <div className={`flex-1 bg-white rounded-xl p-4 shadow-md border-2 ${result.sentiment.shouldEscalate ? 'border-red-500' : 'border-[#d95a2e]'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`${result.sentiment.shouldEscalate ? 'bg-red-500' : 'bg-[#d95a2e]'} text-white p-1 rounded-md text-xs`}>❤️</span>
                      <p className={`text-xs font-bold uppercase ${result.sentiment.shouldEscalate ? 'text-red-500' : 'text-[#d95a2e]'}`}>Sentiment Node</p>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <p className="text-sm font-bold text-slate-800">{result.sentiment.category}</p>
                      {result.sentiment.shouldEscalate && <p className="text-xs font-bold text-red-600 mt-1">🚨 ESCALATION FLAGGED</p>}
                    </div>
                  </div>
                </div>

                <div className="h-6 w-0.5 bg-blue-300"></div>

                {/* Node 4: Resolution */}
                <div className="w-full max-w-sm bg-white rounded-xl p-4 shadow-md border-2 border-[#0eb37e] relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-[#0eb37e] text-white p-1 rounded-md text-xs">⚖️</span>
                    <p className="text-xs font-bold text-[#0eb37e] uppercase">Resolution Logic Node</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg space-y-2">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold">Action</p>
                      <p className="text-sm font-bold text-slate-800">{result.resolution.recommendedAction}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold">Plan</p>
                      <p className="text-sm text-slate-700">{result.resolution.paymentSchedule}</p>
                    </div>
                  </div>
                </div>

                <div className="h-6 w-0.5 bg-blue-300"></div>

                {/* Node 5: Email Draft */}
                <div className="w-full max-w-sm bg-white rounded-xl p-4 shadow-md border-2 border-[#7c3aed] relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-[#7c3aed] text-white p-1 rounded-md text-xs">✉️</span>
                    <p className="text-xs font-bold text-[#7c3aed] uppercase">Auto-Drafting Node</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <p className="text-xs text-slate-700 italic leading-relaxed line-clamp-3">
                      "{result.response}"
                    </p>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Agents;
