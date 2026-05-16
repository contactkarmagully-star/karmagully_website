import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart3, Package, ShoppingBag, Settings as SettingsIcon, LogOut, 
  Plus, Edit2, Trash2, Check, Clock, TrendingUp, Search, Truck,
  ChevronRight, X, Database, ShieldAlert, Tag, Bell, FileText, Image as ImageIcon, Video, MoveUp, MoveDown, MessageSquare, Send, User, LayoutGrid, Rss, Wand2,
  Instagram, Twitter, Facebook, Phone, Youtube, Globe, RefreshCw, AlertTriangle, Zap, Heart, Award, Layers, ShieldCheck, Star, FileSpreadsheet, Upload,
  Cloud, Activity, CheckCircle2, AlertCircle, ExternalLink
} from 'lucide-react';
import { Product, Order, Category, BlogPost, BlogSettings, AppSettings, UserProfile, CourierPartner } from '../types';
import { getAllProducts, addProduct, updateProduct, deleteProduct, bulkAddProducts } from '../services/productService';
import { getAllOrders, updateOrderStatus, updatePaymentStatus, updateOrder, deleteOrder } from '../services/orderService';
import { getAllAdmins, addAdmin, removeAdmin, isUserAdmin, Admin } from '../services/adminService';
import { getSettings, updateSettings, DEFAULT_SETTINGS } from '../services/settingsService';
import { getAllCoupons, addCoupon, deleteCoupon, Coupon } from '../services/couponService';
import { getTrackingUrl } from '../lib/tracking';
import { CourierLogo } from '../components/CourierLogo';
import { getAllCouriers, addCourier, updateCourier, deleteCourier } from '../services/courierService';
import { getAllCategories, addCategory, updateCategory, deleteCategory } from '../services/categoryService';
import { getAllBlogs, createBlog, updateBlog, deleteBlog, getBlogSettings, updateBlogSettings } from '../services/blogService';
import { getPendingLoyaltyClaims } from '../services/loyaltyService';
import { generateBlogTopics, generateCompleteBlogPost, generateBlogImage } from '../services/blogAiService';
import BlogsTab from '../components/admin/BlogsTab';
import ReviewsTab from '../components/admin/ReviewsTab';
import VideosTab from '../components/admin/VideosTab';
import LoyaltyTab from '../components/admin/LoyaltyTab';
import CouriersTab from '../components/admin/CouriersTab';
import DomainHealthPage from '../components/admin/DomainHealthPage';
import { uploadToCloudinary } from '../lib/cloudinary';
import { auth, db } from '../lib/firebase';

import { onAuthStateChanged, signOut } from 'firebase/auth';
import { onSnapshot, query, collection, orderBy, where, getDocs, updateDoc, addDoc, doc, setDoc, deleteDoc, serverTimestamp, limit } from 'firebase/firestore';
import { seedProducts } from '../seed';
import { dataCache } from '../lib/dataCache';

