import { 
  doc, setDoc, getDocs, query, orderBy, serverTimestamp, collection 
} from 'firebase/firestore';
import { db, handleFirestoreError } from '../lib/firebase';
import { Subscriber } from '../types';

const SUBSCRIBERS_COLLECTION = 'subscribers';

export async function addSubscriber(email: string) {
  try {
    const cleanEmail = email.toLowerCase().trim();
    // Use email as ID to prevent duplicates and also because we don't allow general 'read' for subscribers
    const docRef = doc(db, SUBSCRIBERS_COLLECTION, cleanEmail);
    
    await setDoc(docRef, {
      email: cleanEmail,
      createdAt: serverTimestamp()
    }, { merge: true }); // Merge true so we don't lose data if we ever add more fields
    
    return cleanEmail;
  } catch (error) {
    console.error("Error adding subscriber:", error);
    return handleFirestoreError(error, 'write', SUBSCRIBERS_COLLECTION);
  }
}

export async function getAllSubscribers(): Promise<Subscriber[]> {
  try {
    const q = query(collection(db, SUBSCRIBERS_COLLECTION), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Subscriber));
  } catch (error) {
    console.error("Error fetching subscribers:", error);
    return [];
  }
}
