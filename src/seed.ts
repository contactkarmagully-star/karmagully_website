import { db } from './lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const samples = [
  {
    name: "Classic Naruto Metal Poster",
    price: 1499,
    category: "Naruto",
    description: "High-definition metal print of Naruto Uzumaki in sage mode. Premium matte finish.",
    imageUrl: "https://images.unsplash.com/photo-1580477667995-2b94f01c9516?q=80&w=2070&auto=format&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1618336753974-aae8e04506aa?q=80&w=2070&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1613373173733-5188e63a3528?q=80&w=2070&auto=format&fit=crop"
    ],
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    stock: 50,
    isCOD: true,
    featured: true,
    variants: [
      { id: "v1", name: "A4 Size", price: 1499 },
      { id: "v2", name: "A3 Size", price: 2499 },
      { id: "v3", name: "A2 Size", price: 3999 }
    ]
  },
  {
    name: "Luffy Gear 5 Edition",
    price: 1699,
    category: "One Piece",
    description: "Iconic Gear 5 awakening. Vibrant white and purple highlights on aircraft-grade aluminum.",
    imageUrl: "https://images.unsplash.com/photo-1613373173733-5188e63a3528?q=80&w=2070&auto=format&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1580477667995-2b94f01c9516?q=80&w=2070&auto=format&fit=crop"
    ],
    stock: 100,
    isCOD: true,
    featured: true,
    variants: [
      { id: "v4", name: "Standard", price: 1699 },
      { id: "v5", name: "Limited Gloss", price: 1999 }
    ]
  }
];

export async function seedProducts() {
  const productsCol = collection(db, 'products');
  for (const product of samples) {
    await addDoc(productsCol, {
      ...product,
      createdAt: serverTimestamp()
    });
  }
  console.log('Sample products seeded!');
}
