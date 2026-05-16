import React, { useState, useEffect } from 'react';
import { Globe, ShieldCheck, AlertCircle, CheckCircle2, Search, Link as LinkIcon, Database, ShieldAlert, ChevronRight, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import { Link } from 'react-router-dom';

interface HealthCheck {
  id: string;
  name: string;
  status: 'SUCCESS' | 'ERROR' | 'WARNING' | 'LOADING';
  message: string;
  details?: string[];
}

interface DomainHealthPageProps {
  debugData: any;
  isQuotaExceeded: boolean;
}

export default function DomainHealthPage({ debugData, isQuotaExceeded }: DomainHealthPageProps) {
  const [checks, setChecks] = useState<HealthCheck[]>([
    { id: 'domain', name: 'Current Domain', status: 'LOADING', message: 'Detecting domain...' },
    { id: 'sitemap', name: 'Sitemap Check', status: 'LOADING', message: 'Checking /sitemap.xml...' },
    { id: 'robots', name: 'Robots.txt Check', status: 'LOADING', message: 'Checking /robots.txt...' },
    { id: 'consistency', name: 'Domain Consistency', status: 'LOADING', message: 'Verifying URLs...' },
    { id: 'leak', name: 'Netlify Leak Check', status: 'LOADING', message: 'Scanning for .netlify.app...' },
  ]);

  const runChecks = async () => {
    const currentDomain = window.location.host;
    const protocol = window.location.protocol;
    const baseUrl = `${protocol}//${currentDomain}`;

    // 1. Current Domain
    updateCheck('domain', 'SUCCESS', `Running on: ${currentDomain}`);

    try {
      // 2. Sitemap Check
      const sitemapRes = await axios.get('/sitemap.xml');
      updateCheck('sitemap', 'SUCCESS', '/sitemap.xml loads successfully');

      // 4. Consistency Check
      const sitemapText = sitemapRes.data;
      const urls = sitemapText.match(/<loc>(.*?)<\/loc>/g)?.map((val: string) => val.replace(/<\/?loc>/g, '')) || [];
      const inconsistentUrls = urls.filter((url: string) => !url.includes(currentDomain));
      
      if (inconsistentUrls.length > 0) {
        updateCheck('consistency', 'WARNING', `Sitemap contains incorrect domain URLs (${inconsistentUrls.length} mismatch)`, inconsistentUrls);
      } else {
        updateCheck('consistency', 'SUCCESS', 'All URLs in sitemap match current domain');
      }

      // 5. Netlify Leak Check
      const hasNetlifyLeak = sitemapText.includes('.netlify.app');
      if (hasNetlifyLeak) {
        updateCheck('leak', 'WARNING', 'Old Netlify domain detected in sitemap');
      } else {
        updateCheck('leak', 'SUCCESS', 'No Netlify leaks found in SEO manifests');
      }

    } catch (err) {
      updateCheck('sitemap', 'ERROR', 'Could not load /sitemap.xml');
      updateCheck('consistency', 'ERROR', 'Cannot verify consistency without sitemap');
      updateCheck('leak', 'ERROR', 'Cannot perform leak check without sitemap');
    }

    try {
      // 3. Robots.txt Check
      const robotsRes = await axios.get('/robots.txt');
      const robotsText = robotsRes.data;
      updateCheck('robots', 'SUCCESS', '/robots.txt loads successfully');
      
      if (!robotsText.includes('/sitemap.xml')) {
        updateCheck('robots', 'WARNING', 'Sitemap link missing in robots.txt');
      }
    } catch (err) {
      updateCheck('robots', 'ERROR', 'Could not load /robots.txt');
    }
  };

  const updateCheck = (id: string, status: HealthCheck['status'], message: string, details?: string[]) => {
    setChecks(prev => prev.map(c => c.id === id ? { ...c, status, message, details } : c));
  };

  useEffect(() => {
    runChecks();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">Domain <span className="text-neon-blue">Health Dashboard</span></h2>
          <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold mt-1">SEO Infrastructure & Domain Verification</p>
        </div>
        <button 
          onClick={() => {
            setChecks(prev => prev.map(c => ({ ...c, status: 'LOADING', message: 'Retrying...' })));
            runChecks();
          }}
          className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-xl border border-white/5 transition-all"
        >
          Re-Scan Infrastructure
        </button>
      </div>

      {/* Sitemap Debug Section */}
      <div className="p-6 bg-white/5 border border-white/10 rounded-3xl relative overflow-hidden">
        {isQuotaExceeded && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10 flex items-center justify-center p-6 text-center">
            <div className="flex flex-col items-center gap-2">
              <AlertTriangle className="w-8 h-8 text-pink-500" />
              <p className="text-xs font-black uppercase tracking-widest text-pink-500">Firestore Quota Exhausted</p>
              <p className="text-[10px] text-white/60 uppercase tracking-widest leading-relaxed max-w-xs">
                The sitemap generator is currently restricted. Data intel will be restored automatically when your free daily quota resets.
              </p>
            </div>
          </div>
        )}

        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-4 flex items-center gap-2">
          <Globe className="w-3 h-3 text-neon-blue" /> Sitemap Debug Intel
        </h3>

        {debugData?.error ? (
          <div className="flex items-center gap-3 text-white/40 py-2">
            <ShieldAlert className="w-4 h-4" />
            <p className="text-[10px] font-bold uppercase tracking-widest">Sitemap Logic Restricted: {debugData.error}</p>
          </div>
        ) : debugData ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/20 mb-1">Domain</p>
              <p className="text-xs font-mono text-neon-blue truncate">{debugData.domain}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/20 mb-1">Products</p>
              <p className="text-xl font-black italic tracking-tighter">{debugData.products}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/20 mb-1">Blogs</p>
              <p className="text-xl font-black italic tracking-tighter">{debugData.blogs}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/20 mb-1">Categories</p>
              <p className="text-xl font-black italic tracking-tighter">{debugData.categories}</p>
            </div>
          </div>
        ) : (
          <div className="animate-pulse flex items-center gap-3 text-white/20">
            <Database className="w-4 h-4" />
            <p className="text-[10px] font-bold uppercase tracking-widest">Awaiting Engine Response...</p>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-white/5 flex gap-4">
           <a 
             href="/sitemap.xml" 
             target="_blank" 
             className="text-[9px] font-bold uppercase tracking-widest text-neon-purple hover:underline flex items-center gap-1"
           >
             View Live XML <ChevronRight className="w-2 h-2" />
           </a>
           <Link 
             to="/debug-sitemap" 
             target="_blank" 
             className="text-[9px] font-bold uppercase tracking-widest text-white/40 hover:text-white"
           >
             Full Debug JSON
           </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {checks.map(check => (
          <div key={check.id} className="bg-white/5 border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
            {check.status === 'SUCCESS' && <div className="absolute top-0 right-0 p-4 text-emerald-500/20"><CheckCircle2 className="w-12 h-12" /></div>}
            {check.status === 'ERROR' && <div className="absolute top-0 right-0 p-4 text-pink-500/20"><AlertTriangle className="w-12 h-12" /></div>}
            {check.status === 'WARNING' && <div className="absolute top-0 right-0 p-4 text-amber-500/20"><AlertCircle className="w-12 h-12" /></div>}

            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  check.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-500' :
                  check.status === 'ERROR' ? 'bg-pink-500/10 text-pink-500' :
                  check.status === 'WARNING' ? 'bg-amber-500/10 text-amber-500' :
                  'bg-white/10 text-white/40 animate-pulse'
                }`}>
                  {check.id === 'domain' && <Globe className="w-5 h-5" />}
                  {check.id === 'sitemap' && <Search className="w-5 h-5" />}
                  {check.id === 'robots' && <LinkIcon className="w-5 h-5" />}
                  {check.id === 'consistency' && <ShieldCheck className="w-5 h-5" />}
                  {check.id === 'leak' && <AlertCircle className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40">{check.name}</h3>
                  <div className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full inline-block mt-1 ${
                    check.status === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-500' :
                    check.status === 'ERROR' ? 'bg-pink-500/20 text-pink-500' :
                    check.status === 'WARNING' ? 'bg-amber-500/20 text-amber-500' :
                    'bg-white/10 text-white/40'
                  }`}>
                    {check.status}
                  </div>
                </div>
              </div>

              <p className="text-xs font-bold text-white/80 leading-relaxed">{check.message}</p>
              
              {check.details && check.details.length > 0 && (
                <div className="mt-4 p-3 bg-black/40 rounded-xl border border-white/5">
                  <p className="text-[8px] font-black uppercase tracking-widest text-white/20 mb-2">Internal Examples:</p>
                  <div className="space-y-1 max-h-24 overflow-y-auto custom-scrollbar">
                    {check.details.slice(0, 5).map((detail, idx) => (
                      <p key={idx} className="text-[8px] font-mono text-white/40 truncate">{detail}</p>
                    ))}
                    {check.details.length > 5 && <p className="text-[8px] text-white/20">+{check.details.length - 5} more...</p>}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-neon-blue/5 border border-neon-blue/20 rounded-3xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 text-neon-blue/5"><Globe className="w-32 h-32" /></div>
        <div className="relative z-10 max-w-2xl">
          <h3 className="text-xl font-black italic uppercase tracking-tighter text-white mb-2">SEO <span className="text-neon-blue">Architecture Notes</span></h3>
          <p className="text-white/60 text-xs font-medium leading-relaxed mb-6">
            Our system uses dynamic manifest generation. This means your sitemap and robots.txt are updated in real-time as you add products, categories, or blogs. No manual rebuilding or redeployment is required for search engines to find your latest content.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/5">
              <div className="w-8 h-8 bg-neon-blue/10 rounded-lg flex items-center justify-center text-neon-blue"><CheckCircle2 className="w-4 h-4" /></div>
              <p className="text-[9px] font-black uppercase tracking-widest text-white">Auto-Detect Domain</p>
            </div>
            <div className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/5">
              <div className="w-8 h-8 bg-neon-blue/10 rounded-lg flex items-center justify-center text-neon-blue"><CheckCircle2 className="w-4 h-4" /></div>
              <p className="text-[9px] font-black uppercase tracking-widest text-white">Dynamic Content Sync</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

