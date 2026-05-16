import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, orderBy, serverTimestamp, getDoc, limit } from 'firebase/firestore';
import { db, handleFirestoreError } from '../lib/firebase';
import { Category } from '../types';
import { dataCache } from '../lib/dataCache';

const CATEGORIES_COLLECTION = 'categories';

export async function addCategory(category: Omit<Category, 'id' | 'createdAt'>) {
  try {
    const docRef = await addDoc(collection(db, CATEGORIES_COLLECTION), {
      ...category,
      createdAt: serverTimestamp()
    });
    dataCache.clear(); // Invalidate cache
    return docRef.id;
  } catch (error) {
    console.error("Error adding category:", error);
    throw error;
  }
}

export async function updateCategory(id: string, category: Partial<Category>) {
  try {
    const docRef = doc(db, CATEGORIES_COLLECTION, id);
    await updateDoc(docRef, { ...category });
    dataCache.clear(); // Invalidate cache
  } catch (error) {
    return handleFirestoreError(error, 'update', `${CATEGORIES_COLLECTION}/${id}`);
  }
}

export async function deleteCategory(id: string) {
  try {
    console.log("Deleting category:", id);
    const docRef = doc(db, CATEGORIES_COLLECTION, id);
    await deleteDoc(docRef);
    dataCache.clear(); // Invalidate cache
  } catch (error) {
    return handleFirestoreError(error, 'delete', `${CATEGORIES_COLLECTION}/${id}`);
  }
}

export async function getAllCategories(): Promise<Category[]> {
  const cached = dataCache.getCategories();
  if (cached) return cached;

  if (!dataCache.canFetch(CATEGORIES_COLLECTION)) {
    return cached || [];
  }

  try {
    const q = query(collection(db, CATEGORIES_COLLECTION), orderBy('createdAt', 'desc'), limit(100));
    const querySnapshot = await getDocs(q);
    const data = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Category));
    
    dataCache.setCategories(data);
    console.log(`[Firestore] Fetched ${data.length} categories`);
    return data;
  } catch (error: any) {
    if (error.code === 'resource-exhausted') {
      dataCache.setQuotaExceeded(true);
    }
    return handleFirestoreError(error, 'list', CATEGORIES_COLLECTION);
  }
}

export async function getCategoryById(id: string): Promise<Category | null> {
  const docSnap = await getDoc(doc(db, CATEGORIES_COLLECTION, id));
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Category;
  }
  return null;
}
