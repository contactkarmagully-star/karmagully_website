import { collection, getDocs, setDoc, deleteDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError } from '../lib/firebase';
import { dataCache } from '../lib/dataCache';

export interface Coupon {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  isActive: boolean;
  startDate?: string;
  expiryDate?: string;
  usageLimit?: number;
  usageCount?: number;
}

const COLLECTION_NAME = 'coupons';

export async function getAllCoupons(): Promise<Coupon[]> {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
    return querySnapshot.docs.map(doc => {
      const data = doc.data() as Coupon;
      return { ...data, code: data.code || doc.id };
    });
  } catch (error) {
    return handleFirestoreError(error, 'list', COLLECTION_NAME);
  }
}

export async function addCoupon(coupon: Coupon) {
  try {
    // We use the code as the document ID for easy lookup
    const docRef = doc(db, COLLECTION_NAME, coupon.code.toUpperCase());
    await setDoc(docRef, { ...coupon, code: coupon.code.toUpperCase() });
    dataCache.clear();
  } catch (error) {
    return handleFirestoreError(error, 'create', COLLECTION_NAME);
  }
}

export async function getCoupon(code: string): Promise<Coupon | null> {
  try {
    const docRef = doc(db, COLLECTION_NAME, code.toUpperCase());
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as Coupon;
      return { ...data, code: data.code || docSnap.id };
    }
    return null;
  } catch (error) {
    console.error("Error getting coupon:", error);
    return null;
  }
}

export async function deleteCoupon(code: string) {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, code.toUpperCase()));
    dataCache.clear();
  } catch (error) {
    return handleFirestoreError(error, 'delete', `${COLLECTION_NAME}/${code}`);
  }
}

export async function incrementCouponUsage(code: string) {
  try {
    const docRef = doc(db, COLLECTION_NAME, code.toUpperCase());
    const coupon = await getCoupon(code);
    if (coupon) {
      await updateDoc(docRef, { 
        usageCount: (coupon.usageCount || 0) + 1 
      });
    }
  } catch (error) {
    console.error("Error incrementing coupon usage:", error);
  }
}
