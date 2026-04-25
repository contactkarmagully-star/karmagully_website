import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Lock, Zap, ShieldAlert, User } from 'lucide-react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { isUserAdmin } from '../services/adminService';

export default function AdminLogin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      const isAdmin = await isUserAdmin(result.user.uid, result.user.email || '');
      
      if (isAdmin) {
        localStorage.setItem('admin_auth', 'true');
        navigate('/admin');
      } else {
        localStorage.removeItem('admin_auth');
        navigate('/profile');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full glass-morphism p-10 rounded-[2rem] border-white/5 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-8">
           <ShieldAlert className="w-12 h-12 text-white/5" />
        </div>

        <div className="text-center mb-10">
          <Zap className="w-10 h-10 text-purple-500 mx-auto mb-4" />
          <h1 className="text-2xl font-black italic tracking-tighter uppercase mb-2">Gully Access</h1>
          <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-bold">Identify Yourself</p>
        </div>

        <div className="space-y-6">
          {error && (
            <p className="text-xs text-pink-500 uppercase tracking-widest font-bold text-center bg-pink-500/10 p-3 rounded-xl">
              {error}
            </p>
          )}

          <button 
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-4 bg-white text-dark-bg font-black uppercase tracking-[0.2em] rounded-xl hover:bg-purple-600 hover:text-white transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : (
              <>
                <User className="w-5 h-5" />
                Sign in with Google
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
