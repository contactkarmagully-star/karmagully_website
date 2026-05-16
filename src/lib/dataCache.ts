
import { Category, Product, BlogPost, Order } from '../types';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class DataCache {
  private products: CacheEntry<Product[]> | null = null;
  private categories: CacheEntry<Category[]> | null = null;
  private blogs: CacheEntry<BlogPost[]> | null = null;
  private orders: CacheEntry<Order[]> | null = null;
  private cacheDuration = 1000 * 60 * 2; // 2 minutes cache (reduced from 5)

  private fetchTimestamps: Record<string, number> = {};
  public SAFE_MODE = true;
  private MIN_FETCH_INTERVAL = 1000; // 1 second between fetches (reduced from 5)

  private isQuotaExceeded = false;

  setProducts(data: Product[]) {
    this.products = { data, timestamp: Date.now() };
  }

  getProducts(): Product[] | null {
    if (this.products && (Date.now() - this.products.timestamp < this.cacheDuration)) {
      console.log('[Cache] Hit: products');
      return this.products.data;
    }
    return null;
  }

  setCategories(data: Category[]) {
    this.categories = { data, timestamp: Date.now() };
  }

  getCategories(): Category[] | null {
    if (this.categories && (Date.now() - this.categories.timestamp < this.cacheDuration)) {
      console.log('[Cache] Hit: categories');
      return this.categories.data;
    }
    return null;
  }

  setBlogs(data: BlogPost[]) {
    this.blogs = { data, timestamp: Date.now() };
  }

  getBlogs(): BlogPost[] | null {
    if (this.blogs && (Date.now() - this.blogs.timestamp < this.cacheDuration)) {
      console.log('[Cache] Hit: blogs');
      return this.blogs.data;
    }
    return null;
  }

  setOrders(data: Order[]) {
    this.orders = { data, timestamp: Date.now() };
  }

  getOrders(): Order[] | null {
    if (this.orders && (Date.now() - this.orders.timestamp < this.cacheDuration)) {
      console.log('[Cache] Hit: orders');
      return this.orders.data;
    }
    return null;
  }

  canFetch(label: string): boolean {
    if (this.isQuotaExceeded) {
      console.warn(`[Blocked] Quota exceeded. Skipping fetch for ${label}`);
      return false;
    }
    
    if (!this.SAFE_MODE) return true;

    const now = Date.now();
    const lastFetch = this.fetchTimestamps[label] || 0;
    
    if (now - lastFetch < this.MIN_FETCH_INTERVAL) {
      console.warn(`[Safe Mode] Throttled fetch for ${label}. Please wait.`);
      return false;
    }

    this.fetchTimestamps[label] = now;
    return true;
  }

  setQuotaExceeded(status: boolean) {
    this.isQuotaExceeded = status;
    if (status) {
      console.error('[Firebase] Quota limit reached. Data fetching disabled.');
    }
  }

  getIsQuotaExceeded() {
    return this.isQuotaExceeded;
  }

  clear() {
    this.products = null;
    this.categories = null;
    this.blogs = null;
    this.orders = null;
    this.fetchTimestamps = {};
  }
}

export const dataCache = new DataCache();
