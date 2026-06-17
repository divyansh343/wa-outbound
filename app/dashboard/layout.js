'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Sidebar from '@/components/Sidebar';
import { io } from 'socket.io-client';
import { Send, User, MessageCircle } from 'lucide-react';

export default function DashboardLayout({ children }) {
  const { data: session, status } = useSession();
  const [activeLeadChat, setActiveLeadChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotificationPopup, setShowNotificationPopup] = useState(false);
  const [latestNotification, setLatestNotification] = useState(null);
  const messagesEndRef = useRef(null);

  // Initialize socket communication for real-time notification alerts and manual lead messaging
  useEffect(() => {
    if (session?.user?.orgId) {
      const socketUrl = process.env.NEXT_PUBLIC_WS_URL || window.location.origin;
      const newSocket = io(socketUrl);
      setSocket(newSocket);

      newSocket.emit('join_org', session.user.orgId);

      newSocket.on('activity_notification', (data) => {
        setNotifications((prev) => [data, ...prev]);
        setLatestNotification(data);
        setShowNotificationPopup(true);
        setTimeout(() => setShowNotificationPopup(false), 5000);
      });

      // Catch custom client dispatch triggers to pop manual chat drawer
      const handleOpenChat = (e) => {
        setActiveLeadChat(e.detail);
      };
      window.addEventListener('open-direct-chat', handleOpenChat);

      return () => {
        newSocket.disconnect();
        window.removeEventListener('open-direct-chat', handleOpenChat);
      };
    }
  }, [session]);

  // Handle active lead chat messages tracking
  useEffect(() => {
    if (activeLeadChat) {
      fetchMessages();
      const interval = setInterval(fetchMessages, 4000); // Poll messages or handle via socket trigger
      return () => clearInterval(interval);
    }
  }, [activeLeadChat]);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    if (!activeLeadChat) return;
    try {
      const res = await fetch(`/api/messages?leadId=${activeLeadChat.id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeLeadChat) return;

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: activeLeadChat.id,
          waAccountId: activeLeadChat.assigned_wa_account_id,
          content: newMessage,
        }),
      });

      if (res.ok) {
        const msg = await res.json();
        setMessages((prev) => [...prev, msg]);
        setNewMessage('');
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to send message');
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Loading workspace...
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <main className="flex-1 overflow-y-auto p-8 relative z-0">{children}</main>

        {/* Global Realtime Toast Notification Alert */}
        {showNotificationPopup && latestNotification && (
          <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-indigo-500/30 text-white rounded-xl shadow-2xl p-4 max-w-sm flex items-start space-x-3 animate-in slide-in-from-bottom duration-300">
            <MessageCircle className="h-6 w-6 text-indigo-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-sm">System Outbound Notification</h4>
              <p className="text-xs text-slate-300 mt-1">{latestNotification.message}</p>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Floating Manual Direct Message Panel */}
      {activeLeadChat && (
        <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col h-full shadow-2xl relative z-10">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <User className="h-5 w-5 text-indigo-400" />
              <div>
                <p className="text-sm font-semibold truncate w-40">{activeLeadChat.name}</p>
                <p className="text-xs text-green-400">Chat Session</p>
              </div>
            </div>
            <button
              onClick={() => setActiveLeadChat(null)}
              className="text-slate-400 hover:text-white text-xs font-semibold"
            >
              Close
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <p className="text-xs text-slate-500 text-center mt-12">
                No messages logged for this lead
              </p>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col max-w-[85%] rounded-xl p-2.5 text-xs ${
                    msg.direction === 'outbound'
                      ? 'bg-indigo-600 ml-auto text-white'
                      : 'bg-slate-800 mr-auto text-slate-200'
                  }`}
                >
                  <p>{msg.content}</p>
                  <span className="text-[10px] text-slate-400 self-end mt-1">
                    {new Date(msg.sent_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 border-t border-slate-800 flex items-center space-x-2"
          >
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Send direct reply..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
