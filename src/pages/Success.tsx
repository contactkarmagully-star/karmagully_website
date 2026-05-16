import { motion } from 'motion/react';
import { CheckCircle, Truck, Package, ChevronRight, MapPin, CreditCard } from 'lucide-react';
import { getTrackingUrl } from '../lib/tracking';
import { CourierLogo } from '../components/CourierLogo';
import { Link, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import TerminalSubscriber from '../components/TerminalSubscriber';

export default function Success() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');
  const isNew = searchParams.get('new') === 'true';
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrder() {
      if (!orderId) {
        setLoading(false);
        return;
      }
      try {
        const docRef = doc(db, 'orders', orderId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setOrder({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (error) {
        console.error("Error fetching order:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchOrder();
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-neon-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Calculate prices for the detailed view
  const subtotal = order?.items?.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0) || 0;
  const discount = order ? (subtotal - order.totalAmount) : 0;

  if (isNew) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="min-h-[80vh] flex items-center justify-center px-4 py-24"
      >
        <div className="max-w-xl w-full glass-morphism p-12 rounded-[3rem] text-center space-y-10 relative overflow-hidden">
          {/* Glow Effects */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-neon-purple/20 blur-[100px] rounded-full" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-neon-blue/20 blur-[100px] rounded-full" />

          <div className="relative">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.2 }}
              className="w-24 h-24 bg-neon-purple/20 rounded-full flex items-center justify-center mx-auto mb-8 border border-neon-purple/30"
            >
              <CheckCircle className="w-12 h-12 text-neon-purple" />
            </motion.div>
            
            <h1 className="text-4xl font-black italic tracking-tighter uppercase mb-4">Order Secured</h1>
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-[0.3em] mb-4">ORDER ID: {orderId}</p>
            <p className="text-white/50 leading-relaxed uppercase text-xs tracking-widest font-bold">
              Karma Overload! Your order has been received and is being processed by our manufacturing unit.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 py-8 border-y border-white/5">
            <div className="text-center">
              <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-bold mb-1">Estimated Delivery</p>
              <p className="text-sm font-bold text-neon-blue uppercase tracking-widest flex items-center justify-center gap-2">
                <Truck className="w-4 h-4" />
                7-10 Days
              </p>
            </div>
            <div className="text-center border-l border-white/5">
               <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-bold mb-1">Order Status</p>
              <p className="text-sm font-bold text-neon-purple uppercase tracking-widest flex items-center justify-center gap-2">
                <Package className="w-4 h-4" />
                {order?.orderStatus || 'Processing'}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <Link
              to="/profile"
              className="block w-full py-5 bg-white text-dark-bg font-black uppercase tracking-[0.3em] rounded-2xl hover:bg-neon-purple hover:text-white transition-all duration-300 transform active:scale-95 text-xs"
            >
              Track in Profile
            </Link>
            <Link
              to="/shop"
              className="block w-full py-4 bg-white/5 text-white/60 font-bold uppercase tracking-[0.3em] rounded-2xl hover:bg-white/10 transition-all text-[10px] border border-white/5"
            >
              Continue Shopping
            </Link>
          </div>

          <div className="pt-8 mt-8 border-t border-white/5 space-y-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-white/20">Connect to terminal for latest intel</p>
            <TerminalSubscriber compact />
          </div>
        </div>
      </motion.div>
    );
  }

  // Detailed View (for Profile/Order History)
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto px-4 py-24"
    >
      <div className="glass-morphism rounded-[3rem] overflow-hidden border border-white/5">
        {/* Header Section */}
        <div className="p-12 text-center border-b border-white/5 relative bg-gradient-to-b from-neon-purple/10 to-transparent">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-20 h-20 bg-neon-purple/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-neon-purple/30"
          >
            <CheckCircle className="w-10 h-10 text-neon-purple" />
          </motion.div>
          <h1 className="text-4xl font-black italic tracking-tighter uppercase mb-2">Order Details</h1>
          <div className="space-y-1">
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-[0.3em]">ORDER ID: {orderId}</p>
            {order?.createdAt && (
              <p className="text-[9px] text-white/20 font-black uppercase tracking-widest">
                {order.createdAt.toDate ? order.createdAt.toDate().toLocaleString('en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'short'
                }) : new Date(order.createdAt).toLocaleString('en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'short'
                })}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* Left Side: Order Items */}
          <div className="p-8 lg:p-12 space-y-8 lg:border-r border-white/5">
            <div className="space-y-4">
              <h2 className="text-xs font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Items Secured
              </h2>
              <div className="space-y-4">
                {order?.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex gap-4 items-center p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-black/40 border border-white/10">
                      <img src={item.imageUrl || undefined} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-grow">
                      <h4 className="text-sm font-black uppercase italic tracking-tight">{item.name}</h4>
                      <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
                        {item.variantName} • Qty {item.quantity}
                      </p>
                    </div>
                    <p className="text-sm font-black italic">₹{item.price}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Price Summary */}
            <div className="pt-6 border-t border-white/5 space-y-4">
              <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-white/40">
                <span>Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              {discount > 0.1 && (
                <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-emerald-500">
                  <span>Discount Applied</span>
                  <span>-₹{discount.toFixed(2)}</span>
                </div>
              )}
              {order?.advancePaid > 0 && (
                <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-emerald-500">
                  <span>Advance Paid</span>
                  <span>-₹{order.advancePaid}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-black italic uppercase tracking-tight text-white border-t border-white/5 pt-4">
                <span>{order?.paymentType === 'COD' && order?.advancePaid > 0 ? 'Balance at Door' : 'Total Paid'}</span>
                <span className="text-neon-purple">
                  ₹{order?.paymentType === 'COD' && order?.advancePaid > 0 
                    ? (order.totalAmount - order.advancePaid) 
                    : order?.totalAmount}
                </span>
              </div>
            </div>
          </div>

          {/* Right Side: Shipping & Status */}
          <div className="p-8 lg:p-12 space-y-10 bg-black/20">
             {/* Status Grid */}
             <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[9px] text-white/30 uppercase tracking-widest font-black mb-2">Estimate</p>
                <div className="flex items-center gap-2 text-neon-blue">
                  <Truck className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">7-10 Days</span>
                </div>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[9px] text-white/30 uppercase tracking-widest font-black mb-2">Status</p>
                <div className="flex items-center gap-2 text-neon-purple">
                  <Package className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">{order?.orderStatus || 'Processing'}</span>
                </div>
              </div>
            </div>

            {/* Shipping Details */}
            <div className="space-y-4">
              <h2 className="text-xs font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Shipping To
              </h2>
              <div className="p-6 bg-white/5 rounded-3xl border border-white/10 space-y-2">
                <p className="text-sm font-bold uppercase italic">{order?.customerInfo?.fullName || order?.customerInfo?.name}</p>
                <p className="text-xs text-white/60 font-medium leading-relaxed">
                  {order?.address?.fullAddress}<br />
                  {order?.address?.landmark && `Near ${order.address.landmark}, `}
                  {order?.address?.city}, {order?.address?.state} - {order?.address?.pincode}
                </p>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/20 pt-2 border-t border-white/5">
                  {order?.customerInfo?.phone}
                </p>
              </div>
            </div>

            {/* Tracking Details */}
            <div className="space-y-4">
               <h2 className="text-xs font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Logistics Tracking
              </h2>
              <div className="p-6 bg-purple-500/10 rounded-3xl border border-white/5 flex flex-col gap-4">
                <div>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-2">Logistics Partner</p>
                  <div className="flex items-center gap-3">
                    {order?.deliveryPartner ? (
                      <CourierLogo partner={order.deliveryPartner} isSuccessPage={true} />
                    ) : (
                      <div className="w-6 h-6 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center">
                        <Truck className="w-3.5 h-3.5 text-white/20" />
                      </div>
                    )}
                    <p className="text-sm font-black uppercase italic tracking-tight">{order?.deliveryPartner || 'Partner Assigning Soon'}</p>
                  </div>
                </div>
                <div className="pt-3 border-t border-white/5">
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-1">Tracking ID</p>
                  {order?.trackingId ? (
                    <div className="space-y-2">
                      <a 
                        href={getTrackingUrl(order.deliveryPartner || '', order.trackingId) || '#'} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm font-black uppercase italic tracking-tight text-neon-blue underline hover:text-white transition-colors cursor-pointer inline-block"
                      >
                        {order.trackingId}
                      </a>
                      <p className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest animate-pulse">
                        ● Click ID to track live on partner website
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm font-black uppercase italic tracking-tight text-white/40">
                      Registration in progress
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* How to Track Guide */}
            <div className="space-y-4">
              <h2 className="text-xs font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
                <ChevronRight className="w-4 h-4" />
                How to Track
              </h2>
              <div className="grid grid-cols-1 gap-3">
                <div className="flex gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[10px] font-black shrink-0">1</div>
                  <p className="text-[10px] text-white/60 font-medium leading-relaxed uppercase tracking-wider mt-0.5">
                    Wait for your <span className="text-white font-black">Tracking ID</span> to be assigned found in this section or your Profile.
                  </p>
                </div>
                <div className="flex gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div className="w-8 h-8 rounded-lg bg-neon-purple/20 flex items-center justify-center text-[10px] font-black text-neon-purple shrink-0">2</div>
                  <p className="text-[10px] text-white/60 font-medium leading-relaxed uppercase tracking-wider mt-0.5">
                    Simply <span className="text-neon-purple font-black">Click the Tracking ID</span>. We'll instantly beam you to the official logistics portal for live status.
                  </p>
                </div>
              </div>
            </div>

            {/* Payment Details */}
            <div className="space-y-4">
               <h2 className="text-xs font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Payment Method
              </h2>
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                <span className="text-xs font-bold uppercase tracking-widest">{order?.paymentType}</span>
                <span className={`text-[10px] px-2 py-1 rounded bg-white/10 font-bold uppercase tracking-widest ${order?.paymentStatus === 'Success' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {order?.paymentStatus}
                </span>
              </div>
            </div>

            <Link
              to="/shop"
              className="group flex items-center justify-center gap-3 w-full py-5 bg-white text-dark-bg font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-neon-purple hover:text-white transition-all duration-300 transform active:scale-95 text-xs shadow-[0_0_30px_rgba(255,255,255,0.1)]"
            >
              Continue Shopping
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
