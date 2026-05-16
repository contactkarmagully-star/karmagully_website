import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Trash2, Video, Search, AlertCircle, FileVideo, 
  ExternalLink, MoveUp, MoveDown, Package, Upload, Clock, X
} from 'lucide-react';
import { Product, ProductVideo, AppSettings } from '../../types';
import { getAllProducts, getProductVideos, addProductVideo, deleteProductVideo, getAllProductVideos } from '../../services/productService';
import { uploadToCloudinary } from '../../lib/cloudinary';

export default function VideosTab({ settings }: { settings: AppSettings }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [videos, setVideos] = useState<ProductVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProducts = async () => {
    try {
      const data = await getAllProducts();
      setProducts(data);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchVideos = async () => {
    setLoading(true);
    try {
      if (selectedProductId) {
        const data = await getProductVideos(selectedProductId);
        setVideos(data);
      } else {
        // Fetch all videos, which includes general ones (productId is null)
        const data = await getAllProductVideos(100);
        setVideos(data);
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    fetchVideos();
  }, [selectedProductId]);

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 100 * 1024 * 1024) {
      alert('Video too large (Max 100MB)');
      return;
    }

    setUploading(true);
    try {
      const videoUrl = await uploadToCloudinary(
        file, 
        'video'
      );
      
      const newVideo = {
        productId: selectedProductId || undefined,
        videoUrl,
        order: videos.length
      };

      await addProductVideo(newVideo);
      
      // Local state update for instant feedback
      setVideos(prev => [{ ...newVideo, id: Date.now().toString(), createdAt: Date.now() } as ProductVideo, ...prev]);
      
      alert('Video uploaded successfully');
    } catch (error: any) {
      alert('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    console.log("Deleting video reel:", id);
    try {
      await deleteProductVideo(id);
      fetchVideos();
    } catch (error: any) {
      console.error('Delete error:', error);
      alert(`Failed to delete video: ${error.message || 'Check your permissions'}`);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Product Selection */}
      <div className="space-y-6">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-neon-blue flex items-center gap-2">
          <Package className="w-4 h-4" /> Select Product
        </h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
          <input 
            type="text"
            placeholder="Search products..."
            className="w-full pl-10 pr-4 py-3 bg-black/20 border border-white/10 rounded-2xl text-[11px] font-bold text-white outline-none focus:border-neon-blue"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden max-h-[500px] overflow-y-auto custom-scrollbar">
          <button
            onClick={() => setSelectedProductId(null)}
            className={`w-full p-4 flex items-center gap-4 transition-all text-left group ${selectedProductId === null ? 'bg-neon-purple text-white' : 'hover:bg-white/5 text-white/40'}`}
          >
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-black/40 shrink-0 flex items-center justify-center">
              <Video className="w-5 h-5 text-white/20" />
            </div>
            <div className="flex-grow min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest truncate">General / All Reels</p>
              <p className={`text-[8px] font-bold uppercase tracking-[0.2em] mt-0.5 ${selectedProductId === null ? 'text-white/60' : 'text-white/20'}`}>Community Stream</p>
            </div>
          </button>
          {filteredProducts.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedProductId(p.id)}
              className={`w-full p-4 flex items-center gap-4 transition-all text-left group ${selectedProductId === p.id ? 'bg-neon-blue text-white' : 'hover:bg-white/5 text-white/40'}`}
            >
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-black/40 shrink-0">
                <img src={p.imageUrl} className="w-full h-full object-cover" alt={p.name} />
              </div>
              <div className="flex-grow min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest truncate">{p.name}</p>
                <p className={`text-[8px] font-bold uppercase tracking-[0.2em] mt-0.5 ${selectedProductId === p.id ? 'text-white/60' : 'text-white/20'}`}>₹{p.price}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Video Content */}
      <div className="lg:col-span-2 space-y-6">
        <div className="flex justify-between items-center bg-white/5 p-4 rounded-3xl border border-white/10">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/60 flex items-center gap-3">
             <Video className="w-5 h-5 text-neon-purple" /> 
             {products.find(p => p.id === selectedProductId)?.name || 'Product'} Reels
          </h3>
          <div className="flex items-center gap-2">
            <input 
              type="file" 
              ref={fileInputRef}
              accept="video/*"
              onChange={handleVideoUpload}
              className="hidden"
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${uploading ? 'bg-white/5 text-white/20' : 'bg-neon-purple text-white hover:scale-105 neon-shadow-purple'}`}
            >
               {uploading ? (
                 <div className="w-3 h-3 border border-white/20 border-t-white rounded-full animate-spin" />
               ) : (
                 <Upload className="w-3 h-3" />
               )}
               {uploading ? 'UPLOADING...' : 'ADD REEL'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10 gap-4">
            <div className="w-8 h-8 border-2 border-neon-purple border-t-transparent rounded-full animate-spin" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/20">Accessing Cloud Files...</p>
          </div>
        ) : videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10 text-center px-8">
            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-4">
              <FileVideo className="w-6 h-6 text-white/10" />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/20 italic">No Reels Found for this Segment</p>
            <p className="text-[9px] font-medium text-white/10 uppercase tracking-[0.2em] mt-2 max-w-xs leading-relaxed">
              Upload short demo videos to build high-conversion trust. Max 100MB per reel.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {videos.map((vid) => (
              <motion.div 
                key={vid.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative aspect-[9/16] bg-black rounded-3xl overflow-hidden group shadow-2xl"
              >
                <video 
                  src={vid.videoUrl} 
                  className="w-full h-full object-cover" 
                  muted 
                  playsInline 
                  onMouseOver={e => e.currentTarget.play()}
                  onMouseOut={e => {
                    e.currentTarget.pause();
                    e.currentTarget.currentTime = 0;
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent flex flex-col justify-end p-4 gap-2">
                   <div className="flex gap-2">
                     {deletingId === vid.id ? (
                        <button className="flex-grow py-3 bg-pink-500/10 text-pink-500 rounded-xl"><Clock className="w-5 h-5 mx-auto animate-spin" /></button>
                      ) : confirmingId === vid.id ? (
                        <div className="flex-grow flex gap-2 animate-in fade-in slide-in-from-right-2 duration-200">
                          <button 
                            onClick={() => { handleDelete(vid.id); setConfirmingId(null); }} 
                            className="flex-grow py-3 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg"
                          >
                            Confirm
                          </button>
                          <button onClick={() => setConfirmingId(null)} className="px-3 py-3 bg-white/10 text-white/40 hover:text-white rounded-xl">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setConfirmingId(vid.id)}
                          className="flex-grow py-3 bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-red-500/30"
                        >
                          DELETE REEL
                        </button>
                      )}
                      <a 
                        href={vid.videoUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-3 bg-white/10 hover:bg-white text-white hover:text-black rounded-xl transition-all"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                   </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
