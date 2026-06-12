import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Toaster } from 'react-hot-toast';
import { GoogleOAuthProvider } from '@react-oauth/google';
import Login from './pages/Login';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Agents from './pages/Agents';
import Customers from './pages/Customers';
import ComingSoon from './pages/ComingSoon';
import Inbox from './pages/Inbox';
import EscalationQueue from './pages/EscalationQueue';
import CommunicationLogs from './pages/CommunicationLogs';
import Reports from './pages/Reports';
import RepaymentPlans from './pages/RepaymentPlans';
import DisputeManagement from './pages/DisputeManagement';
import Integrations from './pages/Integrations';

function App() {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || 'dummy-client-id'}>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<DashboardLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="agents" element={<Agents />} />
              <Route path="inbox" element={<Inbox />} />
              <Route path="customers" element={<Customers />} />
              <Route path="escalation-queue" element={<EscalationQueue />} />
              <Route path="communication-logs" element={<CommunicationLogs />} />
              <Route path="repayment-plans" element={<RepaymentPlans />} />
              <Route path="dispute-management" element={<DisputeManagement />} />
              <Route path="reports" element={<Reports />} />
              <Route path="integrations" element={<Integrations />} />
              <Route path="coming-soon" element={<ComingSoon />} />
            </Route>
          </Routes>
        </Router>
        <Toaster position="top-right" />
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
