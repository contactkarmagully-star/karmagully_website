import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart3, Package, ShoppingBag, Settings as SettingsIcon, LogOut, 
  Plus, Edit2, Trash2, Check, Clock, TrendingUp, Search,
  ChevronRight, X, Database, ShieldAlert, Tag, Bell, FileText, Image as ImageIcon, Video, MoveUp, MoveDown
} from 'lucide-react';
import { Product, Order } from '../types';
import { getAllProducts, addProduct, updateProduct, deleteProduct } from '../services/productService';
import { getAllOrders, updateOrderStatus, updatePaymentStatus } from '../services/orderService';
import { getAllAdmins, addAdmin, removeAdmin, isUserAdmin, Admin } from '../services/adminService';
import { getSettings, updateSettings, AppSettings, DEFAULT_SETTINGS } from '../services/settingsService';
import { getAllCoupons, addCoupon, deleteCoupon, Coupon } from '../services/couponService';
import { auth, db } from '../lib/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { seedProducts } from '../seed';
const API_BASE = "https://karmagully-website.onrender.com";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'orders' | 'admins' | 'settings' | 'coupons' | 'pages'>('overview');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [pages, setPages] = useState<any[]>([]);
  const [settings, setSettingsState] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        const isAdminAuth = localStorage.getItem('admin_auth') === 'true';
        if (!user || !isAdminAuth) {
          localStorage.removeItem('admin_auth');
          navigate('/admin/login');
          return;
        }

        const isAuthorized = await isUserAdmin(user.uid, user.email || '');
        if (!isAuthorized) {
          localStorage.removeItem('admin_auth');
          navigate('/admin/login');
          return;
        }

        setAuthLoading(false);
        fetchData();
      } catch (err) {
        console.error("Auth check error:", err);
        navigate('/admin/login');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [productsData, ordersData, adminsData, settingsData, couponsData, pagesSnap] = await Promise.all([
        getAllProducts(),
        getAllOrders(),
        getAllAdmins(),
        getSettings(),
        getAllCoupons(),
        getDocs(query(collection(db, 'pages'), orderBy('updatedAt', 'desc')))
      ]);
      setProducts(productsData);
      setOrders(ordersData);
      setAdmins(adminsData);
      setSettingsState(settingsData);
      setCoupons(couponsData);
      setPages(pagesSnap.docs.map(doc => ({ slug: doc.id, ...doc.data() })));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    localStorage.removeItem('admin_auth');
    navigate('/admin/login');
  };

  const handleSeedData = async () => {
    if (confirm('Add sample products to your database?')) {
      setSeeding(true);
      try {
        await seedProducts();
        await fetchData();
      } catch (err) {
        console.error(err);
        alert('Seeding failed. Check console.');
      } finally {
        setSeeding(false);
      }
    }
  };

  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState<Omit<Product, 'id' | 'createdAt'>>({
    name: '',
    price: 0,
    description: '',
    imageUrl: '',
    images: [],
    videoUrl: '',
    category: '',
    stock: 0,
    isCOD: true,
    featured: false,
    variants: []
  });

  useEffect(() => {
    if (editingProduct) {
      setProductForm({
        name: editingProduct.name,
        price: editingProduct.price,
        description: editingProduct.description,
        imageUrl: editingProduct.imageUrl || '',
        images: editingProduct.images || [],
        videoUrl: editingProduct.videoUrl || '',
        category: editingProduct.category,
        stock: editingProduct.stock,
        isCOD: editingProduct.isCOD,
        featured: !!editingProduct.featured,
        variants: editingProduct.variants || []
      });
    } else {
      setProductForm({
        name: '',
        price: 0,
        description: '',
        imageUrl: '',
        images: [],
        videoUrl: '',
        category: '',
        stock: 0,
        isCOD: true,
        featured: false,
        variants: []
      });
    }
  }, [editingProduct]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'imageUrl' | 'images') => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        if (field === 'imageUrl') {
          setProductForm(prev => ({ ...prev, imageUrl: base64 }));
        } else {
          setProductForm(prev => ({ ...prev, images: [...prev.images, base64] }));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAddField = (field: 'images' | 'variants') => {
    if (field === 'images') {
      setProductForm(prev => ({ ...prev, images: [...prev.images, ''] }));
    } else {
      const newVariant = { id: Date.now().toString(), name: '', price: productForm.price };
      setProductForm(prev => ({ ...prev, variants: [...(prev.variants || []), newVariant] }));
    }
  };

  const handleRemoveField = (field: 'images' | 'variants', index: number) => {
    if (field === 'images') {
      setProductForm(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
    } else {
      setProductForm(prev => ({ ...prev, variants: prev.variants?.filter((_, i) => i !== index) }));
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, productForm);
      } else {
        await addProduct(productForm);
      }
      setShowProductModal(false);
      setEditingProduct(null);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to save product');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      await deleteProduct(id);
      fetchData();
    }
  };

  const handleUpdateStatus = async (id: string, status: Order['orderStatus']) => {
    await updateOrderStatus(id, status);
    fetchData();
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg text-white">
        <div className="w-12 h-12 border-4 border-neon-purple border-t-transparent rounded-full animate-spin shadow-[0_0_20px_rgba(168,85,247,0.3)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg flex">
      {/* Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-2xl bg-dark-surface border border-white/10 rounded-3xl p-8 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black uppercase italic tracking-tighter">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button onClick={() => { setShowProductModal(false); setEditingProduct(null); }} className="p-2 hover:bg-white/5 rounded-full"><X /></button>
            </div>
            <form onSubmit={handleSaveProduct} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <AdminInput 
                  label="Name" 
                  value={productForm.name} 
                  onChange={(e: any) => setProductForm({...productForm, name: e.target.value})} 
                  required 
                />
                <AdminInput 
                  label="Category" 
                  value={productForm.category} 
                  onChange={(e: any) => setProductForm({...productForm, category: e.target.value})} 
                  required 
                />
                <AdminInput 
                  label="Base Price (₹)" 
                  type="number" 
                  value={productForm.price.toString()} 
                  onChange={(e: any) => setProductForm({...productForm, price: Number(e.target.value)})} 
                  required 
                />
                <AdminInput 
                  label="Stock" 
                  type="number" 
                  value={productForm.stock.toString()} 
                  onChange={(e: any) => setProductForm({...productForm, stock: Number(e.target.value)})} 
                  required 
                />
              </div>

              {/* Media Section */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-white/20 border-b border-white/5 pb-2">Media Assets</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Main Thumbnail</label>
                    <div className="flex gap-4 items-start">
                      {productForm.imageUrl && (
                        <img src={productForm.imageUrl} className="w-20 h-20 object-cover rounded-xl border border-white/10" alt="thumbnail" />
                      )}
                      <div className="flex-grow space-y-2">
                        <input 
                          type="text" 
                          value={productForm.imageUrl} 
                          onChange={e => setProductForm({...productForm, imageUrl: e.target.value})} 
                          className="w-full bg-dark-bg border border-white/10 rounded-xl py-2 px-3 text-xs focus:border-neon-purple outline-none"
                          placeholder="Image URL"
                        />
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={e => handleFileUpload(e, 'imageUrl')}
                          className="text-[10px] text-white/20 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Video URL (Optional)</label>
                    <input 
                      type="text" 
                      value={productForm.videoUrl} 
                      onChange={e => setProductForm({...productForm, videoUrl: e.target.value})} 
                      className="w-full bg-dark-bg border border-white/10 rounded-xl py-2 px-3 text-xs focus:border-neon-purple outline-none"
                      placeholder="YouTube/Direct URL"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                   <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Additional Gallery Images</label>
                    <button type="button" onClick={() => handleAddField('images')} className="text-[10px] font-black uppercase tracking-widest text-neon-blue">+ Add Slot</button>
                   </div>
                   <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {productForm.images.map((img, idx) => (
                        <div key={idx} className="relative group aspect-square bg-dark-bg border border-white/10 rounded-xl overflow-hidden">
                           {img ? (
                             <img src={img} className="w-full h-full object-cover" alt="gallery" />
                           ) : (
                             <div className="w-full h-full flex items-center justify-center text-white/10">Empty</div>
                           )}
                           <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <button type="button" onClick={() => handleRemoveField('images', idx)} className="text-pink-500 p-2"><Trash2 className="w-5 h-5" /></button>
                           </div>
                           <input 
                             type="file" 
                             accept="image/*"
                             onChange={e => {
                               const file = e.target.files?.[0];
                               if (file) {
                                 const reader = new FileReader();
                                 reader.onloadend = () => {
                                   const base64 = reader.result as string;
                                   const newImages = [...productForm.images];
                                   newImages[idx] = base64;
                                   setProductForm({...productForm, images: newImages});
                                 };
                                 reader.readAsDataURL(file);
                               }
                             }}
                             className="absolute inset-0 opacity-0 cursor-pointer"
                           />
                        </div>
                      ))}
                   </div>
                </div>
              </div>

              {/* Variants Section */}
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <h3 className="text-xs font-black uppercase tracking-widest text-white/20">Product Variants</h3>
                  <button type="button" onClick={() => handleAddField('variants')} className="text-[10px] font-black uppercase tracking-widest text-neon-blue">+ Add Variant</button>
                </div>
                <div className="space-y-3">
                  {productForm.variants?.map((v, idx) => (
                    <div key={v.id} className="flex gap-4 items-center bg-white/5 p-3 rounded-xl">
                      <input 
                        placeholder="Variant Name (e.g. A3 Size)" 
                        value={v.name}
                        onChange={e => {
                          const newVariants = [...(productForm.variants || [])];
                          newVariants[idx].name = e.target.value;
                          setProductForm({...productForm, variants: newVariants});
                        }}
                        className="bg-transparent border-b border-white/10 flex-grow text-sm outline-none focus:border-neon-purple py-1"
                      />
                      <input 
                        type="number"
                        placeholder="Price" 
                        value={v.price}
                        onChange={e => {
                          const newVariants = [...(productForm.variants || [])];
                          newVariants[idx].price = Number(e.target.value);
                          setProductForm({...productForm, variants: newVariants});
                        }}
                        className="bg-transparent border-b border-white/10 w-24 text-sm outline-none focus:border-neon-purple py-1"
                      />
                      <button type="button" onClick={() => handleRemoveField('variants', idx)} className="text-pink-500 hover:scale-110 transition-transform">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Description</label>
                <textarea 
                  value={productForm.description}
                  onChange={e => setProductForm({...productForm, description: e.target.value})}
                  className="w-full bg-dark-bg border border-white/10 rounded-xl py-3 px-4 text-sm focus:border-neon-purple outline-none min-h-[100px]"
                  placeholder="Tell your customers about this drop..."
                />
              </div>

              <div className="flex gap-8 border-t border-white/5 pt-6">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={productForm.isCOD}
                    onChange={e => setProductForm({...productForm, isCOD: e.target.checked})}
                    className="accent-neon-purple w-5 h-5 rounded-lg border-white/10" 
                  />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/60 group-hover:text-white transition-colors">Post-Arrival Payment (COD)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={productForm.featured}
                    onChange={e => setProductForm({...productForm, featured: e.target.checked})}
                    className="accent-neon-blue w-5 h-5 rounded-lg border-white/10" 
                  />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/60 group-hover:text-white transition-colors">Feature in Home Sweep</span>
                </label>
              </div>

              <button 
                type="submit" 
                className="w-full py-5 bg-neon-purple text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-neon-purple/20 hover:bg-white hover:text-dark-bg transition-all active:scale-[0.98]"
              >
                {editingProduct ? 'Confirm Modifications' : 'Initialize Product Drop'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
      {/* Sidebar */}
      <aside className="w-64 glass-morphism border-r border-white/5 flex flex-col pt-8">
        <div className="px-6 mb-12">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
              <SettingsIcon className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-black italic tracking-tighter uppercase">KARMA<span className="text-purple-600">GULLY</span></span>
          </div>
          <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">Admin OS v2.0</p>
        </div>

        <nav className="flex-grow space-y-1 px-4">
          <NavButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<BarChart3 className="w-5 h-5" />} label="Overview" />
          <NavButton active={activeTab === 'products'} onClick={() => setActiveTab('products')} icon={<Package className="w-5 h-5" />} label="Products" />
          <NavButton active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} icon={<ShoppingBag className="w-5 h-5" />} label="Orders" />
          <NavButton active={activeTab === 'coupons'} onClick={() => setActiveTab('coupons')} icon={<Tag className="w-5 h-5" />} label="Coupons" />
          <NavButton active={activeTab === 'pages'} onClick={() => setActiveTab('pages')} icon={<FileText className="w-5 h-5" />} label="Pages" />
          <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Bell className="w-5 h-5" />} label="Settings" />
          <NavButton active={activeTab === 'admins'} onClick={() => setActiveTab('admins')} icon={<ShieldAlert className="w-5 h-5" />} label="Admins" />
        </nav>

        <div className="p-4 border-t border-white/5">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/40 hover:text-pink-500 hover:bg-pink-500/10 rounded-xl transition-all uppercase tracking-widest font-bold"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow p-12 overflow-y-auto h-screen custom-scrollbar">
        <header className="flex justify-between items-end mb-12">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.4em] text-white/20 mb-2">Dashboard</p>
            <h1 className="text-4xl font-black italic tracking-tighter uppercase">{activeTab}</h1>
          </div>
          {activeTab === 'products' && (
            <button onClick={() => setShowProductModal(true)} className="px-6 py-3 bg-neon-purple text-white rounded-xl font-bold uppercase tracking-widest text-xs flex items-center gap-2 neon-shadow-purple hover:scale-105 transition-all">
              <Plus className="w-4 h-4" /> Add Product
            </button>
          )}
        </header>

        {activeTab === 'overview' && <OverviewTab products={products} orders={orders} onSeed={handleSeedData} seeding={seeding} />}
        {activeTab === 'products' && <ProductsTab products={products} onEdit={(p) => { setEditingProduct(p); setShowProductModal(true); }} onDelete={handleDeleteProduct} />}
        {activeTab === 'orders' && <OrdersTab orders={orders} onStatusUpdate={handleUpdateStatus} onDetails={(order) => setSelectedOrder(order)} />}
        {activeTab === 'admins' && <AdminsTab admins={admins} onAdd={async (uid, email) => { await addAdmin(uid, email); fetchData(); }} onRemove={async (uid) => { await removeAdmin(uid); fetchData(); }} currentUserEmail={auth.currentUser?.email || ''} />}
        {activeTab === 'settings' && settings && <SettingsTab settings={settings} onSave={async (s) => { await updateSettings(s); fetchData(); }} />}
        {activeTab === 'coupons' && <CouponsTab coupons={coupons} onAdd={async (c) => { await addCoupon(c); fetchData(); }} onDelete={async (code) => { await deleteCoupon(code); fetchData(); }} />}
        {activeTab === 'pages' && <PagesTab pages={pages} onRefresh={fetchData} />}

        {/* Order Details Modal */}
        <AnimatePresence>
          {selectedOrder && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-2xl bg-dark-surface border border-white/10 rounded-3xl p-8 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h2 className="text-2xl font-black uppercase italic tracking-tighter">Order Details</h2>
                    <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest mt-1">#ORD-{selectedOrder.id.toUpperCase()}</p>
                  </div>
                  <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-white/5 rounded-full"><X /></button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-500">Customer Details</h3>
                    <div className="bg-dark-bg p-4 rounded-2xl border border-white/5 space-y-3">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-white/20">Full Name</p>
                        <p className="text-sm font-bold">{selectedOrder.customerInfo.fullName}</p>
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-grow">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-white/20">Phone</p>
                          <p className="text-sm font-bold">{selectedOrder.customerInfo.phone}</p>
                        </div>
                        {selectedOrder.customerInfo.alternatePhone && (
                          <div className="flex-grow">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-white/20">Alt Phone</p>
                            <p className="text-sm font-bold">{selectedOrder.customerInfo.alternatePhone}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-500">Shipping Address</h3>
                    <div className="bg-dark-bg p-4 rounded-2xl border border-white/5 space-y-3 text-sm">
                      <p className="font-medium text-white/80 leading-relaxed">{selectedOrder.address.fullAddress}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-widest text-white/20">City</p>
                          <p className="font-bold">{selectedOrder.address.city}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-widest text-white/20">Pincode</p>
                          <p className="font-bold">{selectedOrder.address.pincode}</p>
                        </div>
                      </div>
                      {selectedOrder.address.landmark && (
                         <div>
                          <p className="text-[9px] font-bold uppercase tracking-widest text-white/20">Landmark</p>
                          <p className="font-bold">{selectedOrder.address.landmark}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-500">Order Items</h3>
                  <div className="bg-dark-bg rounded-2xl border border-white/5 overflow-hidden">
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className={`p-4 flex justify-between items-center ${idx !== 0 ? 'border-t border-white/5' : ''}`}>
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-lg bg-dark-bg border border-white/10 overflow-hidden shrink-0">
                            <img src={item.imageUrl} className="w-full h-full object-cover" alt={item.name} />
                          </div>
                          <div>
                            <p className="text-sm font-black italic uppercase tracking-tight">{item.name}</p>
                            {item.variantName && <p className="text-[9px] text-purple-500 font-bold uppercase tracking-widest">{item.variantName}</p>}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-white/40">{item.quantity} × ₹{item.price}</p>
                          <p className="text-sm font-black italic">₹{item.quantity * item.price}</p>
                        </div>
                      </div>
                    ))}
                    <div className="p-4 bg-white/5 border-t border-white/5 flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-widest">Total Amount</span>
                      <span className="text-lg font-black italic text-purple-500">₹{selectedOrder.totalAmount}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                   <div className="flex-grow p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between">
                     <div>
                       <p className="text-[9px] font-bold uppercase tracking-widest text-white/20">Payment Type</p>
                       <p className="text-xs font-black uppercase tracking-widest">{selectedOrder.paymentType}</p>
                     </div>
                     <div className="text-right">
                       <p className="text-[9px] font-bold uppercase tracking-widest text-white/20">Status</p>
                       <p className={`text-xs font-black uppercase tracking-widest ${selectedOrder.paymentStatus === 'Success' ? 'text-emerald-500' : 'text-pink-500'}`}>
                         {selectedOrder.paymentStatus === 'Success' ? 'PAID' : selectedOrder.paymentStatus}
                       </p>
                     </div>
                   </div>
                   {selectedOrder.paymentStatus !== 'Success' && (
                     <button 
                       onClick={async () => {
                         await updatePaymentStatus(selectedOrder.id, 'Success');
                         setSelectedOrder(null);
                         fetchData();
                       }}
                       className="px-6 py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                     >
                       Mark as Paid
                     </button>
                   )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function SettingsTab({ settings, onSave }: { settings: AppSettings, onSave: (s: AppSettings) => Promise<void> }) {
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'logoUrl' | 'faviconUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.src = reader.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Max dimensions based on field
        const maxDim = field === 'faviconUrl' ? 64 : 400;

        if (width > height) {
          if (width > maxDim) {
            height *= maxDim / width;
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width *= maxDim / height;
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // Convert to optimized Base64
        const optimizedBase64 = canvas.toDataURL('image/png', 0.8);
        setForm(prev => ({ ...prev, [field]: optimizedBase64 }));
      };
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form);
      alert('Settings updated successfully');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl pb-20">
      <div className="glass-morphism p-8 rounded-3xl space-y-8">
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-purple-500 mb-6 flex items-center gap-2">
            <Bell className="w-4 h-4" /> Announcement Bar
          </h3>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
               <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Show Bar</label>
               <input 
                type="checkbox" 
                checked={form.showAnnouncement}
                onChange={e => setForm({...form, showAnnouncement: e.target.checked})}
                className="w-5 h-5 accent-purple-500"
               />
            </div>
            <AdminInput 
              label="Announcement Text"
              value={form.announcement}
              onChange={(e: any) => setForm({...form, announcement: e.target.value})}
            />
          </div>
        </div>

        <div className="pt-8 border-t border-white/5">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-neon-blue mb-6 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Flash Sale Config
          </h3>
          <div className="space-y-6">
            <div className="flex items-center gap-4">
               <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Activate Sale</label>
               <input 
                type="checkbox" 
                checked={form.flashSale.isActive}
                onChange={e => setForm({...form, flashSale: {...form.flashSale, isActive: e.target.checked}})}
                className="w-5 h-5 accent-neon-blue"
               />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <AdminInput 
                label="Sale Title"
                value={form.flashSale.title}
                onChange={(e: any) => setForm({...form, flashSale: {...form.flashSale, title: e.target.value}})}
              />
              <AdminInput 
                label="End Time (ISO String)"
                value={form.flashSale.endTime}
                onChange={(e: any) => setForm({...form, flashSale: {...form.flashSale, endTime: e.target.value}})}
                placeholder="2024-05-30T00:00:00Z"
              />
            </div>
            <AdminInput 
              label="Discount Promo Text"
              value={form.flashSale.discountText}
              onChange={(e: any) => setForm({...form, flashSale: {...form.flashSale, discountText: e.target.value}})}
            />
          </div>
        </div>

        <div className="pt-8 border-t border-white/5">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-neon-purple mb-6 flex items-center gap-2">
            Social Connectivity
          </h3>
          <div className="space-y-4">
            <AdminInput 
              label="Instagram URL"
              value={form.socialLinks?.instagram || ''}
              onChange={(e: any) => setForm({...form, socialLinks: { ...(form.socialLinks || DEFAULT_SETTINGS.socialLinks), instagram: e.target.value }})}
            />
            <AdminInput 
              label="X / Twitter URL"
              value={form.socialLinks?.twitter || ''}
              onChange={(e: any) => setForm({...form, socialLinks: { ...(form.socialLinks || DEFAULT_SETTINGS.socialLinks), twitter: e.target.value }})}
            />
            <AdminInput 
              label="Facebook URL"
              value={form.socialLinks?.facebook || ''}
              onChange={(e: any) => setForm({...form, socialLinks: { ...(form.socialLinks || DEFAULT_SETTINGS.socialLinks), facebook: e.target.value }})}
            />
            <AdminInput 
              label="Telegram URL"
              value={form.socialLinks?.telegram || ''}
              onChange={(e: any) => setForm({...form, socialLinks: { ...(form.socialLinks || DEFAULT_SETTINGS.socialLinks), telegram: e.target.value }})}
            />
            <AdminInput 
              label="WhatsApp URL"
              value={form.socialLinks?.whatsapp || ''}
              onChange={(e: any) => setForm({...form, socialLinks: { ...(form.socialLinks || DEFAULT_SETTINGS.socialLinks), whatsapp: e.target.value }})}
            />
            <div className="pt-4 mt-4 border-t border-white/5 flex gap-4">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch('/api/test-telegram');
                    const data = await res.json();
                    if (data.success) {
                      alert("✅ Test message sent!");
                    } else {
                      alert("❌ Error: " + (data.error?.description || data.error));
                    }
                  } catch (err) {
                    alert("❌ Failed to reach server.");
                  }
                }}
                className="w-full py-3 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 text-sky-500 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
              >
                Test Bot
              </button>
            </div>
            <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest text-center mt-4">
              Make sure you have added <b>TELEGRAM_BOT_TOKEN</b> and <b>TELEGRAM_CHAT_ID</b> in Secrets tab.
            </p>
          </div>
        </div>

        <div className="pt-8 border-t border-white/5">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-neon-purple mb-6 flex items-center gap-2">
            Branding
          </h3>
          <div className="space-y-6">
            <div className="space-y-4">
              <AdminInput 
                label="Logo URL"
                value={form.logoUrl || ''}
                onChange={(e: any) => setForm({...form, logoUrl: e.target.value})}
                placeholder="https://example.com/logo.png"
              />
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-dark-bg border border-white/10 rounded-xl flex items-center justify-center overflow-hidden">
                  {form.logoUrl ? <img src={form.logoUrl} className="w-full h-full object-contain" alt="Logo preview" /> : <Package className="w-6 h-6 text-white/10" />}
                </div>
                <div className="space-y-2">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">Upload from Device</p>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'logoUrl')}
                    className="text-[10px] text-white/20 file:bg-white/5 file:border-none file:text-[10px] file:text-white file:font-black file:uppercase file:px-3 file:py-1 file:rounded-md file:mr-3 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/5">
              <AdminInput 
                label="Favicon URL"
                value={form.faviconUrl || ''}
                onChange={(e: any) => setForm({...form, faviconUrl: e.target.value})}
                placeholder="https://example.com/favicon.ico"
              />
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-dark-bg border border-white/10 rounded-xl flex items-center justify-center overflow-hidden">
                  {form.faviconUrl ? <img src={form.faviconUrl} className="w-full h-full object-contain" alt="Favicon preview" /> : <div className="text-[10px] font-black italic text-white/10">KG</div>}
                </div>
                <div className="space-y-2">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">Upload from Device</p>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'faviconUrl')}
                    className="text-[10px] text-white/20 file:bg-white/5 file:border-none file:text-[10px] file:text-white file:font-black file:uppercase file:px-3 file:py-1 file:rounded-md file:mr-3 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <button 
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 bg-white text-dark-bg font-black uppercase tracking-widest text-xs rounded-xl hover:bg-purple-500 hover:text-white transition-all disabled:opacity-50"
        >
          {saving ? 'Syncing...' : 'Save Global Settings'}
        </button>
      </div>
    </div>
  );
}

function CouponsTab({ coupons, onAdd, onDelete }: { coupons: Coupon[], onAdd: (c: Coupon) => Promise<void>, onDelete: (code: string) => Promise<void> }) {
  const [newCoupon, setNewCoupon] = useState<Coupon>({
    code: '',
    discountType: 'percentage',
    discountValue: 0,
    minOrderAmount: 0,
    isActive: true,
    startDate: '',
    expiryDate: ''
  });
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCoupon.code) return;
    setIsAdding(true);
    try {
      await onAdd(newCoupon);
      setNewCoupon({
        code: '',
        discountType: 'percentage',
        discountValue: 0,
        minOrderAmount: 0,
        isActive: true,
        startDate: '',
        expiryDate: ''
      });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
      <div className="glass-morphism p-8 rounded-[2rem] border border-white/5 space-y-6">
        <h3 className="text-xs font-black uppercase tracking-widest text-neon-purple">Create New Coupon</h3>
        <form onSubmit={handleAdd} className="space-y-4">
          <AdminInput 
            label="Coupon Code" 
            value={newCoupon.code} 
            onChange={(e: any) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })} 
            placeholder="KARMA50" 
            required 
          />
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Type</label>
            <select 
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-neon-purple outline-none"
              value={newCoupon.discountType}
              onChange={(e) => setNewCoupon({ ...newCoupon, discountType: e.target.value as any })}
            >
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed Amount (₹)</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <AdminInput 
              label="Value" 
              type="number" 
              value={newCoupon.discountValue.toString()} 
              onChange={(e: any) => setNewCoupon({ ...newCoupon, discountValue: Number(e.target.value) })} 
              required 
            />
            <AdminInput 
              label="Min Order" 
              type="number" 
              value={newCoupon.minOrderAmount.toString()} 
              onChange={(e: any) => setNewCoupon({ ...newCoupon, minOrderAmount: Number(e.target.value) })} 
            />
          </div>
          <AdminInput 
            label="Start Date & Time (Optional)" 
            type="datetime-local" 
            value={newCoupon.startDate || ''} 
            onChange={(e: any) => setNewCoupon({ ...newCoupon, startDate: e.target.value })} 
          />
          <AdminInput 
            label="Expiry Date & Time (Optional)" 
            type="datetime-local" 
            value={newCoupon.expiryDate || ''} 
            onChange={(e: any) => setNewCoupon({ ...newCoupon, expiryDate: e.target.value })} 
          />
          <button 
            type="submit" 
            disabled={isAdding}
            className="w-full py-4 bg-neon-purple text-white font-black uppercase tracking-widest text-xs rounded-xl neon-shadow-purple disabled:opacity-50"
          >
            {isAdding ? 'Deploying...' : 'Generate Coupon'}
          </button>
        </form>
      </div>

      <div className="space-y-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-white/20 mb-2">Existing Coupons</h3>
        <div className="space-y-3">
          {coupons.map(coupon => (
            <div key={coupon.code} className="p-6 bg-white/5 border border-white/5 rounded-2xl flex justify-between items-center group hover:border-neon-purple/30 transition-all">
              <div className="space-y-1">
                <p className="text-sm font-black italic tracking-tighter text-white uppercase">{coupon.code}</p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-[9px] bg-neon-blue/10 text-neon-blue px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-neon-blue/20">
                    {coupon.discountValue}{coupon.discountType === 'percentage' ? '%' : '₹'} OFF
                  </span>
                  {coupon.minOrderAmount > 0 && (
                    <span className="text-[9px] bg-white/5 text-white/40 px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-white/10">
                      Min ₹{coupon.minOrderAmount}
                    </span>
                  )}
                </div>
                {(coupon.startDate || coupon.expiryDate) && (
                  <div className="space-y-0.5 pt-1">
                    {coupon.startDate && (
                      <p className="text-[8px] text-emerald-400/60 font-bold uppercase tracking-widest flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" /> Starts: {new Date(coupon.startDate).toLocaleString()}
                      </p>
                    )}
                    {coupon.expiryDate && (
                      <p className="text-[8px] text-pink-500/60 font-bold uppercase tracking-widest flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" /> Expires: {new Date(coupon.expiryDate).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
              <button 
                onClick={() => { if(confirm('Delete this coupon?')) onDelete(coupon.code); }}
                className="p-3 bg-pink-500/10 text-pink-500 rounded-xl hover:bg-pink-500 hover:text-white transition-all shadow-lg"
                title="Delete Coupon"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {coupons.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-3xl">
              <p className="text-xs font-bold uppercase tracking-widest text-white/20">No coupons active</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PagesTab({ pages, onRefresh }: { pages: any[], onRefresh: () => Promise<void> }) {
  const [showModal, setShowModal] = useState(false);
  const [editingPage, setEditingPage] = useState<any | null>(null);
  const [pageForm, setPageForm] = useState({
    title: '',
    slug: '',
    content: [] as { type: 'text' | 'image' | 'video', value: string }[]
  });

  useEffect(() => {
    if (editingPage) {
      setPageForm({
        title: editingPage.title,
        slug: editingPage.slug,
        content: editingPage.content || []
      });
    } else {
      setPageForm({ title: '', slug: '', content: [] });
    }
  }, [editingPage]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pageForm.slug || !pageForm.title) return alert('Title and Slug required');
    
    try {
      const slug = pageForm.slug.toLowerCase().replace(/\s+/g, '-');
      await setDoc(doc(db, 'pages', slug), {
        ...pageForm,
        slug,
        updatedAt: Date.now()
      });
      setShowModal(false);
      setEditingPage(null);
      await onRefresh();
    } catch (err) {
      console.error(err);
      alert('Failed to save page');
    }
  };

  const handleDelete = async (slug: string) => {
    if (confirm('Delete this page?')) {
      await deleteDoc(doc(db, 'pages', slug));
      await onRefresh();
    }
  };

  const addSection = (type: 'text' | 'image' | 'video') => {
    setPageForm({ ...pageForm, content: [...pageForm.content, { type, value: '' }] });
  };

  const updateSection = (idx: number, value: string) => {
    const newContent = [...pageForm.content];
    newContent[idx].value = value;
    setPageForm({ ...pageForm, content: newContent });
  };

  const moveSection = (idx: number, dir: 'up' | 'down') => {
    const newContent = [...pageForm.content];
    const target = dir === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= newContent.length) return;
    [newContent[idx], newContent[target]] = [newContent[target], newContent[idx]];
    setPageForm({ ...pageForm, content: newContent });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={() => setShowModal(true)} className="px-6 py-3 bg-neon-blue text-white rounded-xl font-bold uppercase tracking-widest text-xs flex items-center gap-2 neon-shadow-blue hover:scale-105 transition-all">
          <Plus className="w-4 h-4" /> Create New Page
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pages.map(page => (
          <div key={page.slug} className="glass-morphism p-6 rounded-3xl border border-white/5 space-y-4 group">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h3 className="font-black uppercase italic tracking-tight text-white">{page.title}</h3>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">/page/{page.slug}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditingPage(page); setShowModal(true); }} className="p-2 bg-white/5 rounded-lg text-white/20 hover:text-neon-blue hover:bg-neon-blue/10 transition-all"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(page.slug)} className="p-2 bg-white/5 rounded-lg text-white/20 hover:text-pink-500 hover:bg-pink-500/10 transition-all"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="text-[9px] text-white/10 font-bold uppercase tracking-widest flex items-center gap-2">
              <Clock className="w-3 h-3" /> Updated {new Date(page.updatedAt).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-3xl bg-dark-surface border border-white/10 rounded-3xl p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black uppercase italic tracking-tighter">{editingPage ? 'Edit Page' : 'Create Page'}</h2>
              <button onClick={() => { setShowModal(false); setEditingPage(null); }} className="p-2 hover:bg-white/5 rounded-full"><X /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <AdminInput label="Page Title" value={pageForm.title} onChange={(e: any) => setPageForm({ ...pageForm, title: e.target.value })} required />
                <AdminInput label="Slug (e.g. about-us)" value={pageForm.slug} onChange={(e: any) => setPageForm({ ...pageForm, slug: e.target.value })} required disabled={!!editingPage} />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <h3 className="text-xs font-black uppercase tracking-widest text-white/20">Page Content Blocks</h3>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => addSection('text')} className="flex items-center gap-1.5 px-3 py-1 bg-white/5 hover:bg-white/10 text-[9px] font-black uppercase tracking-widest text-white rounded-lg border border-white/5 transition-all"><FileText className="w-3 h-3" /> Text</button>
                    <button type="button" onClick={() => addSection('image')} className="flex items-center gap-1.5 px-3 py-1 bg-white/5 hover:bg-white/10 text-[9px] font-black uppercase tracking-widest text-white rounded-lg border border-white/5 transition-all"><ImageIcon className="w-3 h-3" /> Image</button>
                    <button type="button" onClick={() => addSection('video')} className="flex items-center gap-1.5 px-3 py-1 bg-white/5 hover:bg-white/10 text-[9px] font-black uppercase tracking-widest text-white rounded-lg border border-white/5 transition-all"><Video className="w-3 h-3" /> Video</button>
                  </div>
                </div>

                <div className="space-y-4">
                  {pageForm.content.map((section, idx) => (
                    <motion.div layout key={idx} className="relative group bg-dark-bg border border-white/5 p-6 rounded-2xl">
                      <div className="absolute -left-3 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button type="button" onClick={() => moveSection(idx, 'up')} className="p-1.5 bg-white/10 hover:bg-neon-purple rounded-md transition-colors"><MoveUp className="w-3 h-3" /></button>
                         <button type="button" onClick={() => moveSection(idx, 'down')} className="p-1.5 bg-white/10 hover:bg-neon-purple rounded-md transition-colors"><MoveDown className="w-3 h-3" /></button>
                      </div>
                      <div className="flex justify-between mb-4">
                         <span className="text-[9px] font-black uppercase tracking-widest text-neon-purple">{section.type} BLOCK</span>
                         <button type="button" onClick={() => {
                           const newContent = pageForm.content.filter((_, i) => i !== idx);
                           setPageForm({ ...pageForm, content: newContent });
                         }} className="text-pink-500/40 hover:text-pink-500 transition-colors"><X className="w-4 h-4" /></button>
                      </div>
                      
                      {section.type === 'text' ? (
                        <textarea 
                          className="w-full bg-black/20 border border-white/5 rounded-xl p-4 text-sm focus:border-neon-purple outline-none min-h-[150px] custom-scrollbar"
                          value={section.value}
                          placeholder="Craft your story here..."
                          onChange={e => updateSection(idx, e.target.value)}
                        />
                      ) : (
                        <div className="space-y-4">
                          <input 
                            className="w-full bg-black/20 border border-white/5 rounded-xl px-4 py-2 text-xs focus:border-neon-purple outline-none"
                            value={section.value}
                            placeholder={section.type === 'image' ? 'Image URL or drop file below...' : 'YouTube URL...'}
                            onChange={e => updateSection(idx, e.target.value)}
                          />
                          {section.type === 'image' && (
                            <div className="flex gap-4 items-center">
                              {section.value && <img src={section.value} className="w-16 h-16 object-cover rounded-lg border border-white/10" />}
                              <input 
                                type="file" 
                                accept="image/*"
                                onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => updateSection(idx, reader.result as string);
                                    reader.readAsDataURL(file);
                                  }
                                }}
                                className="text-[10px] text-white/20"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  ))}
                  {pageForm.content.length === 0 && (
                    <div className="py-12 text-center border-2 border-dashed border-white/5 rounded-2xl text-white/10 font-bold uppercase text-[10px] tracking-widest">
                      Choose a block type above to start building
                    </div>
                  )}
                </div>
              </div>

              <button type="submit" className="w-full py-5 bg-white text-dark-bg font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-neon-purple hover:text-white transition-all">
                Publish Page Manifest
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function AdminInput({ label, onChange, ...props }: any) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">{label}</label>
      <input 
        onChange={onChange}
        className="w-full bg-dark-bg border border-white/10 rounded-xl py-3 px-4 text-sm focus:border-neon-purple focus:outline-none transition-all placeholder:text-white/5"
        {...props}
      />
    </div>
  );
}

function NavButton({ active, icon, label, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-6 py-4 rounded-xl transition-all duration-300 uppercase tracking-[0.15em] text-[10px] font-black ${
        active 
          ? 'bg-neon-purple/10 text-neon-purple border border-neon-purple/20 shadow-[0_0_15px_rgba(188,19,254,0.1)]' 
          : 'text-white/40 hover:text-white hover:bg-white/5 border border-transparent'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function StatCard({ title, value, icon, color }: any) {
  return (
    <div className="glass-morphism p-8 rounded-3xl space-y-4 relative overflow-hidden group">
      <div className={`absolute top-0 right-0 p-8 ${color}`}>
        {icon}
      </div>
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30">{title}</p>
      <h3 className="text-4xl font-black italic tracking-tighter">{value}</h3>
    </div>
  );
}

function OverviewTab({ products, orders, onSeed, seeding }: { products: Product[], orders: Order[], onSeed: () => void, seeding: boolean }) {
  const totalRevenue = orders.filter(o => o.paymentStatus === 'Success').reduce((sum, o) => sum + o.totalAmount, 0);
  
  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <StatCard title="Total Revenue" value={`₹${totalRevenue}`} icon={<TrendingUp className="w-12 h-12 opacity-5" />} color="text-neon-purple" />
        <StatCard title="Active Orders" value={orders.length} icon={<ShoppingBag className="w-12 h-12 opacity-5" />} color="text-neon-blue" />
        <StatCard title="Total Products" value={products.length} icon={<Package className="w-12 h-12 opacity-5" />} color="text-pink-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-morphism p-8 rounded-3xl overflow-hidden relative">
           <h3 className="text-xs font-bold uppercase tracking-[0.3em] mb-8 text-white/30">Database Control</h3>
           <div className="grid grid-cols-1 gap-4">
              <button 
                onClick={onSeed}
                disabled={seeding}
                className="p-8 bg-dark-bg rounded-2xl border border-white/5 hover:border-neon-purple transition-all text-left flex items-center justify-between group disabled:opacity-50"
              >
                <div className="flex items-center gap-6">
                  <div className="w-12 h-12 rounded-xl bg-neon-purple/20 flex items-center justify-center text-neon-purple">
                    <Database className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-widest italic mb-1">Seed Sample Products</p>
                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest leading-relaxed">Populate your store with high-quality <br/> anime metal poster samples.</p>
                  </div>
                </div>
                <ChevronRight className="w-6 h-6 text-white/10 group-hover:text-neon-purple group-hover:translate-x-1 transition-all" />
              </button>
           </div>
           
           <div className="mt-8 p-6 bg-neon-blue/5 rounded-2xl border border-neon-blue/10">
              <div className="flex gap-4">
                <ShieldAlert className="w-5 h-5 text-neon-blue shrink-0" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-neon-blue mb-1">Authenticated Session</p>
                  <p className="text-[9px] text-white/30 font-bold uppercase tracking-widest leading-relaxed">
                    You are signed in as <span className="text-white">c.b.sharma321@gmail.com</span>. 
                    All administrative actions are logged and encrypted.
                  </p>
                </div>
              </div>
           </div>
        </div>

        <div className="glass-morphism p-8 rounded-3xl">
           <h3 className="text-xs font-bold uppercase tracking-[0.3em] mb-8 text-white/30">System Status</h3>
           <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">API Connection</span>
                <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-500">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  Stable
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Inventory Sync</span>
                <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-500">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  Active
                </span>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function ProductsTab({ products, onEdit, onDelete }: { products: Product[], onEdit: (p: Product) => void, onDelete: (id: string) => void }) {
  return (
    <div className="glass-morphism p-8 rounded-3xl">
      <div className="flex items-center gap-4 mb-8">
        <div className="relative flex-grow">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
          <input className="w-full bg-dark-bg border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm focus:border-neon-blue focus:outline-none" placeholder="Search products..." />
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
              <th className="pb-6">Product</th>
              <th className="pb-6">Category</th>
              <th className="pb-6">Price</th>
              <th className="pb-6">Stock</th>
              <th className="pb-6">Status</th>
              <th className="pb-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm font-medium">
            {products.map(p => (
              <tr key={p.id} className="border-t border-white/5 group hover:bg-white/5 transition-colors">
                <td className="py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-dark-bg border border-white/10 overflow-hidden">
                      <img src={p.imageUrl} />
                    </div>
                    <span className="font-bold tracking-tight text-white">{p.name || 'Unnamed Product'}</span>
                  </div>
                </td>
                <td className="py-4 text-white/40 uppercase text-xs tracking-widest">{p.category}</td>
                <td className="py-4 text-neon-purple font-bold italic tracking-tighter">₹{p.price}</td>
                <td className="py-4">{p.stock}</td>
                <td className="py-4">
                   <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest rounded-md border border-emerald-500/20">Active</span>
                </td>
                <td className="py-4 text-right">
                  <div className="flex justify-end gap-2 pr-2 transition-opacity">
                    <button onClick={() => onEdit(p)} className="p-2 bg-white/5 hover:bg-neon-blue/20 rounded-lg text-neon-blue transition-all border border-white/5"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => onDelete(p.id)} className="p-2 bg-white/5 hover:bg-pink-500/20 rounded-lg text-pink-500 transition-all border border-white/5"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OrdersTab({ orders, onStatusUpdate, onDetails }: { orders: Order[], onStatusUpdate: (id: string, status: Order['orderStatus']) => void, onDetails: (order: Order) => void }) {
  const statuses = ['Pending', 'Confirmed', 'Shipped', 'Delivered'];
  
  return (
    <div className="glass-morphism p-8 rounded-3xl">
       <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
              <th className="pb-6">Order ID</th>
              <th className="pb-6">Customer</th>
              <th className="pb-6">Amount</th>
              <th className="pb-6">Payment</th>
              <th className="pb-6">Status</th>
              <th className="pb-6 text-right">Manage</th>
            </tr>
          </thead>
          <tbody className="text-sm font-medium">
            {orders.map(order => (
              <tr key={order.id} className="border-t border-white/5 group hover:bg-white/5 transition-colors">
                <td className="py-6 font-bold tracking-tighter cursor-pointer hover:text-purple-500 transition-colors" onClick={() => onDetails(order)}>#ORD-{order.id.slice(-6).toUpperCase()}</td>
                <td className="py-6">
                   <p className="font-bold">{order.customerInfo.fullName}</p>
                   <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">{order.address.city}, IN</p>
                </td>
                <td className="py-6 font-bold text-neon-purple tracking-tighter italic text-lg">₹{order.totalAmount}</td>
                <td className="py-6">
                   <div className="flex flex-col gap-1">
                     <span className="text-[10px] font-black uppercase tracking-widest text-white/60">{order.paymentType}</span>
                     <span className={`text-[10px] font-bold uppercase tracking-widest ${order.paymentStatus === 'Success' ? 'text-emerald-500' : 'text-pink-500'}`}>
                        {order.paymentStatus === 'Success' ? 'PAID' : order.paymentStatus}
                     </span>
                   </div>
                </td>
                <td className="py-6">
                   <select 
                    value={order.orderStatus}
                    onChange={(e) => onStatusUpdate(order.id, e.target.value as any)}
                    className="bg-dark-bg border border-white/10 rounded-lg py-2 px-3 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-neon-purple"
                   >
                     {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                   </select>
                </td>
                <td className="py-6 text-right">
                   <button 
                    onClick={() => onDetails(order)}
                    className="px-4 py-2 bg-white/5 hover:bg-neon-blue hover:text-dark-bg transition-all rounded-lg text-[10px] font-black uppercase tracking-widest"
                   >
                    Details
                   </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminsTab({ admins, onAdd, onRemove, currentUserEmail }: { admins: Admin[], onAdd: (uid: string, email: string) => Promise<void>, onRemove: (uid: string) => Promise<void>, currentUserEmail: string }) {
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminUid, setNewAdminUid] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail || !newAdminUid) return;
    setIsAdding(true);
    try {
      await onAdd(newAdminUid, newAdminEmail);
      setNewAdminEmail('');
      setNewAdminUid('');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="glass-morphism p-8 rounded-3xl">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-500 mb-6">Authorize New Administrator</h3>
        <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4">
          <div className="flex-grow space-y-1">
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/30 ml-2">Google Email Address</p>
            <input 
              type="email" 
              value={newAdminEmail}
              onChange={e => setNewAdminEmail(e.target.value)}
              placeholder="e.g. naruto@gmail.com"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500"
              required
            />
          </div>
          <div className="flex-grow space-y-1">
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/30 ml-2">User UID (from Firebase)</p>
            <input 
              type="text" 
              value={newAdminUid}
              onChange={e => setNewAdminUid(e.target.value)}
              placeholder="Firebase UID"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500"
              required
            />
          </div>
          <button 
            type="submit"
            disabled={isAdding}
            className="self-end px-8 py-3 bg-purple-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-purple-700 transition-all disabled:opacity-50"
          >
            {isAdding ? 'Adding...' : 'Verify & Add'}
          </button>
        </form>
        <p className="mt-4 text-[10px] text-white/20 italic">Note: To find a user UID, they must have logged in at least once or you can find it in the Firebase Auth console.</p>
      </div>

      <div className="glass-morphism p-8 rounded-3xl">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-500 mb-6">Authorized Personnel</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
                <th className="pb-6">Admin Email</th>
                <th className="pb-6">UID</th>
                <th className="pb-6 text-right">Access Control</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium">
               {/* Bootstrap Admin (Ghost item if not in DB) */}
               {admins.every(a => a.email !== 'c.b.sharma321@gmail.com') && (
                <tr className="border-t border-white/5 group bg-purple-500/5">
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold tracking-tight">c.b.sharma321@gmail.com</span>
                      <span className="px-2 py-0.5 bg-purple-500 text-white text-[8px] font-black rounded uppercase">System Root</span>
                    </div>
                  </td>
                  <td className="py-4 text-white/20 font-mono text-[10px]">BOOTSTRAP_ACCOUNT</td>
                  <td className="py-4 text-right italic text-[10px] text-white/20 uppercase tracking-widest font-bold">Immutable Access</td>
                </tr>
              )}
              {admins.map(admin => (
                <tr key={admin.id} className="border-t border-white/5 group hover:bg-white/5 transition-colors">
                  <td className="py-4">
                    <span className="font-bold tracking-tight">{admin.email}</span>
                  </td>
                  <td className="py-4 text-white/20 font-mono text-[10px]">{admin.id}</td>
                  <td className="py-4 text-right">
                    {admin.email !== currentUserEmail && admin.email !== 'c.b.sharma321@gmail.com' ? (
                      <button 
                        onClick={() => { if(confirm('Revoke access for this admin?')) onRemove(admin.id); }}
                        className="px-4 py-2 bg-pink-500/10 text-pink-500 hover:bg-pink-500 hover:text-white transition-all rounded-lg text-[10px] font-black uppercase tracking-widest"
                      >
                        Revoke Access
                      </button>
                    ) : (
                      <span className="text-[10px] text-white/20 uppercase tracking-widest font-bold px-4">Current Session</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
