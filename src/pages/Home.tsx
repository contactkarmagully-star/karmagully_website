import { motion } from 'motion/react';
import { ArrowRight, ShieldCheck, Truck, CreditCard, Flower2, Globe, Zap, Trophy, Star, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import FlashSaleCard from '../components/FlashSaleCard';
import VideoPlayer from '../components/VideoPlayer';
import { Product, ProductVideo, AppSettings } from '../types';
import { useState, useEffect } from 'react';
import { getAllProducts, getAllProductVideos } from '../services/productService';
import { subscribeToSettings } from '../services/settingsService';
import { dataCache } from '../lib/dataCache';
import TerminalSubscriber from '../components/TerminalSubscriber';

export default function Home() {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [videos, setVideos] = useState<ProductVideo[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [totalFeaturedCount, setTotalFeaturedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return subscribeToSettings(setSettings);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setError(null);
      // Force cache clear on first entry to home to ensure we aren't stuck with empty state
      if (!window.sessionStorage.getItem('home_initialized')) {
        dataCache.clear();
        window.sessionStorage.setItem('home_initialized', 'true');
      }
      
      try {
        // Force fresh load on mount to handle many of the "nothing loading" reports
        const [productData, videoData] = await Promise.all([
          getAllProducts(100, true), 
          getAllProductVideos(50)
        ]);
        
        setAllProducts(productData);
        let featured = productData.filter(p => p.featured);
        
        // Safety: If no products marked featured, show latest products as fallback
        if (featured.length === 0 && productData.length > 0) {
          featured = productData.slice(0, 12);
        }

        setTotalFeaturedCount(featured.length);
        setProducts(featured.slice(0, 12));
        setVideos(videoData);
      } catch (err: any) {
        console.error("Error fetching homepage data:", err);
        setError(err.message || 'Failed to connect to the database uplink.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-16 md:space-y-24 pb-24"
    >
      {/* Hero Section */}
      <section className="relative pt-10 md:pt-16 pb-10 md:pb-12 overflow-hidden border-b border-white/5">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-purple-600/5 blur-[120px] rounded-full -z-10" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8 md:space-y-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4 md:space-y-5"
          >
            <h1 className="text-5xl md:text-8xl font-black italic uppercase leading-[0.85] tracking-tighter max-w-5xl mx-auto">
              Premium <span className="text-gradient">Anime</span><br/>Metal Posters
            </h1>
            <p className="text-slate-400 text-sm md:text-xl max-w-2xl mx-auto font-medium">
              Ultra-durable, high-definition metal prints. Limited drops every month.
            </p>
          </motion.div>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link 
              to="/shop" 
              className="px-10 py-4 bg-purple-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-2xl shadow-purple-600/40 hover:bg-purple-700 transition-all hover:scale-105 text-sm md:text-base inline-block"
            >
              Explore Drops
            </Link>
          </div>
        </div>
      </section>

      {/* Flash Sale - High Urgency */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20">
        <FlashSaleCard />
      </section>

      {/* Featured Products - The Core Value */}
      <section id="featured" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8 md:mb-12 gap-4 flex-wrap">
          <div className="space-y-2 md:space-y-3">
            <h2 className="text-[10px] font-black uppercase tracking-[0.6em] text-purple-500">The Collection</h2>
            <h3 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter">Featured <span className="text-white/40">Drops</span></h3>
          </div>
          <Link to="/shop" className="group flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white/60 hover:text-white transition-colors">
            View All <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-8">
          {loading ? (
            [1,2,3,4,5,6,7,8].map(i => <div key={i} className="aspect-[3/4] bg-white/5 animate-pulse rounded-2xl" />)
          ) : error ? (
            <div className="col-span-full text-center py-20 px-8 border border-dashed border-red-500/20 rounded-[2rem] bg-red-500/[0.02]">
              <AlertCircle className="w-12 h-12 text-red-500/40 mx-auto mb-4" />
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-red-500/60 mb-2">Critical Connection Error</p>
              <p className="text-xs text-white/40 mb-6 max-w-md mx-auto">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="px-8 py-3 bg-red-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
              >
                Retry Uplink
              </button>
            </div>
          ) : products.length > 0 ? (
            products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))
          ) : (
            <div className="col-span-full text-center py-24 px-8 border border-dashed border-white/5 rounded-[3rem] bg-white/[0.01]">
              <Flower2 className="w-16 h-16 text-white/5 mx-auto mb-6" />
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/30">Scanning Frequency...</p>
                <p className="text-xs text-white/10 uppercase tracking-widest max-w-sm mx-auto leading-relaxed">No active drops detected in this sector. Check back soon for the next phase.</p>
              </div>
            </div>
          )}
        </div>

        {totalFeaturedCount > 12 && (
          <div className="mt-12 flex justify-center">
            <Link 
              to="/shop"
              className="px-8 py-3 bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest text-xs rounded-xl hover:bg-white hover:text-black transition-all flex items-center gap-2 group"
            >
              View More <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        )}
      </section>

      {/* Custom Dynamic Sections */}
      {settings?.homeSections && settings.homeSections.length > 0 && (
        <div className="space-y-24">
          {settings.homeSections.sort((a, b) => a.order - b.order).map((section) => {
            const sectionProducts = allProducts.filter(p => section.productIds.includes(p.id));
            if (sectionProducts.length === 0) return null;

            return (
              <section key={section.id} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-end justify-between mb-8 md:mb-12 gap-4">
                  <div className="space-y-2">
                    <h3 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter">{section.title}</h3>
                  </div>
                  <div className="flex gap-2">
                     <p className="text-[10px] font-black uppercase tracking-widest text-white/20 italic">Swipe to Explore</p>
                  </div>
                </div>

                <div className="relative group">
                  <div className="flex gap-4 md:gap-8 overflow-x-auto pb-8 snap-x no-scrollbar -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
                    {sectionProducts.map((p) => (
                      <div key={p.id} className="flex-shrink-0 w-[240px] md:w-[320px] snap-start">
                        <ProductCard product={p} />
                      </div>
                    ))}
                  </div>
                  
                  {/* Subtle indication of more items */}
                  <div className="absolute right-0 top-0 bottom-8 w-24 bg-gradient-to-l from-dark-bg to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Community Reels - See it in Real Life */}
      {videos.length > 0 && (
        <section className="mt-24 space-y-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center text-center gap-6">
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-purple-500 italic">Community Uplink</p>
                <h2 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter leading-none">See it in <br className="md:hidden" /> <span className="text-gradient">Real Life</span></h2>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/20 max-w-sm leading-relaxed">
                Experience the posters in authentic environments through our community's cinematic perspectives.
              </p>
            </div>
          </div>

          <div className="relative">
             <div className="flex gap-4 md:gap-8 overflow-x-auto pb-8 px-4 sm:px-6 lg:px-8 snap-x no-scrollbar">
                {videos.map((vid, idx) => (
                   <motion.div 
                    key={vid.id || idx}
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex-shrink-0 w-64 md:w-80 aspect-[9/16] bg-white/5 rounded-[2.5rem] overflow-hidden border border-white/5 shadow-2xl snap-center relative group"
                   >
                      <VideoPlayer url={vid.videoUrl} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-8 pointer-events-none">
                         <p className="text-[10px] font-black uppercase tracking-widest text-white mb-1">Authentic Selection</p>
                         <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Captured by the Community</p>
                      </div>
                      {vid.productId && (
                        <Link 
                          to={`/product/${vid.productId}`}
                          className="absolute top-6 right-6 p-3 bg-white/10 backdrop-blur-md rounded-full text-white border border-white/20 hover:bg-white hover:text-black transition-all"
                        >
                          <Zap className="w-4 h-4 fill-current" />
                        </Link>
                      )}
                   </motion.div>
                ))}
             </div>
          </div>
        </section>
      )}

      {/* Brand Values Bar */}
      <section className="px-4 py-24 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter">The <span className="text-purple-500">Identity</span></h2>
            <p className="text-slate-400 max-w-xl mx-auto text-sm">Where ancient wisdom meets modern octane. Our posters are more than art; they're a connection.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-3xl bg-purple-600/10 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                <Flower2 className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-white">Cultural Identity</h4>
                <p className="text-[11px] text-white/40 leading-relaxed">Sanskrit adds meaning, power & connection to every piece.</p>
              </div>
            </div>

            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-3xl bg-indigo-600/10 flex items-center justify-center text-indigo-400">
                <span className="text-2xl">⛩️</span>
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-white">Anime Aesthetic</h4>
                <p className="text-[11px] text-white/40 leading-relaxed">Japanese roots and Indian fusion that connects with true fans.</p>
              </div>
            </div>

            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-3xl bg-pink-600/10 flex items-center justify-center text-pink-400">
                <Star className="w-8 h-8 fill-pink-400/20" />
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-white">Bold & Modern</h4>
                <p className="text-[11px] text-white/40 leading-relaxed">Premium brush typography and neon accents for an elite vibe.</p>
              </div>
            </div>

            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-3xl bg-teal-600/10 flex items-center justify-center text-teal-400">
                <Zap className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-white">Memorable Brand</h4>
                <p className="text-[11px] text-white/40 leading-relaxed">A unique, edgy experience that you won't find anywhere else.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter / Terminal Connection */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-24">
        <TerminalSubscriber />
      </section>
    </motion.div>
  );
}
