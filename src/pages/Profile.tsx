import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate, Link } from 'react-router-dom';
import { ShoppingBag, LogOut, Package, Clock, ChevronRight, User } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Order } from '../types';

export default function Profile() {
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        navigate('/admin/login');
      } else {
        setUser(u);
        fetchOrders(u.uid);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const fetchOrders = async (uid: string) => {
    try {
      const q = query(
        collection(db, 'orders'),
        where('userId', '==', uid),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const ordersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(ordersData);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    localStorage.removeItem('admin_auth');
    navigate('/');
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
                <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest truncate">{user?.email}</p>
              </div>
            </div>
            
            <button 
              onClick={handleSignOut}
              className="w-full py-3 bg-white/5 border border-white/5 hover:border-pink-500/50 hover:text-pink-500 transition-all rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <LogOut className="w-3 h-3" />
              Sign Out
            </button>

            {/* Admin Quick Link (Only if admin logged in) */}
            {localStorage.getItem('admin_auth') === 'true' && (
              <button 
                onClick={() => navigate('/admin')}
                className="w-full py-3 bg-purple-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-purple-700 transition-colors"
              >
                Admin Panel
              </button>
            )}
          </div>
        </aside>

        {/* Content */}
        <main className="flex-grow space-y-8">
          <header>
            <h1 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter">
              Order <span className="text-gradient">History</span>
            </h1>
            <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest mt-2">{orders.length} Drops Secured</p>
          </header>

          <div className="space-y-4">
            {orders.length > 0 ? (
              orders.map((order) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={order.id}
                  onClick={() => navigate(`/success?orderId=${order.id}`)}
                  className="glass-morphism p-6 rounded-3xl border border-white/5 hover:border-purple-500/20 transition-all group cursor-pointer"
                >
                  <div className="flex flex-col md:flex-row justify-between gap-6">
                    <div className="flex gap-6">
                      <div className="w-20 h-20 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                         {order.items[0]?.imageUrl ? (
                           <img src={order.items[0].imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
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
                          <span className="text-[10px] text-white/20 not-italic font-bold">#ORD-{order.id.slice(-6).toUpperCase()}</span>
                        </h3>
                        <p className="text-xs text-white/40 font-bold uppercase tracking-widest flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          {formatDate(order.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-row md:flex-col justify-between items-end gap-2">
                      <div className="text-right">
                        <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest">Total Amount</p>
                        <p className="text-xl font-black italic tracking-tighter text-purple-400">₹{order.totalAmount}</p>
                      </div>
                      <Link 
                        to={`/success?orderId=${order.id}`} // Using success page style for overview
                        className="p-2 bg-white/5 rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-purple-500 transition-all"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </Link>
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
          </div>
        </main>
      </div>
    </div>
  );
}
