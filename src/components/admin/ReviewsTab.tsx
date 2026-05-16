import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star, Trash2, Check, X, MessageSquare, 
  ExternalLink, Clock, Filter, Search,
  AlertCircle, Upload, Save, FileSpreadsheet
} from 'lucide-react';
import { Review, Product } from '../../types';
import { getAllReviews, updateReviewStatus, deleteReview, bulkAddReviews, getAllProducts } from '../../services/productService';

export default function ReviewsTab() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkData, setBulkData] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const [reviewData, productData] = await Promise.all([
        getAllReviews(),
        getAllProducts(500)
      ]);
      setReviews(reviewData);
      setProducts(productData);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleStatusUpdate = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await updateReviewStatus(id, status);
      fetchReviews();
    } catch (error) {
      alert('Failed to update status');
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    console.log("Deleting review:", id);
    try {
      await deleteReview(id);
      setReviews(prev => prev.filter(r => r.id !== id));
    } catch (error: any) {
      console.error('Delete error:', error);
      alert(`Failed to delete review: ${error.message || 'Unknown error'}`);
    } finally {
      setDeletingId(null);
    }
  };

  const [useSelectedForTotal, setUseSelectedForTotal] = useState(false);

  const handleBulkUpload = async (providedData?: string) => {
    const dataToProcess = providedData || bulkData;
    if (!dataToProcess.trim()) return;
    setIsUploading(true);
    
    try {
      // Robust Line Processing: Join lines that might have been split unexpectedly (simple heuristic)
      let rawLines = dataToProcess.trim().split(/\r?\n/);
      
      // Cleanup header split issue (like imageUr\nl)
      if (rawLines.length > 1 && rawLines[0].toLowerCase().includes('imageur') && rawLines[1].trim().toLowerCase() === 'l') {
        rawLines[0] = rawLines[0].trim() + rawLines[1].trim();
        rawLines.splice(1, 1);
      }

      const header = rawLines[0].toLowerCase().split(',').map(h => h.trim());
      const newReviews: any[] = [];
      let skippedCount = 0;
      
      for (let i = 1; i < rawLines.length; i++) {
        const line = rawLines[i].trim();
        if (!line) continue;

        // Robust CSV splitting
        const values: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let char of line) {
          if (char === '"') inQuotes = !inQuotes;
          else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim());

        if (values.length < 2) {
          skippedCount++;
          continue;
        }

        const row: any = {};
        header.forEach((h, idx) => {
          if (values[idx] !== undefined) row[h] = values[idx];
        });

        // Mapping Logic
        const pId = row.productid || row.productId || row.id || '';
        const targetProductId = useSelectedForTotal ? selectedProductId : (pId || selectedProductId);
        
        const review: any = {
          productId: targetProductId,
          name: row.name || row.author || row.user || 'Verified User',
          rating: Math.min(5, Math.max(1, parseInt(row.rating) || 5)),
          comment: row.comment || row.review || row.text || '',
          imageUrl: row.image || row.imageurl || row.imageUrl || row.photo || ''
        };

        if (!review.productId) {
           console.warn(`[BulkUplink] Skipping row ${i}: Missing product ID target. Available row data:`, row);
           skippedCount++;
           continue;
        }

        newReviews.length < 500 && newReviews.push(review); // Firestore batch limit
      }

      if (newReviews.length === 0) {
        alert(`No valid intel found. Processed ${rawLines.length - 1} entries, 0 mapped successfully.\nEnsure headers are correct (name, rating, comment).`);
        return;
      }

      await bulkAddReviews(newReviews);
      alert(`Uplink Complete: ${newReviews.length} records pushed. ${skippedCount} items skipped.`);
      setBulkData('');
      setShowBulkModal(false);
      fetchReviews();
    } catch (error: any) {
      console.error('Bulk upload error:', error);
      alert(`System Error during uplink: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setBulkData(content);
    };
    reader.readAsText(file);
  };

  const downloadSampleCSV = () => {
    // Including real product names/IDs in sample if available to help user understand
    const sampleProduct = products[0] ? `\nJane Smith,4,Good value!,${products[0].id},` : "";
    const csvContent = "name,rating,comment,productId,imageUrl\nJohn Doe,5,Excellent quality and fast shipping!,REPLACE_WITH_REAL_PRODUCT_ID,https://example.com/image1.jpg" + sampleProduct;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'karmagully_reviews_template.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const filteredReviews = reviews.filter(r => {
    const matchesFilter = filter === 'all' || r.status === filter;
    const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         r.comment.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative flex-grow sm:flex-grow-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <input 
              type="text"
              placeholder="Search reviews..."
              className="pl-10 pr-4 py-2 bg-black/20 border border-white/10 rounded-xl text-[10px] font-bold text-white outline-none focus:border-neon-purple w-full"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-1 bg-black/20 p-1 rounded-xl border border-white/10">
            {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-neon-purple text-white' : 'text-white/40 hover:text-white'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest"
          >
            <Upload className="w-4 h-4" />
            Bulk Import
          </button>
          <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10">
            <MessageSquare className="w-4 h-4 text-white/40" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">{filteredReviews.length} Records</span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showBulkModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBulkModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-dark-surface border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl"
            >
              <div className="p-8 space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">Bulk Uplink Intel</h3>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20 mt-1">Importing encrypted field reports</p>
                  </div>
                  <button onClick={() => setShowBulkModal(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                    <X className="w-6 h-6 text-white/40" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap gap-3">
                    <button 
                      onClick={downloadSampleCSV}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 text-purple-500 rounded-xl border border-purple-500/20 hover:bg-purple-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      Download Sample CSV
                    </button>
                    <label className="flex items-center gap-2 px-4 py-2 bg-white/5 text-white/60 rounded-xl border border-white/10 hover:bg-white/10 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest cursor-pointer">
                      <Upload className="w-4 h-4" />
                      Upload File
                      <input 
                        type="file" 
                        accept=".csv" 
                        onChange={handleFileChange}
                        className="hidden" 
                      />
                    </label>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">Target Identity</label>
                        <select 
                          value={selectedProductId}
                          onChange={(e) => setSelectedProductId(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-[10px] font-bold text-white outline-none focus:border-neon-purple"
                        >
                          <option value="">-- DEFAULT PRODUCT --</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-2xl border border-white/10 mt-auto">
                        <button
                          type="button"
                          onClick={() => setUseSelectedForTotal(!useSelectedForTotal)}
                          className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${useSelectedForTotal ? 'bg-emerald-500 border-emerald-500' : 'border-white/20 hover:border-white/40'}`}
                        >
                          {useSelectedForTotal && <Check className="w-3 h-3 text-white" />}
                        </button>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 cursor-pointer" onClick={() => setUseSelectedForTotal(!useSelectedForTotal)}>Force Use For All</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">CSV/Excel Data</label>
                      <div className="flex gap-4 items-center">
                        <button 
                          onClick={() => setBulkData('')}
                          className="text-[8px] text-pink-500 uppercase font-black tracking-widest hover:text-pink-400"
                        >
                          Clear
                        </button>
                        <span className="text-[8px] text-white/20 uppercase font-black tracking-widest">Headers: name, rating, comment, productId, imageUrl</span>
                      </div>
                    </div>
                    <textarea 
                      value={bulkData}
                      onChange={(e) => setBulkData(e.target.value)}
                      placeholder="name,rating,comment,productId,imageUrl&#10;John Doe,5,Killer product!,product_id_here,image_url_here"
                      className="w-full h-64 bg-black/40 border border-white/10 rounded-3xl p-6 text-[10px] font-mono text-emerald-500/80 outline-none focus:border-emerald-500/30 transition-all custom-scrollbar placeholder:text-white/5"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setShowBulkModal(false)}
                    className="flex-1 py-4 bg-white/5 text-white/40 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all"
                  >
                    Abort
                  </button>
                  <button 
                    onClick={() => handleBulkUpload()}
                    disabled={isUploading || !bulkData.trim()}
                    className="flex-2 py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale"
                  >
                    {isUploading ? 'Encrypting & Uplinking...' : 'Execute Bulk Uplink'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-8 h-8 border-2 border-neon-purple border-t-transparent rounded-full animate-spin" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/20">Scanning Records...</p>
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
          <AlertCircle className="w-8 h-8 text-white/10 mb-4" />
          <p className="text-xs font-bold uppercase tracking-widest text-white/20 italic">No reviews match the current uplink</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredReviews.map((review) => (
            <motion.div 
              key={review.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-dark-surface border border-white/10 rounded-3xl overflow-hidden flex flex-col group"
            >
              <div className="p-6 space-y-4 flex-grow">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-black italic uppercase tracking-tighter text-white">{review.name}</h4>
                    <div className="flex items-center gap-1 mt-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`w-3 h-3 ${i < review.rating ? 'text-amber-400 fill-amber-400' : 'text-white/10'}`} />
                      ))}
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest ${
                    review.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' :
                    review.status === 'rejected' ? 'bg-pink-500/10 text-pink-500' :
                    'bg-amber-500/10 text-amber-500'
                  }`}>
                    {review.status}
                  </div>
                </div>

                <p className="text-[11px] font-medium leading-relaxed text-white/60">"{review.comment}"</p>

                {review.imageUrl && (
                  <div className="relative aspect-video bg-black/40 rounded-2xl overflow-hidden border border-white/5">
                    <img src={review.imageUrl} className="w-full h-full object-cover" alt="Review" />
                    <a href={review.imageUrl} target="_blank" rel="noopener noreferrer" className="absolute top-2 right-2 p-2 bg-black/60 backdrop-blur-md rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

                      <div className="p-4 bg-white/5 border-t border-white/5 flex items-center justify-between">
                 <div className="flex items-center gap-2 text-[8px] font-bold text-white/20 uppercase tracking-widest">
                   <Clock className="w-3 h-3" />
                   {(() => {
                    const date = review.createdAt;
                    if (!date) return 'RECENT';
                    try {
                      // Handle Firestore Timestamp (seconds/nanoseconds or _seconds/_nanoseconds)
                      if (date && typeof date === 'object') {
                        const seconds = (date as any).seconds || (date as any)._seconds || ((date as any).toMillis ? (date as any).toMillis() / 1000 : null);
                        if (seconds) return new Date(seconds * 1000).toLocaleDateString();
                      }
                      
                      // Handle numeric timestamp (milliseconds)
                      if (typeof date === 'number') {
                        const d = new Date(date);
                        return isNaN(d.getTime()) ? 'RECENT' : d.toLocaleDateString();
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
                  })()}
                 </div>
                 <div className="flex items-center gap-2">
                   {review.status === 'pending' && (
                     <>
                       <button 
                         onClick={() => handleStatusUpdate(review.id, 'approved')}
                         className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-xl transition-all"
                       >
                         <Check className="w-3 h-3" />
                         <span className="text-[8px] font-black uppercase tracking-widest">Approve</span>
                       </button>
                       <button 
                         onClick={() => handleStatusUpdate(review.id, 'rejected')}
                         className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-white rounded-xl transition-all"
                       >
                         <X className="w-3 h-3" />
                         <span className="text-[8px] font-black uppercase tracking-widest">Reject</span>
                       </button>
                     </>
                   )}
                   {review.status === 'approved' && (
                      <button 
                         onClick={() => handleStatusUpdate(review.id, 'rejected')}
                         className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-white rounded-xl transition-all"
                       >
                         <X className="w-3 h-3" />
                         <span className="text-[8px] font-black uppercase tracking-widest">Reject</span>
                       </button>
                   )}
                    {review.status === 'rejected' && (
                      <button 
                         onClick={() => handleStatusUpdate(review.id, 'approved')}
                         className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-xl transition-all"
                       >
                         <Check className="w-3 h-3" />
                         <span className="text-[8px] font-black uppercase tracking-widest">Approve</span>
                       </button>
                   )}
                   {deletingId === review.id ? (
                      <button className="p-2 bg-pink-500/10 text-pink-500 rounded-xl ml-2"><Clock className="w-4 h-4 animate-spin" /></button>
                    ) : confirmingId === review.id ? (
                      <div className="flex gap-1 items-center animate-in fade-in slide-in-from-right-2 duration-200 ml-2">
                        <button 
                          onClick={() => { handleDelete(review.id); setConfirmingId(null); }} 
                          className="px-2 py-1.5 bg-red-600 text-white rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-red-700 transition-all font-bold"
                        >
                          Confirm
                        </button>
                        <button 
                          onClick={() => setConfirmingId(null)}
                          className="p-1 px-2 text-white/40 hover:text-white transition-all text-[8px] font-black uppercase tracking-widest font-bold"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setConfirmingId(review.id)}
                        className="p-2 bg-pink-500/10 hover:bg-pink-500 text-pink-500 hover:text-white rounded-xl transition-all ml-2"
                        title="Delete permanently"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                 </div>
               </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
