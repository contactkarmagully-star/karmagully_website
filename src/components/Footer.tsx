import { Zap, Instagram, Twitter, Facebook, Send, Phone, Youtube } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { subscribeToSettings } from '../services/settingsService';
import { AppSettings } from '../types';

export default function Footer() {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    return subscribeToSettings(setSettings);
  }, []);

  return (
    <footer className="glass-morphism border-t border-white/10 bg-black mt-auto">
      <div className="max-w-7xl mx-auto h-auto md:h-16 flex flex-col md:flex-row items-center px-4 md:px-8 justify-around text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 gap-4 py-6 md:py-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.8)]"></div>
          <span>Cash on Delivery Available</span>
        </div>
        <div className="flex items-center gap-2 border-l border-white/5 pl-4 hidden md:flex">
          <div className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
          <span>7-10 Days Fast Shipping</span>
        </div>
        
        <div className="flex items-center gap-6 border-l border-white/5 pl-6">
          {settings?.socialLinks?.instagram && (
            <a href={settings.socialLinks.instagram} target="_blank" rel="noreferrer" className="hover:text-purple-500 transition-colors">
              <Instagram className="w-4 h-4" />
            </a>
          )}
          {settings?.socialLinks?.twitter && (
            <a href={settings.socialLinks.twitter} target="_blank" rel="noreferrer" className="hover:text-blue-400 transition-colors">
              <Twitter className="w-4 h-4" />
            </a>
          )}
          {settings?.socialLinks?.facebook && (
            <a href={settings.socialLinks.facebook} target="_blank" rel="noreferrer" className="hover:text-blue-600 transition-colors">
              <Facebook className="w-4 h-4" />
            </a>
          )}
          {settings?.socialLinks?.telegram && (
            <a href={settings.socialLinks.telegram} target="_blank" rel="noreferrer" className="hover:text-sky-500 transition-colors">
              <Send className="w-4 h-4" />
            </a>
          )}
          {settings?.socialLinks?.youtube && (
            <a href={settings.socialLinks.youtube} target="_blank" rel="noreferrer" className="hover:text-red-500 transition-colors">
              <Youtube className="w-4 h-4" />
            </a>
          )}
          {settings?.socialLinks?.whatsapp && (
            <a href={settings.socialLinks.whatsapp} target="_blank" rel="noreferrer" className="hover:text-green-500 transition-colors">
              <Phone className="w-4 h-4" />
            </a>
          )}
        </div>

        <div className="flex items-center gap-2 border-l border-white/5 pl-4 hidden md:flex">
          <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.8)]"></div>
          <span>Authentic Metal Grade</span>
        </div>
        <div className="flex items-center gap-2 border-l border-white/5 pl-4">
          <div className="w-2 h-2 bg-orange-500 rounded-full shadow-[0_0_8px_rgba(249,115,22,0.8)]"></div>
          <span>Limited Quantity Runs</span>
        </div>
      </div>
      <div className="border-t border-white/5 py-4 text-center bg-dark-bg/50">
        <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/10">
          © {new Date().getFullYear()} KarmaGully. Elevate your aesthetic.
        </p>
      </div>
    </footer>
  );
}
