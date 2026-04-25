import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError } from '../lib/firebase';

export interface FlashSale {
  isActive: boolean;
  title: string;
  endTime: string;
  discountText: string;
}

export interface SocialLinks {
  instagram: string;
  twitter: string;
  facebook: string;
  telegram: string;
  whatsapp: string;
}

export interface AppSettings {
  announcement: string;
  showAnnouncement: boolean;
  flashSale: FlashSale;
  socialLinks: SocialLinks;
  logoUrl: string;
  faviconUrl: string;
}

const SETTINGS_COLLECTION = 'settings';
const DEFAULT_ID = 'main';

export const DEFAULT_SETTINGS: AppSettings = {
  announcement: 'FREE SHIPPING ON ORDERS OVER ₹1999',
  showAnnouncement: true,
  flashSale: {
    isActive: false,
    title: 'SUMMER DROP 24',
    endTime: '',
    discountText: '30% OFF ALL POSTERS'
  },
  socialLinks: {
    instagram: 'https://instagram.com/karmagully',
    twitter: 'https://twitter.com/karmagully',
    facebook: 'https://facebook.com/karmagully',
    telegram: 'https://t.me/karmagully',
    whatsapp: 'https://wa.me/910000000000'
  },
  logoUrl: '',
  faviconUrl: ''
};

export function subscribeToSettings(callback: (settings: AppSettings) => void) {
  const docRef = doc(db, SETTINGS_COLLECTION, DEFAULT_ID);
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data() as AppSettings);
    } else {
      callback(DEFAULT_SETTINGS);
    }
  });
}

export async function getSettings(): Promise<AppSettings> {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, DEFAULT_ID);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as AppSettings;
    }
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error("Error getting settings:", error);
    return DEFAULT_SETTINGS;
  }
}

export async function updateSettings(settings: AppSettings) {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, DEFAULT_ID);
    await setDoc(docRef, settings);
  } catch (error) {
    return handleFirestoreError(error, 'write', `${SETTINGS_COLLECTION}/${DEFAULT_ID}`);
  }
}
