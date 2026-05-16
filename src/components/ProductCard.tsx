import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ShoppingCart, ArrowRight, Heart, Zap, TrendingUp, Sparkles } from 'lucide-react';
import { Product, AppSettings } from '../types';
import { useWishlist } from '../hooks/useWishlist';
import { subscribeToSettings } from '../services/settingsService';

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { isInWishlist, toggleWishlist } = useWishlist();
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    return subscribeToSettings(setSettings);
  }, []);

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product.id);
  };

  const remainingStock = product.isLimitedDrop && product.dropQuantity 
    ? Math.max(0, product.dropQuantity - (product.soldCount || 0))
    : null;

  return (
    <Link to={`/product/${product.id}`} className="group block h-full">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        whileHover={{ y: -5 }}
        className="relative bg-dark-surface h-full rounded-xl border border-white/10 p-2 md:p-3 flex flex-col transition-all hover:border-purple-500/30 hover:shadow-[0_0_30px_rgba(168,85,247,0.1)]"
      >
        <div className="aspect-[3/4] bg-gradient-to-t from-black to-slate-800 rounded-lg overflow-hidden relative mb-2 md:mb-4 border border-white/5">
          <img 
            src={product.imageUrl || undefined} 
            alt={product.name}
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700"
            referrerPolicy="no-referrer"
          />
          
          <button 
            onClick={handleWishlist}
            className={`absolute top-2 right-2 z-20 w-8 h-8 rounded-full flex items-center justify-center transition-all ${isInWishlist(product.id) ? 'bg-pink-600 text-white' : 'bg-black/60 text-white/40 hover:text-white backdrop-blur-md'}`}
          >
            <Heart className={`w-4 h-4 ${isInWishlist(product.id) ? 'fill-white' : ''}`} />
          </button>

          <div className="absolute bottom-3 left-3 flex flex-col gap-1.5 z-10 pr-16 text-white">
            {product.featured && (
              <div className="px-2 py-1 bg-purple-600 text-[9px] font-black italic rounded uppercase tracking-tighter shadow-xl w-fit">
                NEW DROP
              </div>
            )}
            {product.isNewArrival && (
              <div className="px-2 py-1 bg-neon-blue text-white text-[9px] font-black italic rounded uppercase tracking-tighter shadow-xl flex items-center gap-1 w-fit">
                <Sparkles className="w-2.5 h-2.5 fill-white" /> ARRIVAL
              </div>
            )}
            {product.isTrending && (
              <div className="px-2 py-1 bg-emerald-500 text-white text-[9px] font-black italic rounded uppercase tracking-tighter shadow-xl flex items-center gap-1 w-fit">
                <TrendingUp className="w-2.5 h-2.5" /> TRENDING
              </div>
            )}
            {product.isLimitedDrop && settings?.features.limitedDrops && settings?.features.showLimitedBadgeOnThumbnails && (
              <div className="px-2 py-1 bg-amber-500 text-black text-[9px] font-black italic rounded uppercase tracking-tighter shadow-xl flex items-center gap-1 w-fit">
                <Zap className="w-2.5 h-2.5 fill-black" />
                LIMITED
              </div>
            )}
          </div>

          {/* Stock Counter - Bottom Right */}
          {product.isLimitedDrop && settings?.features.limitedDrops && settings?.features.showStockOnThumbnails && remainingStock !== null && (
            <div className="absolute bottom-3 right-3 flex flex-col items-end">
              <div className="px-2 py-1 bg-black/80 backdrop-blur-md border border-amber-500/30 rounded-lg shadow-2xl">
                <p className="text-[9px] font-black italic tracking-tighter">
                  <span className="text-amber-500">{remainingStock}</span> 
                  <span className="text-white/40 ml-1">LEFT</span>
                </p>
              </div>
            </div>
          )}

          {product.stock <= 0 && (
             <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[2px]">
               <span className="text-[10px] font-black uppercase tracking-[0.3em] border border-white/20 px-4 py-2 rounded-full">Sold Out</span>
             </div>
          )}
        </div>
        
        <div className="flex justify-between items-start gap-2">
          <div>
            <h3 className="font-bold uppercase text-[10px] md:text-sm tracking-tight group-hover:text-purple-400 transition-colors leading-none mb-1">
              {product.name}
            </h3>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
              {product.category} Edition
            </p>
          </div>
          <div className="text-right">
            <p className="text-purple-400 font-mono font-bold text-[10px] md:text-sm italic whitespace-nowrap">
              {product.variants && product.variants.length > 0 ? "From " : ""}₹{product.price}
            </p>
          </div>
        </div>
      </motion.div>
    </Link>
  );
};

export default ProductCard;
