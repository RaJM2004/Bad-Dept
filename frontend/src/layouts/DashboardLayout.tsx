import React from 'react';
import { Outlet, Navigate, NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Menu, Hourglass, Circle, User, LayoutDashboard, 
  Target, LineChart, EyeOff, ClipboardCheck, 
  Bot, Settings, LogOut, Mail, Bell
} from 'lucide-react';
import api from '../lib/axios';

const DashboardLayout: React.FC = () => {
  const { token, user, logout } = useAuth();

  if (!token) {
    return <Navigate to="/login" />;
  }

  const [escalationsCount, setEscalationsCount] = React.useState(0);

  React.useEffect(() => {
    const checkEscalations = async () => {
      try {
        const res = await api.get('/customers?status=Escalated');
        setEscalationsCount(res.data.length);
      } catch (err) {
        console.error(err);
      }
    };
    checkEscalations();
    const interval = setInterval(checkEscalations, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  const navLinks = [
    { name: 'Dashboard', icon: <LayoutDashboard size={18} />, path: '/dashboard' },
    { name: 'Inbox', icon: <Mail size={18} />, path: '/inbox' },
    { name: 'Customer Portfolios', icon: <User size={18} />, path: '/customers' },
    { name: 'AI Collection Agents', icon: <Bot size={18} />, path: '/agents' },
    { name: 'Communication Logs', icon: <Menu size={18} />, path: '/communication-logs' },
    { name: 'Repayment Plans', icon: <ClipboardCheck size={18} />, path: '/repayment-plans' },
    { name: 'Dispute Management', icon: <EyeOff size={18} />, path: '/dispute-management' },
    { name: 'Escalation Queue', icon: <Target size={18} />, path: '/escalation-queue' },
    { name: 'Analytics & Reports', icon: <LineChart size={18} />, path: '/reports' },
  ];

  return (
    <div className="flex flex-col h-screen bg-gen-bg font-sans overflow-hidden text-gen-textDark">
      
      {/* Top Navbar */}
      <header className="h-[72px] bg-gradient-to-r from-gen-topbar to-white flex items-center justify-between px-4 lg:px-6 shrink-0 relative z-20 shadow-sm w-full">
        <div className="flex items-center gap-4 lg:gap-6">
          <button className="p-2 hover:bg-black/5 rounded-md text-gen-textDark transition-colors">
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-3">
            <div className="bg-white p-1.5 rounded-md shadow-sm text-gen-button">
              <Hourglass size={20} />
            </div>
            <h1 className="text-lg lg:text-xl font-bold text-gen-textDark flex gap-2 items-center">
              Bad Debt <span className="font-normal opacity-80">Platform</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4 lg:gap-8 ml-auto">
          {/* Status */}
          <div className="hidden md:flex items-center gap-2 text-xs font-bold tracking-wider text-gen-button">
            <Circle size={10} fill="currentColor" className="text-gen-button" />
            PLATFORM STATUS: OPTIMAL
          </div>
          
          <div className="hidden md:block h-4 w-px bg-gen-textDark/20"></div>
          
          {/* Time */}
          <div className="hidden lg:block text-xs font-mono font-medium text-gen-textDark">
            {new Date().toLocaleTimeString()}
          </div>

          {/* Notifications */}
          <NavLink to="/escalation-queue" className="relative p-2 text-gen-textDark hover:bg-black/5 rounded-full transition-colors flex items-center justify-center">
            <Bell size={20} />
            {escalationsCount > 0 && (
              <span className="absolute top-1 right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-white"></span>
              </span>
            )}
          </NavLink>

          {/* Profile */}
          <div className="flex items-center gap-2 bg-gen-button/10 text-gen-button px-3 py-1.5 rounded-full text-sm font-bold">
            <User size={16} />
            {user?.name || 'Officer'}
          </div>

          {/* Logout */}
          <button 
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              window.location.href = '/login';
            }}
            className="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-full transition-colors"
          >
            LOGOUT
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden relative z-10">
        
        {/* Sidebar */}
        <aside className="w-[280px] bg-gradient-to-b from-gen-sidebar to-gen-sidebarBottom hidden lg:flex flex-col justify-between shrink-0 h-full overflow-y-auto border-r border-white/50">
          <div>
            <nav className="mt-4 flex flex-col gap-1 px-3">
              {navLinks.map((link) => (
                <NavLink 
                  key={link.name} 
                  to={link.path}
                  className={({isActive}) => `
                    flex items-center gap-4 px-4 py-3 rounded-lg text-sm font-semibold transition-colors
                    ${isActive && link.path !== '#' ? 'bg-white/30 text-gen-textDark' : 'text-gen-textDark hover:bg-gen-sidebarHover'}
                  `}
                >
                  {link.icon}
                  {link.name}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="p-3 mb-4 flex flex-col gap-1">
            <button className="flex items-center gap-4 px-4 py-3 rounded-lg text-sm font-semibold text-gen-textDark hover:bg-gen-sidebarHover transition-colors w-full text-left">
              <Settings size={18} />
              Settings
            </button>
            <button 
              onClick={logout}
              className="flex items-center gap-4 px-4 py-3 rounded-lg text-sm font-semibold text-gen-textDark hover:bg-gen-sidebarHover transition-colors w-full text-left"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </aside>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-[1400px] mx-auto h-full">
            <Outlet />
          </div>
        </main>
      </div>
      
    </div>
  );
};

export default DashboardLayout;
