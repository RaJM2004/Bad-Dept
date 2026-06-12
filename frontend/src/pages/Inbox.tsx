import React, { useState, useEffect } from 'react';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import { Mail, RefreshCw, AlertCircle, CheckCircle2, Send, AlertOctagon } from 'lucide-react';

const Inbox = () => {
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzingEmailId, setAnalyzingEmailId] = useState<string | null>(null);
  const [activeFolder, setActiveFolder] = useState<string>('INBOX');

  const fetchInbox = async (folder: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/gmail/inbox?label=${folder}`);
      setEmails(res.data.emails || []);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to fetch emails.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInbox(activeFolder);
  }, [activeFolder]);

  const handleAnalyzeEmail = async (email: any) => {
    setAnalyzingEmailId(email.id);
    try {
      // Find the email address from the "From" header (e.g. "John Doe <john@example.com>")
      const emailMatch = email.from.match(/<(.+)>/);
      const senderEmail = emailMatch ? emailMatch[1] : email.from;

      // Get a valid customer ID
      const custRes = await api.get('/customers');
      // Try to match the customer by email or name, fallback to the first one for demo purposes
      const matchedCustomer = custRes.data.find((c: any) => 
        (c.email && c.email.toLowerCase() === senderEmail.toLowerCase()) || 
        email.from.toLowerCase().includes(c.name.toLowerCase())
      );
      const validCustomerId = matchedCustomer ? matchedCustomer._id : custRes.data[0]?._id;

      // We will hit the communication log processing endpoint
      // This will automatically run Intent, Sentiment, and Resolution agents
      const res = await api.post('/agents/log', {
        customerId: validCustomerId,
        sender: senderEmail,
        messageType: 'Email',
        content: email.subject + " " + email.snippet
      });
      
      toast.success('AI successfully analyzed email and prepared resolution plan!');
    } catch (err) {
      console.error(err);
      toast.error('AI Analysis requires a valid registered customer email in the database to link to.');
    } finally {
      setAnalyzingEmailId(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white rounded-3xl p-8 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-gen-textDark flex items-center gap-3">
            <Mail className="w-8 h-8 text-blue-500" />
            AI Collection Inbox
          </h1>
          <p className="text-gen-textLight">Monitor incoming emails and let AI analyze intent, sentiment, and risk.</p>
        </div>
        <button 
          onClick={() => fetchInbox(activeFolder)}
          disabled={loading}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Inbox
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <div className="w-full lg:w-64 shrink-0 flex flex-col gap-2">
          <button
            onClick={() => setActiveFolder('INBOX')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeFolder === 'INBOX' ? 'bg-blue-50 text-blue-700' : 'text-gen-textLight hover:bg-slate-50'}`}
          >
            <Mail className="w-5 h-5" />
            Inbox
          </button>
          <button
            onClick={() => setActiveFolder('SENT')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeFolder === 'SENT' ? 'bg-blue-50 text-blue-700' : 'text-gen-textLight hover:bg-slate-50'}`}
          >
            <Send className="w-5 h-5" />
            Sent
          </button>
          <button
            onClick={() => setActiveFolder('SPAM')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeFolder === 'SPAM' ? 'bg-blue-50 text-blue-700' : 'text-gen-textLight hover:bg-slate-50'}`}
          >
            <AlertOctagon className="w-5 h-5" />
            Spam
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 bg-white rounded-3xl p-8 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-4" />
              <p className="text-slate-500">Syncing with {activeFolder}...</p>
            </div>
          ) : emails.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-10 h-10 text-slate-300" />
              </div>
              <p className="text-lg font-bold text-gen-textDark mb-2">Folder is empty</p>
              <p className="text-gen-textLight">No emails found in {activeFolder}.</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {/* Header Row */}
              <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b text-xs font-bold text-slate-400 uppercase tracking-wider">
                <div className="col-span-3">Sender</div>
                <div className="col-span-6">Subject & Snippet</div>
                <div className="col-span-2 text-right">Date</div>
                <div className="col-span-1 text-center">Action</div>
              </div>
              
              <div className="divide-y divide-slate-100">
                {emails.map((email) => {
                  // Extract just the name from "Name <email@domain.com>"
                  const nameMatch = email.from.match(/^([^<]+)/);
                  const senderName = nameMatch ? nameMatch[1].trim() : email.from;
                  const initial = senderName.charAt(0).toUpperCase();
                  const isExpanded = analyzingEmailId === email.id + '_expanded';

                  return (
                    <div key={email.id} className="flex flex-col">
                      <div 
                        onClick={() => setAnalyzingEmailId(isExpanded ? null : email.id + '_expanded')}
                        className={`group grid grid-cols-12 gap-4 items-center px-6 py-4 transition-all hover:bg-gen-bg/50 cursor-pointer ${email.isUnread ? 'bg-blue-50/20' : 'bg-white'}`}
                      >
                        {/* Sender Info */}
                        <div className="col-span-3 flex items-center gap-3 overflow-hidden">
                          <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-bold text-sm ${email.isUnread ? 'bg-gen-button text-white' : 'bg-gen-bg text-gen-textLight'}`}>
                            {initial}
                          </div>
                          <span className={`truncate text-sm ${email.isUnread ? 'font-bold text-gen-textDark' : 'font-medium text-gen-textDark'}`}>
                            {senderName}
                          </span>
                        </div>

                        {/* Subject & Snippet */}
                        <div className="col-span-6 truncate">
                          <span className={`text-sm mr-2 ${email.isUnread ? 'font-bold text-gen-textDark' : 'font-medium text-gen-textDark'}`}>
                            {email.subject || '(No Subject)'}
                          </span>
                          <span className="text-sm text-gen-textLight truncate">
                            - {email.snippet.replace(/&#39;/g, "'").replace(/&quot;/g, '"')}...
                          </span>
                        </div>

                        {/* Date */}
                        <div className="col-span-2 text-right text-xs font-medium text-gen-textLight">
                          {new Date(email.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>

                        {/* Action */}
                        <div className="col-span-1 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          {activeFolder === 'INBOX' && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleAnalyzeEmail(email); }}
                              disabled={analyzingEmailId === email.id}
                              className="flex items-center justify-center w-8 h-8 bg-blue-50 text-gen-button hover:bg-gen-button hover:text-white rounded-full transition-colors disabled:opacity-50"
                              title="Run AI Analysis"
                            >
                              {analyzingEmailId === email.id ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded Body */}
                      {isExpanded && (
                        <div className="col-span-12 px-6 py-6 bg-slate-50 border-t border-slate-100 text-sm text-gen-textDark leading-relaxed">
                          <div className="mb-4">
                            <p className="font-bold text-lg mb-1">{email.subject}</p>
                            <p className="text-gen-textLight text-xs">&lt;{email.from}&gt;</p>
                          </div>
                          <div 
                            className="prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: email.body || email.snippet }} 
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Inbox;
