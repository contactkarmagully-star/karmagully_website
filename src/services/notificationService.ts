import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  limit
} from 'firebase/firestore';
import { db, handleFirestoreError } from '../lib/firebase';

export interface AppNotification {
  id?: string;
  title: string;
  message: string;
  type: 'broadcast' | 'tier_reward' | 'system';
  targetTier?: number; // 1, 2, 3 or null for all
  targetUid?: string;
  couponCode?: string;
  bannerUrl?: string;
  isRead?: boolean;
  createdAt: any;
}

const COLLECTION_NAME = 'notifications';

export async function sendBroadcastNotification(data: Omit<AppNotification, 'createdAt' | 'isRead'>) {
  try {
    // Remove undefined fields to prevent Firestore errors
    const cleanedData = Object.entries(data).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {} as any);

    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...cleanedData,
      isRead: false,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    return handleFirestoreError(error, 'create', COLLECTION_NAME);
  }
}

export function subscribeToUserNotifications(uid: string, tier: number | null, callback: (notifications: AppNotification[]) => void) {
  // Query for notifications targeted at this user OR their tier
  const q = query(
    collection(db, COLLECTION_NAME),
    where('targetTier', 'in', tier ? [tier, 0] : [0]), // 0 for all users
    orderBy('createdAt', 'desc'),
    limit(50)
  );

  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as AppNotification));
    callback(notifications);
  }, (error) => {
    console.error("Notification subscription error:", error);
  });
}

export async function markNotificationAsRead(notificationId: string) {
  try {
    const docRef = doc(db, COLLECTION_NAME, notificationId);
    await updateDoc(docRef, { isRead: true });
  } catch (error) {
    return handleFirestoreError(error, 'update', `${COLLECTION_NAME}/${notificationId}`);
  }
}

export async function deleteNotification(notificationId: string) {
  try {
    const docRef = doc(db, COLLECTION_NAME, notificationId);
    await deleteDoc(docRef);
  } catch (error) {
    return handleFirestoreError(error, 'delete', `${COLLECTION_NAME}/${notificationId}`);
  }
}

export async function getAllNotifications() {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'), limit(100));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as AppNotification));
  } catch (error) {
    return handleFirestoreError(error, 'list', COLLECTION_NAME);
  }
}
