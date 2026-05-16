import { motion } from 'motion/react';
import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ChevronLeft, Info, FileText } from 'lucide-react';

export default function CustomPage() {
  const { slug } = useParams();
  const [page, setPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPage() {
      if (!slug) return;
      setLoading(true);
      try {
        const docRef = doc(db, 'pages', slug);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setPage(docSnap.data());
        }
      } catch (error) {
        console.error("Error fetching page:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchPage();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-neon-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-6">
        <div className="p-8 glass-morphism rounded-full">
          <Info className="w-12 h-12 text-white/20" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-black uppercase italic italic tracking-tighter">Page Not Found</h1>
          <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-2">The drop you're looking for doesn't exist.</p>
        </div>
        <Link 
          to="/shop"
          className="px-8 py-4 bg-white text-dark-bg font-black uppercase tracking-widest rounded-2xl transition-all hover:bg-neon-purple hover:text-white"
        >
          Return to Shop
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen pb-24"
    >
      {/* Hero Header */}
      <div className="relative h-[40vh] flex items-center justify-center overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-b from-neon-purple/10 to-transparent" />
        <div className="absolute -top-48 -left-48 w-96 h-96 bg-neon-purple/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-48 -right-48 w-96 h-96 bg-neon-blue/10 blur-[120px] rounded-full" />
        
        <div className="relative z-10 text-center px-4">
           <Link to="/" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-colors mb-6 group">
             <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
             Back to Base
           </Link>
           <h1 className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter text-white">
             {page.title}
           </h1>
           <div className="h-1 w-24 bg-neon-purple mx-auto mt-6" />
        </div>
      </div>

      {/* Content Sections */}
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-16">
        {page.content?.map((section: any, idx: number) => {
          if (section.type === 'text') {
            return (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="prose prose-invert max-w-none"
              >
                <div className="text-white/70 leading-relaxed space-y-6 text-lg font-medium whitespace-pre-wrap">
                  {section.value}
                </div>
              </motion.div>
            );
          }
          
          if (section.type === 'image') {
            return (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="aspect-video relative rounded-[2rem] overflow-hidden border border-white/10"
              >
                <img 
                  src={section.value || undefined} 
                  alt={page.title}
                  className="w-full h-full object-cover"
                />
              </motion.div>
            );
          }

          if (section.type === 'video') {
            // Basic YT/Vimeo support or direct link
            const isYoutube = section.value.includes('youtube.com') || section.value.includes('youtu.be');
            const videoId = isYoutube ? (section.value.includes('v=') ? section.value.split('v=')[1]?.split('&')[0] : section.value.split('/').pop()) : null;

            return (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="aspect-video relative rounded-[2rem] overflow-hidden border border-white/10 bg-black"
              >
                {isYoutube ? (
                  <iframe 
                    src={`https://www.youtube.com/embed/${videoId}`}
                    className="w-full h-full"
                    allowFullScreen
                    title="Video Section"
                  />
                ) : (
                  <video 
                    src={section.value || undefined} 
                    controls 
                    className="w-full h-full object-cover"
                  />
                )}
              </motion.div>
            );
          }

          return null;
        })}
      </div>
    </motion.div>
  );
}
