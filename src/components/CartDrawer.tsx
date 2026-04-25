import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShoppingBag, Trash2, Plus, Minus, ArrowRight } from 'lucide-react';
import { useCart } from '../hooks/useCart';
import { Link } from 'react-router-dom';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { cart, removeFromCart, updateQuantity, total } = useCart();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-dark-bg border-l border-white/10 z-[101] shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-600/10 rounded-xl flex items-center justify-center text-purple-500">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black uppercase italic tracking-tighter">Your Bag</h2>
                  <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">{cart.length} drops inside</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/5 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-white/40" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-grow overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {cart.length > 0 ? (
                cart.map((item) => (
                  <div key={`${item.productId}-${item.variantName}`} className="flex gap-4 group">
                    <div className="w-24 h-24 bg-white/5 rounded-xl border border-white/10 overflow-hidden shrink-0">
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    </div>
                    <div className="flex-grow flex flex-col justify-between py-1">
                      <div>
                        <div className="flex justify-between items-start">
                          <h3 className="text-sm font-black uppercase italic tracking-tight">{item.name}</h3>
                          <button 
                            onClick={() => removeFromCart(item.productId, item.variantName)}
                            className="text-white/20 hover:text-pink-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {item.variantName && (
                          <p className="text-[10px] text-purple-500 font-bold uppercase tracking-widest mt-1">{item.variantName}</p>
                        )}
                        <p className="text-xs font-bold text-white/40 mt-1">₹{item.price}</p>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center bg-white/5 rounded-lg border border-white/10 p-1">
                          <button 
                            onClick={() => updateQuantity(item.productId, item.variantName, item.quantity - 1)}
                            className="p-1 hover:bg-white/5 rounded-sm transition-colors"
                          >
                            <Minus className="w-3 h-3 text-white/40" />
                          </button>
                          <span className="w-8 text-center text-xs font-bold">{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(item.productId, item.variantName, item.quantity + 1)}
                            className="p-1 hover:bg-white/5 rounded-sm transition-colors"
                          >
                            <Plus className="w-3 h-3 text-white/40" />
                          </button>
                        </div>
                        <p className="text-sm font-black italic tracking-tighter">₹{item.price * item.quantity}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center border border-white/5">
                    <ShoppingBag className="w-8 h-8 text-white/10" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-black uppercase italic tracking-widest text-white/20">Bag is Empty</p>
                    <p className="text-[10px] text-white/10 font-bold uppercase tracking-widest">Add some drops to get started</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {cart.length > 0 && (
              <div className="p-6 border-t border-white/5 space-y-6 bg-dark-surface/50 backdrop-blur-md">
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">
                    <span>Subtotal</span>
                    <span>₹{total}</span>
                  </div>
                  <div className="flex justify-between text-lg font-black uppercase italic tracking-tighter">
                    <span>Total Amount</span>
                    <span className="text-purple-500">₹{total}</span>
                  </div>
                </div>
                <Link
                  to="/checkout"
                  onClick={onClose}
                  className="w-full py-4 bg-purple-600 text-white font-black uppercase tracking-[0.2em] rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-purple-600/20 hover:bg-purple-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  Proceed to Checkout
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
