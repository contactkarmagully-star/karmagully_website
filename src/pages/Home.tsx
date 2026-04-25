import { motion } from 'motion/react';
import { ArrowRight, ShieldCheck, Truck, CreditCard, Flower2, Globe, Zap, Trophy, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import FlashSaleCard from '../components/FlashSaleCard';
import { Product } from '../types';
import { useState, useEffect } from 'react';
import { getAllProducts } from '../services/productService';

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const data = await getAllProducts();
        setProducts(data.filter(p => p.featured).slice(0, 8));
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-24 pb-24"
    >
      {/* Hero Section */}
      <section className="relative pt-12 pb-8 overflow-hidden border-b border-white/5">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-purple-600/5 blur-[120px] rounded-full -z-10" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <h1 className="text-6xl md:text-8xl font-black italic uppercase leading-[0.85] tracking-tighter max-w-5xl mx-auto">
              Premium <span className="text-gradient">Anime</span><br/>Metal Posters
            </h1>
            <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto font-medium">
              Ultra-durable, high-definition metal prints.<br className="hidden md:block" /> Limited drops every month.
            </p>
          </motion.div>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link 
              to="/shop" 
              className="px-10 py-4 bg-purple-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-2xl shadow-purple-600/40 hover:bg-purple-700 transition-all hover:scale-105 text-base"
            >
              Explore Drops
            </Link>
          </div>
        </div>
      </section>

      {/* Flash Sale - High Urgency */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative z-20">
        <FlashSaleCard />
      </section>

      {/* Featured Products - The Core Value */}
      <section id="featured" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-10 gap-4 flex-wrap">
          <div className="space-y-2">
            <h2 className="text-[10px] font-black uppercase tracking-[0.6em] text-purple-500">The Collection</h2>
            <h3 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter">Featured <span className="text-white/40">Drops</span></h3>
          </div>
          <Link to="/shop" className="group flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white/60 hover:text-white transition-colors">
            View All <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
        
        <div className="flex flex-wrap justify-center gap-8">
          {loading ? (
            [1,2,3,4].map(i => <div key={i} className="w-full sm:w-[calc(50%-1rem)] lg:w-[calc(25%-1.5rem)] aspect-[3/4] bg-white/5 animate-pulse rounded-2xl" />)
          ) : products.length > 0 ? (
            products.map((p) => (
              <div key={p.id} className="w-full sm:w-[calc(50%-1rem)] lg:w-[calc(25%-1.5rem)]">
                <ProductCard product={p} />
              </div>
            ))
          ) : (
            <p className="w-full text-center text-white/20 uppercase tracking-widest text-sm py-12">No featured products available.</p>
          )}
        </div>
      </section>

      {/* Brand Values Bar - Trust & Identity (Moved Down) */}
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
    </motion.div>
  );
}
