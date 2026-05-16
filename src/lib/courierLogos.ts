import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { CourierPartner } from '../types';

/**
 * Fallback Courier Logo Mapping
 * Used if Firestore record is missing or partner is not yet registered in CMS.
 */
export const COURIER_LOGOS: Record<string, string> = {
  "blue dart": "https://logo.clearbit.com/bluedart.com",
  "delhivery": "https://logo.clearbit.com/delhivery.com",
  "dtdc": "https://logo.clearbit.com/dtdc.in",
  "xpressbees": "https://logo.clearbit.com/xpressbees.com",
  "india post": "https://logo.clearbit.com/indiapost.gov.in",
  "ecom express": "https://logo.clearbit.com/ecomexpress.in",
  "shadowfax": "https://logo.clearbit.com/shadowfax.in",
  "ekart": "https://logo.clearbit.com/ekartlogistics.com"
};

/**
 * Static mapping lookup for fallback
 */
export const getFallbackLogo = (partnerName: string): string | null => {
  if (!partnerName) return null;
  const normalized = partnerName.toLowerCase().trim();
  
  if (normalized.includes('delhivery')) return COURIER_LOGOS['delhivery'];
  if (normalized.includes('blue dart') || normalized.includes('bluedart')) return COURIER_LOGOS['blue dart'];
  if (normalized.includes('dtdc')) return COURIER_LOGOS['dtdc'];
  if (normalized.includes('xpress') || normalized.includes('xb')) return COURIER_LOGOS['xpressbees'];
  if (normalized.includes('india post') || normalized.includes('indiapost')) return COURIER_LOGOS['india post'];
  if (normalized.includes('ecom')) return COURIER_LOGOS['ecom express'];
  if (normalized.includes('shadowfax')) return COURIER_LOGOS['shadowfax'];
  if (normalized.includes('ekart')) return COURIER_LOGOS['ekart'];
  
  return null;
};

/**
 * Dynamic Courier Logo Hook
 * Priority: Firestore Managed Logo > Fallback Static Logo > null
 */
export function useCourierLogo(partnerName: string | undefined) {
  const [logoUrl, setLogoUrl] = useState<string | null>(partnerName ? getFallbackLogo(partnerName) : null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!partnerName) {
      setLogoUrl(null);
      return;
    }

    const fetchLogo = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'courierPartners'), 
          where('name', '==', partnerName),
          where('isActive', '==', true)
        );
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const data = snapshot.docs[0].data() as CourierPartner;
          setLogoUrl(data.logoUrl);
        } else {
          // Try case-insensitive or keywords via fallback
          setLogoUrl(getFallbackLogo(partnerName));
        }
      } catch (err) {
        console.error("Error fetching dynamic courier logo:", err);
        setLogoUrl(getFallbackLogo(partnerName));
      } finally {
        setLoading(false);
      }
    };

    fetchLogo();
  }, [partnerName]);

  return { logoUrl, loading };
}

// Deprecated in favor of useCourierLogo but kept for compatibility
export const getCourierLogo = getFallbackLogo;
