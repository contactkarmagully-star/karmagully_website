import { 
  collection, 
  getDocs, 
  getDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp,
  limit,
  increment,
  getDocsFromServer,
  writeBatch
} from 'firebase/firestore';
import { db, handleFirestoreError } from '../lib/firebase';
import { Product, Review, ProductVideo } from '../types';
import { dataCache } from '../lib/dataCache';

const COLLECTION_NAME = 'products';

// ... (existing code, I'll find where to insert bulkAddReviews)

export async function bulkAddReviews(reviews: Omit<Review, 'id' | 'createdAt' | 'status'>[]) {
  try {
    const batch = writeBatch(db);
    reviews.forEach(review => {
      const docRef = doc(collection(db, 'reviews'));
      batch.set(docRef, {
        ...review,
        status: 'approved',
        createdAt: serverTimestamp()
      });
    });
    await batch.commit();
    dataCache.clear();
  } catch (error) {
    return handleFirestoreError(error, 'write', 'reviews');
  }
}

export async function bulkAddProducts(products: Omit<Product, 'id' | 'createdAt'>[]) {
  try {
    const batch = writeBatch(db);
    products.forEach(product => {
      // Filter out undefined values
      const cleanProduct = Object.fromEntries(
        Object.entries(product).filter(([_, v]) => v !== undefined)
      );
      const docRef = doc(collection(db, COLLECTION_NAME));
      batch.set(docRef, {
        ...cleanProduct,
        createdAt: serverTimestamp()
      });
    });
    await batch.commit();
    dataCache.clear();
  } catch (error) {
    return handleFirestoreError(error, 'write', COLLECTION_NAME);
  }
}

export async function getAllProducts(limitCount: number = 100, forceRefresh: boolean = false): Promise<Product[]> {
  // Check cache first (ignore if forceRefresh is true)
  const cached = dataCache.getProducts();
  if (cached && cached.length > 0 && !forceRefresh) return cached;

  // We skip canFetch check if we have 0 products and we really need them
  if (!dataCache.canFetch(COLLECTION_NAME) && cached && cached.length > 0) {
    return cached;
  }

  try {
    let q = query(
      collection(db, COLLECTION_NAME), 
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    
    let snapshot = await getDocs(q);
    
    // Fallback 1: If no results from general getDocs, try from server specifically
    if (snapshot.empty) {
      console.warn(`[Firestore] No products found in default cache/fetch. Trying getDocsFromServer.`);
      snapshot = await getDocsFromServer(q);
    }

    // Fallback 2: If still no results, try without ordering
    if (snapshot.empty) {
      console.warn(`[Firestore] No products found with orderBy. Trying simple server fetch.`);
      q = query(collection(db, COLLECTION_NAME), limit(limitCount));
      snapshot = await getDocsFromServer(q);
    }

    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
    
    // Always update cache if we got data or if we specifically fetched from server
    if (data.length > 0 || !snapshot.metadata.fromCache) {
      dataCache.setProducts(data);
    }
    
    console.log(`[Firestore] Fetched ${data.length} products (fromCache: ${snapshot.metadata.fromCache})`);
    return data;
  } catch (error: any) {
    // If it's a field error (like orderBy on non-existent field), try simple fetch
    try {
      console.warn(`[Firestore] Failed with complex query, falling back to simple server fetch.`);
      const q = query(collection(db, COLLECTION_NAME), limit(limitCount));
      const snapshot = await getDocsFromServer(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      dataCache.setProducts(data);
      return data;
    } catch (innerError) {
      if (error.code === 'resource-exhausted') {
        dataCache.setQuotaExceeded(true);
      }
      return handleFirestoreError(error, 'list', COLLECTION_NAME);
    }
  }
}

export async function getProductById(id: string): Promise<Product | null> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      return { id: snapshot.id, ...snapshot.data() } as Product;
    }
    return null;
  } catch (error) {
    return handleFirestoreError(error, 'get', `${COLLECTION_NAME}/${id}`);
  }
}

export async function addProduct(product: Omit<Product, 'id' | 'createdAt'>) {
  try {
    // Filter out undefined values
    const cleanProduct = Object.fromEntries(
      Object.entries(product).filter(([_, v]) => v !== undefined)
    );
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...cleanProduct,
      createdAt: serverTimestamp()
    });
    dataCache.clear();
    return docRef.id;
  } catch (error) {
    return handleFirestoreError(error, 'create', COLLECTION_NAME);
  }
}

export async function updateProduct(id: string, updates: Partial<Product>) {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    // Filter out undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await updateDoc(docRef, cleanUpdates);
    dataCache.clear();
  } catch (error) {
    return handleFirestoreError(error, 'update', `${COLLECTION_NAME}/${id}`);
  }
}

