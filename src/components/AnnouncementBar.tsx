import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { subscribeToSettings } from '../services/settingsService';
import { AppSettings } from '../types';

export default function AnnouncementBar() {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    return subscribeToSettings(setSettings);
  }, []);

  if (!settings?.showAnnouncement) return null;

  return (
    <div className="bg-neon-purple py-2.5 px-4 relative overflow-hidden border-b border-white/5 shadow-[0_0_15px_rgba(147,51,234,0.3)]">
      <motion.div 
        animate={{ x: ['100%', '-100%'] }}
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
        className="flex items-center gap-16 whitespace-nowrap"
      >
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Sparkles className="w-3.5 h-3.5 text-white" />
            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-white drop-shadow-sm">
              {settings.announcement}
            </span>
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
        ))}
      </motion.div>
      <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-neon-purple to-transparent z-10" />
      <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-neon-purple to-transparent z-10" />
    </div>
  );
}
