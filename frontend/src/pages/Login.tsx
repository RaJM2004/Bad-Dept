import React from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import api from '../lib/axios';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const googleLogin = useGoogleLogin({
    flow: 'auth-code',
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.events',
    onSuccess: async (codeResponse) => {
      try {
        const res = await api.post('/auth/google', { code: codeResponse.code });
        login(res.data.token, res.data.user);
        toast.success('Successfully logged in!');
        navigate('/dashboard');
      } catch (error) {
        console.error(error);
        toast.error('Login failed');
      }
    },
    onError: errorResponse => console.log(errorResponse),
  });

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50">
      <Card className="w-[400px]">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Bad Debt Platform</CardTitle>
          <CardDescription>Sign in to manage debt collection</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button onClick={() => googleLogin()} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            Sign in with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
