import React, { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import api from '../lib/axios';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, User, Loader2 } from 'lucide-react';

const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const googleLogin = useGoogleLogin({
    flow: 'auth-code',
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/presentations',
    onSuccess: async (codeResponse) => {
      setLoading(true);
      try {
        const res = await api.post('/auth/google', { code: codeResponse.code });
        login(res.data.token, res.data.user);
        toast.success('Successfully logged in!');
        navigate('/dashboard');
      } catch (error: any) {
        console.error("Google Auth Backend Error:", error.response?.data);
        const detail = error.response?.data?.detail || 'Google login failed';
        toast.error(detail);
      } finally {
        setLoading(false);
      }
    },
    onError: errorResponse => {
      console.log(errorResponse);
      toast.error('Google login cancelled or failed');
    },
  });

  return (
    <div className="flex min-h-screen w-full bg-white font-sans selection:bg-blue-200">
      
      {/* Left Side - Branding & Visuals */}
      <div className="hidden lg:flex w-1/2 bg-slate-950 flex-col justify-between relative overflow-hidden">
        {/* Abstract Background Elements */}
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full bg-blue-600/20 blur-[120px] mix-blend-screen pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-600/20 blur-[120px] mix-blend-screen pointer-events-none" />
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none"></div>

        <div className="p-12 relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-black text-xl tracking-tight">GenQuantaa AI</span>
        </div>

        <div className="p-12 pb-24 relative z-10">
          <h1 className="text-5xl font-bold text-white leading-[1.1] tracking-tight mb-6">
            Autonomous<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">
              Debt Recovery.
            </span>
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed max-w-md font-medium">
            Deploy intelligent agents that automatically analyze intent, negotiate settlements, and resolve outstanding balances faster than ever before.
          </p>
          
          {/* Feature tags */}
          <div className="flex flex-wrap gap-3 mt-10">
            <span className="px-4 py-2 rounded-full border border-slate-800 bg-slate-900/50 text-slate-300 text-sm font-semibold backdrop-blur-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span> 70B Parameter LLMs
            </span>
            <span className="px-4 py-2 rounded-full border border-slate-800 bg-slate-900/50 text-slate-300 text-sm font-semibold backdrop-blur-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Automated Escalations
            </span>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 bg-slate-50 lg:bg-white relative">
        <div className="w-full max-w-[420px] space-y-8">
          
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Welcome back</h2>
            <p className="text-slate-500 font-medium mt-2">Sign in to your dashboard to manage collections.</p>
          </div>

          <div className="bg-white lg:bg-transparent p-8 lg:p-0 rounded-3xl shadow-xl lg:shadow-none border border-slate-100 lg:border-none">
            
            <div className="space-y-4">
              <Button
                onClick={() => googleLogin()}
                disabled={loading}
                className="w-full h-14 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-sm hover:shadow disabled:opacity-50 relative overflow-hidden group"
              >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-50/0 via-blue-50/50 to-blue-50/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                <span className="text-[15px]">Continue with Google</span>
              </Button>
            </div>

            <div className="mt-8 flex items-center gap-3">
              <Shield className="w-4 h-4 text-slate-400" />
              <p className="text-xs text-slate-500 font-medium">Enterprise-grade security. By continuing, you agree to our Terms of Service.</p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
