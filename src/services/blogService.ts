import { 
  collection, addDoc, updateDoc, deleteDoc, doc, getDocs, getDoc, 
  query, orderBy, where, serverTimestamp, setDoc, limit 
} from 'firebase/firestore';
import { db, handleFirestoreError } from '../lib/firebase';
import { BlogPost, BlogSettings } from '../types';
import { dataCache } from '../lib/dataCache';

const BLOGS_COLLECTION = 'blogs';
const SETTINGS_COLLECTION = 'blogSettings';
const SETTINGS_ID = 'main_config';

export async function getAllBlogs(includeDrafts = false, limitCount = 20): Promise<BlogPost[]> {
  const path = BLOGS_COLLECTION;
  
  // Only cache published blogs for general view
  if (!includeDrafts) {
    const cached = dataCache.getBlogs();
    if (cached) return cached;
  }

  if (!dataCache.canFetch(BLOGS_COLLECTION + (includeDrafts ? '_admin' : ''))) {
    return [];
  }

  try {
    let q;
    if (includeDrafts) {
      q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(limitCount));
    } else {
      q = query(
        collection(db, path), 
        where('status', '==', 'published'),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
    }
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as BlogPost));
    
    if (!includeDrafts) {
      dataCache.setBlogs(data);
    }
    
    console.log(`[Firestore] Fetched ${data.length} blogs`);
    return data;
  } catch (error: any) {
    if (error.code === 'resource-exhausted') {
      dataCache.setQuotaExceeded(true);
    }
    console.error("Error fetching blogs:", error);
    return handleFirestoreError(error, 'list', path);
  }
}

export async function getBlogBySlug(slug: string): Promise<BlogPost | null> {
  const path = BLOGS_COLLECTION;
  try {
    const q = query(collection(db, path), where('slug', '==', slug));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...(doc.data() as any) } as BlogPost;
  } catch (error) {
    console.error("Error fetching blog by slug:", error);
    return handleFirestoreError(error, 'get', `${path}/${slug}`);
  }
}

export async function createBlog(blog: Omit<BlogPost, 'id' | 'createdAt' | 'updatedAt'>) {
  const path = BLOGS_COLLECTION;
  console.log('Firestore: Attempting to create blog at', path, blog.title);
  try {
    const docRef = await addDoc(collection(db, path), {
      ...blog,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log('Firestore: Blog created successfully with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Firestore: Error creating blog:", error);
    return handleFirestoreError(error, 'create', path);
  }
}

export async function updateBlog(id: string, blog: Partial<BlogPost>) {
  const path = `${BLOGS_COLLECTION}/${id}`;
  try {
    const docRef = doc(db, BLOGS_COLLECTION, id);
    await updateDoc(docRef, {
      ...blog,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error updating blog:", error);
    return handleFirestoreError(error, 'update', path);
  }
}

export async function deleteBlog(id: string) {
  const path = `${BLOGS_COLLECTION}/${id}`;
  try {
    console.log('Attempting to delete blog:', id);
    await deleteDoc(doc(db, BLOGS_COLLECTION, id));
    console.log('Blog deleted successfully:', id);
  } catch (error) {
    console.error("Error deleting blog:", error);
    return handleFirestoreError(error, 'delete', path);
  }
}

export async function getBlogSettings(): Promise<BlogSettings | null> {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_ID);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return snap.data() as BlogSettings;
  } catch (error) {
    console.error("Error fetching blog settings:", error);
    return null;
  }
}

export async function updateBlogSettings(settings: Partial<BlogSettings>) {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_ID);
    await setDoc(docRef, settings, { merge: true });
  } catch (error) {
    console.error("Error updating blog settings:", error);
    throw error;
  }
}
