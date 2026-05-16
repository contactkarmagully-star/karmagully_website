import { 
  collection, 
  getDocs, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError } from '../lib/firebase';
import { CourierPartner } from '../types';

const COLLECTION_NAME = 'courierPartners';

export async function getAllCouriers(): Promise<CourierPartner[]> {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy('name', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CourierPartner));
  } catch (error) {
    return handleFirestoreError(error, 'list', COLLECTION_NAME);
  }
}

export async function addCourier(courier: Omit<CourierPartner, 'id' | 'createdAt'>) {
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...courier,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    return handleFirestoreError(error, 'create', COLLECTION_NAME);
  }
}

export async function updateCourier(id: string, updates: Partial<CourierPartner>) {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, updates);
  } catch (error) {
    return handleFirestoreError(error, 'update', `${COLLECTION_NAME}/${id}`);
  }
}

export async function deleteCourier(id: string) {
  try {
    console.log("Deleting courier:", id);
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
    const { dataCache } = await import('../lib/dataCache');
    dataCache.clear();
  } catch (error) {
    return handleFirestoreError(error, 'delete', `${COLLECTION_NAME}/${id}`);
  }
}
