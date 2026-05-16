import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Send } from 'lucide-react';
import { addSubscriber } from '../services/subscriptionService';

interface TerminalSubscriberProps {
  compact?: boolean;
}

export default function TerminalSubscriber({ compact = false }: TerminalSubscriberProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;
    
    setStatus('loading');
    try {
      await addSubscriber(email);
      setStatus('success');
      setEmail('');
      setTimeout(() => setStatus('idle'), 5000);
    } catch (err) {
      console.error(err);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="flex gap-2 bg-black/40 p-2 rounded-full border border-white/10 group focus-within:border-purple-500/50 transition-all">
        <input 
          type="email" 
          placeholder="SECURE_EMAIL@GULLY.ID" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-transparent flex-grow px-4 outline-none text-[10px] font-black uppercase tracking-widest placeholder:text-white/10"
          required
        />
        <button 
          type="submit"
          disabled={status === 'loading'}
          className="px-6 py-3 bg-white text-black text-[9px] font-black uppercase tracking-widest rounded-full hover:scale-105 transition-all outline-none disabled:opacity-50 flex items-center gap-2"
        >
          {status === 'loading' ? 'LINKING...' : status === 'success' ? 'SYNCED' : 'Connect'}
        </button>
      </form>
    );
  }

  return (
    <div className="p-12 bg-gradient-to-br from-purple-900/20 to-black border border-white/5 rounded-[3.5rem] text-center space-y-6 relative overflow-hidden group">
      {/* Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-purple-600/10 blur-[100px] rounded-full pointer-events-none" />
      
      <div className="relative z-10">
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-purple-500">Join the movement</p>
        <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter">Stay <span className="text-gradient">Synchronized</span></h2>
        <p className="text-white/40 max-w-md mx-auto text-sm uppercase tracking-widest font-bold">
          Receive the latest drops and technical intel direct to your secure terminal.
        </p>
        
        <form onSubmit={handleSubmit} className="flex max-w-sm mx-auto gap-2 bg-black/40 p-2 rounded-full border border-white/10 focus-within:border-purple-500/50 transition-all">
          <input 
            type="email" 
            placeholder="SECURE_EMAIL@GULLY.ID" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-transparent flex-grow px-4 outline-none text-[10px] font-black uppercase tracking-widest placeholder:text-white/10"
            required
          />
          <button 
            type="submit"
            disabled={status === 'loading'}
            className="px-6 py-3 bg-white text-black text-[9px] font-black uppercase tracking-widest rounded-full hover:scale-105 transition-all outline-none disabled:opacity-50 shadow-xl shadow-white/5 whitespace-nowrap"
          >
            {status === 'loading' ? 'LINKING...' : status === 'success' ? 'CONNECTED' : 'Connect'}
          </button>
        </form>

        {status === 'success' && (
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[9px] font-black uppercase tracking-[0.2em] text-purple-400 mt-4"
          >
            Transmission received. Welcome to the collective.
          </motion.p>
        )}
      </div>
    </div>
  );
}
