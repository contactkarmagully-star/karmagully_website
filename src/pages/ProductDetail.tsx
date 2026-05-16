import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingCart, ArrowLeft, ArrowRight, Truck, ShieldCheck, CreditCard, Star, Heart, Zap, Award, ChevronRight, TrendingUp, Sparkles, Play, Camera, StarHalf, MessageSquare, Plus, Check } from 'lucide-react';
import { useCart } from '../hooks/useCart';
import { Product, Category, AppSettings, Review, ProductVideo } from '../types';
import { useState, useEffect, useRef } from 'react';
import { getProductById, getAllProducts, getProductReviews, addReview, getProductVideos } from '../services/productService';
import { uploadToCloudinary } from '../lib/cloudinary';
import { subscribeToSettings } from '../services/settingsService';
import { useWishlist } from '../hooks/useWishlist';
import TrustBadges from '../components/TrustBadges';
import ProductCard from '../components/ProductCard';
import VideoPlayer from '../components/VideoPlayer';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const { isInWishlist, toggleWishlist } = useWishlist();
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  
  // Reviews & Videos
  const [reviews, setReviews] = useState<Review[]>([]);
  const [productVideos, setProductVideos] = useState<ProductVideo[]>([]);
  const [reviewForm, setReviewForm] = useState({ name: '', rating: 5, comment: '' });
  const [reviewImage, setReviewImage] = useState<File | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const reviewFileRef = useRef<HTMLInputElement>(null);

  // Gallery Logic
  const allImages = product ? [product.imageUrl, ...(product.images || [])].filter(Boolean) : [];
  const mergedVideos = product ? [...(product.videoUrls || []), ...productVideos.map(v => v.videoUrl)] : [];
  const finalVideos = Array.from(new Set(mergedVideos)).filter(Boolean);
  
  const galleryItems = [
    ...allImages.map(img => ({ type: 'image' as const, url: img as string })),
    ...finalVideos.map(vid => ({ type: 'video' as const, url: vid as string }))
  ];

  const [activeItem, setActiveItem] = useState(galleryItems[0] || { type: 'image', url: '' });

  useEffect(() => {
    if (galleryItems.length > 0 && (!activeItem.url || !galleryItems.find(i => i.url === activeItem.url))) {
      setActiveItem(galleryItems[0]);
    }
  }, [product, galleryItems.length]);

  useEffect(() => {
    return subscribeToSettings(setSettings);
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    const docRef = doc(db, 'products', id);
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const prodData = { id: snapshot.id, ...snapshot.data() } as Product;
        setProduct(prodData);
        if (prodData.variants && prodData.variants.length > 0 && !selectedVariant) {
          setSelectedVariant(prodData.variants[0]);
        }
      } else {
        setProduct(null);
      }
      setLoading(false);
    });

    const fetchExtra = async () => {
      try {
        const [reviewsData, videosData] = await Promise.all([
          getProductReviews(id),
          getProductVideos(id)
        ]);
        setReviews(reviewsData);
        setProductVideos(videosData);
      } catch (error) {
        console.error("Error fetching extra detail data:", error);
      }
    };

    fetchExtra();
    window.scrollTo(0, 0);
    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!product || !settings?.features.recommendations) return;
      try {
        const allProducts = await getAllProducts(100);
        const sameCategory = allProducts.filter(p => 
          p.id !== product.id && 
          (p.category === product.category || p.categories?.some(c => product.categories?.includes(c)))
        );
        
        const others = allProducts.filter(p => 
          p.id !== product.id && 
          !sameCategory.find(sc => sc.id === p.id)
        );

        const combined = [...sameCategory, ...others.sort(() => Math.random() - 0.5)].slice(0, 4);
        setRecommendations(combined);
      } catch (error) {
        console.error("Error fetching recommendations:", error);
      }
    };
    fetchRecommendations();
  }, [product?.id, settings?.features.recommendations]);

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

  const handleVariantSelect = (v: any) => {
    setSelectedVariant(v);
    if (settings?.features.variantImages && v.imageUrl) {
      setActiveItem({ type: 'image', url: v.imageUrl });
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || submittingReview) return;

    setSubmittingReview(true);
      console.log("Submitting review for product:", id);
    try {
      let imageUrl = '';
      if (reviewImage) {
        console.log("Uploading review image...");
        imageUrl = await uploadToCloudinary(reviewImage, 'image');
      }

      const reviewData: any = {
        productId: id,
        rating: reviewForm.rating,
        name: reviewForm.name,
        comment: reviewForm.comment,
      };

      if (imageUrl && imageUrl.length > 0) {
        reviewData.imageUrl = imageUrl;
      }

      console.log("Adding review to database...", reviewData);
      await addReview(reviewData);

      // Instant state update for better UX (with temporary fields for UI)
      const uiReview: Review = {
        ...reviewData,
        id: Date.now().toString(),
        status: 'approved',
        createdAt: Date.now()
      };
      setReviews(prev => [uiReview, ...prev]);
      
      alert('Review Published Successfully!');
      setReviewForm({ name: '', rating: 5, comment: '' });
      setReviewImage(null);
    } catch (error: any) {
      console.error("Submission error:", error);
      alert('Failed to publish review: ' + (error.message || 'Unknown error'));
    } finally {
      setSubmittingReview(false);
    }
  };

  const formatDate = (date: any) => {
    if (!date) return 'RECENT';
    try {
      // Handle Firestore Timestamp (seconds/nanoseconds or _seconds/_nanoseconds)
      if (date && typeof date === 'object') {
        const seconds = date.seconds || date._seconds || (date.toMillis ? date.toMillis() / 1000 : null);
        if (seconds) return new Date(seconds * 1000).toLocaleDateString();
      }
      
      // Handle numeric timestamp (milliseconds)
      if (typeof date === 'number') {
        return new Date(date).toLocaleDateString();
      }
      
      // Handle string date
      if (typeof date === 'string') {
        const d = new Date(date);
        if (!isNaN(d.getTime())) return d.toLocaleDateString();
      }
      
      return 'RECENT';
    } catch (e) {
      return 'RECENT';
    }
  };

  const averageRating = reviews.length > 0 
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : 0;

  const isFullyClaimed = product.isLimitedDrop && settings?.features.limitedDrops && product.dropQuantity ? (product.soldCount || 0) >= product.dropQuantity : false;
  const isOutOfStock = product.stock <= 0 || isFullyClaimed;

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
        {/* Left: Gallery Section */}
        <div className="space-y-6">
          <div className="relative aspect-[3/4] rounded-3xl overflow-hidden bg-dark-surface border border-white/10 group">
             <AnimatePresence mode="wait">
                {activeItem.type === 'image' && activeItem.url ? (
                  <motion.img 
                    key={activeItem.url}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    src={activeItem.url} 
                    alt={product.name} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : activeItem.type === 'video' && activeItem.url ? (
                  <motion.div
                    key={activeItem.url}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="w-full h-full"
                  >
                    <VideoPlayer url={activeItem.url} />
                  </motion.div>
                ) : (
                  <div className="w-full h-full bg-black/20 flex items-center justify-center">
                    <Camera className="w-12 h-12 text-white/10" />
                  </div>
                )}
             </AnimatePresence>
              <div className="absolute top-8 left-8 flex flex-col gap-2 z-10">
                {product.featured && (
                  <div className="px-4 py-2 bg-neon-purple text-white text-[10px] font-black uppercase tracking-widest italic rounded-lg shadow-2xl">
                    Featured Drop
                  </div>
                )}
                {product.isNewArrival && (
                  <div className="px-4 py-2 bg-neon-blue text-white text-[10px] font-black uppercase tracking-widest italic rounded-lg shadow-2xl flex items-center gap-2">
                    <Sparkles className="w-3 h-3 fill-white" />
                    New Arrival
                  </div>
                )}
                {product.isTrending && (
                  <div className="px-4 py-2 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest italic rounded-lg shadow-2xl flex items-center gap-2">
                    <TrendingUp className="w-3 h-3" />
                    Trending Now
                  </div>
                )}
              </div>
              {product.isLimitedDrop && settings?.features.limitedDrops && (
                <div className="absolute top-8 right-8 px-4 py-2 bg-amber-500 text-black text-[10px] font-black uppercase tracking-widest italic rounded-lg shadow-2xl z-10 flex items-center gap-2">
                  <Zap className="w-3 h-3 fill-black" />
                  Limited Drop
                </div>
              )}
          </div>
          
          {/* Gallery Thumbnails */}
          {galleryItems.length > 1 && (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-4">
              {galleryItems.map((item, idx) => (
                <button 
                  key={idx}
                  onClick={() => setActiveItem(item)}
                  className={`aspect-square rounded-xl border-2 transition-all overflow-hidden relative ${activeItem.url === item.url ? 'border-neon-purple scale-105' : 'border-white/5 opacity-40 hover:opacity-100'}`}
                >
                  {item.type === 'image' ? (
                    <img src={item.url || undefined} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-black flex items-center justify-center relative">
                      <Play className="w-4 h-4 text-white z-10" />
                      <video src={item.url || undefined} className="absolute inset-0 w-full h-full object-cover opacity-50" muted />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

        </div>

        {/* Right: Info Section */}
        <div className="flex flex-col space-y-10">
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-neon-blue text-[10px] font-black uppercase tracking-[0.4em] italic leading-none">
                {product.categories && product.categories.length > 0 ? (
                  product.categories.map(c => (
                    <Link key={c} to={`/shop?category=${c}`} className="hover:text-white transition-colors">{c}</Link>
                  ))
                ) : (
                  <Link to={`/shop?category=${product.category}`} className="hover:text-white transition-colors">{product.category}</Link>
                )}
                <span className="text-white/20 ml-2">Series</span>
              </div>
              <div className="flex justify-between items-start gap-4">
                <h1 className="text-6xl md:text-8xl font-black italic uppercase tracking-tighter leading-[0.9] flex-grow">{product.name}</h1>
                {settings?.features.wishlist && (
                  <button 
                    onClick={() => toggleWishlist(product.id)}
                    className={`p-4 rounded-2xl border transition-all shrink-0 ${isInWishlist(product.id) ? 'bg-pink-600 border-pink-600 text-white shadow-lg shadow-pink-500/20' : 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:border-white/20'}`}
                  >
                    <Heart className={`w-6 h-6 ${isInWishlist(product.id) ? 'fill-white' : ''}`} />
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-8">
              <div className="text-5xl font-black italic tracking-tighter text-white">
                ₹{selectedVariant ? selectedVariant.price : product.price}
              </div>
              <div className="flex flex-col">
                <span className={`text-[10px] font-black uppercase tracking-widest ${!isOutOfStock ? 'text-emerald-500' : 'text-pink-500'}`}>
                  {!isOutOfStock ? 'In Stock & Ready' : isFullyClaimed ? 'Fully Claimed' : 'Sold Out Permanently'}
                </span>
                <span className="text-[9px] text-white/30 font-bold uppercase tracking-widest">{!isOutOfStock ? 'Dispatched in 24 Hours' : 'Drop Terminated'}</span>
              </div>
            </div>

            {/* Limited Drop Scarcity Indicator */}
            {product.isLimitedDrop && settings?.features.limitedDrops && settings?.features.showStockOnDetails && product.dropQuantity && (
              <div className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-3xl space-y-4">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-2">
                       <Zap className="w-3 h-3 fill-amber-500" /> Rapid Stock Exhaustion
                    </p>
                    <p className="text-xl font-black italic tracking-tighter">Only {Math.max(0, product.dropQuantity - (product.soldCount || 0))} Items Remaining</p>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40">{Math.round(((product.soldCount || 0) / product.dropQuantity) * 100)}% Claimed</p>
                </div>
                <div className="h-2 bg-black/40 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, ((product.soldCount || 0) / product.dropQuantity) * 100)}%` }}
                    className="h-full bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]"
                  />
                </div>
              </div>
            )}

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
                    onClick={() => handleVariantSelect(v)}
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
              <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">DURABLE BUILD</p>
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
              disabled={isOutOfStock}
              className="w-full py-6 bg-white text-dark-bg font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-neon-purple hover:text-white transition-all shadow-2xl active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-3 relative group overflow-hidden"
            >
              <div className="absolute inset-0 bg-neon-blue/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative">
                {!isOutOfStock ? 'Secure Product Drop' : isFullyClaimed ? 'Fully Claimed' : 'Sold Out Permanently'}
              </span>
              <ShoppingCart className="w-6 h-6 relative" />
            </button>
            
            <div className="flex items-center justify-center gap-8 py-4 opacity-20 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
              <div className="text-[10px] font-black uppercase tracking-[0.3em]">Secure Checkout</div>
              <div className="text-[10px] font-black uppercase tracking-[0.3em]">COD ELIGIBLE</div>
              <div className="text-[10px] font-black uppercase tracking-[0.3em]">Secure Connection</div>
            </div>

            {settings && <TrustBadges settings={settings} />}
          </div>
        </div>
      </div>

      {/* Video Support */}
      {settings?.features.videoSection && finalVideos.length > 0 && (
        <section className="mt-32 space-y-12">
          <div className="flex flex-col items-center text-center gap-6">
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-neon-purple italic">Real Life Demo</p>
              <h2 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter">See it in <span className="text-gradient">Real Life</span></h2>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/20 max-w-sm leading-relaxed">
              Experience the product in action through cinematic community captures.
            </p>
          </div>

          <div className="relative">
             <div className="flex gap-4 overflow-x-auto pb-8 snap-x no-scrollbar px-4">
                {finalVideos.map((url, idx) => (
                   <motion.div 
                    key={idx}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex-shrink-0 w-64 md:w-80 aspect-[9/16] bg-dark-surface rounded-[2rem] overflow-hidden border border-white/5 shadow-2xl snap-center group relative"
                   >
                      <VideoPlayer url={url} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-6 pointer-events-none">
                         <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-dark-bg mb-4 mt-auto">
                            <Play className="w-5 h-5 fill-current ml-1" />
                         </div>
                         <p className="text-[10px] font-black uppercase tracking-widest text-white">Authentic Showcase</p>
                      </div>
                   </motion.div>
                ))}
             </div>
          </div>
        </section>
      )}

      {/* Collection Navigation */}
      <section className="mt-32 p-12 md:p-24 bg-white/5 border border-white/5 rounded-[4rem] text-center space-y-12 overflow-hidden relative group">
        <div className="absolute inset-0 bg-gradient-to-tr from-purple-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        <div className="relative space-y-6">
          <p className="text-[10px] font-black uppercase tracking-[0.6em] text-neon-blue italic">Related Collection</p>
          <h2 className="text-5xl md:text-8xl font-black italic uppercase tracking-tighter leading-none">Explore more from <br/> this <span className="text-gradient leading-normal">{product.category}</span></h2>
          <div className="pt-4">
             <button 
               onClick={() => navigate(`/shop?category=${product.category}`)}
               className="px-12 py-5 bg-white text-dark-bg font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-neon-purple hover:text-white transition-all shadow-2xl active:scale-95"
             >
               View Collection
             </button>
          </div>
        </div>
      </section>

      {/* Recommendations */}
      {settings?.features.recommendations && recommendations.length > 0 && (
        <section className="mt-32 space-y-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 italic">Curated Selection</p>
              <h2 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter">You may also <span className="text-gradient">like</span></h2>
            </div>
            <Link to="/shop" className="flex items-center gap-2 group text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-all">
              Explore All <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            <AnimatePresence>
              {recommendations.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}

      {/* Reviews Section - MOVED TO BOTTOM */}
      {settings?.features.reviews && (
        <section className="mt-32 space-y-16 pb-32" id="reviews">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
            {/* Review Stats */}
            <div className="lg:col-span-4 space-y-8">
               <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-neon-blue italic">Community Verdict</p>
                <h2 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter">Verified <br/> <span className="text-gradient">Collections</span></h2>
              </div>

              <div className="p-8 bg-white/5 border border-white/5 rounded-[2rem] space-y-6">
                 <div className="flex items-center gap-4">
                    <div className="text-6xl font-black italic tracking-tighter">{averageRating}</div>
                    <div>
                       <div className="flex gap-1 mb-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                             <Star key={i} className={`w-4 h-4 ${i < Math.round(Number(averageRating)) ? 'text-amber-400 fill-current' : 'text-white/10'}`} />
                          ))}
                       </div>
                       <p className="text-[10px] font-black uppercase tracking-widest text-white/40 italic">Based on {reviews.length} Intel Records</p>
                    </div>
                 </div>

                 <div className="space-y-3 border-t border-white/5 pt-6">
                    {[5,4,3,2,1].map(star => {
                       const count = reviews.filter(r => r.rating === star).length;
                       const percent = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                       return (
                          <div key={star} className="flex items-center gap-3">
                             <span className="text-[9px] font-black text-white/40 w-4">{star}</span>
                             <div className="flex-grow h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  whileInView={{ width: `${percent}%` }}
                                  className="h-full bg-emerald-500" 
                                />
                             </div>
                             <span className="text-[9px] font-black text-white/40 w-8">{Math.round(percent)}%</span>
                          </div>
                       )
                    })}
                 </div>

                 <button 
                  onClick={() => document.getElementById('review-form')?.scrollIntoView({ behavior: 'smooth' })}
                  className="w-full py-4 bg-neon-blue/10 border border-neon-blue/20 rounded-xl text-[10px] font-black uppercase tracking-widest text-neon-blue hover:bg-neon-blue hover:text-white transition-all shadow-[0_0_20px_rgba(0,163,255,0.1)]"
                 >
                    CONTRIBUTE Intel
                 </button>
              </div>
            </div>

            {/* Review List & Form */}
            <div className="lg:col-span-8 space-y-12">
               <div className="space-y-8">
                  <div className="flex justify-between items-center border-b border-white/5 pb-4">
                     <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 italic">Recent Uplinks</h3>
                  </div>

                  <div className="grid gap-6">
                     {reviews.length === 0 ? (
                       <div className="py-20 text-center border border-dashed border-white/10 rounded-[2rem] bg-white/[0.02]">
                          <MessageSquare className="w-8 h-8 text-white/10 mx-auto mb-4" />
                          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">No public records found yet.</p>
                       </div>
                     ) : (
                       (showAllReviews ? reviews : reviews.slice(0, 10)).map((review, idx) => (
                         <motion.div 
                           key={review.id}
                           initial={{ opacity: 0, y: 20 }}
                           animate={{ opacity: 1, y: 0 }}
                           transition={{ delay: idx * 0.1 }}
                           className="p-8 bg-white/[0.02] border border-white/5 rounded-[2.5rem] flex flex-col md:flex-row gap-8 group hover:bg-white/[0.04] transition-colors"
                         >
                            <div className="flex-grow space-y-4">
                               <div className="flex justify-between items-start">
                                  <div>
                                     <div className="flex gap-1 mb-2">
                                        {Array.from({ length: 5 }).map((_, i) => (
                                           <Star key={i} className={`w-3 h-3 ${i < review.rating ? 'text-amber-400 fill-current' : 'text-white/10'}`} />
                                        ))}
                                     </div>
                                     <h4 className="text-sm font-black uppercase italic tracking-tighter text-white tracking-widest">{review.name}</h4>
                                     <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.3em] mt-1">Verified Drop • {formatDate(review.createdAt)}</p>
                                  </div>
                               </div>
                               <p className="text-white/60 leading-relaxed text-sm font-medium italic">"{review.comment}"</p>
                            </div>
                            {review.imageUrl && (
                               <div className="w-full md:w-32 aspect-square rounded-2xl overflow-hidden border border-white/10 bg-black shrink-0 relative">
                                  <img src={review.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                  <div className="absolute inset-0 bg-neon-blue/10 mix-blend-overlay opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            )}
                         </motion.div>
                       ))
                     )}
                  </div>

                  {reviews.length > 10 && !showAllReviews && (
                    <button 
                      onClick={() => setShowAllReviews(true)}
                      className="w-full py-6 mt-8 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] text-white hover:bg-white hover:text-dark-bg transition-all"
                    >
                      Show More Recon Reports ({reviews.length - 10} hidden)
                    </button>
                  )}
               </div>

               {/* Write Review Form - Redesigned */}
               <div id="review-form" className="pt-16 space-y-10">
                  <div className="space-y-4">
                    <h3 className="text-2xl font-black italic uppercase tracking-tighter">Publish your <span className="text-gradient">Review</span></h3>
                    <div className="h-px w-24 bg-gradient-to-r from-neon-blue to-transparent" />
                  </div>

                  <form onSubmit={handleSubmitReview} className="space-y-8 bg-white/[0.01] p-10 rounded-[3.5rem] border border-white/5 relative overflow-hidden group/form shadow-2xl">
                     <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover/form:opacity-[0.07] transition-opacity duration-1000 rotate-12">
                        <Zap className="w-48 h-48 text-neon-blue" />
                     </div>
                     <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-neon-purple/5 blur-[100px] rounded-full" />
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                        <div className="space-y-3">
                           <label className="text-[9px] font-black uppercase tracking-[0.4em] text-white/40 ml-1">Name</label>
                           <input 
                              required
                              className="w-full bg-white/[0.03] border border-white/5 rounded-2xl p-5 text-xs font-medium outline-none focus:border-neon-blue/50 focus:bg-white/[0.05] transition-all placeholder:text-white/10 text-white italic tracking-widest"
                              placeholder="Enter your name"
                              value={reviewForm.name}
                              onChange={e => setReviewForm({...reviewForm, name: e.target.value})}
                           />
                        </div>
                        <div className="space-y-3">
                           <label className="text-[9px] font-black uppercase tracking-[0.4em] text-white/40 ml-1">Give Stars</label>
                           <div className="flex gap-3 p-4 bg-white/[0.03] border border-white/5 rounded-2xl justify-center items-center">
                              {[1,2,3,4,5].map(star => (
                                 <button 
                                   key={star} 
                                   type="button"
                                   onClick={() => setReviewForm({...reviewForm, rating: star})}
                                   className="transition-all hover:scale-125 focus:outline-none"
                                 >
                                    <Star className={`w-6 h-6 ${star <= reviewForm.rating ? 'text-amber-400 fill-current drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]' : 'text-white/5 hover:text-white/20'}`} />
                                 </button>
                              ))}
                           </div>
                        </div>
                     </div>

                     <div className="space-y-3">
                        <label className="text-[9px] font-black uppercase tracking-[0.4em] text-white/40 ml-1">Message / Caption</label>
                        <textarea 
                           required
                           rows={4}
                           className="w-full bg-white/[0.03] border border-white/5 rounded-3xl p-6 text-xs font-medium outline-none focus:border-neon-blue/50 focus:bg-white/[0.05] transition-all resize-none placeholder:text-white/10 text-white leading-relaxed italic"
                           placeholder="Share your experience..."
                           value={reviewForm.comment}
                           onChange={e => setReviewForm({...reviewForm, comment: e.target.value})}
                        />
                     </div>

                     <div className="space-y-3">
                        <label className="text-[9px] font-black uppercase tracking-[0.4em] text-white/40 ml-1">Upload Product Preview (Optional)</label>
                        <div 
                          onClick={() => reviewFileRef.current?.click()}
                          className="w-full h-40 border-2 border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:bg-white/[0.05] hover:border-neon-blue/30 transition-all group/upload relative group-hover/form:border-white/10"
                        >
                           {reviewImage ? (
                              <div className="flex flex-col items-center gap-4 text-emerald-400">
                                 <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center">
                                    <Check className="w-6 h-6" />
                                 </div>
                                 <p className="text-[10px] font-black uppercase tracking-[0.3em] font-mono">{reviewImage.name.toUpperCase()}</p>
                                 <button type="button" onClick={(e) => { e.stopPropagation(); setReviewImage(null); }} className="text-[9px] font-black uppercase tracking-widest text-white/20 hover:text-red-400 border-t border-white/5 pt-2 mt-2">Abort Upload</button>
                              </div>
                           ) : (
                              <>
                                <div className="w-14 h-14 bg-white/[0.02] rounded-full flex items-center justify-center mb-4 group-hover/upload:scale-110 group-hover/upload:bg-neon-blue/10 transition-all">
                                   <Camera className="w-6 h-6 text-white/10 group-hover/upload:text-neon-blue transition-colors" />
                                </div>
                                <span className="text-[9px] font-black uppercase tracking-[0.4em] text-white/20">Upload Preview</span>
                                <span className="text-[8px] font-bold text-white/5 mt-1">DRAG & DROP OR EXPLORE_GALLERY</span>
                              </>
                           )}
                           <input 
                              type="file" 
                              ref={reviewFileRef}
                              accept="image/*"
                              className="hidden"
                              onChange={e => setReviewImage(e.target.files?.[0] || null)}
                           />
                        </div>
                     </div>

                     <button 
                        type="submit"
                        disabled={submittingReview}
                        className="w-full py-6 bg-neon-blue text-white font-black uppercase tracking-[0.5em] rounded-2xl hover:bg-white hover:text-dark-bg transition-all shadow-[0_0_40px_rgba(0,163,255,0.2)] flex items-center justify-center gap-4 disabled:opacity-50 text-xs relative overflow-hidden group/btn"
                     >
                        <div className="absolute inset-y-0 left-0 w-1 bg-white opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                        {submittingReview ? (
                          <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <Check className="w-5 h-5" />
                            <span>Publish Review</span>
                          </>
                        )}
                        <ArrowRight className="w-4 h-4 opacity-0 -translate-x-4 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all" />
                     </button>
                  </form>
               </div>
            </div>
          </div>
        </section>
      )}
    </motion.div>
  );
}
