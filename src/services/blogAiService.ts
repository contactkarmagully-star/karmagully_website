import { collection, query, limit, getDocs, where, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Product } from "../types";
import { GoogleGenAI, Type } from "@google/genai";

const apiKey = import.meta.env.VITE_GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
const genAI = new GoogleGenAI({ apiKey: apiKey as string });

// Helper to fetch products directly with a limit to avoid fetching the entire catalog
async function getProductsForContext(max: number = 10): Promise<Product[]> {
  try {
    const q = query(collection(db, "products"), limit(max));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
  } catch (error) {
    console.error("Error fetching context products:", error);
    return [];
  }
}

async function getLatestBlogsForLinking(max: number = 2): Promise<{title: string, slug: string}[]> {
  try {
    // Only link published blogs
    const q = query(
      collection(db, "blogs"), 
      where('status', '==', 'published'),
      orderBy('createdAt', 'desc'), 
      limit(max)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ title: doc.data().title, slug: doc.data().slug }));
  } catch (error) {
    console.error("Error fetching blogs for linking:", error);
    return [];
  }
}

export async function generateBlogTopics(niche: string = "Anime Metal Posters") {
  if (!apiKey) {
    throw new Error("Google AI API Key (VITE_GOOGLE_API_KEY) is missing. Please add it to your environment variables.");
  }
  
  const products = await getProductsForContext(5);
  const productNames = products.map(p => p.name).join(", ");

  const prompt = `You are an API. You MUST return ONLY valid JSON.
    TASK: Suggest 5 catchy, high-CTR blog titles for niche: ${niche}
    Existing Products for context: ${productNames}
    FORMAT: ["Title 1", "Title 2", "Title 3", "Title 4", "Title 5"]`;

  try {
    const result = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    const text = result.text;
    if (!text) throw new Error("AI returned no content");
    const cleaned = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (error: any) {
    console.error("AI Topic Generation Error:", error.message);
    throw new Error("Failed to research topics. Please try again.");
  }
}

export async function generateCompleteBlogPost(topic: string) {
  if (!apiKey) throw new Error("Google AI API Key (VITE_GOOGLE_API_KEY) is missing.");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const products = await getProductsForContext(30);
    const productList = products.map(p => p.name).join(", ");

    const prompt = `You are a premium AI content engine for KarmaGully, a brand selling high-end anime metal posters.
      Return ONLY a valid JSON object. NO extra text.
      
      TOPIC: "${topic}"
      
      CONTENT RULES:
      - 1000-1500 words Markdown content.
      - TONE: Premium, modern, slightly edgy (Gen Z anime audience).
      - FORMAT: Use short paragraphs (2-4 lines).
      - LISTS: Use bullet points (⚡) or numbered lists. 
      - CRITICAL: You MUST put EXACTLY TWO NEWLINE characters (\n\n) between every single list item. NEVER merge list items into a single block. Failure to do this will break the UI.
      - [PRODUCT: name] markers naturally (Max 2 total).
      - Do NOT include the FAQ section inside the "content" string.
      
      STRICT JSON FORMAT:
      {
        "title": "SEO Optimized Title",
        "slug": "seo-friendly-slug",
        "meta_description": "First paragraph style meta description",
        "content": "Full markdown content with [PRODUCT:...] and [COLLECTION:...] markers",
        "products": ["Name 1", "Name 2"],
        "collections": ["Name 1"],
        "faq": [
          { "question": "Are KarmaGully posters durable?", "answer": "Detailed answer about metal print quality..." }
        ]
      }`;

    const result = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    const fullResponse = result.text;
    
    if (!fullResponse) throw new Error("AI returned void.");
    
    const cleaned = fullResponse.replace(/```json|```/g, '').trim();
    const data = JSON.parse(cleaned);

    // Backend enrichment
    const enriched = await postProcessBlog(data);
    
    clearTimeout(timeoutId);
    return enriched;

  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error("Forging Error:", error);
    throw new Error(error.message || "Failed to forge premium content.");
  }
}

/**
 * Generates SEO-optimized alt text for an image description or tag
 */
export async function generateAltText(description: string): Promise<string> {
  const prompt = `You are an SEO expert for KarmaGully. 
  Generate a single, concise, and descriptive ALT TEXT (max 10 words) for an anime metal poster blog image based on this context: "${description}".
  Focus on keywords like "anime wall art", "metal poster", and "room decor". 
  Return ONLY the alt text string, nothing else.`;

  try {
    const result = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    return result.text?.trim() || description;
  } catch (err: any) {
    console.error("Alt text gen failed:", err);
    // If it's a rate limit or similar, return a cleaned version of description as fallback
    return description.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
  }
}

/**
 * Enriches AI placeholders with real links and assets
 */
async function postProcessBlog(data: any) {
  const products = await getProductsForContext(40);
  let content = data.content;

  // Resolve Products
  content = content.replace(/\[PRODUCT: (.*?)\]/g, (match: string, name: string) => {
    const trimmedName = name.trim();
    const product = products.find(p => 
      p.name.toLowerCase().includes(trimmedName.toLowerCase()) || 
      trimmedName.toLowerCase().includes(p.name.toLowerCase())
    );

    if (product) {
      return `\n\n[PRODUCT: ${product.id} | ${product.id} | ${product.name} | ${product.imageUrl}]\n\n`;
    }
    return `**${trimmedName}**`;
  });

  // Resolve Collections (Simple link badge)
  content = content.replace(/\[COLLECTION: (.*?)\]/g, (match: string, name: string) => {
    return `\n\n[COLLECTION_LINK: ${name.trim()}]\n\n`;
  });

  // Append Related Blogs (Last 2)
  try {
    const lastBlogs = await getLatestBlogsForLinking(2);
    if (lastBlogs && lastBlogs.length > 0) {
      content += `\n\n---\n\n### ⚡ Trending Now: Check Out Our Latest Blogs\n\nDiscover more anime insights and style guides from our recent posts:\n\n`;
      lastBlogs.forEach(blog => {
        content += `- **[${blog.title}](/blog/${blog.slug})**\n`;
      });
      content += `\n\n---\n`;
    }
  } catch (err) {
    console.error("Failed to link related blogs:", err);
  }

  return {
    title: data.title,
    slug: data.slug,
    content: content,
    excerpt: data.meta_description,
    metaDescription: data.meta_description,
    seoKeywords: data.image_suggestions || [],
    faq: data.faq || [],
    schemaMarkup: {},
    suggestedThumbnail: ''
  };
}

export async function generateBlogImage(topic: string) {
  // Use a direct Unsplash URL structure (this is a placeholder for a real search or static high-quality art)
  // Since we want direct JPGs, we'll suggest a fixed high-quality anime art image or similar if we can't search dynamically without an API
  const keywords = encodeURIComponent(topic + " anime art aesthetic");
  // Using a more reliable Unsplash URL structure that is direct
  return `https://images.unsplash.com/photo-1541560052-5e117f48b0b8?q=80&w=1200&auto=format&fit=crop`; // Default professional fallback
}
