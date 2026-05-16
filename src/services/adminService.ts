import { 
  collection, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  doc, 
  query, 
  where,
  getDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError } from '../lib/firebase';

const COLLECTION_NAME = 'admins';

export interface Admin {
  id: string; // This will be the user UID
  email: string;
  addedAt: any;
}

export async function getAllAdmins(): Promise<Admin[]> {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Admin));
  } catch (error) {
    return handleFirestoreError(error, 'list', COLLECTION_NAME);
  }
}

export async function addAdmin(uid: string, email: string) {
  try {
    const docRef = doc(db, COLLECTION_NAME, uid);
    await setDoc(docRef, {
      email,
      addedAt: serverTimestamp()
    });
    return uid;
  } catch (error) {
    return handleFirestoreError(error, 'create', COLLECTION_NAME);
  }
}

export async function removeAdmin(uid: string) {
  try {
    console.log("Removing admin:", uid);
    await deleteDoc(doc(db, COLLECTION_NAME, uid));
    const { dataCache } = await import('../lib/dataCache');
    dataCache.clear();
  } catch (error) {
    return handleFirestoreError(error, 'delete', `${COLLECTION_NAME}/${uid}`);
  }
}

export async function isUserAdmin(uid: string, email: string): Promise<boolean> {
  // Bootstrap email check
  if (email === 'c.b.sharma321@gmail.com') return true;

  try {
    const docRef = doc(db, COLLECTION_NAME, uid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists();
  } catch (error) {
    console.error("Admin check failed:", error);
    return false;
  }
}
