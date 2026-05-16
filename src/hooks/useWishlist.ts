import { useState, useEffect } from 'react';
import { incrementWishlistCount } from '../services/productService';

export function useWishlist() {
  const [wishlist, setWishlist] = useState<string[]>(() => {
    const saved = localStorage.getItem('wishlist');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  const toggleWishlist = async (productId: string) => {
    const isAdding = !wishlist.includes(productId);
    
    setWishlist(prev => 
      isAdding 
        ? [...prev, productId]
        : prev.filter(id => id !== productId)
    );

    if (isAdding) {
      try {
        await incrementWishlistCount(productId);
      } catch (err) {
        console.error("Failed to track wishlist click:", err);
      }
    }
  };

  const isInWishlist = (productId: string) => wishlist.includes(productId);

  return { wishlist, toggleWishlist, isInWishlist };
}