export async function deleteProduct(id: string) {
  try {
    console.log("Deleting product:", id);
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
    dataCache.clear();
  } catch (error) {
    return handleFirestoreError(error, 'delete', `${COLLECTION_NAME}/${id}`);
  }
}

export async function incrementWishlistCount(id: string) {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      wishlistCount: increment(1)
    });
  } catch (error) {
    console.error("Silent wishlist increment fail:", error);
  }
}

export async function incrementSoldCount(id: string, quantity: number) {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      soldCount: increment(quantity),
      stock: increment(-quantity)
    });
    dataCache.clear();
  } catch (error) {
    return handleFirestoreError(error, 'update', `${COLLECTION_NAME}/${id}`);
  }
}

export async function checkStockAvailability(items: { productId: string, quantity: number, name: string }[]): Promise<{ available: boolean, error?: string }> {
  try {
    const fetchPromises = items.map(item => getDoc(doc(db, COLLECTION_NAME, item.productId)));
    const snapshots = await Promise.all(fetchPromises);
    
    for (let i = 0; i < snapshots.length; i++) {
      const snap = snapshots[i];
      const requested = items[i].quantity;
      const name = items[i].name;
      
      if (!snap.exists()) {
        return { available: false, error: `Product "${name}" no longer exists in our vault.` };
      }
      
      const product = snap.data() as Product;
      if (product.stock < requested) {
        if (product.stock <= 0) {
          return { available: false, error: `"${name}" just sold out! Please remove it to proceed.` };
        }
        return { available: false, error: `Only ${product.stock} units of "${name}" left in stock.` };
      }
    }
    
    return { available: true };
  } catch (error) {
    console.error("Stock check error:", error);
    return { available: false, error: "Authentication with inventory vault failed. Please try again." };
  }
}

// --- Reviews ---

export async function getProductReviews(productId: string): Promise<Review[]> {
  try {
    const q = query(
      collection(db, 'reviews'),
      where('productId', '==', productId),
      where('status', '==', 'approved'),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
  } catch (error) {
    return handleFirestoreError(error, 'list', 'reviews');
  }
}

export async function getAllReviews(): Promise<Review[]> {
  try {
    const q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
  } catch (error) {
    return handleFirestoreError(error, 'list', 'reviews');
  }
}

export async function addReview(review: Omit<Review, 'id' | 'createdAt' | 'status'>) {
  try {
    // Filter out undefined values
    const cleanReview = Object.fromEntries(
      Object.entries(review).filter(([_, v]) => v !== undefined)
    );
    await addDoc(collection(db, 'reviews'), {
      ...cleanReview,
      status: 'approved', // Auto-approve for instant visibility
      createdAt: serverTimestamp()
    });
    dataCache.clear();
  } catch (error) {
    return handleFirestoreError(error, 'create', 'reviews');
  }
}

export async function updateReviewStatus(id: string, status: 'approved' | 'rejected') {
  try {
    const docRef = doc(db, 'reviews', id);
    await updateDoc(docRef, { status });
    dataCache.clear();
  } catch (error) {
    return handleFirestoreError(error, 'update', `reviews/${id}`);
  }
}

export async function deleteReview(id: string) {
  try {
    console.log("Deleting review:", id);
    const docRef = doc(db, 'reviews', id);
    await deleteDoc(docRef);
    dataCache.clear();
  } catch (error) {
    return handleFirestoreError(error, 'delete', `reviews/${id}`);
  }
}

// --- Product Videos ---

export async function getProductVideos(productId: string): Promise<ProductVideo[]> {
  try {
    const q = query(
      collection(db, 'productVideos'),
      where('productId', '==', productId),
      orderBy('order', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductVideo));
  } catch (error) {
    return handleFirestoreError(error, 'list', 'productVideos');
  }
}

export async function getAllProductVideos(limitCount: number = 20): Promise<ProductVideo[]> {
  try {
    const q = query(
      collection(db, 'productVideos'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductVideo));
  } catch (error) {
    return handleFirestoreError(error, 'list', 'productVideos');
  }
}

export async function addProductVideo(video: Omit<ProductVideo, 'id' | 'createdAt'>) {
  try {
    // Ensure productId is either a string or nulled out correctly for general reels
    const videoData = {
      ...video,
      productId: video.productId || null,
      createdAt: serverTimestamp()
    };
    
    await addDoc(collection(db, 'productVideos'), videoData);
    dataCache.clear();
  } catch (error) {
    return handleFirestoreError(error, 'create', 'productVideos');
  }
}

export async function deleteProductVideo(id: string) {
  try {
    console.log("Deleting video:", id);
    const docRef = doc(db, 'productVideos', id);
    await deleteDoc(docRef);
    dataCache.clear();
  } catch (error) {
    return handleFirestoreError(error, 'delete', `productVideos/${id}`);
  }
}
