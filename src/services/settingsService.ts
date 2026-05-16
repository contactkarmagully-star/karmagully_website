import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError } from '../lib/firebase';
import { AppSettings } from '../types';
export type { AppSettings };

const SETTINGS_COLLECTION = 'settings';
const DEFAULT_ID = 'main';

export const DEFAULT_SETTINGS: AppSettings = {
  storeName: 'KarmaGully',
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
    whatsapp: 'https://wa.me/910000000000',
    youtube: 'https://youtube.com/@karmagully'
  },
  logoUrl: '',
  faviconUrl: '',
  supportBotUrl: 'https://t.me/KarmaGullySupportBot',
  quickLinks: [
    { label: 'My Orders', url: '/profile' },
    { label: 'Shipping FAQ', url: '/page/shipping-delivery' },
    { label: 'Return Policy', url: '/page/return-replacement-policy' }
  ],
  homeSections: [],
  loyalty: {
    isCodVerificationEnabled: true,
    codVerificationAmount: 99,
    autoApproveTrustedBuyer: true,
    badgesEnabled: true,
    badgeNames: {
      trusted: 'Trusted Buyer',
      collector: 'Verified Collector',
      elite: 'Elite Drop Member'
    }
  },
  features: {
    recommendations: true,
    wishlist: true,
    limitedDrops: false,
    trustBadges: true,
    showStockOnThumbnails: true,
    showStockOnDetails: true,
    showLimitedBadgeOnThumbnails: true,
    reviews: true,
    videoSection: false,
    variantImages: true
  },
  trustBadgesContent: {
    quality: true,
    resistant: true,
    easyMount: true,
    cod: true
  }
};

export function subscribeToSettings(callback: (settings: AppSettings) => void) {
  const docRef = doc(db, SETTINGS_COLLECTION, DEFAULT_ID);
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      callback({
        ...DEFAULT_SETTINGS,
        ...data,
        flashSale: { ...DEFAULT_SETTINGS.flashSale, ...data.flashSale },
        socialLinks: { ...DEFAULT_SETTINGS.socialLinks, ...(data.socialLinks || {}) },
        quickLinks: data.quickLinks || DEFAULT_SETTINGS.quickLinks,
        homeSections: data.homeSections || DEFAULT_SETTINGS.homeSections,
        loyalty: { ...DEFAULT_SETTINGS.loyalty, ...data.loyalty },
        features: { ...DEFAULT_SETTINGS.features, ...data.features },
        trustBadgesContent: { ...DEFAULT_SETTINGS.trustBadgesContent, ...data.trustBadgesContent }
      } as AppSettings);
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
      const data = docSnap.data();
      return {
        ...DEFAULT_SETTINGS,
        ...data,
        flashSale: { ...DEFAULT_SETTINGS.flashSale, ...data.flashSale },
        socialLinks: { ...DEFAULT_SETTINGS.socialLinks, ...(data.socialLinks || {}) },
        quickLinks: data.quickLinks || DEFAULT_SETTINGS.quickLinks,
        homeSections: data.homeSections || DEFAULT_SETTINGS.homeSections,
        loyalty: { ...DEFAULT_SETTINGS.loyalty, ...data.loyalty },
        features: { ...DEFAULT_SETTINGS.features, ...data.features },
        trustBadgesContent: { ...DEFAULT_SETTINGS.trustBadgesContent, ...data.trustBadgesContent }
      } as AppSettings;
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
