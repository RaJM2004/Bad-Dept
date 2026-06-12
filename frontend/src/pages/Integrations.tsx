import React, { useState, useEffect } from 'react';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import { CreditCard, Save, CheckCircle2, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Integrations: React.FC = () => {
  const { user } = useAuth();
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [razorpayKeySecret, setRazorpayKeySecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasIntegration, setHasIntegration] = useState(false);

  useEffect(() => {
    // Fetch profile to see if keys are already set
    api.get('/auth/profile').then(res => {
      setHasIntegration(res.data.has_razorpay_integration);
    }).catch(console.error);
  }, []);

  const handleSaveKeys = async () => {
    if (!razorpayKeyId || !razorpayKeySecret) {
      return toast.error('Both Key ID and Key Secret are required.');
    }
    setLoading(true);
    try {
      await api.post('/auth/integrations/razorpay', {
        razorpay_key_id: razorpayKeyId,
        razorpay_key_secret: razorpayKeySecret
      });
      toast.success('Razorpay keys securely saved!');
      setHasIntegration(true);
      setRazorpayKeySecret(''); // clear for security
    } catch (err) {
      console.error(err);
      toast.error('Failed to save keys.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl">
      <div className="bg-white rounded-3xl p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-gen-textDark mb-2">Integrations & Settings</h1>
        <p className="text-gen-textLight">Manage your third-party connections and API keys for automated AI workflows.</p>
      </div>

      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gen-textDark flex items-center gap-2">
              Razorpay Payment Gateway
              {hasIntegration && (
                <span className="flex items-center gap-1 text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  <CheckCircle2 className="w-3 h-3" /> Connected
                </span>
              )}
            </h2>
            <p className="text-sm text-gen-textLight mt-1">Connect your Razorpay account to allow the AI to automatically generate secure payment links for your customers.</p>
          </div>
        </div>

        <div className="space-y-5 bg-slate-50 p-6 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-2 text-sm text-slate-500 font-medium mb-2">
            <Lock className="w-4 h-4" />
            Your API keys are encrypted before being stored in the database.
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Razorpay Key ID</label>
            <input 
              type="text" 
              value={razorpayKeyId}
              onChange={(e) => setRazorpayKeyId(e.target.value)}
              placeholder="rzp_test_..."
              className="w-full px-4 py-3 rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 outline-none transition-all shadow-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Razorpay Key Secret</label>
            <input 
              type="password" 
              value={razorpayKeySecret}
              onChange={(e) => setRazorpayKeySecret(e.target.value)}
              placeholder="••••••••••••••••"
              className="w-full px-4 py-3 rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 outline-none transition-all shadow-sm"
            />
          </div>

          <div className="pt-2">
            <button 
              onClick={handleSaveKeys}
              disabled={loading || !razorpayKeyId || !razorpayKeySecret}
              className="bg-gen-button hover:bg-gen-buttonHover text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              {hasIntegration ? 'Update API Keys' : 'Save API Keys'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Integrations;
