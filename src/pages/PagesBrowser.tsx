import { motion } from 'motion/react';
import { collection, getDocs } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { FileText, ChevronRight, Search } from 'lucide-react';

export default function PagesBrowser() {
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function fetchPages() {
      try {
        const querySnapshot = await getDocs(collection(db, 'pages'));
        const pagesData = querySnapshot.docs.map(doc => ({ slug: doc.id, ...doc.data() }));
        setPages(pagesData);
      } catch (error) {
        console.error("Error fetching pages:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchPages();
  }, []);

  const filtered = pages.filter(p => p.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen pt-32 pb-12 px-4 max-w-4xl mx-auto">
      <div className="space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-5xl md:text-6xl font-black uppercase italic tracking-tighter">Information <span className="text-neon-purple">Hub</span></h1>
          <p className="text-[10px] text-white/40 font-bold uppercase tracking-[0.4em]">Official Drops & Legal Policies</p>
        </div>

        <div className="relative group max-w-md mx-auto">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-neon-purple transition-colors" />
          <input 
            type="text" 
            placeholder="SEARCH SITE PAGES..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-full py-4 pl-14 pr-8 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-neon-purple transition-all shadow-2xl"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-4 border-neon-purple border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid gap-4">
            {filtered.length > 0 ? filtered.map((page, idx) => (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={page.slug}
              >
                <Link 
                  to={`/page/${page.slug}`}
                  className="group flex items-center justify-between p-8 glass-morphism rounded-[2.5rem] border border-white/5 hover:border-neon-purple/50 transition-all hover:bg-white/[0.02]"
                >
                  <div className="flex items-center gap-6">
                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center group-hover:bg-neon-purple/20 transition-colors">
                      <FileText className="w-6 h-6 text-white/20 group-hover:text-neon-purple" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black uppercase italic tracking-tight">{page.title}</h3>
                      <p className="text-[9px] text-white/20 font-black uppercase tracking-[0.2em] mt-1 italic">Authorized Documentation</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-white/10 group-hover:text-white transition-all transform group-hover:translate-x-1" />
                </Link>
              </motion.div>
            )) : (
              <div className="text-center py-24 text-white/20 font-black uppercase tracking-widest text-xs">
                No matching pages found in the database.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
