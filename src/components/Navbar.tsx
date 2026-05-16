import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Menu, X, User, Search, Instagram, Twitter, Facebook, Send, Phone, ChevronDown, Tag } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useCart } from '../hooks/useCart';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { subscribeToSettings } from '../services/settingsService';
import { AppSettings, Category } from '../types';
import { getAllCategories } from '../services/categoryService';
import CartDrawer from './CartDrawer';

import { useAuth } from '../hooks/useAuth';
import { AppNotification } from '../services/notificationService';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isPagesOpen, setIsPagesOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [pages, setPages] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const { user: authUser, profile } = useAuth();
  const { cart } = useCart();
  const navigate = useNavigate();
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    return subscribeToSettings(setSettings);
  }, []);

  useEffect(() => {
    async function fetchPages() {
      try {
        const q = query(collection(db, 'pages'), orderBy('title'));
        const querySnapshot = await getDocs(q);
        const pagesList = querySnapshot.docs.map(doc => ({
          slug: doc.id,
          ...doc.data()
        }));
        setPages(pagesList);
      } catch (error) {
        console.error("Error fetching pages:", error);
      }
    }
    fetchPages();
  }, []);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const data = await getAllCategories();
        setCategories(data);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    }
    fetchCategories();
  }, []);

  const handleSearch = (e: any) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  };

  return (
    <nav className="glass-morphism border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-3 group">
              {settings?.logoUrl ? (
                <img 
                  src={settings.logoUrl || undefined} 
                  alt={settings.storeName || 'KARMAGULLY'} 
                  className="h-8 w-auto object-contain"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="relative w-10 h-10">
                  <div className="absolute inset-0 bg-purple-600 rounded-xl rotate-45 group-hover:rotate-90 transition-transform duration-500 shadow-[0_0_15px_rgba(168,85,247,0.4)]" />
                  <div className="absolute inset-0 flex items-center justify-center text-white font-black text-sm italic tracking-tighter">
                    KG
                  </div>
                </div>
              )}
              <span className="text-xl font-black tracking-tighter uppercase italic ml-1">
                KARMA<span className="text-gradient">GULLY</span>
              </span>
            </Link>
          </div>
          
          <div className="hidden md:block">
            <div className={`ml-10 flex items-baseline space-x-8 transition-all duration-300 ${isSearchOpen ? 'w-0 opacity-0 invisible overflow-hidden' : 'w-auto opacity-100 visible'}`}>
              <Link to="/" className="text-slate-400 hover:text-white transition-colors text-[10px] font-black uppercase tracking-[0.2em] px-1">Home</Link>
              <Link to="/shop" className="text-slate-400 hover:text-white transition-colors text-[10px] font-black uppercase tracking-[0.2em]">Collections</Link>
              <Link to="/categories" className="text-slate-400 hover:text-white transition-colors text-[10px] font-black uppercase tracking-[0.2em]">Categories</Link>
              
              {/* Pages Dropdown */}
              {pages.length > 0 && (
                <div className="relative group/pages">
                  <button 
                    className="flex items-center gap-1 text-slate-400 group-hover/pages:text-white transition-colors text-[10px] font-black uppercase tracking-[0.2em]"
                    onClick={() => setIsPagesOpen(!isPagesOpen)}
                  >
                    Pages <ChevronDown className="w-3 h-3" />
                  </button>
                  <div className="absolute top-full left-0 mt-2 w-48 glass-morphism border border-white/10 rounded-xl py-2 opacity-0 invisible group-hover/pages:opacity-100 group-hover/pages:visible transition-all z-50">
                    <Link 
                      to="/pages" 
                      className="block px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/5 transition-all"
                    >
                      All Pages
                    </Link>
                    <div className="h-px bg-white/5 my-1" />
                    {pages.map(page => (
                      <Link 
                        key={page.slug}
                        to={`/page/${page.slug}`}
                        className="block px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/5 transition-all"
                      >
                        {page.title}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <Link to="/blog" className="text-slate-400 hover:text-white transition-colors text-[10px] font-black uppercase tracking-[0.2em]">Blog</Link>
              <Link to="/support" className="text-slate-400 hover:text-white transition-colors text-[10px] font-black uppercase tracking-[0.2em]">Support</Link>
              <Link to="/shop?category=Featured" className="text-slate-400 hover:text-white transition-colors text-[10px] font-black uppercase tracking-[0.2em]">Featured</Link>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center relative mr-2">
               <button 
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className="p-2 text-slate-400 hover:text-white transition-colors"
               >
                 <Search className="w-5 h-5" />
               </button>
               <AnimatePresence>
                 {isSearchOpen && (
                   <motion.form 
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 250, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    onSubmit={handleSearch}
                    className="absolute right-full mr-2"
                   >
                     <input 
                      type="text"
                      autoFocus
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search posters..."
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] text-white font-bold uppercase tracking-widest focus:outline-none focus:border-purple-500 placeholder:text-white/10"
                     />
                   </motion.form>
                 )}
               </AnimatePresence>
            </div>

            <button 
              onClick={() => setIsCartOpen(true)}
              className="relative group p-2 bg-white/5 rounded-xl border border-white/5 hover:border-purple-500/50 transition-all"
            >
              <ShoppingCart className="w-5 h-5 text-slate-300 group-hover:text-purple-400 transition-colors" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-purple-600 text-white text-[8px] w-4 h-4 flex items-center justify-center rounded-full font-black">
                  {itemCount}
                </span>
              )}
            </button>
            <Link 
              to={authUser ? "/profile" : "/admin/login"} 
              className="hidden md:flex items-center gap-2 px-5 py-2 bg-white text-black font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-purple-600 hover:text-white transition-all shadow-lg shadow-white/5"
            >
              <User className="w-3 h-3" />
              {authUser ? 'Account' : 'Sign In'}
            </Link>
            <button 
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden p-2 text-slate-400 hover:text-white"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass-morphism overflow-hidden border-b border-white/10"
          >
            <div className="px-6 py-8 space-y-6">
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input 
                  type="text" 
                  placeholder="Search posters..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-purple-500"
                />
              </form>
              
              <Link 
                to="/" 
                onClick={() => setIsOpen(false)} 
                className="block text-3xl font-black italic uppercase tracking-tighter hover:text-purple-500 transition-colors"
              >
                Home
              </Link>
              <Link 
                to="/shop" 
                onClick={() => setIsOpen(false)} 
                className="block text-3xl font-black italic uppercase tracking-tighter hover:text-purple-500 transition-colors"
              >
                Collections
              </Link>
              <Link 
                to="/categories" 
                onClick={() => setIsOpen(false)} 
                className="block text-3xl font-black italic uppercase tracking-tighter hover:text-purple-500 transition-colors"
              >
                Categories
              </Link>
              <Link 
                to="/blog" 
                onClick={() => setIsOpen(false)} 
                className="block text-3xl font-black italic uppercase tracking-tighter hover:text-purple-500 transition-colors"
              >
                Blog
              </Link>

              <Link 
                to="/support" 
                onClick={() => setIsOpen(false)} 
                className="block text-3xl font-black italic uppercase tracking-tighter hover:text-purple-500 transition-colors"
              >
                Support
              </Link>
              <Link 
                to="/pages" 
                onClick={() => setIsOpen(false)} 
                className="block text-3xl font-black italic uppercase tracking-tighter hover:text-purple-500 transition-colors"
              >
                Pages
              </Link>

              <Link 
                to={authUser ? "/profile" : "/admin/login"} 
                onClick={() => setIsOpen(false)} 
                className="block text-3xl font-black italic uppercase tracking-tighter hover:text-purple-500 transition-colors"
              >
                {authUser ? 'My Account' : 'Sign In'}
              </Link>
              

              
              <div className="pt-6 border-t border-white/5">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 mb-4">The Gully Social</p>
                <div className="flex gap-4">
                  {settings?.socialLinks?.instagram && (
                    <a 
                      href={settings.socialLinks.instagram} 
                      target="_blank" 
                      rel="noreferrer"
                      className="w-10 h-10 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center text-white/20 hover:border-purple-500/50 hover:text-purple-500 transition-all cursor-pointer"
                    >
                      <Instagram className="w-5 h-5" />
                    </a>
                  )}
                  {settings?.socialLinks?.twitter && (
                    <a 
                      href={settings.socialLinks.twitter} 
                      target="_blank" 
                      rel="noreferrer"
                      className="w-10 h-10 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center text-white/20 hover:border-purple-500/50 hover:text-purple-500 transition-all cursor-pointer"
                    >
                      <Twitter className="w-5 h-5" />
                    </a>
                  )}
                  {settings?.socialLinks?.facebook && (
                    <a 
                      href={settings.socialLinks.facebook} 
                      target="_blank" 
                      rel="noreferrer"
                      className="w-10 h-10 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center text-white/20 hover:border-purple-500/50 hover:text-purple-500 transition-all cursor-pointer"
                    >
                      <Facebook className="w-5 h-5" />
                    </a>
                  )}
                  {settings?.socialLinks?.telegram && (
                    <a 
                      href={settings.socialLinks.telegram} 
                      target="_blank" 
                      rel="noreferrer"
                      className="w-10 h-10 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center text-white/20 hover:border-purple-500/50 hover:text-purple-500 transition-all cursor-pointer"
                    >
                      <Send className="w-5 h-5" />
                    </a>
                  )}
                  {settings?.socialLinks?.whatsapp && (
                    <a 
                      href={settings.socialLinks.whatsapp} 
                      target="_blank" 
                      rel="noreferrer"
                      className="w-10 h-10 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center text-white/20 hover:border-purple-500/50 hover:text-purple-500 transition-all cursor-pointer"
                    >
                      <Phone className="w-5 h-5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
