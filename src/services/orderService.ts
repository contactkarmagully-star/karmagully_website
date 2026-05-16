import { 
  collection, 
  getDocs, 
  getDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  addDoc,
  setDoc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp,
  limit,
  increment
} from 'firebase/firestore';
import { db, handleFirestoreError } from '../lib/firebase';
import { Order } from '../types';
import { dataCache } from '../lib/dataCache';
import { incrementSoldCount } from './productService';
import { getUserProfile, updateUserTrustStats } from './loyaltyService';

const COLLECTION_NAME = 'orders';

function generateOrderId() {
  const year = new Date().getFullYear().toString().slice(-2);
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid O, 0, I, 1 for clarity
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `KG${year}-${result}`;
}

export async function createOrder(order: Omit<Order, 'id' | 'createdAt'>) {
  try {
    const customId = generateOrderId();
    const docRef = doc(db, COLLECTION_NAME, customId);
    
    // Check if ID exists (highly unlikely but safe)
    const existing = await getDoc(docRef);
    if (existing.exists()) {
      return createOrder(order); // Retry
    }

    await setDoc(docRef, {
      ...order,
      id: customId,
      createdAt: serverTimestamp()
    });

    // Increment soldCount for limited drops
    for (const item of order.items) {
      await incrementSoldCount(item.productId, item.quantity).catch(err => {
        console.error("Failed to increment sold count for product:", item.productId, err);
      });
    }

    dataCache.clear(); // Invalidate cache
    return customId;
  } catch (error) {
    return handleFirestoreError(error, 'create', COLLECTION_NAME);
  }
}

export async function getOrderById(id: string): Promise<Order | null> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      return { id: snapshot.id, ...snapshot.data() } as Order;
    }
    return null;
  } catch (error) {
    return handleFirestoreError(error, 'get', `${COLLECTION_NAME}/${id}`);
  }
}

export async function getAllOrders(limitCount: number = 100): Promise<Order[]> {
  const cached = dataCache.getOrders();
  if (cached) return cached;

  if (!dataCache.canFetch(COLLECTION_NAME)) {
    return cached || [];
  }

  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
    
    dataCache.setOrders(data);
    console.log(`[Firestore] Fetched ${data.length} orders`);
    return data;
  } catch (error: any) {
    if (error.code === 'resource-exhausted') {
      dataCache.setQuotaExceeded(true);
    }
    return handleFirestoreError(error, 'list', COLLECTION_NAME);
  }
}

export async function updateOrderStatus(id: string, status: Order['orderStatus']) {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    
    // Get existing order to check transition
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return;
    
    const orderData = snapshot.data() as Order;
    const oldStatus = orderData.orderStatus;
    
    await updateDoc(docRef, { orderStatus: status });

    // Trust System Logic: Update stats when marked delivered
    if (status === 'Delivered' && oldStatus !== 'Delivered' && orderData.userId) {
      if (orderData.paymentType === 'COD') {
        await updateUserTrustStats(orderData.userId, { deliveredCodOrders: increment(1) as any });
      } else if (orderData.paymentType === 'Online') {
        await updateUserTrustStats(orderData.userId, { successfulPrepaidOrders: increment(1) as any });
      }
    }

    // Invert stats if moving AWAY from delivered (correction)
    if (oldStatus === 'Delivered' && status !== 'Delivered' && orderData.userId) {
      if (orderData.paymentType === 'COD') {
        await updateUserTrustStats(orderData.userId, { deliveredCodOrders: increment(-1) as any });
      } else if (orderData.paymentType === 'Online') {
        await updateUserTrustStats(orderData.userId, { successfulPrepaidOrders: increment(-1) as any });
      }
    }

    dataCache.clear();
  } catch (error) {
    return handleFirestoreError(error, 'update', `${COLLECTION_NAME}/${id}`);
  }
}

export async function updatePaymentStatus(id: string, status: Order['paymentStatus']) {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, { paymentStatus: status });
  } catch (error) {
    return handleFirestoreError(error, 'update', `${COLLECTION_NAME}/${id}`);
  }
}

export async function updateOrder(id: string, data: Partial<Order>) {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, { ...data });
    dataCache.clear(); // Invalidate cache
  } catch (error) {
    return handleFirestoreError(error, 'update', `${COLLECTION_NAME}/${id}`);
  }
}

export async function deleteOrder(id: string) {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
    dataCache.clear();
  } catch (error) {
    return handleFirestoreError(error, 'delete', `${COLLECTION_NAME}/${id}`);
  }
}
