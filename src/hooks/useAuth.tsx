import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { UserProfile } from '../types';
import { subscribeToUserProfile, createUserProfile } from '../services/loyaltyService';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      
      if (u) {
        try {
          // Ensure profile exists or create it
          await createUserProfile(u.uid, u.email || '', u.displayName || undefined);
          
          // Cleanup previous profile subscription if any
          if (unsubscribeProfile) unsubscribeProfile();

          // Subscribe to profile changes
          unsubscribeProfile = subscribeToUserProfile(u.uid, (p) => {
            setProfile(p);
            setLoading(false);
          });
        } catch (error) {
          console.error("Auth initialization error:", error);
          setLoading(false);
        }
      } else {
        if (unsubscribeProfile) unsubscribeProfile();
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
