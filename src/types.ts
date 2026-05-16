export interface Variant {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  additionalImages?: string[];
}

export interface Category {
  id: string;
  name: string;
  imageUrl: string;
  createdAt: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  imageUrl: string; // Still main thumbnail
  publicId?: string; // For Cloudinary image deletion
  images: string[]; // Additional images
  videoUrls?: string[]; // Multiple videos
  category: string; // Keep for backward compatibility/legacy main category
  categories?: string[]; // Array of Category IDs
  isCOD: boolean;
  stock: number;
  featured?: boolean;
  variants?: Variant[];
  createdAt: number;
  // Growth Features
  isLimitedDrop?: boolean;
  dropQuantity?: number;
  soldCount?: number;
  wishlistCount?: number;
  isTrending?: boolean;
  isNewArrival?: boolean;
}

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
  youtube?: string;
}

export interface HomeSection {
  id: string;
  title: string;
  productIds: string[];
  order: number;
}

export interface AppSettings {
  storeName: string;
  announcement: string;
  showAnnouncement: boolean;
  flashSale: FlashSale;
  socialLinks: SocialLinks;
  logoUrl: string;
  faviconUrl: string;
  primaryDomain?: string; // e.g. https://karmagully.com
  supportBotUrl?: string;
  quickLinks?: { label: string; url: string; }[];
  homeSections?: HomeSection[];
  loyalty?: {
    isCodVerificationEnabled: boolean;
    codVerificationAmount: number;
    autoApproveTrustedBuyer: boolean;
    badgesEnabled: boolean;
    badgeNames: {
      trusted: string;
      collector: string;
      elite: string;
    };
  };
  // Feature Flags
  features: {
    recommendations: boolean;
    wishlist: boolean;
    limitedDrops: boolean;
    trustBadges: boolean;
    showStockOnThumbnails: boolean;
    showStockOnDetails: boolean;
    showLimitedBadgeOnThumbnails: boolean;
    reviews: boolean;
    videoSection: boolean;
    variantImages: boolean;
  };
  trustBadgesContent: {
    quality: boolean;
    resistant: boolean;
    easyMount: boolean;
    cod: boolean;
  };
}

export interface Order {
  id: string;
  userId?: string; // Link to customer account
  profileId?: string; // UNIQUE ID
  items: OrderItem[];
  totalAmount: number;
  advancePaid?: number;
  isCodVerified?: boolean;
  customerInfo: CustomerInfo;
  address: Address;
  paymentType: 'COD' | 'Online';
  paymentStatus: 'Pending' | 'Success' | 'Failed';
  orderStatus: 'Pending' | 'Confirmed' | 'Shipped' | 'Delivered';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  trackingId?: string;
  deliveryPartner?: string;
  createdAt: number;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  variantName?: string;
  imageUrl?: string;
}

export interface CustomerInfo {
  fullName: string;
  phone: string;
  email: string;
  alternatePhone?: string;
}

export interface Address {
  fullAddress: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
}

export interface Ticket {
  id: string; // The firestore ID
  ticketId: string; // Human readable ID
  userId?: string;
  username: string;
  userEmail?: string;
  telegramChatId?: string;
  category: string;
  message: string;
  linkedOrderId?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'closed';
  createdAt: number;
  updatedAt: number;
  source: 'telegram' | 'website';
}

export interface SupportMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderType: 'user' | 'admin';
  createdAt: number;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  coverImage?: string;
  coverImageAlt?: string;
  category?: string;
  tags?: string[];
  seoKeywords?: string[];
  metaDescription?: string;
  schemaMarkup?: any;
  faq?: { question: string; answer: string }[];
  status: 'draft' | 'published';
  isAiGenerated?: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface BlogSettings {
  isAutoEnabled: boolean;
  intervalDays: number;
  lastPostAt?: number;
  targetTopics?: string[];
  promptStyle?: string;
}

export interface Subscriber {
  id: string;
  email: string;
  createdAt: any;
}

export interface Review {
  id: string;
  productId: string;
  rating: number;
  name: string;
  comment: string;
  imageUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
}

export interface ProductVideo {
  id: string;
  productId?: string;
  videoUrl: string;
  order: number;
  createdAt: number;
}

export interface CourierPartner {
  id: string;
  name: string;
  logoUrl: string;
  isActive: boolean;
  createdAt: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  isTrustedBuyer?: boolean;
  loyaltyStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  trustStats?: {
    deliveredCodOrders: number;
    successfulPrepaidOrders: number;
  };
  badge?: string;
  loyaltyTier?: number; // 1: Trusted, 2: Collector, 3: Elite
  profileId?: string;
  createdAt: number;
}
