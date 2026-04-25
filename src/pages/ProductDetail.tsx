import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ShoppingCart, ArrowLeft, Truck, ShieldCheck, CreditCard, Star } from 'lucide-react';
import { useCart } from '../hooks/useCart';
import { Product } from '../types';
import { useState, useEffect } from 'react';
import { getProductById } from '../services/productService';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState('');
  const [selectedVariant, setSelectedVariant] = useState<any>(null);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      try {
        const data = await getProductById(id);
        setProduct(data);
        if (data?.imageUrl) setActiveImage(data.imageUrl);
        if (data?.variants && data.variants.length > 0) {
          setSelectedVariant(data.variants[0]);
        }
      } catch (error) {
        console.error("Error fetching product:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg">
        <div className="w-12 h-12 border-4 border-neon-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg">
        <p className="text-white/40 uppercase tracking-widest font-black">Drop mission failed. Product missing.</p>
      </div>
    );
  }

  const handleAddToCart = () => {
    if (product) {
      addToCart(
        product, 
        quantity, 
        selectedVariant ? selectedVariant.price : product.price,
        selectedVariant ? selectedVariant.name : undefined
      );
      navigate('/checkout');
    }
  };

  const allImages = [product.imageUrl, ...(product.images || [])].filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
    >
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-white/30 hover:text-white transition-all mb-12 uppercase text-[10px] tracking-widest font-black italic group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Return to Collections
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
        {/* Left: Image Section */}
        <div className="space-y-6">
          <div className="relative aspect-[3/4] rounded-3xl overflow-hidden bg-dark-surface border border-white/10 group">
             <motion.img 
                key={activeImage}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                src={activeImage} 
                alt={product.name} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              {product.featured && (
                <div className="absolute top-8 left-8 px-4 py-2 bg-neon-purple text-white text-[10px] font-black uppercase tracking-widest italic rounded-lg shadow-2xl">
                  Limited Drop
                </div>
              )}
          </div>
          
          {/* Gallery Thumbnails */}
          {allImages.length > 1 && (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-4">
              {allImages.map((img, idx) => (
                <button 
                  key={idx}
                  onClick={() => setActiveImage(img)}
                  className={`aspect-square rounded-xl border-2 transition-all overflow-hidden ${activeImage === img ? 'border-neon-purple scale-105' : 'border-white/5 opacity-40 hover:opacity-100'}`}
                >
                  <img src={img} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Video Support */}
          {product.videoUrl && (
            <div className="mt-8 p-6 bg-white/5 rounded-3xl border border-white/5">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-4">Cinematic Showcase</h4>
              {product.videoUrl.includes('youtube.com') || product.videoUrl.includes('youtu.be') ? (
                <div className="aspect-video rounded-2xl overflow-hidden shadow-2xl">
                   <iframe 
                      className="w-full h-full"
                      src={product.videoUrl.replace('watch?v=', 'embed/')} 
                      title="Product Video"
                      allowFullScreen
                   ></iframe>
                </div>
              ) : (
                <video 
                  src={product.videoUrl} 
                  controls 
                  className="w-full rounded-2xl shadow-2xl"
                />
              )}
            </div>
          )}
        </div>

        {/* Right: Info Section */}
        <div className="flex flex-col space-y-10">
          <div className="space-y-6">
            <div className="space-y-4">
              <span className="text-neon-blue text-[10px] font-black uppercase tracking-[0.5em] italic leading-none">{product.category} Series</span>
              <h1 className="text-6xl md:text-8xl font-black italic uppercase tracking-tighter leading-[0.9]">{product.name}</h1>
            </div>
            
            <div className="flex items-center gap-8">
              <div className="text-5xl font-black italic tracking-tighter text-white">
                ₹{selectedVariant ? selectedVariant.price : product.price}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">In Stock & Ready</span>
                <span className="text-[9px] text-white/30 font-bold uppercase tracking-widest">Dispatched in 24 Hours</span>
              </div>
            </div>

            <p className="text-white/40 text-lg leading-relaxed font-medium">
              {product.description}
            </p>
          </div>

          {/* Variants Selection */}
          {product.variants && product.variants.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-white/20">Select Version</h4>
              <div className="flex flex-wrap gap-3">
                {product.variants.map((v) => (
                  <button 
                    key={v.id}
                    onClick={() => setSelectedVariant(v)}
                    className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${selectedVariant?.id === v.id ? 'bg-white text-dark-bg border-white scale-105' : 'bg-white/5 text-white/50 border-white/10 hover:border-white/20'}`}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="p-6 bg-white/5 rounded-3xl border border-white/5 space-y-2 group hover:bg-white/10 transition-colors">
              <Truck className="w-5 h-5 text-neon-blue" />
              <p className="text-xs font-black uppercase tracking-widest text-white">Rapid Ship</p>
              <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">Pan-India Express</p>
            </div>
            <div className="p-6 bg-white/5 rounded-3xl border border-white/5 space-y-2 group hover:bg-white/10 transition-colors">
              <ShieldCheck className="w-5 h-5 text-neon-purple" />
              <p className="text-xs font-black uppercase tracking-widest text-white">Indestructible</p>
              <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">Lifetime Warranty</p>
            </div>
          </div>

          <div className="space-y-8 pt-8 border-t border-white/5">
            <div className="flex items-center justify-between gap-6">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/20 italic">Units to Drop</span>
              <div className="flex items-center gap-6 bg-white/5 p-2 rounded-2xl border border-white/10">
                <button 
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="w-12 h-12 flex items-center justify-center hover:bg-white/10 rounded-xl transition-all font-black text-xl"
                >-</button>
                <span className="w-6 text-center font-black italic text-xl">{quantity}</span>
                <button 
                   onClick={() => setQuantity(q => q + 1)}
                   className="w-12 h-12 flex items-center justify-center hover:bg-white/10 rounded-xl transition-all font-black text-xl"
                >+</button>
              </div>
            </div>

            <button 
              onClick={handleAddToCart}
              disabled={product.stock <= 0}
              className="w-full py-6 bg-white text-dark-bg font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-neon-purple hover:text-white transition-all shadow-2xl active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-3 relative group overflow-hidden"
            >
              <div className="absolute inset-0 bg-neon-blue/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative">
                {product.stock > 0 ? 'Secure Product Drop' : 'Sold Out Permanently'}
              </span>
              <ShoppingCart className="w-6 h-6 relative" />
            </button>
            
            <div className="flex items-center justify-center gap-8 py-4 opacity-20 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
              <div className="text-[10px] font-black uppercase tracking-[0.3em]">PCI Compliant</div>
              <div className="text-[10px] font-black uppercase tracking-[0.3em]">COD ELIGIBLE</div>
              <div className="text-[10px] font-black uppercase tracking-[0.3em]">256-BIT SSL</div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
