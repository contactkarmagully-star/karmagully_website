import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, 
  Send, 
  Package, 
  Truck, 
  RefreshCcw, 
  Search, 
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  User,
  Clock,
  ExternalLink
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { collection, doc, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { createWebsiteTicket, sendMessage, subscribeToMessages, SupportTicket, SupportMessage } from '../services/supportService';
import { getSettings, AppSettings } from '../services/settingsService';

const CATEGORIES = [
  { id: 'Product Inquiry', icon: Package, label: 'Product Inquiry', color: 'bg-blue-500' },
  { id: 'Shipping', icon: Truck, label: 'Shipping & Delivery', color: 'bg-amber-500' },
  { id: 'Refund', icon: RefreshCcw, label: 'Return & Refund', color: 'bg-emerald-500' },
  { id: 'Order Status', icon: Search, label: 'Order Status', color: 'bg-purple-500' },
  { id: 'Other', icon: AlertCircle, label: 'Other Issue', color: 'bg-pink-500' }
];

export default function Support() {
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newTicketData, setNewTicketData] = useState({
    category: '',
    message: '',
    linkedOrderId: ''
  });
  const [loading, setLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [userTickets, setUserTickets] = useState<SupportTicket[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auth & Session Recovery & User Tickets Sync
  useEffect(() => {
    getSettings().then(setSettings);

    const unsub = auth.onAuthStateChanged((user) => {
      setAuthReady(true);
      const savedTicketId = localStorage.getItem('activeSupportTicketId');
      if (savedTicketId) {
        setActiveTicket({ ticketId: savedTicketId } as any);
      }

      if (user?.email) {
        const q = query(
          collection(db, 'tickets'),
          where('userEmail', '==', user.email.toLowerCase().trim()),
          where('source', '==', 'website'),
          orderBy('updatedAt', 'desc')
        );
        return onSnapshot(q, (snap) => {
          setUserTickets(snap.docs.map(d => ({ id: d.id, ...d.data() }) as any));
        }, (err) => {
          console.error("User tickets sync error:", err);
        });
      } else {
        setUserTickets([]);
      }
    });
    return () => unsub();
  }, []);

  // Sync Ticket Status
  useEffect(() => {
    if (activeTicket?.ticketId) {
      const unsub = onSnapshot(doc(db, 'tickets', activeTicket.ticketId), (snap) => {
        if (snap.exists()) {
          const data = snap.data() as SupportTicket;
          setActiveTicket(data);
          // If closed, maybe clear from localStorage after some time or keep it so they can see history?
          // For now, let's keep it so they can read.
        } else if (localStorage.getItem('activeSupportTicketId') === activeTicket.ticketId) {
           localStorage.removeItem('activeSupportTicketId');
           setActiveTicket(null);
        }
      }, (err) => {
        console.error("Ticket status sync error:", err);
      });
      return () => unsub();
    }
  }, [activeTicket?.ticketId]);

  // Sync Messages
  useEffect(() => {
    if (activeTicket?.ticketId) {
      const unsubscribe = subscribeToMessages(activeTicket.ticketId, (msgs) => {
        setMessages(msgs);
        setTimeout(() => {
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }, 100);
      });
      return () => unsubscribe();
    }
  }, [activeTicket?.ticketId]);

  const handleCreateTicket = async () => {
    if (!newTicketData.category || !newTicketData.message) return;
    setLoading(true);
    try {
      const user = auth.currentUser;
      const ticketId = await createWebsiteTicket({
        userId: user?.uid || 'guest',
        username: user?.displayName || 'User',
        userEmail: user?.email || '',
        category: newTicketData.category,
        message: newTicketData.message,
        linkedOrderId: newTicketData.linkedOrderId || undefined
      });
      
      localStorage.setItem('activeSupportTicketId', ticketId);
      
      // The status sync effect will take care of setting the activeTicket object
      setActiveTicket({ ticketId } as any);
      setIsCreating(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseChat = () => {
    localStorage.removeItem('activeSupportTicketId');
    setActiveTicket(null);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeTicket) return;
    const user = auth.currentUser;
    await sendMessage(activeTicket.ticketId, inputText, user?.uid || 'guest', user?.displayName || 'User', 'user');
    setInputText('');
  };

  return (
    <div className="min-h-screen bg-black text-white pt-24 pb-12 px-4">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-black uppercase tracking-tighter italic mb-2">Support Center</h1>
          <p className="text-white/40 font-medium">How can we help you today?</p>
        </header>

        {!activeTicket && !isCreating ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                onClick={() => setIsCreating(true)}
                className="p-8 bg-zinc-900 border border-white/5 rounded-2xl text-left group hover:border-purple-500/50 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <MessageSquare className="text-purple-500" />
                </div>
                <h3 className="text-xl font-bold mb-2">Start a conversation</h3>
                <p className="text-white/40 text-sm">Create a new ticket and chat with our team.</p>
              </motion.button>

              <div className="p-8 bg-zinc-900 border border-white/5 rounded-2xl">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-6 text-blue-500">
                  <Clock className="" />
                </div>
                <h3 className="text-xl font-bold mb-2">Telegram Customer Support Bot</h3>
                <p className="text-white/40 text-sm">Check status of your previous inquiries on Telegram.</p>
                {settings?.supportBotUrl ? (
                  <a 
                    href={settings.supportBotUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 mt-4 text-xs font-bold uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Open Bot <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-white/10 italic">Bot Configuration Missing</p>
                )}
              </div>
            </div>

            {userTickets.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 ml-2">Your Website Conversations</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {userTickets.map(ticket => (
                    <button
                      key={ticket.ticketId}
                      onClick={() => {
                        localStorage.setItem('activeSupportTicketId', ticket.ticketId);
                        setActiveTicket(ticket);
                      }}
                      className="p-5 bg-zinc-900/50 border border-white/5 rounded-2xl text-left hover:border-purple-500/30 transition-all flex justify-between items-center group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold uppercase tracking-tight">{ticket.category}</p>
                          <span className="text-[8px] px-1 py-0.5 rounded bg-white/5 text-white/40 font-bold">{ticket.ticketId}</span>
                        </div>
                        <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">
                          Status: <span className={
                            ticket.status === 'pending' ? 'text-amber-500' :
                            ticket.status === 'accepted' ? 'text-emerald-500' :
                            'text-white/20'
                          }>{ticket.status}</span>
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/10 group-hover:text-purple-500 group-hover:translate-x-1 transition-all" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : isCreating ? (
          <div className="bg-zinc-900 border border-white/5 rounded-3xl p-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black uppercase italic tracking-tighter">New Inquiry</h2>
              <button onClick={() => setIsCreating(false)} className="text-white/20 hover:text-white">Cancel</button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-3">Select Category</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setNewTicketData(p => ({ ...p, category: cat.id }))}
                      className={`flex flex-col items-center p-4 rounded-2xl border transition-all ${
                        newTicketData.category === cat.id 
                        ? 'border-purple-500 bg-purple-500/10' 
                        : 'border-white/5 bg-black/20 hover:border-white/20'
                      }`}
                    >
                      <cat.icon className={`w-6 h-6 mb-2 ${newTicketData.category === cat.id ? 'text-purple-500' : 'text-white/40'}`} />
                      <span className="text-[10px] font-bold text-center leading-tight uppercase tracking-widest">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-3">Order ID (Optional)</label>
                <input 
                  type="text"
                  placeholder="KG26-XXXXXX"
                  value={newTicketData.linkedOrderId}
                  onChange={e => setNewTicketData(p => ({ ...p, linkedOrderId: e.target.value.toUpperCase() }))}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 font-mono text-sm focus:border-purple-500 transition-colors outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-3">Your Message</label>
                <textarea 
                  rows={4}
                  placeholder="Describe your issue in detail..."
                  value={newTicketData.message}
                  onChange={e => setNewTicketData(p => ({ ...p, message: e.target.value }))}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-4 text-sm focus:border-purple-500 transition-colors outline-none resize-none"
                />
              </div>

              <button
                disabled={loading || !newTicketData.category || !newTicketData.message}
                onClick={handleCreateTicket}
                className="w-full py-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-black uppercase tracking-widest italic transition-all flex items-center justify-center gap-3"
              >
                {loading ? 'Creating...' : 'Initialize Support'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-white/5 rounded-3xl overflow-hidden flex flex-col h-[70vh] md:h-[600px]">
            {/* Chat Header */}
            <div className="p-4 sm:p-6 border-b border-white/5 bg-black/20 flex items-center justify-between">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-purple-500" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold leading-none text-sm sm:text-base truncate">{activeTicket.category}</h3>
                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/10 text-white/60 font-medium uppercase tracking-widest shrink-0">{activeTicket.ticketId.substring(0,6)}</span>
                  </div>
                  <p className="text-[9px] sm:text-[10px] text-white/40 mt-1 uppercase font-bold tracking-widest">
                    Status: <span className={`${
                      activeTicket.status === 'pending' ? 'text-amber-500' :
                      activeTicket.status === 'accepted' ? 'text-emerald-500' :
                      activeTicket.status === 'closed' ? 'text-white/20' : 'text-pink-500'
                    }`}>{activeTicket.status}</span>
                  </p>
                </div>
              </div>
              <button 
                onClick={handleCloseChat}
                className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-white"
              >
                Exit
              </button>
            </div>

            {/* Messages Area */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-gradient-to-b from-black/20 to-transparent custom-scrollbar"
            >
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center opacity-20">
                  <MessageSquare className="w-12 h-12 mb-4" />
                  <p className="text-sm">Connecting to support team...</p>
                </div>
              )}
              {messages.map((msg, idx) => {
                const isSystem = msg.senderId === 'system';
                if (isSystem) {
                  return (
                    <div key={msg.id || idx} className="flex justify-center my-6">
                       <div className="bg-white/5 border border-white/5 rounded-full px-5 py-2 flex items-center gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{msg.text}</span>
                       </div>
                    </div>
                  );
                }
                return (
                  <div 
                    key={msg.id || idx}
                    className={`flex ${msg.senderType === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] sm:max-w-[80%] ${msg.senderType === 'user' ? 'order-2' : ''}`}>
                      <div className={`p-3 sm:p-4 rounded-2xl text-xs sm:text-sm ${
                        msg.senderType === 'user' 
                        ? 'bg-purple-600 text-white rounded-tr-none shadow-lg shadow-purple-500/10' 
                        : 'bg-zinc-800 text-white/90 rounded-tl-none border border-white/5'
                      }`}>
                        {msg.text}
                      </div>
                      <p className={`text-[8px] sm:text-[9px] mt-1.5 sm:mt-2 uppercase font-bold tracking-widest text-white/20 ${msg.senderType === 'user' ? 'text-right' : 'text-left'}`}>
                        {msg.senderType === 'admin' ? 'Support' : 'You'} • {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Message Input */}
            <div className="p-4 bg-black/40 border-t border-white/5">
              {activeTicket.status === 'closed' ? (
                <div className="w-full bg-zinc-800/50 border border-white/5 rounded-2xl px-6 py-4 text-center">
                  <p className="text-xs font-bold text-white/40 uppercase tracking-widest">
                    This ticket is closed. Please start a new conversation for further help.
                  </p>
                </div>
              ) : (
                <div className="relative">
                  <input 
                    type="text"
                    placeholder="Type your message..."
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                    className="w-full bg-zinc-900 border border-white/5 rounded-2xl px-6 py-4 pr-16 text-sm focus:border-purple-500 transition-colors outline-none"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputText.trim()}
                    className="absolute right-2 top-2 bottom-2 px-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <footer className="mt-12 pt-8 border-t border-white/5 grid grid-cols-1 md:grid-cols-3 gap-8">
           <div>
             <h4 className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-4">Quick Links</h4>
             <ul className="space-y-2">
               {settings?.quickLinks ? settings.quickLinks.map((link, idx) => (
                 <li key={idx}>
                   <Link to={link.url} className="text-xs text-white/40 hover:text-white transition-colors">
                     {link.label}
                   </Link>
                 </li>
               )) : (
                 <>
                   <li><Link to="/profile" className="text-xs text-white/40 hover:text-white transition-colors">My Orders</Link></li>
                   <li><Link to="/page/shipping-delivery" className="text-xs text-white/40 hover:text-white transition-colors">Shipping FAQ</Link></li>
                   <li><Link to="/page/return-replacement-policy" className="text-xs text-white/40 hover:text-white transition-colors">Return Policy</Link></li>
                 </>
               )}
             </ul>
           </div>
           <div className="md:col-span-2">
             <div className="p-6 bg-zinc-900/50 rounded-2xl border border-white/5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <h4 className="text-sm font-bold mb-1 italic uppercase">Instant Status Check</h4>
                  <p className="text-xs text-white/40 leading-relaxed">
                    You can also track your order status instantly via our 
                    {settings?.supportBotUrl ? (
                      <a href={settings.supportBotUrl} target="_blank" rel="noreferrer" className="text-purple-500 hover:underline mx-1">Telegram Bot</a>
                    ) : ' Telegram Bot '}
                    by using the 🔍 Order Status menu without creating a ticket.
                  </p>
                </div>
             </div>
           </div>
        </footer>
      </div>
    </div>
  );
}
