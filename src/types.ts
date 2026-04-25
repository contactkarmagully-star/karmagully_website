export interface Variant {
  id: string;
  name: string; // e.g. "A4 Size", "A3 Size"
  price: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  imageUrl: string; // Still main thumbnail
  images: string[]; // Additional images
  videoUrl?: string; // Video URL
  category: string;
  isCOD: boolean;
  stock: number;
  featured?: boolean;
  variants?: Variant[];
  createdAt: number;
}

export interface Order {
  id: string;
  userId?: string; // Link to customer account
  items: OrderItem[];
  totalAmount: number;
  customerInfo: CustomerInfo;
  address: Address;
  paymentType: 'COD' | 'Online';
  paymentStatus: 'Pending' | 'Success' | 'Failed';
  orderStatus: 'Pending' | 'Confirmed' | 'Shipped' | 'Delivered';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
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
  alternatePhone?: string;
}

export interface Address {
  fullAddress: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
}
