import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Clock, Zap } from 'lucide-react';
import { subscribeToSettings, AppSettings } from '../services/settingsService';

export default function FlashSaleCard() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [timeLeft, setTimeLeft] = useState<{h: number, m: number, s: number} | null>(null);

  useEffect(() => {
    return subscribeToSettings(setSettings);
  }, []);

  useEffect(() => {
    if (!settings?.flashSale.isActive || !settings.flashSale.endTime) return;

    const timer = setInterval(() => {
      const end = new Date(settings.flashSale.endTime).getTime();
      const now = new Date().getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft(null);
        clearInterval(timer);
        return;
      }

      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ h, m, s });
    }, 1000);

    return () => clearInterval(timer);
  }, [settings]);

  if (!settings?.flashSale.isActive || !timeLeft) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-neon-blue/20 to-purple-600/20 border border-neon-blue/30 rounded-3xl p-6 md:p-8 relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Zap className="w-32 h-32 text-neon-blue" />
      </div>
      
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">
        <div className="text-center md:text-left">
          <p className="text-neon-blue font-black uppercase tracking-[0.4em] text-[10px] mb-2 flex items-center justify-center md:justify-start gap-2">
            <Clock className="w-3 h-3" /> Flash Drop Active
          </p>
          <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter mb-2">
            {settings.flashSale.title}
          </h2>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">
            {settings.flashSale.discountText}
          </p>
        </div>

        <div className="flex gap-4">
          <TimeUnit value={timeLeft.h} label="HRS" />
          <TimeUnit value={timeLeft.m} label="MIN" />
          <TimeUnit value={timeLeft.s} label="SEC" />
        </div>
      </div>
    </motion.div>
  );
}

function TimeUnit({ value, label }: { value: number, label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-16 h-16 md:w-20 md:h-20 bg-dark-bg/80 border border-white/10 rounded-2xl flex items-center justify-center mb-1 shadow-2xl">
        <span className="text-2xl md:text-3xl font-black italic tracking-tighter text-white">
          {value.toString().padStart(2, '0')}
        </span>
      </div>
      <span className="text-[8px] font-black tracking-widest text-white/30 uppercase">{label}</span>
    </div>
  );
}
