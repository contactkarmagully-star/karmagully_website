import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product, OrderItem } from '../types';

interface CartItem extends OrderItem {
  imageUrl: string;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number, price?: number, variantName?: string) => void;
  removeFromCart: (productId: string, variantName?: string) => void;
  updateQuantity: (productId: string, variantName: string | undefined, quantity: number) => void;
  clearCart: () => void;
  total: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('karmagully_cart');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('karmagully_cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (product: Product, quantity: number = 1, price?: number, variantName?: string) => {
    const finalPrice = price ?? product.price;
    setCart(prev => {
      const existingIndex = prev.findIndex(item => 
        item.productId === product.id && item.variantName === variantName
      );
      
      if (existingIndex > -1) {
        const newCart = [...prev];
        // Change: For 'Secure Drop' (Buy Now), we should set the quantity 
        // to whatever was selected on the product page, not increment it.
        // This prevents double-counting if users go back and forth.
        newCart[existingIndex].quantity = quantity;
        return newCart;
      }

      return [...prev, {
        productId: product.id,
        name: product.name,
        price: finalPrice,
        quantity,
        imageUrl: product.imageUrl,
        variantName: variantName
      }];
    });
  };

  const removeFromCart = (productId: string, variantName?: string) => {
    setCart(prev => prev.filter(item => 
      !(item.productId === productId && item.variantName === variantName)
    ));
  };

  const updateQuantity = (productId: string, variantName: string | undefined, quantity: number) => {
    setCart(prev => prev.map(item => 
      (item.productId === productId && item.variantName === variantName) 
        ? { ...item, quantity: Math.max(1, quantity) } 
        : item
    ));
  };

  const clearCart = () => setCart([]);

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, total }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
