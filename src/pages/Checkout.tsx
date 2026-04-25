import { motion } from 'motion/react';
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShoppingCart, ArrowRight, ShieldCheck, CreditCard, Info, Truck } from 'lucide-react';
import { useCart } from '../hooks/useCart';
import { useRazorpay } from '../hooks/useRazorpay';
import { createOrder } from '../services/orderService';
import { getCoupon, Coupon } from '../services/couponService';
import { auth } from '../lib/firebase';
import { Tag, CheckCircle2 } from 'lucide-react';

export default function Checkout() {
  const { cart, total, clearCart } = useCart();
  const navigate = useNavigate();
  const { displayRazorpay, loading: rpLoading } = useRazorpay();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    altPhone: '',
    email: '',
    address: '',
    landmark: '',
    city: '',
    state: '',
    pincode: '',
    paymentMode: 'COD'
  });

  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  useEffect(() => {
    if (auth.currentUser) {
      setFormData(prev => ({
        ...prev,
        fullName: auth.currentUser?.displayName || '',
        email: auth.currentUser?.email || '',
      }));
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    setValidatingCoupon(true);
    setCouponError(null);
    try {
      const coupon = await getCoupon(couponCode);
      if (!coupon) {
        setCouponError('Invalid coupon code');
      } else if (!coupon.isActive) {
        setCouponError('Coupon is no longer active');
      } else if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
        setCouponError('Coupon has expired');
      } else if (coupon.startDate && new Date(coupon.startDate) > new Date()) {
        setCouponError('Coupon is not yet active (scheduled start)');
      } else if (coupon.minOrderAmount && total < coupon.minOrderAmount) {
        setCouponError(`Min order amount for this coupon is ₹${coupon.minOrderAmount}`);
      } else {
        setAppliedCoupon(coupon);
        setCouponCode('');
      }
    } catch (err) {
      setCouponError('Error validating coupon');
    } finally {
      setValidatingCoupon(false);
    }
  };

  const getDiscountedTotal = () => {
    if (!appliedCoupon) return total;
    if (appliedCoupon.discountType === 'percentage') {
      return total - (total * (appliedCoupon.discountValue / 100));
    }
    return Math.max(0, total - appliedCoupon.discountValue);
  };

  const discountedTotal = getDiscountedTotal();

  const handlePlaceOrder = async (paymentId?: string, razorpayOrderId?: string) => {
    try {
      const orderData = {
        userId: auth.currentUser?.uid || null, // Link to account
        items: cart.map(item => ({
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          variantName: item.variantName || 'Standard',
          imageUrl: item.imageUrl
        })),
        totalAmount: discountedTotal,
        customerInfo: {
          fullName: formData.fullName,
          phone: formData.phone,
          alternatePhone: formData.altPhone,
          email: formData.email
        },
        address: {
          fullAddress: formData.address,
          landmark: formData.landmark,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode
        },
        paymentType: formData.paymentMode as any,
        paymentStatus: paymentId ? 'Success' : 'Pending',
        orderStatus: 'Pending',
        razorpayOrderId: razorpayOrderId || null,
        razorpayPaymentId: paymentId || null
      };

      const orderId = await createOrder(orderData as any);
      if (!orderId) throw new Error("Database Write Failed");
      
      // Trigger Notifications (Email + Telegram) in background
      fetch('/api/notifications/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          order: { ...orderData, id: orderId },
          customerEmail: formData.email,
          customerName: formData.fullName
        })
      }).catch(err => console.error("Notification trigger failed:", err));

      clearCart();
      navigate(`/success?orderId=${orderId}&new=true`);
    } catch (error: any) {
      console.error("Order creation failed:", error);
      setErrorMessage(error.message || "Failed to finalize order. Check your connection.");
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    if (formData.paymentMode === 'Online') {
      try {
        const response = await fetch('/api/razorpay/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: discountedTotal, receipt: `order_${Date.now()}` })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || "Payment system initialized incorrectly.");
        }

        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID, // Must be provided by user
          amount: data.amount,
          currency: data.currency,
          name: "KarmaGully",
          description: "Premium Anime Posters",
          order_id: data.id,
          handler: async (response: any) => {
            try {
              const verifyRes = await fetch('/api/razorpay/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(response)
              });
              const verifyData = await verifyRes.json();
              if (verifyData.status === 'success') {
                handlePlaceOrder(response.razorpay_payment_id, response.razorpay_order_id);
              } else {
                setErrorMessage("Payment verification failed. Re-authentication required.");
                setLoading(false);
              }
            } catch (err) {
              setErrorMessage("Server communication failure during verification.");
              setLoading(false);
            }
          },
          modal: {
            ondismiss: function() {
              setLoading(false);
            }
          },
          prefill: {
            name: formData.fullName,
            contact: formData.phone,
            email: formData.email
          },
          theme: { color: "#bc13fe" }
        };

        if (!options.key) {
           throw new Error("Razorpay Client Key missing. Please set VITE_RAZORPAY_KEY_ID.");
        }

        displayRazorpay(options);
      } catch (err: any) {
        console.error(err);
        setErrorMessage(err.message || "Network Error: Could not connect to payment server.");
        setLoading(false);
      }
    } else {
      // COD
      await handlePlaceOrder();
    }
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
        <ShoppingCart className="w-16 h-16 text-white/10 mb-6" />
        <h2 className="text-2xl font-bold mb-4">Your cart is empty</h2>
        <button onClick={() => navigate('/shop')} className="px-8 py-3 bg-neon-purple rounded-full uppercase text-xs font-bold tracking-widest">
          Continue Shopping
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-dark-bg"
    >
      <div className="flex flex-col lg:flex-row min-h-screen">
        {/* Left Side: Cart Gallery */}
        <div className="lg:w-3/5 p-8 lg:p-12 border-r border-white/5 bg-dark-bg">
          <div className="max-w-2xl mx-auto space-y-12">
            <div className="space-y-4">
              <Link to="/shop" className="text-slate-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" /> Continue Collections
              </Link>
              <h1 className="text-5xl md:text-6xl font-black italic uppercase leading-none tracking-tighter">
                Your <span className="text-gradient">Selection</span>
              </h1>
            </div>

            <div className="space-y-6">
              {cart.map((item) => (
                <div key={`${item.productId}-${item.variantName}`} className="flex items-center gap-6 p-4 bg-white/5 rounded-2xl border border-white/10">
                  <div className="w-24 h-32 bg-dark-bg rounded-xl overflow-hidden border border-white/10 shrink-0">
                    <img src={item.imageUrl} className="w-full h-full object-cover opacity-80" />
                  </div>
                  <div className="flex-grow">
                    <h3 className="font-bold uppercase tracking-tight text-lg leading-none mb-1">{item.name}</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Qty: {item.quantity}</p>
                    {item.variantName && <p className="text-[9px] text-purple-500 font-bold uppercase tracking-[0.2em]">{item.variantName}</p>}
                    <div className="mt-4 flex justify-between items-center">
                      <span className="font-mono font-bold text-purple-400">₹{item.price * item.quantity}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-8 border-t border-white/10 space-y-6">
              {/* Coupon Section */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Loyalty Pass / Coupon</label>
                {!appliedCoupon ? (
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={couponCode}
                      onChange={e => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="ENTER CODE"
                      className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold tracking-widest focus:outline-none focus:border-purple-500 flex-grow uppercase"
                    />
                    <button 
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={validatingCoupon || !couponCode}
                      className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                    >
                      {validatingCoupon ? '...' : 'Apply'}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">{appliedCoupon.code} Activated</p>
                        <p className="text-[9px] font-bold text-white/40 uppercase">Discount applied successfully</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setAppliedCoupon(null)}
                      className="text-[9px] font-black uppercase tracking-widest text-white/20 hover:text-white"
                    >
                      Remove
                    </button>
                  </div>
                )}
                {couponError && <p className="text-[10px] font-bold text-pink-500 uppercase tracking-widest ml-1">{couponError}</p>}
              </div>

              <div className="flex justify-between items-center bg-purple-500/5 p-6 rounded-2xl border border-purple-500/20">
                <div className="space-y-1">
                  <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px] block">Final Series Total</span>
                  {appliedCoupon && <span className="text-white/20 line-through text-xs font-mono">₹{total}</span>}
                </div>
                <span className="text-3xl font-mono font-black italic tracking-tighter text-purple-400">₹{discountedTotal}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Smart Checkout */}
        <div className="lg:w-2/5 p-8 lg:p-12 bg-black/30 backdrop-blur-xl flex flex-col">
          <div className="max-w-md mx-auto w-full">
            <div className="flex items-center gap-3 mb-10">
              <span className="w-8 h-8 rounded-full bg-purple-600/20 border border-purple-500 flex items-center justify-center text-purple-400 font-bold text-sm">1</span>
              <h2 className="text-2xl font-black uppercase italic tracking-tighter">Quick Checkout</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 border-b border-white/5 pb-2">Identification</h3>
                  <InputField label="Full Name" name="fullName" value={formData.fullName} onChange={handleChange} required placeholder="Tanjiro Kamado" />
                  <div className="grid grid-cols-2 gap-4">
                    <InputField label="Phone Number" name="phone" value={formData.phone} onChange={handleChange} required placeholder="+91 98765 43210" />
                    <InputField label="Pincode" name="pincode" value={formData.pincode} onChange={handleChange} required placeholder="110001" />
                  </div>
                  <InputField label="Email Address" type="email" name="email" value={formData.email} onChange={handleChange} required placeholder="tanjiro@slayer.corps" />
                </div>

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 border-b border-white/5 pb-2">Logistics</h3>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Delivery Address</label>
                    <textarea 
                      name="address"
                      value={formData.address}
                      onChange={handleChange as any}
                      required
                      placeholder="123 Hidden Leaf Village, Near Hokage Rock" 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500 transition-all resize-none h-24"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <InputField label="City" name="city" value={formData.city} onChange={handleChange} required placeholder="Neo Tokyo" />
                    <InputField label="Phase / State" name="state" value={formData.state} onChange={handleChange} required placeholder="Kanto" />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 border-b border-white/5 pb-2">Protocol</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <PaymentOption 
                      active={formData.paymentMode === 'COD'} 
                      onClick={() => setFormData(p => ({ ...p, paymentMode: 'COD' }))}
                      label="Post-Arrival"
                      sub="COD Available"
                    />
                    <PaymentOption 
                      active={formData.paymentMode === 'Online'} 
                      onClick={() => setFormData(p => ({ ...p, paymentMode: 'Online' }))}
                      label="Pay Online"
                      sub="UPI / RuPay / Cards"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-6 space-y-3">
                {errorMessage && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-[10px] font-black uppercase tracking-widest text-center"
                  >
                    {errorMessage}
                  </motion.div>
                )}
                <button 
                  type="submit"
                  disabled={loading || rpLoading}
                  className="w-full py-5 bg-purple-600 hover:bg-purple-700 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-purple-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed group flex items-center justify-center gap-3"
                >
                  {loading || rpLoading ? 'Encrypting...' : (
                    <>
                      Place Order
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
                <p className="text-[9px] text-center text-slate-600 font-bold uppercase tracking-[0.2em]">
                  <ShieldCheck className="w-3 h-3 inline mr-1 mb-0.5" /> Military-Grade 256-Bit SSL Secured
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function InputField({ label, ...props }: any) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">{label}</label>
      <input 
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500 transition-all placeholder:text-white/5"
        {...props}
      />
    </div>
  );
}

function PaymentOption({ active, onClick, label, sub }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-4 rounded-xl border transition-all text-left group ${
        active 
          ? 'bg-purple-500/10 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.1)]' 
          : 'bg-white/5 border-white/10 hover:border-white/20'
      }`}
    >
      <div className={`w-4 h-4 rounded-full border-2 mb-3 flex items-center justify-center ${active ? 'border-purple-500' : 'border-white/20'}`}>
        {active && <div className="w-2 h-2 bg-purple-500 rounded-full" />}
      </div>
      <p className={`text-xs font-black uppercase tracking-tighter ${active ? 'text-white' : 'text-slate-400'}`}>{label}</p>
      <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{sub}</p>
    </button>
  );
}
