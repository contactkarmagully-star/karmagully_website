import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useEffect } from 'react';
import { CartProvider } from './hooks/useCart';
import Navbar from './components/Navbar';
import AnnouncementBar from './components/AnnouncementBar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Shop from './pages/Shop';
import Categories from './pages/Categories';
import ProductDetail from './pages/ProductDetail';
import Checkout from './pages/Checkout';
import Success from './pages/Success';
import AdminDashboard from './pages/AdminDashboard';
import AdminLogin from './pages/AdminLogin';
import Profile from './pages/Profile';
import CustomPage from './pages/CustomPage';
import PagesBrowser from './pages/PagesBrowser';
import Support from './pages/Support';
import Blog from './pages/Blog';
import BlogPostView from './pages/BlogPostView';
import { subscribeToSettings } from './services/settingsService';
import { AuthProvider } from './hooks/useAuth';

function AppContent() {
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith('/admin');

  useEffect(() => {
    // Dynamic settings listener for favicon
    const unsubscribe = subscribeToSettings((settings) => {
      if (settings.faviconUrl) {
        let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.getElementsByTagName('head')[0].appendChild(link);
        }
        link.href = settings.faviconUrl;
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-dark-bg text-white">
      {!isAdminPath && (
        <header className="sticky top-0 z-50 w-full">
          <AnnouncementBar />
          <Navbar />
        </header>
      )}
      <main className="flex-grow">
        <AnimatePresence mode="wait">
          <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/success" element={<Success />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/support" element={<Support />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPostView />} />
            <Route path="/pages" element={<PagesBrowser />} />
            <Route path="/page/:slug" element={<CustomPage />} />
          </Routes>
        </AnimatePresence>
      </main>
      {!isAdminPath && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <CartProvider>
          <AppContent />
        </CartProvider>
      </AuthProvider>
    </Router>
  );
}

