import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { db, handleFirestoreError } from '../lib/firebase';
import { UserProfile } from '../types';

const COLLECTION_NAME = 'users';

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const docRef = doc(db, COLLECTION_NAME, uid);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      const data = snapshot.data();
      // Auto-generate profileId if missing
      if (!data.profileId) {
        const profileId = `KG-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        await updateDoc(docRef, { profileId });
        return { id: snapshot.id, ...data, profileId } as any;
      }
      return { id: snapshot.id, ...data } as any;
    }
    return null;
  } catch (error) {
    return handleFirestoreError(error, 'get', `${COLLECTION_NAME}/${uid}`);
  }
}

export function subscribeToUserProfile(uid: string, callback: (profile: UserProfile | null) => void) {
  const docRef = doc(db, COLLECTION_NAME, uid);
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      // Auto-generate profileId if missing in real-time
      if (!data.profileId) {
        const profileId = `KG-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        updateDoc(docRef, { profileId }).catch(console.error);
        callback({ id: snapshot.id, ...data, profileId } as any);
      } else {
        callback({ id: snapshot.id, ...data } as any);
      }
    } else {
      callback(null);
    }
  }, (error) => {
    handleFirestoreError(error, 'get', `${COLLECTION_NAME}/${uid}`);
  });
}

export async function createUserProfile(uid: string, email: string, displayName?: string) {
  try {
    const docRef = doc(db, COLLECTION_NAME, uid);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) {
      const profileId = `KG-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const newUser = {
        uid,
        email,
        displayName: displayName || null,
        profileId,
        isTrustedBuyer: false,
        loyaltyStatus: 'none',
        trustStats: {
          deliveredCodOrders: 0,
          successfulPrepaidOrders: 0
        },
        createdAt: serverTimestamp()
      };
      await setDoc(docRef, newUser);
      return { ...newUser, createdAt: Date.now() } as any;
    }
    const existingData = snapshot.data();
    if (!existingData.profileId) {
      const profileId = `KG-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      await updateDoc(docRef, { profileId });
      return { id: snapshot.id, ...existingData, profileId } as any;
    }
    return { id: snapshot.id, ...existingData } as any;
  } catch (error) {
    return handleFirestoreError(error, 'create', `${COLLECTION_NAME}/${uid}`);
  }
}

export async function claimTrustedStatus(uid: string) {
  try {
    const docRef = doc(db, COLLECTION_NAME, uid);
    await updateDoc(docRef, {
      loyaltyStatus: 'pending'
    });
  } catch (error) {
    return handleFirestoreError(error, 'update', `${COLLECTION_NAME}/${uid}`);
  }
}

// Admin Operations
export async function getPendingLoyaltyClaims(): Promise<UserProfile[]> {
  try {
    const q = query(collection(db, COLLECTION_NAME), where('loyaltyStatus', '==', 'pending'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
  } catch (error) {
    return handleFirestoreError(error, 'list', COLLECTION_NAME);
  }
}

export async function approveLoyaltyClaim(uid: string, badgeName: string) {
  try {
    const docRef = doc(db, COLLECTION_NAME, uid);
    await updateDoc(docRef, {
      loyaltyStatus: 'approved',
      isTrustedBuyer: true,
      badge: badgeName,
      loyaltyTier: 1
    });
  } catch (error) {
    return handleFirestoreError(error, 'update', `${COLLECTION_NAME}/${uid}`);
  }
}

export async function rejectLoyaltyClaim(uid: string) {
  try {
    const docRef = doc(db, COLLECTION_NAME, uid);
    await updateDoc(docRef, {
      loyaltyStatus: 'rejected'
    });
  } catch (error) {
    return handleFirestoreError(error, 'update', `${COLLECTION_NAME}/${uid}`);
  }
}

export async function revokeLoyaltyStatus(uid: string) {
  try {
    const docRef = doc(db, COLLECTION_NAME, uid);
    await updateDoc(docRef, {
      loyaltyStatus: 'none',
      isTrustedBuyer: false,
      badge: null,
      loyaltyTier: null
    });
  } catch (error) {
    return handleFirestoreError(error, 'update', `${COLLECTION_NAME}/${uid}`);
  }
}

export async function updateUserTier(uid: string, tier: number | null, badgeName?: string) {
  try {
    const docRef = doc(db, COLLECTION_NAME, uid);
    const updates: any = { loyaltyTier: tier };
    if (badgeName !== undefined) updates.badge = badgeName;
    if (tier) {
      updates.isTrustedBuyer = true;
      updates.loyaltyStatus = 'approved';
    } else {
      updates.isTrustedBuyer = false;
      updates.loyaltyStatus = 'none';
    }
    await updateDoc(docRef, updates);
  } catch (error) {
    return handleFirestoreError(error, 'update', `${COLLECTION_NAME}/${uid}`);
  }
}

export async function updateUserTrustStats(uid: string, stats: Partial<UserProfile['trustStats']>) {
  try {
    const docRef = doc(db, COLLECTION_NAME, uid);
    // Use dot notation for nested objects in updateDoc to avoid overwriting the whole object
    const updates: any = {};
    if (stats.deliveredCodOrders !== undefined) updates['trustStats.deliveredCodOrders'] = stats.deliveredCodOrders;
    if (stats.successfulPrepaidOrders !== undefined) updates['trustStats.successfulPrepaidOrders'] = stats.successfulPrepaidOrders;
    
    await updateDoc(docRef, updates);
  } catch (error) {
    return handleFirestoreError(error, 'update', `${COLLECTION_NAME}/${uid}`);
  }
}

export async function getAllTrustedUsers(): Promise<UserProfile[]> {
  try {
    const q = query(collection(db, COLLECTION_NAME), where('isTrustedBuyer', '==', true));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
  } catch (error) {
    return handleFirestoreError(error, 'list', COLLECTION_NAME);
  }
}

export async function searchUserByProfileId(profileId: string): Promise<UserProfile | null> {
  try {
    const q = query(collection(db, COLLECTION_NAME), where('profileId', '==', profileId.toUpperCase()));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as any;
    }
    return null;
  } catch (error) {
    return handleFirestoreError(error, 'list', COLLECTION_NAME);
  }
}
