import React from 'react';
import { Award, Zap, ShieldCheck, Truck } from 'lucide-react';
import { AppSettings } from '../types';

export default function TrustBadges({ settings }: { settings: AppSettings }) {
  if (!settings.features.trustBadges) return null;

  const badges = [
    {
      id: 'quality',
      label: 'Premium Quality Metal',
      icon: <Award className="w-5 h-5 text-neon-purple" />,
      active: settings.trustBadgesContent.quality
    },
    {
      id: 'resistant',
      label: 'Fade Resistant Ink',
      icon: <Zap className="w-5 h-5 text-amber-500" />,
      active: settings.trustBadgesContent.resistant
    },
    {
      id: 'easyMount',
      label: 'Easy Mount System',
      icon: <ShieldCheck className="w-5 h-5 text-neon-blue" />,
      active: settings.trustBadgesContent.easyMount
    },
    {
      id: 'cod',
      label: 'Cash on Delivery',
      icon: <Truck className="w-5 h-5 text-emerald-500" />,
      active: settings.trustBadgesContent.cod
    }
  ].filter(b => b.active);

  if (badges.length === 0) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 border-t border-white/5">
      {badges.map(badge => (
        <div key={badge.id} className="flex flex-col items-center text-center gap-2 p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all">
          <div className="p-3 bg-white/5 rounded-xl">
            {badge.icon}
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-white/40 leading-tight">
            {badge.label}
          </span>
        </div>
      ))}
    </div>
  );
}
