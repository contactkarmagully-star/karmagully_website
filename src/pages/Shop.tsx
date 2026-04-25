import { motion } from 'motion/react';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Filter, SlidersHorizontal } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import { Product } from '../types';
import { getAllProducts } from '../services/productService';

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('search') || '';
  const categoryParam = searchParams.get('category') || 'All';

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const data = await getAllProducts();
        setProducts(data);
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const categories = ['All', ...new Set(products.map(p => p.category))];

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryParam === 'All' || p.category === categoryParam;
    return matchesSearch && matchesCategory;
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6"
    >
      <header className="mb-4 space-y-3">
        <div className="flex flex-col md:flex-row justify-between items-end gap-3 border-b border-white/5 pb-3">
          <div className="space-y-1">
            <h1 className="text-3xl md:text-5xl font-black italic uppercase leading-none tracking-tighter">
              The <span className="text-gradient">Collections</span>
            </h1>
            <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-[9px]">Filtering {filteredProducts.length} Exclusive Drops</p>
          </div>
          
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
            <input 
              type="text" 
              placeholder="Search Series..."
              value={searchQuery}
              onChange={(e) => setSearchParams({ search: e.target.value, category: categoryParam })}
              className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-[10px] font-bold uppercase tracking-widest focus:outline-none focus:border-purple-500 transition-all placeholder:text-white/5"
            />
          </div>
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                const params = new URLSearchParams(searchParams);
                params.set('category', cat as string);
                params.set('search', searchQuery);
                setSearchParams(params);
              }}
              className={`flex-shrink-0 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] italic border transition-all duration-300 ${
                categoryParam === cat 
                  ? 'bg-purple-600 border-purple-500 text-white' 
                  : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="aspect-[3/4] bg-white/5 animate-pulse rounded-xl" />)}
        </div>
      ) : filteredProducts.length > 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredProducts.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="py-32 text-center border border-dashed border-white/10 rounded-3xl">
          <p className="text-slate-600 font-black uppercase tracking-[0.4em] text-xs">No matching drops detected</p>
        </div>
      )}
    </motion.div>
  );
}