const compressImage = (base64: string, maxWidth: number = 800, maxHeight: number = 800): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
  });
};

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'categories' | 'orders' | 'admins' | 'settings' | 'coupons' | 'pages' | 'support' | 'blogs' | 'domain-check' | 'reviews' | 'product-videos' | 'loyalty' | 'couriers' | 'health'>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couriers, setCouriers] = useState<CourierPartner[]>([]);
  const [pages, setPages] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [pendingClaims, setPendingClaims] = useState<UserProfile[]>([]);
  const [blogSettings, setBlogSettingsState] = useState<BlogSettings | null>(null);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [lastSeenOrders, setLastSeenOrders] = useState<number>(() => Number(localStorage.getItem('admin_last_seen_orders') || '0'));
  const [lastSeenSupport, setLastSeenSupport] = useState<number>(() => Number(localStorage.getItem('admin_last_seen_support') || '0'));
  const [settings, setSettingsState] = useState<AppSettings | null>(null);
  const [debugSitemapData, setDebugSitemapData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [showBulkProductModal, setShowBulkProductModal] = useState(false);
  const [bulkProductData, setBulkProductData] = useState('');
  const [isUploadingProducts, setIsUploadingProducts] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [editOrderForm, setEditOrderForm] = useState<Partial<Order>>({});
  const navigate = useNavigate();

  useEffect(() => {
    if (selectedOrder) {
      setEditOrderForm({
        customerInfo: { ...selectedOrder.customerInfo },
        address: { ...selectedOrder.address },
        totalAmount: selectedOrder.totalAmount,
        paymentType: selectedOrder.paymentType,
        paymentStatus: selectedOrder.paymentStatus,
        orderStatus: selectedOrder.orderStatus,
        trackingId: selectedOrder.trackingId || '',
        deliveryPartner: selectedOrder.deliveryPartner || '',
        items: [...selectedOrder.items]
      });
      setIsEditingOrder(false);
    }
  }, [selectedOrder]);

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

        // Real-time listener for support tickets (for notification badges) - only pending
        const ticketsQuery = query(collection(db, 'tickets'), where('status', '==', 'pending'), limit(10));
        const unsubscribeTickets = onSnapshot(ticketsQuery, (snapshot) => {
          setTickets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (err) => console.error("Ticket listener error:", err));

        return () => {
          unsubscribeTickets();
        };
      } catch (err) {
        console.error("Auth check error:", err);
        navigate('/admin/login');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const safeFetch = async (fn: any, fallback: any = []) => {
        try {
          return await fn();
        } catch (err) {
          console.error(`Fetch failed:`, err);
          return fallback;
        }
      };

      // Phase 1: Critical data for initial view (Overview/Orders/Products)
      // We also fetch Pages here as it is often needed quickly
      const [productsData, ordersData, settingsData, pagesSnap] = await Promise.all([
        safeFetch(getAllProducts),
        safeFetch(getAllOrders),
        safeFetch(getSettings, null),
        safeFetch(() => getDocs(query(collection(db, 'pages'), orderBy('updatedAt', 'desc'))), { docs: [] })
      ]);

      const pagesList = pagesSnap.docs.map((doc: any) => ({ slug: doc.id, ...doc.data() }));

      setProducts(productsData);
      setOrders(ordersData);
      setSettingsState(settingsData);
      setPages(pagesList);
      setPendingOrdersCount(ordersData.filter((o: Order) => o.orderStatus === 'Pending').length);
      setLoading(false);

      // Phase 2: Lazy load secondary data or wait until tab switch
      // This happens in the background to speed up perceived load time
      const [adminsData, couponsData, couriersData, categoriesData, blogsData, blogSettingsData, pendingClaimsData] = await Promise.all([
        safeFetch(getAllAdmins),
        safeFetch(getAllCoupons),
        safeFetch(getAllCouriers),
        safeFetch(getAllCategories),
        safeFetch(() => getAllBlogs(true)),
        safeFetch(getBlogSettings, null),
        safeFetch(getPendingLoyaltyClaims, [])
      ]);

      setAdmins(adminsData);
      setCoupons(couponsData);
      setCouriers(couriersData);
      setCategories(categoriesData);
      setBlogs(blogsData);
      setBlogSettingsState(blogSettingsData);
      setPendingClaims(pendingClaimsData);

      // Fetch sitemap debug
      try {
        const debugRes = await fetch('/debug-sitemap');
        if (debugRes.ok) {
          const debugData = await debugRes.json();
          setDebugSitemapData(debugData);
        } else {
          setDebugSitemapData({ error: "Server returned error" });
        }
      } catch (err) {
        setDebugSitemapData({ error: "Network error" });
        console.error("Debug fetch error:", err);
      }

      // Bootstrap admin record if current user is the root admin but not in collection
      const user = auth.currentUser;
      if (user && user.email === 'c.b.sharma321@gmail.com' && !adminsData.find((a: any) => a.id === user.uid)) {
        await addAdmin(user.uid, user.email);
      }

      // Check current tab to update lastSeen if needed
      const now = Date.now();
      if (activeTab === 'orders') {
        setLastSeenOrders(now);
        localStorage.setItem('admin_last_seen_orders', now.toString());
      } else if (activeTab === 'support') {
        setLastSeenSupport(now);
        localStorage.setItem('admin_last_seen_support', now.toString());
      }
    } catch (error) {
      console.error("Global fetchData error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const now = Date.now();
    if (activeTab === 'orders') {
      setLastSeenOrders(now);
      localStorage.setItem('admin_last_seen_orders', now.toString());
    } else if (activeTab === 'support') {
      setLastSeenSupport(now);
      localStorage.setItem('admin_last_seen_support', now.toString());
    }
  }, [activeTab]);

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
    videoUrls: [],
    category: '', // Legacy single category
    categories: [], // Multi-category support
    stock: 0,
    isCOD: true,
    featured: false,
    variants: [],
    isLimitedDrop: false,
    dropQuantity: 0,
    soldCount: 0,
    isTrending: false,
    isNewArrival: false
  });

  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const [activeVideoSlotIdx, setActiveVideoSlotIdx] = useState<number | null>(null);

  useEffect(() => {
    if (editingProduct) {
      setProductForm({
        name: editingProduct.name,
        price: editingProduct.price,
        description: editingProduct.description,
        imageUrl: editingProduct.imageUrl || '',
        images: editingProduct.images || [],
        videoUrls: editingProduct.videoUrls || [],
        category: editingProduct.category,
        categories: editingProduct.categories || [],
        stock: editingProduct.stock,
        isCOD: editingProduct.isCOD,
        featured: !!editingProduct.featured,
        variants: editingProduct.variants || [],
        isLimitedDrop: !!editingProduct.isLimitedDrop,
        dropQuantity: editingProduct.dropQuantity || 0,
        soldCount: editingProduct.soldCount || 0,
        isTrending: !!editingProduct.isTrending,
        isNewArrival: !!editingProduct.isNewArrival
      });
    } else {
      setProductForm({
        name: '',
        price: 0,
        description: '',
        imageUrl: '',
        images: [],
        videoUrls: [],
        category: '',
        categories: [],
        stock: 0,
        isCOD: true,
        featured: false,
        variants: [],
        isLimitedDrop: false,
        dropQuantity: 0,
        soldCount: 0,
        isTrending: false,
        isNewArrival: false
      });
    }
  }, [editingProduct]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'imageUrl' | 'images' | 'videoUrls', idx?: number) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // Try Cloudinary
    try {
      const resourceType = field === 'videoUrls' ? 'video' : 'image';
      const url = await uploadToCloudinary(file, resourceType);
      
      if (field === 'imageUrl') {
        setProductForm(prev => ({ ...prev, imageUrl: url }));
      } else if (field === 'images') {
        setProductForm(prev => {
          const newImages = [...prev.images];
          if (idx !== undefined) newImages[idx] = url;
          else newImages.push(url);
          return { ...prev, images: newImages };
        });
      } else if (field === 'videoUrls') {
        setProductForm(prev => {
          const newVideos = [...(prev.videoUrls || [])];
          if (idx !== undefined) newVideos[idx] = url;
          else newVideos.push(url);
          return { ...prev, videoUrls: newVideos };
        });
      }
      return;
    } catch (err: any) {
      console.error("Cloudinary upload failed", err);
      if (field === 'videoUrls') {
        alert('Video upload failed: ' + err.message);
      }
    } finally {
      if (e.target) e.target.value = '';
    }

    // Fallback for images
    if (field !== 'videoUrls') {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const compressed = await compressImage(base64);
        if (field === 'imageUrl') {
          setProductForm(prev => ({ ...prev, imageUrl: compressed }));
        } else if (field === 'images') {
          setProductForm(prev => {
            const newImages = [...prev.images];
            if (idx !== undefined) newImages[idx] = compressed;
            else newImages.push(compressed);
            return { ...prev, images: newImages };
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddField = (field: 'images' | 'variants' | 'videoUrls') => {
    if (field === 'images') {
      setProductForm(prev => ({ ...prev, images: [...prev.images, ''] }));
    } else if (field === 'videoUrls') {
      setProductForm(prev => ({ ...prev, videoUrls: [...(prev.videoUrls || []), ''] }));
    } else {
      const newVariant = { id: Date.now().toString(), name: '', price: productForm.price };
      setProductForm(prev => ({ ...prev, variants: [...(prev.variants || []), newVariant] }));
    }
  };

  const handleRemoveField = (field: 'images' | 'variants' | 'videoUrls', index: number) => {
    if (field === 'images') {
      setProductForm(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
    } else if (field === 'videoUrls') {
      setProductForm(prev => ({ ...prev, videoUrls: (prev.videoUrls || []).filter((_, i) => i !== index) }));
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
    console.log("Deleting product:", id);
    setDeletingId(id);
    try {
      await deleteProduct(id);
      setDeletingId(null);
      fetchData();
    } catch (err: any) {
      console.error("Delete failed:", err);
      setDeletingId(null);
      alert(`Failed to delete product: ${err.message || 'Check your permissions'}`);
    }
  };

  const handleDeleteOrder = async (id: string) => {
    console.log("Deleting order:", id);
    setDeletingId(id);
    try {
      await deleteOrder(id);
      setDeletingId(null);
      fetchData(); // This refreshes admin dashboard stats
    } catch (err: any) {
      console.error("Delete failed:", err);
      setDeletingId(null);
      alert(`Failed to delete order: ${err.message || 'Check your permissions'}`);
    }
  };

  const handleUpdateStatus = async (id: string, status: Order['orderStatus']) => {
    await updateOrderStatus(id, status);
    fetchData();
  };

  const onEditOrder = async (id: string, data: Partial<Order>) => {
    await updateOrder(id, data);
    fetchData();
  };

  const handleDeleteBlog = async (id: string) => {
    console.log("Dashboard initiating delete for blog:", id);
    try {
      await deleteBlog(id);
      console.log("Blog deleted from Firestore, refreshing data...");
      await fetchData(true); // Silent refresh
      console.log("Refresh complete");
    } catch (err) {
      console.error("Dashboard delete failed:", err);
      throw err;
    }
  };

  const handleBulkProductUpload = async () => {
    if (!bulkProductData.trim()) return;
    setIsUploadingProducts(true);
    
    try {
      let rawLines = bulkProductData.trim().split(/\r?\n/);
      const header = rawLines[0].toLowerCase().split(',').map(h => h.trim());
      const newProducts: any[] = [];
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

        const row: any = {};
        header.forEach((h, idx) => {
          if (values[idx] !== undefined) row[h] = values[idx];
        });

        // Basic mapping
        const product: any = {
          name: row.name || '',
          price: parseFloat(row.price) || 0,
          description: row.description || '',
          category: row.category || '',
          stock: parseInt(row.stock) || 0,
          imageUrl: row.imageurl || row.image || row.imageUrl || '',
          images: (row.images || '').split(';').map((s: string) => s.trim()).filter(Boolean),
          isCOD: row.iscod?.toLowerCase() === 'true' || row.iscod === '1',
          featured: row.featured?.toLowerCase() === 'true' || row.featured === '1',
          isNewArrival: true,
          soldCount: 0,
          wishlistCount: 0
        };

        // Parse Variants: e.g. "Size:Small|Price:659,Size:Medium|Price:759"
        if (row.variants) {
           const variantStrings = row.variants.split(',');
           product.variants = variantStrings.map((vs: string) => {
             const parts = vs.split('|');
             const v: any = { id: Math.random().toString(36).substr(2, 9) };
             parts.forEach(p => {
               const [key, val] = p.split(':');
               if (key?.trim().toLowerCase() === 'size' || key?.trim().toLowerCase() === 'name') v.name = val?.trim();
               if (key?.trim().toLowerCase() === 'price') v.price = parseFloat(val?.trim()) || product.price;
               if (key?.trim().toLowerCase() === 'image') v.imageUrl = val?.trim();
             });
             return v;
           });
        }

        if (!product.name) {
          skippedCount++;
          continue;
        }

        newProducts.push(product);
      }

      if (newProducts.length === 0) {
        alert("No valid products found in the provided data.");
        return;
      }

      await bulkAddProducts(newProducts);
      alert(`Successfully uploaded ${newProducts.length} products. ${skippedCount} items skipped.`);
      setBulkProductData('');
      setShowBulkProductModal(false);
      fetchData();
    } catch (error: any) {
      console.error('Bulk product upload error:', error);
      alert(`Upload failed: ${error.message}`);
    } finally {
      setIsUploadingProducts(false);
    }
  };

  const downloadProductSampleCSV = () => {
    const csvContent = "name,price,description,category,stock,imageUrl,images,isCOD,featured,variants\n" +
      "Graphic Tee,899,Premium quality cotton oversized tee.,T-Shirts,50,https://res.cloudinary.com/demo/image/upload/sample.jpg,https://res.cloudinary.com/demo/image/upload/v1/sample2.jpg;https://res.cloudinary.com/demo/image/upload/v1/sample3.jpg,true,false,\"Size:Small|Price:899,Size:Medium|Price:999\"";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'karmagully_products_template.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg text-white">
        <div className="w-12 h-12 border-4 border-neon-purple border-t-transparent rounded-full animate-spin shadow-[0_0_20px_rgba(168,85,247,0.3)]" />
      </div>
    );
  }

  const newOrdersBadge = orders.filter(o => {
    if (o.orderStatus !== 'Pending') return false;
    const createdAt = (o.createdAt as any)?.toMillis?.() || (o.createdAt as any)?.seconds * 1000 || 0;
    return createdAt > lastSeenOrders;
  }).length;

  const newTicketsBadge = tickets.filter(t => {
    if (t.status !== 'pending') return false;
    const createdAt = (t.createdAt as any)?.toMillis?.() || (t.createdAt as any)?.seconds * 1000 || 0;
    return createdAt > lastSeenSupport;
  }).length;

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col md:flex-row">
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-white/5 bg-dark-bg/80 backdrop-blur-md sticky top-0 z-[60]">
        <Link to="/" className="flex items-center gap-2">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl || undefined} alt="Logo" className="w-8 h-8 object-contain" />
          ) : (
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
              <SettingsIcon className="w-5 h-5 text-white" />
            </div>
          )}
          <span className="text-lg font-black italic tracking-tighter uppercase">KARMA<span className="text-purple-600">GULLY</span></span>
        </Link>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-white">
          {isSidebarOpen ? <X /> : <MessageSquare className="rotate-90" />} {/* Using semi-rotating message icon as menu */}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-[70] w-64 glass-morphism border-r border-white/5 flex flex-col pt-8 transition-transform duration-300 md:relative md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="px-6 mb-12 hidden md:block">
          <Link to="/" className="flex items-center gap-2 mb-2 group">
            {settings?.logoUrl ? (
              <img src={settings.logoUrl || undefined} alt="Logo" className="w-8 h-8 object-contain group-hover:scale-110 transition-transform" />
            ) : (
              <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <SettingsIcon className="w-5 h-5 text-white" />
              </div>
            )}
            <span className="text-lg font-black italic tracking-tighter uppercase group-hover:text-purple-500 transition-colors">KARMA<span className="text-purple-600">GULLY</span></span>
          </Link>
          <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">Admin OS v2.0</p>
        </div>

        <nav className="flex-grow space-y-1 px-4 mt-16 md:mt-0 overflow-y-auto custom-scrollbar md:pb-12">
          <NavButton active={activeTab === 'overview'} onClick={() => { setActiveTab('overview'); setIsSidebarOpen(false); }} icon={<BarChart3 className="w-5 h-5" />} label="Overview" />
          <NavButton active={activeTab === 'products'} onClick={() => { setActiveTab('products'); setIsSidebarOpen(false); }} icon={<Package className="w-5 h-5" />} label="Products" />
          <NavButton active={activeTab === 'categories'} onClick={() => { setActiveTab('categories'); setIsSidebarOpen(false); }} icon={<LayoutGrid className="w-5 h-5" />} label="Categories" />
          <NavButton active={activeTab === 'blogs'} onClick={() => { setActiveTab('blogs'); setIsSidebarOpen(false); }} icon={<Rss className="w-5 h-5" />} label="Blogs" />
          <NavButton 
            active={activeTab === 'orders'} 
            onClick={() => { setActiveTab('orders'); setIsSidebarOpen(false); }} 
            icon={<ShoppingBag className="w-5 h-5" />} 
            label="Orders" 
            badge={activeTab === 'orders' ? 0 : newOrdersBadge}
          />
          <NavButton active={activeTab === 'coupons'} onClick={() => { setActiveTab('coupons'); setIsSidebarOpen(false); }} icon={<Tag className="w-5 h-5" />} label="Coupons" />
          <NavButton active={activeTab === 'pages'} onClick={() => { setActiveTab('pages'); setIsSidebarOpen(false); }} icon={<FileText className="w-5 h-5" />} label="Pages" />
          <NavButton 
            active={activeTab === 'support'} 
            onClick={() => { setActiveTab('support'); setIsSidebarOpen(false); }} 
            icon={<MessageSquare className="w-5 h-5" />} 
            label="Support" 
            badge={activeTab === 'support' ? 0 : newTicketsBadge}
          />
          <NavButton active={activeTab === 'loyalty'} onClick={() => { setActiveTab('loyalty'); setIsSidebarOpen(false); }} icon={<Award className="w-5 h-5" />} label="Loyalty" badge={pendingClaims.length > 0 ? pendingClaims.length : 0} />
          <NavButton active={activeTab === 'couriers'} onClick={() => { setActiveTab('couriers'); setIsSidebarOpen(false); }} icon={<Truck className="w-5 h-5" />} label="Courier Partners" />
          <NavButton active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setIsSidebarOpen(false); }} icon={<SettingsIcon className="w-5 h-5" />} label="Settings" />
          <NavButton active={activeTab === 'reviews'} onClick={() => { setActiveTab('reviews'); setIsSidebarOpen(false); }} icon={<Star className="w-5 h-5" />} label="Reviews" />
          <NavButton active={activeTab === 'product-videos'} onClick={() => { setActiveTab('product-videos'); setIsSidebarOpen(false); }} icon={<Video className="w-5 h-5" />} label="Videos" />
          <NavButton active={activeTab === 'admins'} onClick={() => { setActiveTab('admins'); setIsSidebarOpen(false); }} icon={<ShieldAlert className="w-5 h-5" />} label="Admins" />
          <NavButton active={activeTab === 'domain-check'} onClick={() => { setActiveTab('domain-check'); setIsSidebarOpen(false); }} icon={<Globe className="w-5 h-5" />} label="Domain Health" />
          <NavButton active={activeTab === 'health'} onClick={() => { setActiveTab('health'); setIsSidebarOpen(false); }} icon={<Activity className="w-5 h-5" />} label="System Health" />
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

      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm md:hidden z-[65]" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-grow p-4 sm:p-8 md:p-12 overflow-y-auto h-[calc(100vh-64px)] md:h-screen custom-scrollbar">
        {dataCache.getIsQuotaExceeded() && (
          <div className="mb-8 p-4 bg-pink-500/10 border border-pink-500/20 rounded-2xl flex items-center gap-4 text-pink-500 animate-pulse">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            <div>
              <p className="text-xs font-black uppercase tracking-widest">Quota limit reached</p>
              <p className="text-[10px] font-bold opacity-80 uppercase tracking-wider">Data temporarily unavailable. Please try again later or check Firebase console.</p>
            </div>
          </div>
        )}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8 md:mb-12">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.4em] text-white/20 mb-2">Dashboard</p>
            <div className="flex items-center gap-4">
              <h1 className="text-3xl md:text-4xl font-black italic tracking-tighter uppercase">{activeTab}</h1>
              <button 
                onClick={() => {
                  dataCache.clear();
                  fetchData();
                }} 
                className="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-all flex items-center gap-2"
                title="Refresh Data"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
          {activeTab === 'products' && (
            <button onClick={() => setShowProductModal(true)} className="w-full sm:w-auto px-6 py-3 bg-neon-purple text-white rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 neon-shadow-purple hover:scale-105 transition-all">
              <Plus className="w-4 h-4" /> Add Product
            </button>
          )}
        </header>

        {activeTab === 'overview' && <OverviewTab products={products} orders={orders} onSeed={handleSeedData} seeding={seeding} onTabChange={setActiveTab} />}
        {activeTab === 'products' && (
          <ProductsTab 
            products={products} 
            onEdit={(p) => { setEditingProduct(p); setShowProductModal(true); }} 
            onDelete={(id) => {
              console.log("ProductsTab: Requesting delete for", id);
              handleDeleteProduct(id);
            }}
            onBulkImport={() => setShowBulkProductModal(true)}
            deletingId={deletingId}
          />
        )}
        {activeTab === 'categories' && <CategoriesTab 
          categories={categories} 
          onAdd={async (cat) => { try { await addCategory(cat); fetchData(); } catch (e: any) { alert(e.message); } }} 
          onDelete={async (id) => { 
            console.log("Deleting category:", id);
            setDeletingId(id);
            try { await deleteCategory(id); } catch (e: any) { alert(e.message); } finally { setDeletingId(null); fetchData(); }
          }} 
          onUpdate={async (id, cat) => { try { await updateCategory(id, cat); fetchData(); } catch (e: any) { alert(e.message); } }} 
          deletingId={deletingId}
        />}
        {activeTab === 'orders' && <OrdersTab orders={orders} onStatusUpdate={handleUpdateStatus} onDetails={(order) => setSelectedOrder(order)} onEditOrder={onEditOrder} onDelete={handleDeleteOrder} deletingId={deletingId} />}
        {activeTab === 'admins' && <AdminsTab 
          admins={admins} 
          onAdd={async (uid, email) => { try { await addAdmin(uid, email); fetchData(); } catch (e: any) { alert(e.message); } }} 
          onRemove={async (uid) => { 
            console.log("Removing admin:", uid);
            setDeletingId(uid);
            try { await removeAdmin(uid); } catch (e: any) { alert(e.message); } finally { setDeletingId(null); fetchData(); }
          }} 
          currentUserEmail={auth.currentUser?.email || ''} 
          deletingId={deletingId}
        />}
        {activeTab === 'settings' && settings && <SettingsTab settings={settings} pages={pages} products={products} onSave={async (s) => { await updateSettings(s); fetchData(); }} />}
        {activeTab === 'coupons' && <CouponsTab 
          coupons={coupons} 
          onAdd={async (c) => { try { await addCoupon(c); fetchData(); } catch (e: any) { alert(e.message); } }} 
          onDelete={async (code) => { 
            console.log("Deleting coupon:", code);
            setDeletingId(code);
            try { await deleteCoupon(code); } catch (e: any) { alert(e.message); } finally { setDeletingId(null); fetchData(); }
          }} 
          deletingId={deletingId}
        />}
        {activeTab === 'pages' && <PagesTab pages={pages} onRefresh={fetchData} />}
        {activeTab === 'support' && <SupportTab />}
        {activeTab === 'loyalty' && <LoyaltyTab />}
        {activeTab === 'couriers' && <CouriersTab couriers={couriers} onRefresh={fetchData} />}
        {activeTab === 'blogs' && <BlogsTab blogs={blogs} settings={blogSettings} onRefresh={fetchData} onDelete={handleDeleteBlog} />}
        {activeTab === 'reviews' && <ReviewsTab />}
        {activeTab === 'product-videos' && settings && <VideosTab settings={settings} />}
        {activeTab === 'domain-check' && <DomainHealthPage debugData={debugSitemapData} isQuotaExceeded={dataCache.getIsQuotaExceeded()} />}
        {activeTab === 'health' && <HealthTab />}

        {/* Product Modal */}
        <input 
          type="file"
          ref={videoFileInputRef}
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            if (activeVideoSlotIdx !== null) {
              handleFileUpload(e, 'videoUrls', activeVideoSlotIdx);
            }
          }}
        />
        <AnimatePresence>
          {showProductModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-4xl bg-dark-surface border border-white/10 rounded-3xl p-8 max-h-[90vh] overflow-y-auto custom-scrollbar"
              >
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-2xl font-black uppercase italic tracking-tighter">{editingProduct ? 'Modify Product' : 'Forge Product'}</h2>
                  <button onClick={() => { setShowProductModal(false); setEditingProduct(null); }} className="p-2 hover:bg-white/5 rounded-full"><X /></button>
                </div>

                <form onSubmit={handleSaveProduct} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <AdminInput label="Product Name" value={productForm.name} onChange={(e: any) => setProductForm({ ...productForm, name: e.target.value })} required />
                      <div className="grid grid-cols-2 gap-4">
                        <AdminInput 
                          label="Price (₹)" 
                          type="number" 
                          value={productForm.price ?? ''} 
                          onChange={(e: any) => setProductForm({ ...productForm, price: e.target.value === '' ? undefined : Number(e.target.value) })} 
                          required 
                        />
                        <AdminInput 
                          label="Stock" 
                          type="number" 
                          value={productForm.stock ?? ''} 
                          onChange={(e: any) => setProductForm({ ...productForm, stock: e.target.value === '' ? undefined : Number(e.target.value) })} 
                          required 
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Categories (Multi-Select)</label>
                        <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto no-scrollbar p-3 bg-black/20 rounded-xl border border-white/5">
                          {categories.map(cat => (
                            <label key={cat.id} className="flex items-center gap-2 cursor-pointer group">
                              <input 
                                type="checkbox"
                                checked={productForm.categories?.includes(cat.name)}
                                onChange={e => {
                                  const updated = e.target.checked 
                                    ? [...(productForm.categories || []), cat.name] 
                                    : (productForm.categories || []).filter(c => c !== cat.name);
                                  setProductForm({ ...productForm, categories: updated });
                                  // Also sync legacy category if first selection
                                  if (e.target.checked && !productForm.category) {
                                    setProductForm(prev => ({ ...prev, category: cat.name, categories: updated }));
                                  }
                                }}
                                className="w-4 h-4 accent-neon-purple rounded"
                              />
                              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 group-hover:text-white transition-colors">{cat.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Description</label>
                        <textarea 
                          className="w-full bg-dark-bg border border-white/10 rounded-xl p-4 text-sm focus:border-neon-purple outline-none min-h-[120px]"
                          value={productForm.description}
                          onChange={e => setProductForm({ ...productForm, description: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Primary Product Image</label>
                        <div className="flex items-center gap-4">
                          <div className="w-24 h-24 bg-dark-bg border border-white/10 rounded-2xl flex items-center justify-center overflow-hidden shrink-0">
                            {productForm.imageUrl ? <img src={productForm.imageUrl || undefined} className="w-full h-full object-cover" /> : <ImageIcon className="text-white/10" />}
                          </div>
                          <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'imageUrl')} className="text-[10px] file:bg-white/5 file:border-none file:text-[9px] file:text-white file:font-black file:uppercase file:px-3 file:py-1 file:rounded-md cursor-pointer" />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Additional Gallery Images</label>
                          <button type="button" onClick={() => handleAddField('images')} className="p-1 px-3 bg-neon-blue/10 text-neon-blue text-[8px] font-black uppercase rounded-lg border border-neon-blue/20">Add Image Slot</button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {productForm.images.map((img, idx) => (
                            <div key={idx} className="relative group aspect-square bg-dark-bg border border-white/10 rounded-xl overflow-hidden">
                              {img ? (
                                <>
                                  <img src={img || undefined} className="w-full h-full object-cover" />
                                  <button type="button" onClick={() => handleRemoveField('images', idx)} className="absolute inset-0 bg-pink-600/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Trash2 className="w-4 h-4 text-white" /></button>
                                </>
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2">
                                  <ImageIcon className="w-4 h-4 text-white/5" />
                                  <input type="file" accept="image/*" onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if(file) {
                                      const reader = new FileReader();
                                      reader.onloadend = () => {
                                        const newImages = [...productForm.images];
                                        newImages[idx] = reader.result as string;
                                        setProductForm({ ...productForm, images: newImages });
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                  }} className="absolute inset-0 opacity-0 cursor-pointer" />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-white/5">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Product Reels (Videos)</label>
                          <button type="button" onClick={() => handleAddField('videoUrls')} className="p-1 px-3 bg-neon-purple/10 text-neon-purple text-[8px] font-black uppercase rounded-lg border border-neon-purple/20">Add Video Slot</button>
                        </div>
                        <div className="space-y-2">
                           {productForm.videoUrls?.map((url, idx) => (
                             <div key={idx} className="flex gap-2">
                               <input 
                                 className="flex-grow bg-dark-bg border border-white/10 rounded-xl px-3 py-2 text-[10px] focus:border-neon-purple outline-none"
                                 value={url}
                                 placeholder="Cloudinary Video URL or Direct MP4"
                                 onChange={e => {
                                   const newVideos = [...(productForm.videoUrls || [])];
                                   newVideos[idx] = e.target.value;
                                   setProductForm({ ...productForm, videoUrls: newVideos });
                                 }}
                               />
                               <div className="flex items-center">
                                 <button 
                                   type="button" 
                                   onClick={() => {
                                     setActiveVideoSlotIdx(idx);
                                     videoFileInputRef.current?.click();
                                   }}
                                   className="p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                                 >
                                   <Video className="w-4 h-4 text-white/40" />
                                 </button>
                               </div>
                               <button type="button" onClick={() => handleRemoveField('videoUrls', idx)} className="p-2 bg-pink-500/10 text-pink-500 rounded-xl hover:bg-pink-500 hover:text-white transition-all">
                                 <Trash2 className="w-4 h-4" />
                               </button>
                             </div>
                           ))}
                           {(!productForm.videoUrls || productForm.videoUrls.length === 0) && (
                             <p className="text-[8px] text-white/10 font-bold uppercase tracking-[0.2em] text-center py-2">No videos linked to this manifest.</p>
                           )}
                        </div>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-white/5">
                        <div className="flex justify-between items-center">
                           <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Product Variants (Sizes/Types)</label>
                           <button type="button" onClick={() => handleAddField('variants')} className="p-1 px-3 bg-white/10 text-white text-[8px] font-black uppercase rounded-lg border border-white/20">Add Variant</button>
                        </div>
                        <div className="space-y-3">
                          {productForm.variants?.map((v, idx) => (
                            <div key={v.id} className="flex gap-2 items-end group bg-black/20 p-3 rounded-2xl border border-white/5">
                               <div className="relative shrink-0 group/img">
                                 <div className="w-10 h-10 bg-dark-bg border border-white/10 rounded-xl flex items-center justify-center overflow-hidden">
                                   {v.imageUrl ? <img src={v.imageUrl} className="w-full h-full object-cover" /> : <ImageIcon className="w-4 h-4 text-white/10" />}
                                 </div>
                                 <input 
                                   type="file" 
                                   accept="image/*" 
                                   onChange={async (e) => {
                                     const file = e.target.files?.[0];
                                     if (!file) return;
                                     try {
                                       const url = await uploadToCloudinary(file, 'image');
                                       const newVariants = [...(productForm.variants || [])];
                                       newVariants[idx].imageUrl = url;
                                       setProductForm({ ...productForm, variants: newVariants });
                                     } catch (err) {
                                       console.error("Variant image upload failed, falling back to compression", err);
                                       const url = await compressImage(await new Promise(r => { 
                                         const rd = new FileReader(); 
                                         rd.onload = () => r(rd.result as string); 
                                         rd.readAsDataURL(file); 
                                       }));
                                       const newVariants = [...(productForm.variants || [])];
                                       newVariants[idx].imageUrl = url;
                                       setProductForm({ ...productForm, variants: newVariants });
                                     }
                                   }} 
                                   className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                                 />
                                 {v.imageUrl && (
                                   <button 
                                     type="button" 
                                     onClick={() => {
                                       const newVariants = [...(productForm.variants || [])];
                                       newVariants[idx].imageUrl = undefined;
                                       setProductForm({ ...productForm, variants: newVariants });
                                     }}
                                     className="absolute -top-1 -right-1 p-0.5 bg-pink-500 rounded-full text-white opacity-0 group-hover/img:opacity-100 transition-opacity z-20"
                                   >
                                     <X className="w-2 h-2" />
                                   </button>
                                 )}
                               </div>
                               <div className="flex-grow space-y-1">
                                 <p className="text-[8px] font-bold uppercase tracking-widest text-white/20 ml-1">Name</p>
                                 <input 
                                   className="w-full bg-dark-bg border border-white/10 rounded-xl px-3 py-2 text-[10px] focus:border-neon-purple outline-none"
                                   value={v.name}
                                   placeholder="e.g. 12x18 Inch"
                                   onChange={e => {
                                     const newVariants = [...(productForm.variants || [])];
                                     newVariants[idx].name = e.target.value;
                                     setProductForm({ ...productForm, variants: newVariants });
                                   }}
                                 />
                               </div>
                               <div className="w-24 space-y-1">
                                 <p className="text-[8px] font-bold uppercase tracking-widest text-white/20 ml-1">Price (₹)</p>
                                 <input 
                                   type="number"
                                   className="w-full bg-dark-bg border border-white/10 rounded-xl px-3 py-2 text-[10px] focus:border-neon-purple outline-none"
                                   value={v.price ?? ''}
                                   onChange={e => {
                                     const newVariants = [...(productForm.variants || [])];
                                     newVariants[idx].price = e.target.value === '' ? undefined : Number(e.target.value) as any;
                                     setProductForm({ ...productForm, variants: newVariants });
                                   }}
                                 />
                               </div>
                               <button type="button" onClick={() => handleRemoveField('variants', idx)} className="p-2 bg-pink-500/10 text-pink-500 rounded-lg hover:bg-pink-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 mb-0.5"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          ))}
                          {(!productForm.variants || productForm.variants.length === 0) && (
                            <p className="text-[9px] text-white/10 font-bold uppercase tracking-widest text-center py-4 border border-dashed border-white/5 rounded-2xl italic">No variants active. Standard price applies.</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/5 group hover:border-emerald-500/30 transition-all">
                           <input type="checkbox" checked={productForm.featured} onChange={e => setProductForm({...productForm, featured: e.target.checked})} className="w-5 h-5 accent-emerald-500" />
                           <div className="flex flex-col">
                             <label className="text-[10px] font-black uppercase tracking-widest text-white/60">Featured Drop</label>
                             <span className="text-[7px] text-white/20 font-bold uppercase tracking-widest">Main Slider & Badge</span>
                           </div>
                        </div>
                        <div className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/5 group hover:border-neon-blue/30 transition-all">
                           <input type="checkbox" checked={productForm.isNewArrival} onChange={e => setProductForm({...productForm, isNewArrival: e.target.checked})} className="w-5 h-5 accent-neon-blue" />
                           <div className="flex flex-col">
                             <label className="text-[10px] font-black uppercase tracking-widest text-white/60">New Arrival</label>
                             <span className="text-[7px] text-white/20 font-bold uppercase tracking-widest">Recent Heat Label</span>
                           </div>
                        </div>
                        <div className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/5 group hover:border-pink-500/30 transition-all">
                           <input type="checkbox" checked={productForm.isTrending} onChange={e => setProductForm({...productForm, isTrending: e.target.checked})} className="w-5 h-5 accent-pink-500" />
                           <div className="flex flex-col">
                             <label className="text-[10px] font-black uppercase tracking-widest text-white/60">Trending</label>
                             <span className="text-[7px] text-white/20 font-bold uppercase tracking-widest">Most Wanted label</span>
                           </div>
                        </div>
                        <div className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/5 group hover:border-purple-500/30 transition-all">
                           <input type="checkbox" checked={productForm.isCOD} onChange={e => setProductForm({...productForm, isCOD: e.target.checked})} className="w-5 h-5 accent-purple-500" />
                           <div className="flex flex-col">
                             <label className="text-[10px] font-black uppercase tracking-widest text-white/60">COD Support</label>
                             <span className="text-[7px] text-white/20 font-bold uppercase tracking-widest">Enable Cash on Delivery</span>
                           </div>
                        </div>
                      </div>

                      <div className="space-y-4 pt-6 border-t border-white/5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Zap className="w-4 h-4 text-amber-500" />
                            <label className="text-[10px] font-black uppercase tracking-widest text-white/60">Limited Drop Mode</label>
                            <input 
                              type="checkbox" 
                              checked={productForm.isLimitedDrop} 
                              onChange={e => setProductForm({...productForm, isLimitedDrop: e.target.checked})} 
                              className="w-5 h-5 accent-amber-500" 
                            />
                          </div>
                          {productForm.isLimitedDrop && (
                            <button 
                              type="button" 
                              onClick={() => setProductForm({...productForm, soldCount: 0})}
                              className="text-[8px] font-black uppercase tracking-widest text-pink-500 hover:underline"
                            >
                              Reset Drop
                            </button>
                          )}
                        </div>
                        
                        {productForm.isLimitedDrop && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            className="grid grid-cols-2 gap-4 pt-2"
                          >
                            <AdminInput 
                              label="Drop Quantity" 
                              type="number" 
                              value={productForm.dropQuantity || ''} 
                              onChange={(e: any) => setProductForm({...productForm, dropQuantity: Number(e.target.value)})} 
                            />
                            <div className="bg-black/20 p-3 rounded-xl border border-white/5 flex flex-col justify-center">
                              <p className="text-[8px] font-bold uppercase tracking-widest text-white/20 mb-1">Items Sold</p>
                              <p className="text-xl font-black italic tracking-tighter text-amber-500">{productForm.soldCount || 0}</p>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-white/5 flex gap-4">
                    <button type="button" onClick={() => { setShowProductModal(false); setEditingProduct(null); }} className="flex-1 py-4 bg-white/5 text-white/40 font-black uppercase tracking-widest text-xs rounded-xl hover:bg-white/10">Abort Changes</button>
                    <button type="submit" className="flex-grow py-4 bg-white text-dark-bg font-black uppercase tracking-widest text-xs rounded-xl hover:bg-neon-purple hover:text-white transition-all shadow-xl shadow-white/5">Forge Manifest</button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Bulk Product Modal */}
        <AnimatePresence>
          {showBulkProductModal && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-2xl bg-dark-surface border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl"
              >
                <div className="p-8 space-y-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">Bulk Product Forge</h3>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20 mt-1">Importing mass inventory data</p>
                    </div>
                    <button onClick={() => setShowBulkProductModal(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                      <X className="w-6 h-6 text-white/40" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-3">
                      <button 
                        onClick={downloadProductSampleCSV}
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
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (event) => setBulkProductData(event.target?.result as string);
                            reader.readAsText(file);
                          }}
                          className="hidden" 
                        />
                      </label>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">CSV Intel Data</label>
                        <div className="flex gap-4 items-center">
                          <button 
                            onClick={() => setBulkProductData('')}
                            className="text-[8px] text-pink-500 uppercase font-black tracking-widest hover:text-pink-400"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                      <textarea 
                        value={bulkProductData}
                        onChange={(e) => setBulkProductData(e.target.value)}
                        placeholder="name,price,description,category,stock,imageUrl,images,isCOD,featured,variants..."
                        className="w-full h-64 bg-black/40 border border-white/10 rounded-3xl p-6 text-[10px] font-mono text-emerald-500/80 outline-none focus:border-emerald-500/30 transition-all custom-scrollbar placeholder:text-white/5"
                      />
                      <p className="text-[8px] text-white/20 uppercase font-black tracking-widest mt-2 px-1">
                        Headers: name, price, description, category, stock, imageUrl, images (semicolon separated), isCOD (true/false), featured (true/false), variants (name:val|price:val,...)
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button 
                      onClick={() => setShowBulkProductModal(false)}
                      className="flex-1 py-4 bg-white/5 text-white/40 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all"
                    >
                      Abort
                    </button>
                    <button 
                      onClick={handleBulkProductUpload}
                      disabled={isUploadingProducts || !bulkProductData.trim()}
                      className="flex-2 py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      {isUploadingProducts ? 'Forging Inventory...' : 'Execute Bulk Forge'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Order Details Modal */}
        <AnimatePresence>
          {selectedOrder && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-2xl bg-dark-surface border border-white/10 rounded-3xl p-8 max-h-[90vh] overflow-y-auto custom-scrollbar"
              >
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h2 className="text-2xl font-black uppercase italic tracking-tighter">{isEditingOrder ? 'Edit Manifest' : 'Order Intel'}</h2>
                    <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest mt-1">#ORD-{selectedOrder.id.toUpperCase()}</p>
                  </div>
                  <div className="flex gap-2">
                    {!isEditingOrder && (
                      <button 
                        onClick={() => setIsEditingOrder(true)}
                        className="p-2 bg-white/5 hover:bg-neon-blue/20 text-neon-blue rounded-lg transition-all"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                    )}
                    <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-white/5 rounded-full"><X /></button>
                  </div>
                </div>

                {isEditingOrder ? (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    setLoading(true); // Show loading state during update
                    try {
                      await onEditOrder(selectedOrder.id, editOrderForm);
                      setSelectedOrder(null);
                      setIsEditingOrder(false);
                    } catch (err: any) {
                      console.error("Order update failed:", err);
                      alert("Error updating order: " + (err.message || "Unknown error"));
                    } finally {
                      setLoading(false);
                    }
                  }} className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-500">Customer Details</h3>
                        <AdminInput 
                          label="Full Name" 
                          value={editOrderForm.customerInfo?.fullName || ''} 
                          onChange={(e: any) => setEditOrderForm({ ...editOrderForm, customerInfo: { ...editOrderForm.customerInfo!, fullName: e.target.value } })} 
                        />
                        <AdminInput 
                          label="Phone" 
                          value={editOrderForm.customerInfo?.phone || ''} 
                          onChange={(e: any) => setEditOrderForm({ ...editOrderForm, customerInfo: { ...editOrderForm.customerInfo!, phone: e.target.value } })} 
                        />
                      </div>
                      <div className="space-y-6">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-500">Shipping Address</h3>
                        <AdminInput 
                          label="Full Address" 
                          value={editOrderForm.address?.fullAddress || ''} 
                          onChange={(e: any) => setEditOrderForm({ ...editOrderForm, address: { ...editOrderForm.address!, fullAddress: e.target.value } })} 
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <AdminInput 
                            label="City" 
                            value={editOrderForm.address?.city || ''} 
                            onChange={(e: any) => setEditOrderForm({ ...editOrderForm, address: { ...editOrderForm.address!, city: e.target.value } })} 
                          />
                          <AdminInput 
                            label="Pincode" 
                            value={editOrderForm.address?.pincode || ''} 
                            onChange={(e: any) => setEditOrderForm({ ...editOrderForm, address: { ...editOrderForm.address!, pincode: e.target.value } })} 
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-white/5">
                      <div className="space-y-6">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-500">Logistics & Tracking</h3>
                        <AdminInput 
                          label="Delivery Partner" 
                          placeholder="e.g. Delhivery, Blue Dart"
                          value={editOrderForm.deliveryPartner || ''} 
                          onChange={(e: any) => setEditOrderForm({ ...editOrderForm, deliveryPartner: e.target.value })} 
                        />
                        <AdminInput 
                          label="Tracking ID" 
                          placeholder="Enter tracking number"
                          value={editOrderForm.trackingId || ''} 
                          onChange={(e: any) => setEditOrderForm({ ...editOrderForm, trackingId: e.target.value })} 
                        />
                      </div>
                    </div>

                    <div className="pt-8 border-t border-white/5 flex gap-4">
                       <button type="button" onClick={() => setIsEditingOrder(false)} className="flex-1 py-4 bg-white/5 text-white/40 font-black uppercase tracking-widest text-xs rounded-xl">Discard</button>
                       <button type="submit" className="flex-grow py-4 bg-neon-purple text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-xl shadow-purple-500/20">Apply Changes</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                      <div className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-500">Customer Details</h3>
                        <div className="bg-dark-bg p-4 rounded-2xl border border-white/5 space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-widest text-white/20">Full Name</p>
                              <p className="text-sm font-bold">{selectedOrder.customerInfo.fullName}</p>
                            </div>
                            {selectedOrder.profileId && (
                              <div className="text-right">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-500">Customer ID</p>
                                <p className="text-xs font-black tracking-tighter text-emerald-500">{selectedOrder.profileId}</p>
                              </div>
                            )}
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
                                <img src={item.imageUrl || undefined} className="w-full h-full object-cover" alt={item.name} />
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
                        <div className="p-4 bg-white/5 border-t border-white/5 space-y-2">
                          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-white/40">
                            <span>Subtotal</span>
                            <span>₹{selectedOrder.totalAmount}</span>
                          </div>
                          {selectedOrder.advancePaid > 0 && (
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-emerald-500">
                              <span>Advance Paid (Verification)</span>
                              <span>-₹{selectedOrder.advancePaid}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center pt-2 border-t border-white/5">
                            <span className="text-[10px] font-black uppercase tracking-widest">
                              {selectedOrder.paymentType === 'COD' ? 'Balance at Door' : 'Total Amount'}
                            </span>
                            <span className="text-lg font-black italic text-purple-500">
                              ₹{selectedOrder.paymentType === 'COD' ? (selectedOrder.totalAmount - (selectedOrder.advancePaid || 0)) : selectedOrder.totalAmount}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 mb-8">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-500">Logistic Intel</h3>
                      <div className="p-4 bg-purple-500/5 rounded-2xl border border-purple-500/20 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                            <Truck className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-white/20 mb-1">Logistics Partner</p>
                            <div className="flex items-center gap-2">
                              <CourierLogo partner={selectedOrder.deliveryPartner} />
                              <p className="text-xs font-black uppercase tracking-tight">
                                {selectedOrder.deliveryPartner || 'Partner Assigning Soon'}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-white/20">Tracking ID</p>
                          {selectedOrder.trackingId ? (
                            <a 
                              href={getTrackingUrl(selectedOrder.deliveryPartner || '', selectedOrder.trackingId) || '#'} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs font-black uppercase tracking-tight text-neon-blue font-bold underline cursor-pointer hover:text-white transition-colors"
                            >
                              {selectedOrder.trackingId}
                            </a>
                          ) : (
                            <p className="text-xs font-black uppercase tracking-tight text-white/40">
                              Registration in progress
                            </p>
                          )}
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
                             {selectedOrder.paymentType === 'COD' && selectedOrder.paymentStatus === 'Success' ? 'COD Paid' : 
                               selectedOrder.paymentType === 'COD' ? 'COD Pending' : 
                               selectedOrder.paymentStatus === 'Success' ? 'Paid Online' : selectedOrder.paymentStatus}
                           </p>
                         </div>
                       </div>
                       {selectedOrder.paymentStatus !== 'Success' && (
                         <button 
                           onClick={async () => {
                             try {
                               await updatePaymentStatus(selectedOrder.id, 'Success');
                               const updatedOrder = { ...selectedOrder, paymentStatus: 'Success' as const };
                               setSelectedOrder(updatedOrder);
                               setOrders(prev => prev.map(o => o.id === selectedOrder.id ? updatedOrder : o));
                             } catch (e) {
                               console.error("Failed to update payment:", e);
                             }
                           }}
                           className="px-6 py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                         >
                           Mark as Paid
                         </button>
                       )}
                    </div>
                  </>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function SettingsTab({ settings, pages, products, onSave }: { settings: AppSettings, pages: any[], products: Product[], onSave: (s: AppSettings) => Promise<void> }) {
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

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
      <div className="glass-morphism p-6 sm:p-8 rounded-3xl space-y-8">
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-purple-500 mb-6 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Announcement Bar
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
            <Zap className="w-4 h-4" /> Growth Features
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FeatureToggle 
              icon={<TrendingUp className="w-4 h-4" />}
              label="Recommendations"
              description="AI-driven 'You may also like' section"
              checked={form.features?.recommendations ?? true}
              onChange={val => setForm({...form, features: {...(form.features || DEFAULT_SETTINGS.features), recommendations: val}})}
            />
            <FeatureToggle 
              icon={<Heart className="w-4 h-4" />}
              label="Wishlist System"
              description="Allow users to save items for later"
              checked={form.features?.wishlist ?? true}
              onChange={val => setForm({...form, features: {...(form.features || DEFAULT_SETTINGS.features), wishlist: val}})}
            />
            <FeatureToggle 
              icon={<Zap className="w-4 h-4" />}
              label="Limited Collections"
              description="Enable FOMO scarcity indicators"
              checked={form.features?.limitedDrops ?? false}
              onChange={val => setForm({...form, features: {...(form.features || DEFAULT_SETTINGS.features), limitedDrops: val}})}
            />
            <FeatureToggle 
              icon={<ShieldCheck className="w-4 h-4" />}
              label="Trust Badges"
              description="Show production quality badges"
              checked={form.features?.trustBadges ?? true}
              onChange={val => setForm({...form, features: {...(form.features || DEFAULT_SETTINGS.features), trustBadges: val}})}
            />
            <FeatureToggle 
              icon={<MessageSquare className="w-4 h-4" />}
              label="Product Reviews"
              description="Enable customer reviews and ratings"
              checked={form.features?.reviews ?? true}
              onChange={val => setForm({...form, features: {...(form.features || DEFAULT_SETTINGS.features), reviews: val}})}
            />
            <FeatureToggle 
              icon={<Video className="w-4 h-4" />}
              label="Video/Reels Section"
              description="Show vertical product videos"
              checked={form.features?.videoSection ?? false}
              onChange={val => setForm({...form, features: {...(form.features || DEFAULT_SETTINGS.features), videoSection: val}})}
            />
            <FeatureToggle 
              icon={<Layers className="w-4 h-4" />}
              label="Variant Images"
              description="Switch images based on selection"
              checked={form.features?.variantImages ?? true}
              onChange={val => setForm({...form, features: {...(form.features || DEFAULT_SETTINGS.features), variantImages: val}})}
            />
          </div>

          {form.features?.trustBadges && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="mt-6 p-6 bg-white/5 border border-white/10 rounded-2xl space-y-4"
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-2">Visible Badges</p>
              <div className="grid grid-cols-2 gap-4">
                <BadgeCheckbox label="Premium Quality" checked={form.trustBadgesContent?.quality ?? true} onChange={val => setForm({...form, trustBadgesContent: {...(form.trustBadgesContent || DEFAULT_SETTINGS.trustBadgesContent), quality: val}})} />
                <BadgeCheckbox label="Fade Resistant" checked={form.trustBadgesContent?.resistant ?? true} onChange={val => setForm({...form, trustBadgesContent: {...(form.trustBadgesContent || DEFAULT_SETTINGS.trustBadgesContent), resistant: val}})} />
                <BadgeCheckbox label="Easy Mount" checked={form.trustBadgesContent?.easyMount ?? true} onChange={val => setForm({...form, trustBadgesContent: {...(form.trustBadgesContent || DEFAULT_SETTINGS.trustBadgesContent), easyMount: val}})} />
                <BadgeCheckbox label="COD Support" checked={form.trustBadgesContent?.cod ?? true} onChange={val => setForm({...form, trustBadgesContent: {...(form.trustBadgesContent || DEFAULT_SETTINGS.trustBadgesContent), cod: val}})} />
              </div>
            </motion.div>
          )}
        </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AdminInput 
                label="Sale Title"
                value={form.flashSale.title}
                onChange={(e: any) => setForm({...form, flashSale: {...form.flashSale, title: e.target.value}})}
              />
              <AdminInput 
                label="End Time (ISO)"
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
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-neon-purple flex items-center gap-2">
              Social Nodes
            </h3>
            <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Connects Blog & Terminal</p>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5 group hover:border-purple-500/30 transition-all">
              <div className="w-10 h-10 bg-gradient-to-tr from-purple-600 to-pink-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Instagram className="w-5 h-5 text-white" />
              </div>
              <div className="flex-grow">
                <p className="text-[8px] font-black uppercase tracking-widest text-white/40 mb-1">Instagram Protocol</p>
                <input 
                  type="text"
                  placeholder="https://instagram.com/yourname"
                  className="w-full bg-transparent text-[10px] font-bold text-white outline-none placeholder:text-white/10"
                  value={form.socialLinks?.instagram || ''}
                  onChange={(e: any) => setForm({...form, socialLinks: { ...(form.socialLinks || DEFAULT_SETTINGS.socialLinks), instagram: e.target.value }})}
                />
              </div>
            </div>

            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5 group hover:border-blue-400/30 transition-all">
              <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center border border-white/10 shadow-lg group-hover:scale-110 transition-transform">
                <Twitter className="w-5 h-5 text-white" />
              </div>
              <div className="flex-grow">
                <p className="text-[8px] font-black uppercase tracking-widest text-white/40 mb-1">X / Twitter Matrix</p>
                <input 
                  type="text"
                  placeholder="https://twitter.com/yourname"
                  className="w-full bg-transparent text-[10px] font-bold text-white outline-none placeholder:text-white/10"
                  value={form.socialLinks?.twitter || ''}
                  onChange={(e: any) => setForm({...form, socialLinks: { ...(form.socialLinks || DEFAULT_SETTINGS.socialLinks), twitter: e.target.value }})}
                />
              </div>
            </div>

            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5 group hover:border-blue-600/30 transition-all">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Facebook className="w-5 h-5 text-white" />
              </div>
              <div className="flex-grow">
                <p className="text-[8px] font-black uppercase tracking-widest text-white/40 mb-1">Facebook Core</p>
                <input 
                  type="text"
                  placeholder="https://facebook.com/yourpage"
                  className="w-full bg-transparent text-[10px] font-bold text-white outline-none placeholder:text-white/10"
                  value={form.socialLinks?.facebook || ''}
                  onChange={(e: any) => setForm({...form, socialLinks: { ...(form.socialLinks || DEFAULT_SETTINGS.socialLinks), facebook: e.target.value }})}
                />
              </div>
            </div>

            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5 group hover:border-sky-400/30 transition-all">
              <div className="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Send className="w-5 h-5 text-white" />
              </div>
              <div className="flex-grow">
                <p className="text-[8px] font-black uppercase tracking-widest text-white/40 mb-1">Telegram Channel</p>
                <input 
                  type="text"
                  placeholder="https://t.me/yourboturl"
                  className="w-full bg-transparent text-[10px] font-bold text-white outline-none placeholder:text-white/10"
                  value={form.socialLinks?.telegram || ''}
                  onChange={(e: any) => setForm({...form, socialLinks: { ...(form.socialLinks || DEFAULT_SETTINGS.socialLinks), telegram: e.target.value }})}
                />
              </div>
            </div>

            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5 group hover:border-emerald-500/30 transition-all">
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Phone className="w-5 h-5 text-white" />
              </div>
              <div className="flex-grow">
                <p className="text-[8px] font-black uppercase tracking-widest text-white/40 mb-1">WhatsApp Terminal</p>
                <input 
                  type="text"
                  placeholder="https://wa.me/yournumber"
                  className="w-full bg-transparent text-[10px] font-bold text-white outline-none placeholder:text-white/10"
                  value={form.socialLinks?.whatsapp || ''}
                  onChange={(e: any) => setForm({...form, socialLinks: { ...(form.socialLinks || DEFAULT_SETTINGS.socialLinks), whatsapp: e.target.value }})}
                />
              </div>
            </div>

            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5 group hover:border-pink-600/30 transition-all">
              <div className="w-10 h-10 bg-pink-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Youtube className="w-5 h-5 text-white" />
              </div>
              <div className="flex-grow">
                <p className="text-[8px] font-black uppercase tracking-widest text-white/40 mb-1">YouTube Network</p>
                <input 
                  type="text"
                  placeholder="https://youtube.com/@yourchannel"
                  className="w-full bg-transparent text-[10px] font-bold text-white outline-none placeholder:text-white/10"
                  value={form.socialLinks?.youtube || ''}
                  onChange={(e: any) => setForm({...form, socialLinks: { ...(form.socialLinks || DEFAULT_SETTINGS.socialLinks), youtube: e.target.value }})}
                />
              </div>
            </div>
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
          </div>
        </div>

        <div className="pt-8 border-t border-white/5">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-neon-blue mb-6 flex items-center gap-2">
            Growth & Experience
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5 group hover:border-purple-500/30 transition-all">
               <div className="flex items-center gap-3">
                 <Heart className="w-4 h-4 text-pink-500" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Wishlist System</span>
               </div>
               <input 
                 type="checkbox" 
                 checked={form.features?.wishlist} 
                 onChange={e => setForm({...form, features: { ...(form.features || DEFAULT_SETTINGS.features), wishlist: e.target.checked }})}
                 className="w-5 h-5 accent-pink-500" 
               />
            </div>
            <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5 group hover:border-neon-blue/30 transition-all">
               <div className="flex items-center gap-3">
                 <Layers className="w-4 h-4 text-neon-blue" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Recommendations</span>
               </div>
               <input 
                 type="checkbox" 
                 checked={form.features?.recommendations} 
                 onChange={e => setForm({...form, features: { ...(form.features || DEFAULT_SETTINGS.features), recommendations: e.target.checked }})}
                 className="w-5 h-5 accent-neon-blue" 
               />
            </div>
            <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5 group hover:border-amber-500/30 transition-all border-amber-500/10">
               <div className="flex items-center gap-3">
                 <Zap className="w-4 h-4 text-amber-500" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Limited Drop Modules</span>
               </div>
               <input 
                 type="checkbox" 
                 checked={form.features?.limitedDrops} 
                 onChange={e => setForm({...form, features: { ...(form.features || DEFAULT_SETTINGS.features), limitedDrops: e.target.checked }})}
                 className="w-5 h-5 accent-amber-500" 
               />
            </div>
            <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5 group hover:border-amber-500/30 transition-all">
               <div className="flex items-center gap-3">
                 <Zap className="w-4 h-4 text-amber-500" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Limited Badge (Thumb)</span>
               </div>
               <input 
                 type="checkbox" 
                 checked={form.features?.showLimitedBadgeOnThumbnails} 
                 onChange={e => setForm({...form, features: { ...(form.features || DEFAULT_SETTINGS.features), showLimitedBadgeOnThumbnails: e.target.checked }})}
                 className="w-5 h-5 accent-amber-500" 
               />
            </div>
            <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5 group hover:border-emerald-500/30 transition-all">
               <div className="flex items-center gap-3">
                 <ShieldCheck className="w-4 h-4 text-emerald-500" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Trust Badges</span>
               </div>
               <input 
                 type="checkbox" 
                 checked={form.features?.trustBadges} 
                 onChange={e => setForm({...form, features: { ...(form.features || DEFAULT_SETTINGS.features), trustBadges: e.target.checked }})}
                 className="w-5 h-5 accent-emerald-500" 
               />
            </div>
            <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5 group hover:border-amber-500/30 transition-all">
               <div className="flex items-center gap-3">
                 <Database className="w-4 h-4 text-amber-500" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Stock on Thumbnails</span>
               </div>
               <input 
                 type="checkbox" 
                 checked={form.features?.showStockOnThumbnails} 
                 onChange={e => setForm({...form, features: { ...(form.features || DEFAULT_SETTINGS.features), showStockOnThumbnails: e.target.checked }})}
                 className="w-5 h-5 accent-amber-500" 
               />
            </div>
            <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5 group hover:border-amber-500/30 transition-all">
               <div className="flex items-center gap-3">
                 <Database className="w-4 h-4 text-amber-500" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Stock on Details</span>
               </div>
               <input 
                 type="checkbox" 
                 checked={form.features?.showStockOnDetails} 
                 onChange={e => setForm({...form, features: { ...(form.features || DEFAULT_SETTINGS.features), showStockOnDetails: e.target.checked }})}
                 className="w-5 h-5 accent-amber-500" 
               />
            </div>
          </div>

          {form.features?.trustBadges && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="mt-4 p-6 bg-emerald-500/5 rounded-3xl border border-emerald-500/10 space-y-4"
            >
               <h4 className="text-[8px] font-black uppercase tracking-widest text-emerald-500/60">Active Trust Indicators</h4>
               <div className="grid grid-cols-2 gap-4">
                 <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      checked={form.trustBadgesContent?.quality} 
                      onChange={e => setForm({...form, trustBadgesContent: { ...(form.trustBadgesContent || DEFAULT_SETTINGS.trustBadgesContent), quality: e.target.checked }})}
                    />
                    <label className="text-[9px] font-bold uppercase tracking-widest text-white/40">Premium Metal</label>
                 </div>
                 <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      checked={form.trustBadgesContent?.resistant} 
                      onChange={e => setForm({...form, trustBadgesContent: { ...(form.trustBadgesContent || DEFAULT_SETTINGS.trustBadgesContent), resistant: e.target.checked }})}
                    />
                    <label className="text-[9px] font-bold uppercase tracking-widest text-white/40">Fade Resistant</label>
                 </div>
                 <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      checked={form.trustBadgesContent?.easyMount} 
                      onChange={e => setForm({...form, trustBadgesContent: { ...(form.trustBadgesContent || DEFAULT_SETTINGS.trustBadgesContent), easyMount: e.target.checked }})}
                    />
                    <label className="text-[9px] font-bold uppercase tracking-widest text-white/40">Easy Mount</label>
                 </div>
                 <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      checked={form.trustBadgesContent?.cod} 
                      onChange={e => setForm({...form, trustBadgesContent: { ...(form.trustBadgesContent || DEFAULT_SETTINGS.trustBadgesContent), cod: e.target.checked }})}
                    />
                    <label className="text-[9px] font-bold uppercase tracking-widest text-white/40">Cash on Delivery</label>
                 </div>
               </div>
            </motion.div>
          )}
        </div>

        <div className="pt-8 border-t border-white/5">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white flex items-center gap-2 mb-6">
            <MessageSquare className="w-4 h-4 text-purple-500" /> Support Integration
          </h3>
          <div className="space-y-4">
            <AdminInput 
              label="Telegram Support Bot URL"
              value={form.supportBotUrl || ''}
              onChange={(e: any) => setForm({...form, supportBotUrl: e.target.value})}
              placeholder="https://t.me/YourSupportBot"
            />
            <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-white/20 italic">
              Used in the Support card on the website.
            </p>
          </div>
        </div>

        <div className="pt-8 border-t border-white/5">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-pink-500" /> Quick Links
            </h3>
            <button 
              type="button"
              onClick={() => setForm({ ...form, quickLinks: [...(form.quickLinks || []), { label: 'New Link', url: '/' }] })}
              className="text-[10px] font-black uppercase tracking-widest text-purple-500 hover:text-purple-400"
            >
              + Add Link
            </button>
          </div>
          <div className="space-y-3">
            {(form.quickLinks || []).map((link, idx) => (
              <div key={idx} className="flex gap-3 bg-white/5 p-3 rounded-xl border border-white/5 items-end">
                <div className="flex-1">
                  <AdminInput 
                    label="Label"
                    value={link.label}
                    onChange={(e: any) => {
                      const newLinks = [...(form.quickLinks || [])];
                      newLinks[idx].label = e.target.value;
                      setForm({ ...form, quickLinks: newLinks });
                    }}
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-white/40 block">Destination</label>
                  <select 
                    value={link.url}
                    onChange={(e) => {
                      const newLinks = [...(form.quickLinks || [])];
                      newLinks[idx].url = e.target.value;
                      setForm({ ...form, quickLinks: newLinks });
                    }}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-[10px] font-bold text-white outline-none focus:border-purple-500 transition-colors"
                  >
                    <option value="/">Home</option>
                    <option value="/shop">Shop</option>
                    <option value="/profile">My Orders</option>
                    <option value="/support">Support</option>
                    <optgroup label="Custom Pages">
                      {pages.map(p => (
                        <option key={p.slug} value={`/page/${p.slug}`}>{p.title}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <button 
                  type="button"
                  onClick={() => {
                    const newLinks = (form.quickLinks || []).filter((_, i) => i !== idx);
                    setForm({ ...form, quickLinks: newLinks });
                  }}
                  className="p-3 bg-pink-500/10 text-pink-500 rounded-xl hover:bg-pink-500/20 transition-all mb-0.5"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-8 border-t border-white/5">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-emerald-500" /> Home Page Sections
            </h3>
            <button 
              type="button"
              onClick={() => setForm({ 
                ...form, 
                homeSections: [
                  ...(form.homeSections || []), 
                  { id: Date.now().toString(), title: 'New Section', productIds: [], order: (form.homeSections?.length || 0) }
                ] 
              })}
              className="text-[10px] font-black uppercase tracking-widest text-emerald-500 hover:text-emerald-400"
            >
              + Add Section
            </button>
          </div>
          <div className="space-y-6">
            {(form.homeSections || []).sort((a, b) => a.order - b.order).map((section, sidx) => (
              <div key={section.id} className="bg-white/5 p-6 rounded-[2rem] border border-white/5 space-y-6">
                <div className="flex justify-between items-end gap-4">
                  <div className="flex-grow">
                    <AdminInput 
                      label="Section Heading"
                      value={section.title}
                      onChange={(e: any) => {
                        const newSections = [...(form.homeSections || [])];
                        const idx = newSections.findIndex(s => s.id === section.id);
                        newSections[idx].title = e.target.value;
                        setForm({ ...form, homeSections: newSections });
                      }}
                    />
                  </div>
                  <div className="flex gap-2 mb-0.5">
                    <button 
                      type="button"
                      onClick={() => {
                        const newSections = [...(form.homeSections || [])];
                        const idx = newSections.findIndex(s => s.id === section.id);
                        if (idx > 0) {
                          const temp = newSections[idx].order;
                          newSections[idx].order = newSections[idx-1].order;
                          newSections[idx-1].order = temp;
                          setForm({ ...form, homeSections: newSections });
                        }
                      }}
                      className="p-3 bg-white/5 text-white/40 rounded-xl hover:text-white transition-all"
                    >
                      <MoveUp className="w-4 h-4" />
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        const newSections = [...(form.homeSections || [])];
                        const idx = newSections.findIndex(s => s.id === section.id);
                        if (idx < newSections.length - 1) {
                          const temp = newSections[idx].order;
                          newSections[idx].order = newSections[idx+1].order;
                          newSections[idx+1].order = temp;
                          setForm({ ...form, homeSections: newSections });
                        }
                      }}
                      className="p-3 bg-white/5 text-white/40 rounded-xl hover:text-white transition-all"
                    >
                      <MoveDown className="w-4 h-4" />
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        const newSections = (form.homeSections || []).filter(s => s.id !== section.id);
                        setForm({ ...form, homeSections: newSections });
                      }}
                      className="p-3 bg-pink-500/10 text-pink-500 rounded-xl hover:bg-pink-500/20 transition-all shadow-lg shadow-pink-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[9px] font-black uppercase tracking-widest text-white/40 block ml-1">Products in Section</label>
                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto p-4 bg-black/40 rounded-2xl border border-white/5 no-scrollbar">
                    {products.map(p => {
                      const isSelected = section.productIds.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            const newSections = [...(form.homeSections || [])];
                            const idx = newSections.findIndex(s => s.id === section.id);
                            const productIds = [...newSections[idx].productIds];
                            if (isSelected) {
                              const pIdx = productIds.indexOf(p.id);
                              productIds.splice(pIdx, 1);
                            } else {
                              productIds.push(p.id);
                            }
                            newSections[idx].productIds = productIds;
                            setForm({ ...form, homeSections: newSections });
                          }}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${isSelected ? 'bg-purple-600/20 border-purple-600/50 text-white' : 'bg-white/5 border-white/5 text-white/40 hover:border-white/10'}`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-purple-600 border-purple-600' : 'border-white/20'}`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <img src={p.imageUrl} alt="" className="w-8 h-8 rounded object-cover grayscale" />
                          <div className="flex-grow">
                             <span className="text-[10px] font-bold block truncate">{p.name}</span>
                             <span className="text-[8px] opacity-40">₹{p.price}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
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
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="w-16 h-16 bg-dark-bg border border-white/10 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                  {form.logoUrl ? <img src={form.logoUrl || undefined} className="w-full h-full object-contain" alt="Logo preview" /> : <Package className="w-6 h-6 text-white/10" />}
                </div>
                <div className="space-y-2">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">Upload Logo</p>
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
                label="Primary Domain (SEO)"
                value={form.primaryDomain || ''}
                onChange={(e: any) => setForm({...form, primaryDomain: e.target.value})}
                placeholder="https://karmagully.com"
              />
              <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-white/20 italic leading-relaxed">
                Crucial for Sitemap & SEO accuracy. Defines the base URL for search engines and sitemap generation. Include https://
              </p>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/5">
              <AdminInput 
                label="Favicon URL"
                value={form.faviconUrl || ''}
                onChange={(e: any) => setForm({...form, faviconUrl: e.target.value})}
                placeholder="https://example.com/favicon.ico"
              />
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="w-10 h-10 bg-dark-bg border border-white/10 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                  {form.faviconUrl ? <img src={form.faviconUrl || undefined} className="w-full h-full object-contain" alt="Favicon preview" /> : <div className="text-[10px] font-black italic text-white/10">KG</div>}
                </div>
                <div className="space-y-2">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">Upload Favicon</p>
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
    );
}

function CouponsTab({ coupons, onAdd, onDelete, deletingId }: { coupons: Coupon[], onAdd: (c: Coupon) => Promise<void>, onDelete: (code: string) => Promise<void>, deletingId: string | null }) {
  const [newCoupon, setNewCoupon] = useState<Coupon>({
    code: '',
    discountType: 'percentage',
    discountValue: 0,
    minOrderAmount: 0,
    isActive: true,
    startDate: '',
    expiryDate: '',
    usageLimit: 0
  });
  const [isAdding, setIsAdding] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

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
        expiryDate: '',
        usageLimit: 0
      });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
      <div className="glass-morphism p-6 sm:p-8 rounded-[2rem] border border-white/5 space-y-6">
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
          <AdminInput 
            label="Usage Limit (0 for unlimited)" 
            type="number" 
            value={(newCoupon.usageLimit || 0).toString()} 
            onChange={(e: any) => setNewCoupon({ ...newCoupon, usageLimit: Number(e.target.value) })} 
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
                  {coupon.usageLimit && coupon.usageLimit > 0 && (
                    <span className="text-[9px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-purple-500/20">
                      Limit: {coupon.usageCount || 0} / {coupon.usageLimit}
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
              {deletingId === coupon.code ? (
                <button className="p-3 bg-pink-500/10 text-pink-500 rounded-xl animate-pulse"><Clock className="w-4 h-4 animate-spin" /></button>
              ) : confirmingId === coupon.code ? (
                <div className="flex gap-2 items-center animate-in fade-in slide-in-from-right-2 duration-200">
                  <button 
                    onClick={() => { onDelete(coupon.code); setConfirmingId(null); }} 
                    className="px-3 py-2 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all font-bold"
                  >
                    Confirm
                  </button>
                  <button 
                    onClick={() => setConfirmingId(null)}
                    className="p-2 px-3 text-white/40 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest font-bold"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setConfirmingId(coupon.code)}
                  className="p-3 bg-pink-500/10 text-pink-500 rounded-xl hover:bg-pink-500 hover:text-white transition-all shadow-lg"
                  title="Delete Coupon"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
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

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
      const slug = pageForm.slug.toLowerCase().trim().replace(/\s+/g, '-');
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
    setDeletingId(slug);
    try {
      console.log("AdminDashboard: Deleting page:", slug);
      await deleteDoc(doc(db, 'pages', slug));
      const { dataCache } = await import('../lib/dataCache');
      dataCache.clear();
      await onRefresh();
      setConfirmingId(null);
    } catch (err: any) {
      console.error("Delete failed:", err);
      alert("Error: " + err.message);
    } finally {
      setDeletingId(null);
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
                {deletingId === page.slug ? (
                  <button className="p-2 bg-pink-500/10 text-pink-500 rounded-lg animate-pulse">
                    <Clock className="w-4 h-4 animate-spin" />
                  </button>
                ) : confirmingId === page.slug ? (
                  <div className="flex gap-2 items-center animate-in fade-in slide-in-from-right-2 duration-200">
                    <button 
                      onClick={() => handleDelete(page.slug)} 
                      className="px-2 py-1 bg-pink-600 text-white rounded text-[8px] font-black uppercase tracking-widest hover:bg-pink-700 transition-all font-bold"
                    >
                      DEL
                    </button>
                    <button 
                      onClick={() => setConfirmingId(null)}
                      className="text-white/40 hover:text-white transition-all text-[8px] font-black uppercase tracking-widest font-bold"
                    >
                      X
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setConfirmingId(page.slug)} 
                    className="p-2 bg-white/5 rounded-lg text-white/20 hover:text-pink-500 hover:bg-pink-500/10 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
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
                              {section.value && <img src={section.value || undefined} className="w-16 h-16 object-cover rounded-lg border border-white/10" />}
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

function FeatureToggle({ icon, label, description, checked, onChange }: { icon: any, label: string, description: string, checked: boolean, onChange: (val: boolean) => void }) {
  return (
    <label className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl cursor-pointer group hover:bg-white/10 transition-all">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${checked ? 'bg-neon-purple text-white shadow-lg shadow-purple-500/20' : 'bg-white/5 text-white/20'}`}>
        {icon}
      </div>
      <div className="flex-grow">
        <p className={`text-[10px] font-black uppercase tracking-widest transition-colors ${checked ? 'text-white' : 'text-white/40'}`}>{label}</p>
        <p className="text-[8px] text-white/20 uppercase tracking-widest font-bold mt-0.5">{description}</p>
      </div>
      <input 
        type="checkbox" 
        checked={checked} 
        onChange={e => onChange(e.target.checked)} 
        className="hidden" 
      />
      <div className={`w-10 h-6 rounded-full relative transition-colors ${checked ? 'bg-neon-purple' : 'bg-white/10'}`}>
        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${checked ? 'right-1' : 'left-1'}`} />
      </div>
    </label>
  );
}

function BadgeCheckbox({ label, checked, onChange }: { label: string, checked: boolean, onChange: (val: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${checked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-white/10 group-hover:border-white/20'}`}>
        {checked && <Check className="w-3 h-3" />}
      </div>
      <span className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${checked ? 'text-white' : 'text-white/20'}`}>{label}</span>
      <input 
        type="checkbox" 
        checked={checked} 
        onChange={e => onChange(e.target.checked)} 
        className="hidden" 
      />
    </label>
  );
}

function NavButton({ active, icon, label, onClick, badge }: any) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-between px-6 py-4 rounded-xl transition-all duration-300 uppercase tracking-[0.15em] text-[10px] font-black ${
        active 
          ? 'bg-neon-purple/10 text-neon-purple border border-neon-purple/20 shadow-[0_0_15px_rgba(188,19,254,0.1)]' 
          : 'text-white/40 hover:text-white hover:bg-white/5 border border-transparent'
      }`}
    >
      <div className="flex items-center gap-3">
        {icon}
        {label}
      </div>
      {badge > 0 && (
        <span className="bg-pink-500 text-white text-[8px] px-1.5 py-0.5 rounded-md font-bold animate-pulse shadow-[0_0_10px_rgba(236,72,153,0.4)]">
          {badge}
        </span>
      )}
    </button>
  );
}

function StatCard({ title, value, icon, color }: any) {
  return (
    <div className="glass-morphism p-6 md:p-8 rounded-3xl space-y-4 relative overflow-hidden group">
      <div className={`absolute top-0 right-0 p-6 md:p-8 ${color}`}>
        {icon}
      </div>
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30">{title}</p>
      <h3 className="text-2xl md:text-4xl font-black italic tracking-tighter">{value}</h3>
    </div>
  );
}

function OverviewTab({ products, orders, onSeed, seeding, onTabChange }: { products: Product[], orders: Order[], onSeed: () => void, seeding: boolean, onTabChange: (tab: any) => void }) {
  const totalRevenue = orders.filter(o => o.paymentStatus === 'Success').reduce((sum, o) => sum + o.totalAmount, 0);
  const outOfStockProducts = products.filter(p => {
    const isOutOfStock = p.stock <= 0;
    const isFullyClaimed = p.isLimitedDrop && p.dropQuantity && (p.soldCount || 0) >= p.dropQuantity;
    return isOutOfStock || isFullyClaimed;
  });
  
  return (
    <div className="space-y-8 md:space-y-12">
      {outOfStockProducts.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 bg-pink-500/10 border border-pink-500/20 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 bg-pink-500/20 rounded-2xl flex items-center justify-center text-pink-500 shrink-0">
               <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-pink-500">Inventory Alert</p>
              <div className="flex flex-wrap gap-2">
                <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider">
                  Needs Refill:
                </p>
                {outOfStockProducts.slice(0, 3).map(p => (
                  <span key={p.id} className="text-[9px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-white/40 font-mono">
                    {p.name.substring(0, 15)}...
                  </span>
                ))}
                {outOfStockProducts.length > 3 && <span className="text-[9px] text-white/20 font-bold">+{outOfStockProducts.length - 3} More</span>}
              </div>
            </div>
          </div>
          <button 
            onClick={() => {
              onTabChange('products');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="w-full md:w-auto px-8 py-3 bg-pink-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-pink-600 transition-all shadow-lg shadow-pink-500/20"
          >
            Refill Inventory
          </button>
        </motion.div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
        <StatCard title="Total Revenue" value={`₹${totalRevenue}`} icon={<TrendingUp className="w-12 h-12 opacity-5" />} color="text-neon-purple" />
        <StatCard title="Active Orders" value={orders.length} icon={<ShoppingBag className="w-12 h-12 opacity-5" />} color="text-neon-blue" />
        <StatCard title="Total Products" value={products.length} icon={<Package className="w-12 h-12 opacity-5" />} color="text-pink-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-morphism p-6 md:p-8 rounded-3xl overflow-hidden relative">
           <h3 className="text-xs font-bold uppercase tracking-[0.3em] mb-6 md:mb-8 text-white/30">Database Control</h3>
           <div className="grid grid-cols-1 gap-4">
              <button 
                onClick={onSeed}
                disabled={seeding}
                className="p-6 md:p-8 bg-dark-bg rounded-2xl border border-white/5 hover:border-neon-purple transition-all text-left flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group disabled:opacity-50"
              >
                <div className="flex items-center gap-4 md:gap-6">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-neon-purple/20 flex items-center justify-center text-neon-purple">
                    <Database className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div>
                    <p className="text-xs md:text-sm font-black uppercase tracking-widest italic mb-1">Seed Sample Products</p>
                    <p className="text-[9px] md:text-[10px] text-white/30 font-bold uppercase tracking-widest leading-relaxed">Populate your store with high-quality <br className="hidden md:block"/> anime metal poster samples.</p>
                  </div>
                </div>
                <ChevronRight className="w-6 h-6 text-white/10 group-hover:text-neon-purple group-hover:translate-x-1 transition-all hidden sm:block" />
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

function ProductsTab({ products, onEdit, onDelete, onBulkImport, deletingId }: { products: Product[], onEdit: (p: Product) => void, onDelete: (id: string) => void, onBulkImport: () => void, deletingId?: string | null }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const filteredProducts = products.filter(p => {
    const searchStr = searchTerm.toLowerCase();
    const isOutOfStock = p.stock <= 0;
    const isFullyClaimed = p.isLimitedDrop && p.dropQuantity && (p.soldCount || 0) >= p.dropQuantity;
    
    // Allow searching by 'out of stock' specifically
    if (searchStr === 'out of stock' && isOutOfStock) return true;
    if (searchStr === 'fully claimed' && isFullyClaimed) return true;

    return (p.name?.toLowerCase() || '').includes(searchStr) || 
      (p.category?.toLowerCase() || '').includes(searchStr) ||
      p.categories?.some(c => c.toLowerCase().includes(searchStr));
  });

  return (
    <div className="glass-morphism p-4 sm:p-8 rounded-3xl overflow-hidden">
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-8">
        <div className="relative flex-grow w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
          <input 
            className="w-full bg-dark-bg border border-white/10 rounded-xl py-3 pl-12 pr-4 text-xs sm:text-sm focus:border-neon-blue focus:outline-none" 
            placeholder="Search products..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          onClick={onBulkImport}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all text-xs font-black uppercase tracking-widest whitespace-nowrap"
        >
          <Upload className="w-4 h-4" />
          Bulk Import
        </button>
      </div>
      
      <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="text-left text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.1em] sm:tracking-[0.2em] text-white/30">
              <th className="pb-6">Product</th>
              <th className="pb-6">Category</th>
              <th className="pb-6">Price</th>
              <th className="pb-6">Stock</th>
              <th className="pb-6">Status</th>
              <th className="pb-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-xs sm:text-sm font-medium">
            {filteredProducts.map(p => (
              <tr key={p.id} className="border-t border-white/5 group hover:bg-white/5 transition-colors">
                <td className="py-4">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-dark-bg border border-white/10 overflow-hidden shrink-0">
                      <img src={p.imageUrl || undefined} alt={p.name} className="w-full h-full object-cover" />
                    </div>
                    <span className="font-bold tracking-tight text-white line-clamp-1">{p.name || 'Unnamed Product'}</span>
                  </div>
                </td>
                <td className="py-4">
                  <div className="flex flex-wrap gap-1 max-w-[150px]">
                    {(p.category || (p as any).category) && (
                      <span className="text-[8px] bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-white/40 uppercase tracking-widest">{p.category || (p as any).category}</span>
                    )}
                    {p.categories?.map(cat => (
                      <span key={cat} className="text-[8px] bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded text-purple-500 uppercase tracking-widest">{cat}</span>
                    ))}
                  </div>
                </td>
                <td className="py-4 text-neon-purple font-bold italic tracking-tighter">₹{p.price}</td>
                <td className="py-4">{p.stock}</td>
                <td className="py-4">
                   {p.stock <= 0 ? (
                     <span className="px-2 py-0.5 sm:py-1 bg-pink-500/10 text-pink-500 text-[8px] sm:text-[10px] font-black uppercase tracking-widest rounded-md border border-pink-500/20">Empty</span>
                   ) : p.isLimitedDrop && p.dropQuantity && (p.soldCount || 0) >= p.dropQuantity ? (
                     <span className="px-2 py-0.5 sm:py-1 bg-amber-500/10 text-amber-500 text-[8px] sm:text-[10px] font-black uppercase tracking-widest rounded-md border border-amber-500/20">Claimed</span>
                   ) : (
                     <span className="px-2 py-0.5 sm:py-1 bg-emerald-500/10 text-emerald-500 text-[8px] sm:text-[10px] font-black uppercase tracking-widest rounded-md border border-emerald-500/20">Active</span>
                   )}
                </td>
                <td className="py-4 text-right">
                  <div className="flex justify-end gap-1 sm:gap-2 transition-all">
                    <button onClick={() => onEdit(p)} className="p-1.5 sm:p-2 bg-white/5 hover:bg-neon-blue/20 rounded-lg text-neon-blue transition-all border border-white/5"><Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
                    {deletingId === p.id ? (
                      <button className="p-1.5 sm:p-2 bg-pink-500/10 text-pink-500 rounded-lg border border-pink-500/20"><Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /></button>
                    ) : confirmingId === p.id ? (
                      <div className="flex gap-1 items-center animate-in fade-in slide-in-from-right-2 duration-200">
                        <button 
                          onClick={() => { onDelete(p.id); setConfirmingId(null); }} 
                          className="px-2 py-1.5 bg-red-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-red-700 transition-all"
                        >
                          Confirm
                        </button>
                        <button 
                          onClick={() => setConfirmingId(null)}
                          className="p-1.5 bg-white/5 text-white/40 rounded-lg hover:text-white transition-all"
                        >
                          <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmingId(p.id)} className="p-1.5 sm:p-2 bg-white/5 hover:bg-pink-500/20 rounded-lg text-pink-500 transition-all border border-white/5"><Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredProducts.length === 0 && (
              <tr>
                <td colSpan={6} className="py-20 text-center">
                  <div className="flex flex-col items-center gap-4 text-white/20">
                    <Package className="w-12 h-12" />
                    <p className="text-xs font-black uppercase tracking-widest">No products found in the vault</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CategoriesTab({ categories, onAdd, onDelete, onUpdate, deletingId }: { categories: Category[], onAdd: (c: Omit<Category, 'id' | 'createdAt'>) => Promise<void>, onDelete: (id: string) => Promise<void>, onUpdate: (id: string, c: Partial<Category>) => Promise<void>, deletingId: string | null }) {
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', imageUrl: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingCategory) {
      setForm({ name: editingCategory.name, imageUrl: editingCategory.imageUrl });
    } else {
      setForm({ name: '', imageUrl: '' });
    }
  }, [editingCategory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.imageUrl) {
      alert("Please provide both name and image for the category.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      if (editingCategory) {
        await onUpdate(editingCategory.id, form);
      } else {
        await onAdd(form);
      }
      setShowModal(false);
      setEditingCategory(null);
    } catch (err) {
      console.error("Failed to save category:", err);
      alert("Error saving category. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const compressed = await compressImage(base64);
        setForm({ ...form, imageUrl: compressed });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <button onClick={() => setShowModal(true)} className="px-6 py-3 bg-neon-purple text-white rounded-xl font-bold uppercase tracking-widest text-xs flex items-center gap-2 neon-shadow-purple hover:scale-105 transition-all">
          <Plus className="w-4 h-4" /> Create Category
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {categories.map(cat => (
          <div key={cat.id} className="glass-morphism p-6 rounded-3xl border border-white/5 space-y-4 group relative overflow-hidden text-center">
             <div className="w-20 h-20 mx-auto rounded-full border-2 border-neon-purple/30 p-1 group-hover:border-neon-purple transition-all overflow-hidden bg-dark-bg">
                <img src={cat.imageUrl || undefined} className="w-full h-full object-cover rounded-full" alt={cat.name} />
             </div>
             <div>
                <h3 className="font-black uppercase italic tracking-tight text-white mb-1">{cat.name}</h3>
                <p className="text-[10px] text-white/20 font-bold uppercase tracking-[0.2em]">{cat.id.substring(0,8)}</p>
             </div>
             <div className="flex justify-center gap-2 pt-2">
                <button onClick={() => { setEditingCategory(cat); setShowModal(true); }} className="p-2 bg-white/5 rounded-xl text-white/20 hover:text-white hover:bg-neon-purple/20 transition-all">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                {deletingId === cat.id ? (
                  <button className="p-2 bg-pink-500/10 text-pink-500 rounded-xl"><Clock className="w-3.5 h-3.5 animate-spin" /></button>
                ) : confirmingId === cat.id ? (
                  <div className="flex gap-1 animate-in fade-in slide-in-from-right-2 duration-200">
                    <button 
                      onClick={() => { onDelete(cat.id); setConfirmingId(null); }} 
                      className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all font-bold"
                    >
                      Confirm
                    </button>
                    <button 
                      onClick={() => setConfirmingId(null)} 
                      className="p-1.5 px-3 text-white/40 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest font-bold"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmingId(cat.id)} className="p-2 bg-white/5 rounded-xl text-white/20 hover:text-pink-500 hover:bg-pink-500/20 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
             </div>
          </div>
        ))}
        {categories.length === 0 && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
             <Tag className="w-12 h-12 text-white/5 mx-auto mb-4" />
             <p className="text-xs font-black uppercase tracking-widest text-white/20">No categories found</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
           <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md bg-dark-surface border border-white/10 rounded-3xl p-8">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black uppercase italic tracking-tighter">{editingCategory ? 'Edit Category' : 'New Category'}</h2>
                <button onClick={() => { setShowModal(false); setEditingCategory(null); }} className="p-2 hover:bg-white/5 rounded-full"><X /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-6">
                <AdminInput label="Category Name" value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} required />
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">Category Avatar Image</label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 bg-dark-bg border border-white/10 rounded-full flex items-center justify-center overflow-hidden shrink-0">
                      {form.imageUrl ? <img src={form.imageUrl || undefined} className="w-full h-full object-cover" /> : <ImageIcon className="text-white/10" />}
                    </div>
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="text-[10px] file:bg-white/5 file:border-none file:text-[9px] file:text-white file:font-black file:uppercase file:px-3 file:py-1 file:rounded-md cursor-pointer" />
                  </div>
                </div>
                <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-white text-dark-bg font-black uppercase tracking-widest text-xs rounded-xl hover:bg-neon-purple hover:text-white transition-all disabled:opacity-50">
                   {isSubmitting ? 'Forging...' : (editingCategory ? 'Update Category' : 'Forge Category')}
                </button>
              </form>
           </motion.div>
        </div>
      )}
    </div>
  );
}

function OrdersTab({ orders, onStatusUpdate, onDetails, onEditOrder, onDelete, deletingId }: { orders: Order[], onStatusUpdate: (id: string, status: Order['orderStatus']) => void, onDetails: (order: Order) => void, onEditOrder: (id: string, data: Partial<Order>) => void, onDelete: (id: string) => void, deletingId: string | null }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const statuses = ['Pending', 'Confirmed', 'Shipped', 'Delivered'];
  
  const filteredOrders = orders.filter(o => 
    (o.customerInfo?.fullName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (o.customerInfo?.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (o.profileId?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (o.id?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );
  
  return (
    <div className="glass-morphism p-4 sm:p-8 rounded-3xl overflow-hidden">
       <div className="flex items-center gap-4 mb-8">
        <div className="relative flex-grow">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
          <input 
            className="w-full bg-dark-bg border border-white/10 rounded-xl py-3 pl-12 pr-4 text-xs sm:text-sm focus:border-neon-blue focus:outline-none" 
            placeholder="Search by Order ID, Customer, or Profile ID..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

       <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="text-left text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.1em] sm:tracking-[0.2em] text-white/30">
              <th className="pb-6 px-4">Order ID / Profile ID</th>
              <th className="pb-6 px-4">Customer</th>
              <th className="pb-6 px-4">Amount</th>
              <th className="pb-6 px-4">Payment</th>
              <th className="pb-6 px-4">Status</th>
              <th className="pb-6 px-4 text-right">Manage</th>
            </tr>
          </thead>
          <tbody className="text-xs sm:text-sm font-medium">
            {filteredOrders.map(order => (
              <tr key={order.id} className="border-t border-white/5 group hover:bg-white/5 transition-colors">
                <td className="py-6 px-4 cursor-pointer" onClick={() => onDetails(order)}>
                   <div className="flex flex-col">
                     <span className="font-bold tracking-tighter hover:text-purple-500 transition-colors">#ORD-{order.id.toUpperCase().substring(0, 8)}</span>
                     {order.profileId && <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest mt-1">ID: {order.profileId}</span>}
                   </div>
                </td>
                <td className="py-6 px-4">
                   <p className="font-bold">{order.customerInfo.fullName}</p>
                   <p className="text-[9px] sm:text-[10px] text-white/30 font-bold uppercase tracking-widest">{order.address.city}, IN</p>
                </td>
                <td className="py-6 px-4">
                   <div className="flex flex-col">
                     <span className="font-bold text-neon-purple tracking-tighter italic text-base sm:text-lg">₹{order.totalAmount}</span>
                     {order.advancePaid > 0 && order.paymentType === 'COD' && (
                       <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest">
                         Balance: ₹{order.totalAmount - order.advancePaid}
                       </span>
                     )}
                   </div>
                 </td>
                <td className="py-6 px-4">
                   <div className="flex flex-col gap-1">
                     <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-white/60">{order.paymentType}</span>
                     <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-widest ${order.paymentStatus === 'Success' ? 'text-emerald-500' : 'text-pink-500'}`}>
                        {order.paymentType === 'COD' && order.paymentStatus === 'Success' ? 'COD Paid' : 
                         order.paymentType === 'COD' ? 'COD Pending' : 
                         order.paymentStatus === 'Success' ? 'PAID' : order.paymentStatus}
                     </span>
                   </div>
                </td>
                <td className="py-6 px-4">
                   <select 
                    value={order.orderStatus}
                    onChange={(e) => onStatusUpdate(order.id, e.target.value as any)}
                    className="bg-dark-bg border border-white/10 rounded-lg py-1.5 px-2 text-[9px] sm:text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-neon-purple"
                   >
                     {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                   </select>
                </td>
                <td className="py-6 px-4 text-right">
                   <div className="flex items-center justify-end gap-2">
                     <button 
                      onClick={() => onDetails(order)}
                      className="px-3 py-1.5 sm:px-4 sm:py-2 bg-white/5 hover:bg-neon-blue hover:text-dark-bg transition-all rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest"
                     >
                      Details
                     </button>
                     {deletingId === order.id ? (
                        <button className="p-1.5 sm:p-2 bg-pink-500/10 text-pink-500 rounded-lg"><Clock className="w-3.5 h-3.5 animate-spin" /></button>
                      ) : confirmingId === order.id ? (
                        <div className="flex gap-1 items-center animate-in fade-in slide-in-from-right-2 duration-200">
                          <button 
                            onClick={() => { onDelete(order.id); setConfirmingId(null); }} 
                            className="px-2 py-1.5 bg-red-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-red-700 transition-all font-bold"
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
                          onClick={() => setConfirmingId(order.id)}
                          className="p-1.5 sm:p-2 bg-white/5 hover:bg-pink-500/20 rounded-lg text-pink-500 transition-all border border-white/5"
                          title="Delete Order"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
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

function AdminsTab({ admins, onAdd, onRemove, currentUserEmail, deletingId }: { admins: Admin[], onAdd: (uid: string, email: string) => Promise<void>, onRemove: (uid: string) => Promise<void>, currentUserEmail: string, deletingId: string | null }) {
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminUid, setNewAdminUid] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

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
                      deletingId === admin.id ? (
                        <button className="px-4 py-2 bg-pink-500/10 text-pink-500 rounded-lg"><Clock className="w-3.5 h-3.5 animate-spin" /></button>
                      ) : confirmingId === admin.id ? (
                        <div className="flex gap-2 justify-end items-center animate-in fade-in slide-in-from-right-2 duration-200">
                          <button 
                            onClick={() => { onRemove(admin.id); setConfirmingId(null); }} 
                            className="px-4 py-2 bg-red-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-700 shadow-lg shadow-red-500/20"
                          >
                            Confirm Revoke
                          </button>
                          <button 
                            onClick={() => setConfirmingId(null)}
                            className="p-2 text-white/40 hover:text-white transition-all font-bold text-[10px] uppercase tracking-widest"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setConfirmingId(admin.id)}
                          className="px-4 py-2 bg-pink-500/10 text-pink-500 hover:bg-pink-500 hover:text-white transition-all rounded-lg text-[10px] font-black uppercase tracking-widest"
                        >
                          Revoke Access
                        </button>
                      )
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

function SupportTab() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [activeTicket, setActiveTicket] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [replyText, setReplyText] = useState('');
  const [searchOrderId, setSearchOrderId] = useState('');
  const [foundOrder, setFoundOrder] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'closed'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'website' | 'telegram'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Added state to control view on mobile (list vs chat)
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  useEffect(() => {
    if (activeTicket) setMobileView('chat');
  }, [activeTicket]);

  useEffect(() => {
    const q = query(collection(db, 'tickets'), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTickets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.error("Support Tab listener error:", err);
    });
    return () => unsubscribe();
  }, []);

  const handleDeleteTicket = async (id: string) => {
    const { deleteTicket } = await import('../services/supportService');
    console.log("AdminDashboard: Deleting ticket:", id);
    setDeletingId(id);
    try {
      await deleteTicket(id);
      if (activeTicket?.id === id) {
        setActiveTicket(null);
        setMobileView('list');
      }
      setConfirmingId(null);
    } catch (err: any) {
      console.error("Delete ticket error:", err);
      alert(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredTickets = tickets.filter(t => {
    const statusMatch = filter === 'all' || t.status === filter;
    const sourceMatch = sourceFilter === 'all' || t.source === sourceFilter;
    return statusMatch && sourceMatch;
  });

  useEffect(() => {
    if (activeTicket?.id) {
      const q = query(
        collection(db, 'tickets', activeTicket.id, 'messages'),
        orderBy('createdAt', 'asc')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }, (err) => {
        console.error("Ticket messages listener error:", err);
      });
      return () => unsubscribe();
    }
  }, [activeTicket?.id]);

  const handleSearchOrder = async () => {
    if (!searchOrderId.trim()) return;
    setSearching(true);
    try {
      const oSnap = await getDocs(query(collection(db, 'orders'), where('id', '==', searchOrderId.trim().toUpperCase())));
      if (!oSnap.empty) {
        setFoundOrder(oSnap.docs[0].data());
      } else {
        setFoundOrder(null);
        alert("Order not found");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() || !activeTicket) return;
    const admin = auth.currentUser;
    
    try {
      const msgData = {
        text: replyText,
        senderId: admin?.uid || 'admin',
        senderName: 'Support',
        senderType: 'admin',
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'tickets', activeTicket.id, 'messages'), msgData);
      await updateDoc(doc(db, 'tickets', activeTicket.id), { status: 'accepted', updatedAt: Date.now() });

      // Notify user via Telegram if it's a telegram ticket
      if (activeTicket.source === 'telegram' && activeTicket.telegramChatId) {
        await fetch('/api/notify-user-telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: activeTicket.telegramChatId,
            text: `👤 <b>Support:</b> ${replyText}`
          })
        });
      }

      setReplyText('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatusChange = async (docId: string, status: string) => {
    try {
      await updateDoc(doc(db, 'tickets', docId), { status, updatedAt: Date.now() });
      
      // Update activeTicket state locally so UI reflects immediately
      if (activeTicket?.id === docId) {
        setActiveTicket(prev => ({ ...prev, status }));
      }

      // Post system message to chat
      await addDoc(collection(db, 'tickets', docId, 'messages'), {
        text: `🚩 Ticket status updated to: ${status.toUpperCase()}`,
        senderId: 'system',
        senderName: 'System',
        senderType: 'admin',
        createdAt: serverTimestamp()
      });

      // Notify user via Telegram if it's a telegram ticket
      const ticketRef = doc(db, 'tickets', docId);
      const snap = await getDocs(query(collection(db, 'tickets'), where('id', '==', docId))); // Fallback check or just use snap if we had it
      // Actually, we can just get the doc
      const tSnap = await getDocs(query(collection(db, 'tickets'), where('ticketId', '==', activeTicket?.ticketId || '')));
      // Let's just find the ticket from our current list
      const ticket = tickets.find(t => t.id === docId);

      if (ticket && ticket.source === 'telegram' && ticket.telegramChatId) {
        let notifyMsg = `🔔 <b>Status Update:</b> Your ticket <code>${ticket.ticketId}</code> is now <b>${status.toUpperCase()}</b>.`;
        if (status === 'closed') {
          notifyMsg += `\n\nThank you for reaching out! Use /start for any new issues.`;
        }
        await fetch('/api/notify-user-telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: ticket.telegramChatId,
            text: notifyMsg
          })
        });
      }
    } catch (err) {
      console.error("Status update failed:", err);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 h-[calc(100vh-160px)] md:h-[calc(100vh-200px)] relative">
      {/* Sidebar: Tickets & Search */}
      <div className={`
        ${mobileView === 'chat' && activeTicket ? 'hidden lg:flex' : 'flex'}
        flex-col gap-6 h-full
      `}>
        <div className="glass-morphism p-6 rounded-3xl shrink-0">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-500 mb-4">Support Order Search</h3>
          <div className="flex gap-2">
            <input 
              type="text"
              placeholder="KG26-XXXXXX"
              value={searchOrderId}
              onChange={e => setSearchOrderId(e.target.value.toUpperCase())}
              className="flex-grow bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs font-mono outline-none focus:border-purple-500"
            />
            <button 
              onClick={handleSearchOrder}
              disabled={searching}
              className="p-2 bg-purple-500 rounded-xl hover:bg-purple-600 transition-all disabled:opacity-50"
            >
              <Search className="w-4 h-4 text-white" />
            </button>
          </div>
          {foundOrder && (
            <motion.div 
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               className="mt-4 p-4 bg-white/5 rounded-2xl border border-white/10 text-xs space-y-2"
            >
               <div className="flex justify-between items-start">
                  <p className="font-bold uppercase tracking-tight italic">{foundOrder.customerInfo?.fullName}</p>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500 text-white font-black uppercase">{foundOrder.orderStatus}</span>
               </div>
               <p className="text-white/40">{foundOrder.customerInfo?.phone}</p>
               <p className="text-white/60 line-clamp-2">{foundOrder.address?.fullAddress || foundOrder.address}</p>
               <button onClick={() => setFoundOrder(null)} className="text-[9px] font-black uppercase tracking-widest text-pink-500">Clear Search</button>
            </motion.div>
          )}
        </div>

        <div className="glass-morphism rounded-3xl overflow-hidden flex flex-col flex-1 border border-white/5 shadow-2xl shadow-purple-500/5">
          <div className="p-6 border-b border-white/5 flex flex-col gap-4 bg-white/5">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-500">Inbound Support Stream</h3>
            
            {/* Status Filter */}
            <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar border-b border-white/5 mb-2">
              {['all', 'pending', 'accepted', 'closed'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f as any)}
                  className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                    filter === f 
                    ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30' 
                    : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Source Filter (The missing 'Chat' tab logic) */}
            <div className="flex gap-1">
              {[
                { id: 'all', label: 'All Sources' },
                { id: 'website', label: 'Website Chat' },
                { id: 'telegram', label: 'Telegram' }
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSourceFilter(s.id as any)}
                  className={`flex-1 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all border ${
                    sourceFilter === s.id 
                    ? 'bg-neon-blue/10 border-neon-blue/50 text-neon-blue' 
                    : 'bg-white/5 border-transparent text-white/40 hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 bg-black/20">
             {filteredTickets.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-48 opacity-20 text-center">
                 <MessageSquare className="w-8 h-8 mb-2" />
                 <p className="text-[10px] font-bold uppercase tracking-widest">No {filter !== 'all' ? filter : ''} tickets found</p>
               </div>
             ) : filteredTickets.map(ticket => (
               <div
                 key={ticket.id}
                 onClick={() => setActiveTicket(ticket)}
                 className={`w-full p-4 rounded-2xl border text-left transition-all relative group cursor-pointer ${
                   activeTicket?.id === ticket.id 
                   ? 'bg-purple-600/20 border-purple-500/50 shadow-xl shadow-purple-500/10' 
                   : 'bg-white/5 border-white/5 hover:border-white/20'
                 }`}
               >
                 <div className="flex justify-between items-start mb-2">
                   <div className="flex items-center gap-2">
                     <p className="text-xs font-black uppercase italic tracking-tight truncate max-w-[120px]">{ticket.username}</p>
                     {ticket.source === 'telegram' ? <span className="w-1.5 h-1.5 rounded-full bg-blue-500" title="Telegram" /> : <span className="w-1.5 h-1.5 rounded-full bg-purple-500" title="Website" />}
                   </div>
                   <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-widest shadow-sm ${
                     ticket.status === 'pending' ? 'bg-amber-500 text-black' :
                     ticket.status === 'accepted' ? 'bg-emerald-500 text-white' :
                     ticket.status === 'closed' ? 'bg-white/10 text-white/40' :
                     'bg-pink-500 text-white'
                   }`}>
                     {ticket.status}
                   </span>
                 </div>
                 <p className="text-[10px] text-white/60 mb-3 truncate font-medium">{ticket.category}</p>
                 <div className="flex items-center justify-between border-t border-white/5 pt-3">
                    <span className="text-[8px] text-white/20 font-black uppercase tracking-widest">{ticket.id.substring(0, 8)}...</span>
                      <div className="flex items-center gap-2 text-[8px] text-white/20 font-black uppercase tracking-widest">
                        {deletingId === ticket.id ? (
                          <div className="p-1"><Clock className="w-3 h-3 text-pink-500 animate-spin" /></div>
                        ) : confirmingId === ticket.id ? (
                          <div className="flex gap-1 animate-in fade-in slide-in-from-right-1 duration-200" onClick={e => e.stopPropagation()}>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDeleteTicket(ticket.id); setConfirmingId(null); }}
                              className="px-1.5 py-0.5 bg-red-600 text-white rounded text-[7px] font-black uppercase tracking-widest font-bold"
                            >
                              DEL
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setConfirmingId(null); }}
                              className="px-1 py-0.5 bg-white/10 text-white rounded text-[7px] font-black uppercase tracking-widest font-bold"
                            >
                              X
                            </button>
                          </div>
                        ) : (
                          <div 
                            onClick={(e) => { e.stopPropagation(); setConfirmingId(ticket.id); }}
                            className="p-1 hover:bg-pink-500/10 text-white/10 hover:text-pink-500 rounded transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </div>
                        )}
                        <span>{ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}</span>
                      </div>
                 </div>
               </div>
             ))}
          </div>
        </div>
      </div>

      {/* Main: Chat View */}
      <div className={`
        ${mobileView === 'list' ? 'hidden lg:flex' : 'flex'}
        lg:col-span-2 flex-col bg-dark-bg/40 glass-morphism rounded-3xl overflow-hidden h-full z-10
      `}>
        {activeTicket ? (
          <>
            <div className="p-4 sm:p-6 border-b border-white/5 bg-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3 sm:gap-4">
                <button 
                  onClick={() => setMobileView('list')} 
                  className="lg:hidden p-2 hover:bg-white/5 rounded-full mr-1"
                >
                  <Search className="w-4 h-4 rotate-180" /> {/* Back arrow placeholder */}
                </button>
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 sm:w-6 sm:h-6 text-purple-500" />
                </div>
                <div className="min-w-0">
                   <h3 className="font-bold text-sm sm:text-lg truncate">{activeTicket.username}</h3>
                   <div className="flex items-center gap-2 sm:gap-3">
                     <span className="text-[8px] sm:text-[10px] font-bold text-white/40 uppercase tracking-widest truncate max-w-[80px]">{activeTicket.ticketId}</span>
                     <span className="text-[8px] sm:text-[10px] font-bold text-white/40 italic truncate">{activeTicket.category}</span>
                   </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select 
                  value={activeTicket.status}
                  onChange={(e) => handleStatusChange(activeTicket.id, e.target.value)}
                  className="bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest outline-none focus:border-purple-500"
                >
                  <option value="pending">Pending</option>
                  <option value="accepted">Accepted</option>
                  <option value="closed">Closed</option>
                  <option value="rejected">Rejected</option>
                </select>
                <button onClick={() => { setActiveTicket(null); setMobileView('list'); }} className="p-2 hover:bg-white/5 rounded-full"><X className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-4 sm:space-y-6 custom-scrollbar bg-black/10">
               {messages.map((msg, idx) => {
                 const isSystem = msg.senderId === 'system';
                 if (isSystem) {
                   return (
                     <div key={msg.id || idx} className="flex justify-center my-4">
                        <div className="bg-white/5 border border-white/5 rounded-full px-4 py-1.5 flex items-center gap-2">
                           <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-purple-500 animate-pulse" />
                           <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-white/40 text-center">{msg.text}</span>
                        </div>
                     </div>
                   );
                 }
                 return (
                   <div key={msg.id || idx} className={`flex ${msg.senderType === 'admin' ? 'justify-end' : 'justify-start'}`}>
                     <div className={`max-w-[85%] sm:max-w-[70%] group`}>
                        <div className={`p-3 sm:p-4 rounded-2xl text-xs sm:text-sm ${
                          msg.senderType === 'admin' 
                          ? 'bg-purple-600 text-white rounded-tr-none shadow-lg shadow-purple-500/10' 
                          : 'bg-white/5 text-white/90 rounded-tl-none border border-white/5'
                        }`}>
                           {msg.text}
                        </div>
                        <p className={`text-[8px] sm:text-[9px] mt-1.5 sm:mt-2 font-black uppercase tracking-[0.2em] text-white/20 ${msg.senderType === 'admin' ? 'text-right' : 'text-left'}`}>
                          {msg.senderName} • {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                        </p>
                     </div>
                   </div>
                 );
               })}
               <div ref={chatEndRef} />
            </div>

            <div className="p-4 sm:p-6 bg-black/20 border-t border-white/5">
               <div className="relative">
                 <input 
                   type="text"
                   placeholder="Type support reply..."
                   value={replyText}
                   onChange={e => setReplyText(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && handleReply()}
                   className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 sm:px-6 py-3 sm:py-4 pr-14 sm:pr-16 text-xs sm:text-sm focus:border-purple-500 transition-all outline-none"
                 />
                 <button 
                  onClick={handleReply}
                  disabled={!replyText.trim()}
                  className="absolute right-1.5 top-1.5 bottom-1.5 px-4 sm:px-6 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl transition-all shadow-lg shadow-purple-500/20"
                 >
                   <Send className="w-4 h-4" />
                 </button>
               </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center opacity-20 text-center p-8 sm:p-12">
            <MessageSquare className="w-12 h-12 md:w-16 md:h-16 mb-4" strokeWidth={1} />
            <h3 className="text-lg md:text-xl font-bold uppercase italic tracking-tighter">Support Terminal</h3>
            <p className="text-xs md:text-sm max-w-xs mt-2">Select a ticket from the left to start chatting with customers across Web & Telegram.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function HealthTab() {
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/cloudinary/usage')
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setUsage(data);
      })
      .catch(err => {
        console.error("Cloudinary usage fetch error:", err);
        setUsage({ error: err.message });
      })
      .finally(() => setLoading(false));
  }, []);

  const creditsUsage = usage?.credits?.used_percent || 0;
  const isLowCredits = usage && !usage.error && creditsUsage > 85;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* Alert Banner */}
      {isLowCredits && (
        <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex items-center gap-4 text-orange-500">
          <AlertCircle className="w-6 h-6 shrink-0" />
          <div>
            <p className="text-xs font-black uppercase tracking-widest">Plan Credits Warning</p>
            <p className="text-[10px] font-bold opacity-80 uppercase tracking-wider">
              Cloudinary monthly credits are almost exhausted ({creditsUsage.toFixed(1)}%). 
              Please check your console to avoid upload failures.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Cloudinary Card */}
        <div className="glass-morphism p-8 rounded-3xl border border-white/5 space-y-6 relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <Cloud className="w-32 h-32" />
           </div>
           
           <div className="flex items-center gap-4 text-neon-blue relative z-10">
             <div className="p-3 bg-neon-blue/10 rounded-2xl">
               <Cloud className="w-6 h-6" />
             </div>
             <h3 className="text-xl font-black uppercase italic tracking-tighter">Media Consumption</h3>
           </div>
           
           {loading ? (
             <div className="animate-pulse space-y-6">
               <div className="h-4 bg-white/5 rounded-full w-2/3" />
               <div className="h-2 bg-white/5 rounded-full w-full" />
               <div className="grid grid-cols-2 gap-4">
                 <div className="h-16 bg-white/5 rounded-2xl" />
                 <div className="h-16 bg-white/5 rounded-2xl" />
               </div>
             </div>
           ) : usage && !usage.error ? (
             <div className="space-y-8 relative z-10">
               <div className="space-y-3">
                 <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                   <span className="text-white/40 italic">Monthly Credits Utilization</span>
                   <span className={creditsUsage > 90 ? 'text-red-500' : 'text-neon-blue'}>
                     {creditsUsage.toFixed(1)}%
                   </span>
                 </div>
                 <div className="h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
                   <motion.div 
                     initial={{ width: 0 }}
                     animate={{ width: `${creditsUsage}%` }}
                     className={`h-full ${creditsUsage > 85 ? 'bg-red-500' : 'bg-neon-blue shadow-[0_0_10px_rgba(0,163,255,0.5)]'}`}
                   />
                 </div>
                 <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest text-right">
                   {(usage.credits?.usage || 0).toFixed(2)} CREDITS OF {(usage.credits?.limit || 0).toFixed(2)} CREDITS USED
                 </p>
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div className="p-4 bg-white/5 rounded-2xl border border-white/5 group-hover:border-neon-blue/20 transition-all">
                   <p className="text-[8px] font-black uppercase tracking-widest text-white/40 mb-1">Storage Usage</p>
                   <p className="text-xl font-black italic">{( (usage.storage?.usage || 0) / 1024 / 1024 / 1024).toFixed(2)} GB</p>
                   <p className="text-[8px] text-white/20 font-bold mt-1 uppercase">Total Media Size</p>
                 </div>
                 <div className="p-4 bg-white/5 rounded-2xl border border-white/5 group-hover:border-neon-blue/20 transition-all">
                   <p className="text-[8px] font-black uppercase tracking-widest text-white/40 mb-1">Active Resources</p>
                   <p className="text-xl font-black italic">{(usage.objects?.usage || usage.resources || 0).toLocaleString()}</p>
                   <p className="text-[8px] text-white/20 font-bold mt-1 uppercase">Images & Videos</p>
                 </div>
               </div>
             </div>
           ) : (
             <div className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-500 relative z-10">
               <div className="flex items-center gap-2 mb-2">
                 <AlertTriangle className="w-4 h-4" />
                 <p className="text-[10px] font-black uppercase tracking-widest">Configuration Required</p>
               </div>
               <p className="text-[10px] font-bold uppercase tracking-wider leading-relaxed opacity-80">
                 {usage?.error === "CLOUDINARY_URL not set in environment." 
                  ? "Cloudinary Admin API not linked. Please add 'CLOUDINARY_URL' to your environment settings to track your media storage limits."
                  : `Failed to load metrics: ${usage?.error || 'Unknown error'}`}
               </p>
             </div>
           )}

           <a 
            href="https://console.cloudinary.com/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all group-hover:translate-y-[-2px]"
           >
             Open Cloudinary Dashboard <ExternalLink className="w-3 h-3" />
           </a>
        </div>

        {/* Firestore Card */}
        <div className="glass-morphism p-8 rounded-3xl border border-white/5 space-y-6 relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <Activity className="w-32 h-32" />
           </div>

           <div className="flex items-center gap-4 text-pink-500 relative z-10">
             <div className="p-3 bg-pink-500/10 rounded-2xl">
               <Activity className="w-6 h-6" />
             </div>
             <h3 className="text-xl font-black uppercase italic tracking-tighter">Database Health</h3>
           </div>

           <div className="space-y-6 relative z-10">
             <div className="p-5 bg-pink-500/5 border border-pink-500/10 rounded-2xl">
               <div className="flex items-center gap-2 mb-3">
                 <Zap className="w-4 h-4 text-pink-500" />
                 <p className="text-[10px] font-black uppercase tracking-widest text-pink-500">Spark Plan Quotas</p>
               </div>
               <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-1">Daily Reads</p>
                    <p className="text-sm font-black italic">50,000 / Day</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-1">Daily Writes</p>
                    <p className="text-sm font-black italic">20,000 / Day</p>
                  </div>
               </div>
               <p className="text-[10px] text-white/40 leading-relaxed uppercase tracking-wider font-medium">
                 Firestore usage resets every 24 hours. Exceeding these limits causes temporary app downtime.
               </p>
             </div>

             <div className="space-y-4">
               <p className="text-[9px] font-black uppercase tracking-widest text-white/20">Optimization Checklist:</p>
               <div className="space-y-3">
                  <div className="flex gap-3 items-start p-3 bg-white/5 rounded-xl border border-transparent hover:border-emerald-500/20 transition-all">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <p className="text-[9px] font-bold text-white/60 uppercase tracking-wider">Close unused admin tabs to stop background polls.</p>
                  </div>
                  <div className="flex gap-3 items-start p-3 bg-white/5 rounded-xl border border-transparent hover:border-emerald-500/20 transition-all">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <p className="text-[9px] font-bold text-white/60 uppercase tracking-wider">Use limit() for historical data (Orders/Logs).</p>
                  </div>
                  <div className="flex gap-3 items-start p-3 bg-white/5 rounded-xl border border-transparent hover:border-emerald-500/20 transition-all">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <p className="text-[9px] font-bold text-white/60 uppercase tracking-wider">Upgrade to Blaze plan for high-traffic launch.</p>
                  </div>
               </div>
             </div>
           </div>

           <a 
            href={`https://console.firebase.google.com/project/gen-lang-client-0026893842/firestore/usage`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all group-hover:translate-y-[-2px]"
           >
             Detailed Firebase Usage <ExternalLink className="w-3 h-3" />
           </a>
        </div>
      </div>

      {/* Info Notice */}
      <div className="p-6 glass-morphism rounded-3xl border border-white/5 text-center">
         <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] max-w-2xl mx-auto leading-relaxed">
           Real-time Firestore usage monitoring via API is restricted by Google. For 100% accurate daily read/write metrics, 
           please refer to the official <span className="text-white">Usage</span> tab in your Firebase Console.
         </p>
      </div>
    </div>
  );
}
