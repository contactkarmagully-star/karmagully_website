import React from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ShoppingCart, ArrowRight } from 'lucide-react';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  return (
    <Link to={`/product/${product.id}`} className="group block h-full">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        whileHover={{ y: -5 }}
        className="relative bg-dark-surface h-full rounded-xl border border-white/10 p-3 flex flex-col transition-all hover:border-purple-500/30 hover:shadow-[0_0_30px_rgba(168,85,247,0.1)]"
      >
        <div className="aspect-[3/4] bg-gradient-to-t from-black to-slate-800 rounded-lg overflow-hidden relative mb-4 border border-white/5">
          <img 
            src={product.imageUrl} 
            alt={product.name}
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700"
            referrerPolicy="no-referrer"
          />
          {product.featured && (
            <div className="absolute bottom-3 left-3 px-2 py-1 bg-purple-600 text-[10px] font-black italic rounded uppercase tracking-tighter shadow-lg">
              NEW DROP
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
            <h3 className="font-bold uppercase text-sm tracking-tight group-hover:text-purple-400 transition-colors leading-none mb-1">
              {product.name}
            </h3>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
              {product.category} Edition
            </p>
          </div>
          <div className="text-right">
            <p className="text-purple-400 font-mono font-bold text-sm italic whitespace-nowrap">
              {product.variants && product.variants.length > 0 ? "From " : ""}₹{product.price}
            </p>
          </div>
        </div>
      </motion.div>
    </Link>
  );
};

export default ProductCard;
