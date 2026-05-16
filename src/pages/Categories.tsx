import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Tag, ChevronRight } from 'lucide-react';
import { getAllCategories } from '../services/categoryService';
import { Category } from '../types';

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const data = await getAllCategories();
        setCategories(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-neon-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-purple-500 mb-2">Explore</p>
          <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter uppercase">Browse <span className="text-gradient">Categories</span></h1>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 sm:gap-8">
          {categories.map((cat, idx) => (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="flex flex-col items-center"
            >
              <Link to={`/shop?category=${cat.name}`} className="group flex flex-col items-center gap-4 w-full">
                <div className="relative aspect-square w-full rounded-full overflow-hidden border-2 border-white/10 bg-white/5 transition-all group-hover:border-purple-500 group-hover:shadow-[0_0_20px_rgba(168,85,247,0.3)]">
                  <img 
                    src={cat.imageUrl || undefined} 
                    alt={cat.name} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                </div>
                <div className="text-center">
                  <h3 className="text-sm md:text-base font-black italic uppercase tracking-tighter text-white group-hover:text-purple-500 transition-colors uppercase">{cat.name}</h3>
                  <div className="mt-1 h-0.5 w-0 group-hover:w-full bg-purple-500 mx-auto transition-all duration-300" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {categories.length === 0 && (
          <div className="text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
            <Tag className="w-16 h-16 text-white/5 mx-auto mb-4" />
            <p className="text-white/40 font-black uppercase tracking-widest text-xs">No categories found in the vault.</p>
          </div>
        )}
      </div>
    </div>
  );
}
