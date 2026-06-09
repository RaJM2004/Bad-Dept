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
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.events',
    onSuccess: async (codeResponse) => {
      setLoading(true);
      try {
        const res = await api.post('/auth/google', { code: codeResponse.code });
        login(res.data.token, res.data.user);
        toast.success('Successfully logged in!');
        navigate('/dashboard');
      } catch (error) {
        console.error(error);
        toast.error('Google login failed');
      } finally {
        setLoading(false);
      }
    },
    onError: errorResponse => {
      console.log(errorResponse);
      toast.error('Google login cancelled or failed');
    },
  });

  const handleLocalLogin = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      login(res.data.token, res.data.user);
      toast.success(`Logged in as ${res.data.user.role}!`);
      navigate('/dashboard');
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.detail || 'Local login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50">
      <Card className="w-[420px] shadow-xl border border-slate-100 rounded-3xl overflow-hidden bg-white">
        <CardHeader className="text-center pb-4 pt-8">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-3">
            <Shield className="w-6 h-6 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-black text-slate-800">Bad Debt Platform</CardTitle>
          <CardDescription className="text-slate-500 font-medium mt-1">Sign in to manage debt collection</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 px-8 pb-8">
          <Button
            onClick={() => googleLogin()}
            disabled={loading}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-100 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            Sign in with Google
          </Button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-4 text-xs font-bold text-slate-400 uppercase tracking-wider">or local developer bypass</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => handleLocalLogin('admin@example.com', 'admin123')}
              className="w-full h-11 border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 text-slate-700 hover:text-blue-700 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all"
            >
              <Shield className="w-4 h-4 text-blue-500" />
              Sign in as Admin
            </Button>
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => handleLocalLogin('officer@example.com', 'officer123')}
              className="w-full h-11 border-slate-200 hover:border-purple-500 hover:bg-purple-50/50 text-slate-700 hover:text-purple-700 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all"
            >
              <User className="w-4 h-4 text-purple-500" />
              Sign in as Officer
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
