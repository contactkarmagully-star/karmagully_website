import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, Link } from 'react-router-dom';
import { ShoppingBag, LogOut, Package, Clock, ChevronRight, User, Heart, Trash2, Eye, X, ShieldCheck, Award, Zap, AlertTriangle, Copy, Check, Layers, Bell, Gift, Truck } from 'lucide-react';
import { getTrackingUrl } from '../lib/tracking';
import { getCourierLogo, useCourierLogo } from '../lib/courierLogos';
import { auth, db } from '../lib/firebase';

import { CourierLogo } from '../components/CourierLogo';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Order, Product, AppSettings } from '../types';
import { useWishlist } from '../hooks/useWishlist';
import { getAllProducts } from '../services/productService';
import { deleteOrder } from '../services/orderService';
import { useAuth } from '../hooks/useAuth';
import { claimTrustedStatus } from '../services/loyaltyService';
import { subscribeToSettings } from '../services/settingsService';

import { AppNotification, markNotificationAsRead, subscribeToUserNotifications } from '../services/notificationService';

export default function Profile() {
  const { user, profile, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [wishlistProducts, setWishlistProducts] = useState<Product[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { wishlist, toggleWishlist } = useWishlist();
  const [activeTab, setActiveTab] = useState<'orders' | 'wishlist' | 'notifications'>('orders');
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (!authLoading && !user && !isLoggingOut) {
      navigate('/admin/login');
    }
  }, [user, authLoading, navigate, isLoggingOut]);

  useEffect(() => {
    const unsubscribe = subscribeToSettings(setSettings);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchOrders(user);
      fetchWishlistProducts();
      
      const unsubNotifs = subscribeToUserNotifications(
        user.uid, 
        profile?.loyaltyTier || 0,
        setNotifications
      );
      return () => unsubNotifs();
    }
  }, [user, profile?.loyaltyTier]);

  useEffect(() => {
    if (activeTab === 'notifications' && notifications.length > 0) {
      notifications.filter(n => !n.isRead).forEach(n => {
        if (n.id) markNotificationAsRead(n.id);
      });
    }
  }, [activeTab, notifications.length]); // Use length to avoid infinite loops if markRead triggers a refresh

  useEffect(() => {
    // Sync wishlist products if the ID list changes
    fetchWishlistProducts();
  }, [wishlist]);

  const fetchWishlistProducts = async () => {
    if (wishlist.length === 0) {
      setWishlistProducts([]);
      return;
    }
    const all = await getAllProducts();
    setWishlistProducts(all.filter(p => wishlist.includes(p.id)));
  };

  const fetchOrders = async (u: any) => {
    if (!u) return;
    setOrdersLoading(true);
    try {
      const collectionRef = collection(db, 'orders');
      
      const userIdQuery = query(collectionRef, where('userId', '==', u.uid));
      const emailQuery = u.email ? query(collectionRef, where('customerInfo.email', '==', u.email.toLowerCase().trim())) : null;

      // Execute separately to handle partial permissions or missing indexes
      const snapshots = await Promise.all([
        getDocs(userIdQuery).catch(err => {
          console.error("User ID query failed:", err);
          if (err.code === 'permission-denied') throw err;
          return { docs: [] };
        }),
        emailQuery ? getDocs(emailQuery).catch(err => {
          console.error("Email query failed:", err);
          if (err.code === 'permission-denied') throw err;
          return { docs: [] };
        }) : Promise.resolve({ docs: [] })
      ]);

      const ordersMap = new Map();
      snapshots.forEach(snapshot => {
        snapshot.docs.forEach(doc => {
          ordersMap.set(doc.id, { id: doc.id, ...doc.data() });
        });
      });
      
      const ordersData = Array.from(ordersMap.values()) as Order[];
      // Sort by date manually after merging
      ordersData.sort((a: any, b: any) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return Number(dateB) - Number(dateA);
      });

      setOrders(ordersData);
      setError(null);
    } catch (error: any) {
      console.error("Error fetching orders:", error);
      setError(error.code === 'permission-denied' ? "Sync failed: Missing credentials for this series." : "Network interruption while fetching orders.");
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    await signOut(auth);
    localStorage.removeItem('admin_auth');
    navigate('/', { replace: true });
  };

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    alert('System: Copy successful.');
  };

  const formatDate = (dateValue: any) => {
    if (!dateValue) return 'Pending...';
    try {
      const d = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return 'Processing...';
    }
  };

  const handleClaimBadge = async () => {
    if (!user || !settings) return;
    try {
      if (settings.loyalty?.autoApproveTrustedBuyer) {
        // Correctly use existing service function for approval
        const { approveLoyaltyClaim } = await import('../services/loyaltyService');
        await approveLoyaltyClaim(user.uid, settings.loyalty.badgeNames.trusted);
      } else {
        await claimTrustedStatus(user.uid);
      }
    } catch (e) {
      console.error("Claim failed:", e);
    }
  };

  const handleCancelOrder = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('CRITICAL: Permanently redact this deployment from the manifest? This cannot be undone.')) {
      try {
        await deleteOrder(id);
        if (user) fetchOrders(user);
      } catch (err) {
        console.error("Cancellation failed:", err);
        alert("Operation failed. Terminal linkage lost.");
      }
    }
  };

  if (authLoading || ordersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Loyalty calculations
  const deliveredCod = profile?.trustStats?.deliveredCodOrders || 0;
  const successfulPrepaid = profile?.trustStats?.successfulPrepaidOrders || 0;
  const totalCompleted = orders.filter(o => o.orderStatus === 'Delivered').length;
  
  const isEligible = deliveredCod >= 3 || successfulPrepaid >= 1;
  const isTrusted = profile?.isTrustedBuyer || profile?.loyaltyStatus === 'approved';
  
  // Badge Names from settings
  const badgeNames = settings?.loyalty?.badgeNames || {
    trusted: 'Trusted Buyer',
    collector: 'Verified Collector',
    elite: 'Elite Drop Member'
  };

  // Tier calculation
  let badgeTitle = 'Awaiting Debut';
  let badgeTier: 'none' | 'trusted' | 'collector' | 'elite' = 'none';
  let currentBadgeLabel = '';

  if (totalCompleted >= 25) {
    badgeTier = 'elite';
    badgeTitle = badgeNames.elite;
    currentBadgeLabel = 'ELITE STATUS UNLOCKED';
  } else if (totalCompleted >= 10) {
    badgeTier = 'collector';
    badgeTitle = badgeNames.collector;
    currentBadgeLabel = 'COLLECTOR STATUS UNLOCKED';
  } else if (isTrusted) {
    badgeTier = 'trusted';
    badgeTitle = profile?.badge || badgeNames.trusted;
    currentBadgeLabel = 'TRUSTED STATUS UNLOCKED';
  }

  const progress = badgeTier === 'elite' ? 100 : 
                  badgeTier === 'collector' ? ((totalCompleted / 25) * 100) :
                  isTrusted ? ((totalCompleted / 10) * 100) : 
                  Math.min(100, (deliveredCod / 3) * 100);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <aside className="w-full md:w-64 space-y-6">
          <div className="glass-morphism p-6 rounded-3xl border border-white/5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-600 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.3)]">
                <User className="w-6 h-6 text-white" />
              </div>
              <div className="overflow-hidden">
                <h2 className="text-sm font-black uppercase italic tracking-tighter truncate">{user?.displayName || 'User'}</h2>
                <div className="flex flex-col">
                  <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest truncate">{user?.email}</p>
                  <button 
                    onClick={() => profile?.profileId && copyToClipboard(profile.profileId)}
                    className="flex items-center gap-1.5 mt-1 group/id"
                  >
                    <p className="text-[9px] text-purple-500/80 font-black tracking-widest">ID: {profile?.profileId || 'GENERATING...'}</p>
                    {profile?.profileId && (
                      <div className="opacity-0 group-hover/id:opacity-100 transition-opacity">
                        {copied ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5 text-purple-500/40" />}
                      </div>
                    )}
                    {copied && <span className="text-[8px] text-emerald-500 font-bold uppercase tracking-tighter animate-pulse">Copied</span>}
                  </button>
                </div>
              </div>
            </div>
            
            <button 
              onClick={handleSignOut}
              className="w-full py-3 bg-white/5 border border-white/5 hover:border-pink-500/50 hover:text-pink-500 transition-all rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <LogOut className="w-3 h-3" />
              Sign Out
            </button>

            {localStorage.getItem('admin_auth') === 'true' && (
              <button 
                onClick={() => navigate('/admin')}
                className="w-full py-3 bg-purple-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-purple-700 transition-colors"
              >
                Admin Panel
              </button>
            )}
          </div>

          {/* Loyalty Card */}
          <div className="glass-morphism p-6 rounded-3xl border border-white/5 space-y-4 overflow-hidden relative group">
            {/* Background Accent */}
            <div className={`absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 blur-3xl transition-all duration-700 opacity-20 ${isTrusted ? 'bg-emerald-500 scale-150' : 'bg-purple-600'}`} />
            
            <div className="flex items-center justify-between relative z-10">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Trust Status</span>
              {isTrusted && (
                <ShieldCheck className="w-4 h-4 text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
              )}
            </div>

            <div className="space-y-4 relative z-10">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${badgeTier !== 'none' ? 'bg-emerald-500/20 border border-emerald-500/50' : 'bg-white/5 border border-white/10'}`}>
                  {badgeTier === 'elite' ? (
                    <Award className="w-8 h-8 text-emerald-400" />
                  ) : badgeTier === 'collector' ? (
                    <Layers className="w-8 h-8 text-emerald-400" />
                  ) : badgeTier === 'trusted' ? (
                    <ShieldCheck className="w-8 h-8 text-emerald-400" />
                  ) : (
                    <Zap className="w-8 h-8 text-purple-500" />
                  )}
                </div>
                <div>
                  <h3 className={`text-lg font-black italic uppercase tracking-tighter ${badgeTier !== 'none' ? 'text-emerald-400' : 'text-white'}`}>
                    {badgeTitle}
                  </h3>
                  <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest">
                    {badgeTier === 'elite' ? 'Premium Elite Access' : 
                     badgeTier === 'collector' ? 'Volume Collector' :
                     badgeTier === 'trusted' ? 'Verified Member' : 'Collector Progression'}
                  </p>
                </div>
              </div>

              {badgeTier !== 'elite' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-[8px] font-black uppercase tracking-widest">
                    <span className="text-white/40">
                      {badgeTier === 'collector' ? `To ${badgeNames.elite}` :
                       badgeTier === 'trusted' ? `To ${badgeNames.collector}` : 'To Trust Status'}
                    </span>
                    <span className="text-purple-400">
                      {badgeTier === 'collector' ? `${totalCompleted}/25` :
                       badgeTier === 'trusted' ? `${totalCompleted}/10` : `${deliveredCod}/3`} Orders
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className="h-full bg-gradient-to-r from-purple-600 to-pink-600"
                    />
                  </div>
                  
                  {currentBadgeLabel && (
                    <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-center">
                      <p className="text-[7px] text-emerald-400 font-bold uppercase tracking-widest">{currentBadgeLabel}</p>
                    </div>
                  )}

                  {!isTrusted && (
                    <>
                      {isEligible && profile?.loyaltyStatus === 'none' && (
                        <button 
                          onClick={handleClaimBadge}
                          className="w-full py-3 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all mt-2"
                        >
                          Claim Trust Badge
                        </button>
                      )}
                      {profile?.loyaltyStatus === 'pending' && (
                        <div className="w-full py-3 bg-white/5 border border-emerald-500/20 text-emerald-500 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                          <Clock className="w-3 h-3" />
                          Approval Pending
                        </div>
                      )}
                      {profile?.loyaltyStatus === 'rejected' && (
                        <div className="space-y-2">
                          <div className="w-full py-3 bg-pink-500/10 border border-pink-500/20 text-pink-500 rounded-xl text-[10px] font-black uppercase tracking-widest flex flex-col items-center justify-center gap-1 text-center">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Request Rejected</span>
                            <p className="text-[7px] text-pink-500/60 font-bold max-w-[80%]">Try again after making more verified purchases.</p>
                          </div>
                          <button 
                            onClick={handleClaimBadge}
                            className="w-full py-2 bg-white/5 border border-white/10 text-white/40 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
                          >
                            Try Re-applying
                          </button>
                        </div>
                      )}
                      {!isEligible && (
                        <p className="text-[8px] text-white/20 font-bold italic leading-relaxed">
                          Complete 3 COD orders or 1 Prepaid order to unlock Trusted Buyer benefits.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {isTrusted && (
                <div className="pt-2">
                  <div className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <p className="text-[8px] text-emerald-400 font-bold uppercase tracking-[0.15em] flex items-center gap-2">
                      <Zap className="w-3 h-3 fill-emerald-400" />
                      Free COD Verification Unlocked
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-grow space-y-8">
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter">
                My <span className="text-gradient">Account</span>
              </h1>
              <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest mt-2">Welcome back, {user?.displayName || 'Seeker'}</p>
            </div>
             <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 overflow-x-auto no-scrollbar">
                <button 
                  onClick={() => setActiveTab('orders')}
                  className={`px-4 sm:px-6 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'orders' ? 'bg-purple-600 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                >
                  Orders
                </button>
                <button 
                  onClick={() => setActiveTab('notifications')}
                  className={`px-4 sm:px-6 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'notifications' ? 'bg-blue-600 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                >
                  Messages {notifications.length > 0 && <span className="w-4 h-4 bg-white/20 rounded-full flex items-center justify-center text-[7px]">{notifications.length}</span>}
                </button>
                <button 
                  onClick={() => setActiveTab('wishlist')}
                  className={`px-4 sm:px-6 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'wishlist' ? 'bg-pink-600 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                >
                  Wishlist {wishlist.length > 0 && `(${wishlist.length})`}
                </button>
             </div>
          </header>

          {error && (
            <div className="p-6 bg-pink-500/10 border border-pink-500/20 rounded-3xl text-pink-500 text-xs font-black uppercase tracking-widest text-center shadow-[0_0_30px_rgba(236,72,153,0.1)]">
              {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            {activeTab === 'orders' ? (
              <motion.div 
                key="orders"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                {orders.length > 0 ? (
                  orders.map((order) => (
                    <motion.div 
                      key={order.id}
                      onClick={() => navigate(`/success?orderId=${order.id}`)}
                      className="glass-morphism p-6 rounded-3xl border border-white/5 hover:border-purple-500/20 transition-all group cursor-pointer"
                    >
                      <div className="flex flex-col md:flex-row justify-between gap-6">
                        <div className="flex gap-6">
                          <div className="w-20 h-20 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                             {order.items[0]?.imageUrl ? (
                               <img src={order.items[0].imageUrl || undefined} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                             ) : (
                               <Package className="w-8 h-8 text-white/10 group-hover:text-purple-500 transition-colors" />
                             )}
                          </div>
                          <div className="space-y-2 flex-grow">
                            <div className="flex flex-wrap gap-2">
                               <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                                 order.orderStatus === 'Delivered' ? 'bg-emerald-500 text-white' : 
                                 order.orderStatus === 'Shipped' ? 'bg-blue-500 text-white' : 'bg-purple-600 text-white'
                               }`}>
                                 {order.orderStatus}
                               </span>
                               <span className={`px-3 py-1 bg-white/5 border border-white/10 text-white/40 rounded-full text-[8px] font-black uppercase tracking-widest`}>
                                 {order.paymentType}
                               </span>
                            </div>
                            <h3 className="text-sm font-black uppercase italic tracking-tight flex items-baseline gap-2">
                              {order.items[0]?.name || 'Mystery Release'}
                              <span className="text-[10px] text-white/20 not-italic font-bold">#ORD-{order.id.toUpperCase()}</span>
                            </h3>
                            <p className="text-xs text-white/40 font-bold uppercase tracking-widest flex items-center gap-2">
                              <Clock className="w-3 h-3" />
                              {formatDate(order.createdAt)}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-row md:flex-col justify-between items-end gap-2">
                          <div className="text-right">
                            <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest">
                              {order.paymentType === 'COD' && order.advancePaid > 0 ? 'Balance to Pay' : 'Total Amount'}
                            </p>
                            <p className="text-xl font-black italic tracking-tighter text-purple-400">
                              ₹{order.paymentType === 'COD' && order.advancePaid > 0 ? (order.totalAmount - order.advancePaid) : order.totalAmount}
                            </p>
                            {order.paymentType === 'COD' && order.advancePaid > 0 && (
                              <p className="text-[8px] text-emerald-500 font-bold uppercase tracking-widest mt-1">
                                ₹{order.advancePaid} Paid (Verification)
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Link 
                              to={`/success?orderId=${order.id}`}
                              className="p-2 bg-white/5 rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-purple-500 transition-all"
                            >
                              <ChevronRight className="w-5 h-5" />
                            </Link>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 pt-6 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                             <div className="w-8 h-8 bg-white/5 rounded-lg border border-white/5 flex items-center justify-center text-[10px] font-bold">
                                {item.quantity}x
                             </div>
                             <div className="overflow-hidden">
                               <p className="text-[10px] font-black uppercase tracking-tight truncate">{item.name}</p>
                               <p className="text-[8px] text-purple-500 font-bold uppercase tracking-widest">{item.variantName}</p>
                             </div>
                          </div>
                        ))}
                      </div>

                      {/* Tracking Section */}
                      <div className="mt-6 p-4 bg-purple-500/5 rounded-2xl border border-purple-500/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                            <Truck className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-[8px] font-bold uppercase tracking-widest text-white/20 mb-1">Logistics Partner</p>
                            <div className="flex items-center gap-2">
                              <CourierLogo partner={order.deliveryPartner} />
                              <p className="text-[10px] font-black uppercase tracking-tight">
                                {order.deliveryPartner || 'Partner Assigning Soon'}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="sm:text-right">
                          <p className="text-[8px] font-bold uppercase tracking-widest text-white/20">Tracking ID</p>
                          {order.trackingId ? (
                            <div className="space-y-1 sm:flex sm:flex-col sm:items-end">
                              <a 
                                href={getTrackingUrl(order.deliveryPartner || '', order.trackingId) || '#'} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[10px] font-black uppercase tracking-tight text-neon-blue underline hover:text-white transition-colors cursor-pointer"
                              >
                                {order.trackingId}
                              </a>
                              <p className="text-[7px] text-emerald-400 font-bold uppercase tracking-widest sm:block hidden">
                                Click to track live
                              </p>
                            </div>
                          ) : (
                            <p className="text-[10px] font-black uppercase tracking-tight text-white/40 italic">
                              Registration in progress
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="py-24 text-center glass-morphism rounded-3xl border border-white/5 space-y-4">
                    <ShoppingBag className="w-12 h-12 text-white/5 mx-auto" />
                    <div className="space-y-1">
                      <p className="text-sm font-black uppercase italic tracking-widest text-white/20">No orders found</p>
                      <Link to="/shop" className="text-[10px] text-purple-500 font-bold uppercase tracking-widest hover:underline">Explore the gully</Link>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : activeTab === 'notifications' ? (
              <motion.div 
                key="notifications"
                initial="hidden"
                animate="show"
                exit="hidden"
                variants={{
                  hidden: { opacity: 0 },
                  show: {
                    opacity: 1,
                    transition: { staggerChildren: 0.1 }
                  }
                }}
                className="space-y-6"
              >
                {notifications.length > 0 ? (
                  notifications.map((notif) => (
                    <motion.div 
                      key={notif.id} 
                      variants={{
                        hidden: { opacity: 0, y: 20, scale: 0.98 },
                        show: { opacity: 1, y: 0, scale: 1 }
                      }}
                      className="glass-morphism rounded-3xl border border-white/5 relative overflow-hidden group hover:border-blue-500/40 hover:bg-white/[0.03] transition-all duration-700 shadow-2xl flex flex-col sm:flex-row"
                    >
                      {/* Neon Sidebar Accent */}
                      <div className={`absolute top-0 left-0 w-1.5 h-full z-20 ${
                        notif.type === 'broadcast' ? 'bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.6)]' : 
                        notif.type === 'tier_reward' ? 'bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.6)]' : 'bg-purple-600 shadow-[0_0_25px_rgba(147,51,234,0.6)]'
                      }`} />
                      
                      {/* Neural Mesh Background Pattern */}
                      <div className="absolute inset-0 opacity-[0.02] pointer-events-none group-hover:opacity-[0.04] transition-opacity duration-700" 
                        style={{ backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,1) 0.5px, transparent 0)`, backgroundSize: '16px 16px' }} 
                      />

                      {notif.bannerUrl ? (
                        <div className="w-full sm:w-[32%] aspect-[2/1] overflow-hidden relative shrink-0">
                           <img src={notif.bannerUrl} alt="Banner" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[1500ms] ease-out" />
                           <div className="absolute inset-0 bg-gradient-to-r from-dark-bg/60 via-transparent to-transparent hidden sm:block" />
                           <div className="absolute inset-0 bg-gradient-to-t from-dark-bg/60 via-transparent to-transparent sm:hidden" />
                        </div>
                      ) : (
                        <div className="w-full sm:w-[15%] aspect-[2/1] bg-white/5 flex items-center justify-center shrink-0 border-r border-white/5">
                            <Bell className="w-5 h-5 text-white/10 group-hover:text-blue-500 transition-all" />
                        </div>
                      )}

                      <div className="p-4 sm:p-5 flex-grow flex flex-col justify-center relative z-10">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                             <div className="flex items-center gap-1.5">
                                <span className={`px-2 py-0.5 rounded-full text-[6px] font-black uppercase tracking-wider border backdrop-blur-xl ${
                                  notif.type === 'broadcast' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                                  notif.type === 'tier_reward' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                }`}>
                                  {notif.type === 'broadcast' ? 'BROADCAST' : notif.type === 'tier_reward' ? 'REWARD' : 'SYSTEM'}
                                </span>
                                {!notif.isRead && (
                                  <div className="flex items-center gap-1">
                                    <span className="w-1 h-1 bg-blue-500 rounded-full animate-ping" />
                                    <span className="text-[6px] font-black uppercase text-blue-500 tracking-widest">New</span>
                                  </div>
                                )}
                             </div>
                             <div className="flex items-center gap-1.5 text-white/5">
                                <Clock className="w-2 h-2" />
                                <span className="text-[7px] font-bold uppercase tracking-wider">{formatDate(notif.createdAt)}</span>
                             </div>
                          </div>
                          
                          <div className="space-y-0.5">
                            <h3 className="text-base sm:text-lg font-black italic uppercase tracking-tighter text-white leading-tight group-hover:text-blue-400 transition-colors duration-300">
                              {notif.title}
                            </h3>
                            <p className="text-[10px] sm:text-xs text-white/30 font-medium leading-relaxed max-w-2xl line-clamp-2 group-hover:line-clamp-none transition-all">
                              {notif.message}
                            </p>
                          </div>

                          {notif.couponCode && (
                            <div className="pt-2 mt-1 border-t border-white/5 flex items-center justify-between gap-2">
                               <div className="flex items-center gap-2 group/coupon bg-white/[0.01] p-1.5 px-2.5 rounded-lg border border-white/5 hover:border-emerald-500/20 transition-all">
                                  <Gift className="w-3 h-3 text-emerald-500" />
                                  <div>
                                     <p className="text-[6px] text-white/20 font-black uppercase tracking-wider">Coupon</p>
                                     <span className="text-xs sm:text-sm font-black uppercase italic text-emerald-500 tracking-tighter">{notif.couponCode}</span>
                                  </div>
                               </div>
                               <button 
                                 onClick={() => copyToClipboard(notif.couponCode!)}
                                 className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[8px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5"
                               >
                                 {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                 {copied ? 'Copied' : 'Copy'}
                               </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="py-32 text-center glass-morphism rounded-[3rem] border border-white/5 space-y-6 relative overflow-hidden">
                    <div className="absolute inset-0 bg-blue-600/5 blur-[120px] rounded-full -m-24" />
                    <div className="relative z-10 space-y-6">
                      <div className="w-20 h-20 bg-white/5 rounded-[2rem] border border-white/10 flex items-center justify-center mx-auto shadow-inner">
                        <Bell className="w-10 h-10 text-white/5" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-xl font-black uppercase italic tracking-widest text-white/30">Void Spectrum Active</p>
                        <p className="text-[11px] text-white/10 font-bold uppercase tracking-[0.3em]">Neural link established. Awaiting command center protocols.</p>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="wishlist"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {wishlistProducts.length > 0 ? (
                  wishlistProducts.map((product) => (
                    <motion.div 
                      layout
                      key={product.id}
                      className="glass-morphism rounded-3xl border border-white/5 overflow-hidden group relative"
                    >
                      <button 
                        onClick={() => toggleWishlist(product.id)}
                        className="absolute top-4 right-4 z-10 w-8 h-8 bg-pink-600 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                      >
                         <X className="w-4 h-4 text-white" />
                      </button>
                      <div className="aspect-square overflow-hidden bg-white/5 group-hover:bg-white/10 transition-colors">
                        <img src={product.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      </div>
                      <div className="p-4 space-y-4">
                        <div>
                          <h3 className="text-xs font-black uppercase italic tracking-tighter truncate">{product.name}</h3>
                          <p className="text-sm font-black italic tracking-tighter text-pink-500 mt-1">₹{product.price}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                           <button 
                             onClick={() => navigate(`/product/${product.id}`)}
                             className="py-2 bg-white text-dark-bg text-[8px] font-black uppercase tracking-widest rounded-lg flex items-center justify-center gap-1 hover:bg-white/90"
                           >
                             <Eye className="w-3 h-3" /> View
                           </button>
                           <button 
                             onClick={() => toggleWishlist(product.id)}
                             className="py-2 bg-white/5 text-white/40 text-[8px] font-black uppercase tracking-widest rounded-lg flex items-center justify-center gap-1 hover:bg-pink-500/10 hover:text-pink-500"
                           >
                             <Trash2 className="w-3 h-3" /> Remove
                           </button>
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="col-span-full py-24 text-center glass-morphism rounded-3xl border border-white/5 space-y-4">
                    <Heart className="w-12 h-12 text-white/5 mx-auto" />
                    <div className="space-y-1">
                      <p className="text-sm font-black uppercase italic tracking-widest text-white/20">Wishlist empty</p>
                      <Link to="/shop" className="text-[10px] text-pink-500 font-bold uppercase tracking-widest hover:underline">Start saving heat</Link>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
