import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  getDoc, 
  setDoc,
  getDocs,
  limit,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface SupportMessage {
  id?: string;
  text: string;
  senderId: string;
  senderName: string;
  senderType: 'user' | 'admin';
  createdAt: any;
}

export interface SupportTicket {
  ticketId: string;
  userId?: string;
  username: string;
  userEmail?: string;
  telegramChatId?: string;
  category: string;
  message: string; // Initial message
  linkedOrderId?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'closed';
  createdAt: number;
  updatedAt: number;
  source: 'telegram' | 'website';
}

export async function createWebsiteTicket(data: Omit<SupportTicket, 'ticketId' | 'status' | 'createdAt' | 'updatedAt' | 'source'>) {
  const ticketId = 'T-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  const ticket: SupportTicket = {
    ...data,
    ticketId,
    status: 'pending',
    source: 'website',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  await setDoc(doc(db, 'tickets', ticketId), ticket);
  
  // Create first message
  await addDoc(collection(db, 'tickets', ticketId, 'messages'), {
    text: ticket.message,
    senderId: ticket.userId || 'guest',
    senderName: ticket.username,
    senderType: 'user',
    createdAt: serverTimestamp()
  });

  // Call API to notify admin via Telegram
  try {
    await fetch('/api/notify-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'new_ticket',
        ticketId,
        username: ticket.username,
        category: ticket.category,
        message: ticket.message,
        linkedOrderId: ticket.linkedOrderId
      })
    });
  } catch (err) {
    console.error("Failed to notify admin:", err);
  }

  return ticketId;
}

export function subscribeToMessages(ticketId: string, callback: (messages: SupportMessage[]) => void) {
  const q = query(
    collection(db, 'tickets', ticketId, 'messages'),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as SupportMessage[];
    callback(messages);
  });
}

export async function sendMessage(ticketId: string, text: string, senderId: string, senderName: string, senderType: 'user' | 'admin' = 'user') {
  const msgData = {
    text,
    senderId,
    senderName,
    senderType,
    createdAt: serverTimestamp()
  };
  
  await addDoc(collection(db, 'tickets', ticketId, 'messages'), msgData);
  await updateDoc(doc(db, 'tickets', ticketId), { updatedAt: Date.now() });

  // If it's a user message, notify admin via Telegram
  if (senderType === 'user') {
    try {
      await fetch('/api/notify-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'new_message',
          ticketId,
          username: senderName,
          text
        })
      });
    } catch (err) {
      console.error("Failed to notify admin of message:", err);
    }
  } else if (senderType === 'admin') {
      // If it's an admin message on website, and it's a telegram ticket, notify user via Telegram
      const tSnap = await getDoc(doc(db, 'tickets', ticketId));
      if (tSnap.exists()) {
          const t = tSnap.data() as SupportTicket;
          if (t.source === 'telegram' && t.telegramChatId) {
             await fetch('/api/notify-user-telegram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatId: t.telegramChatId,
                    text: `👤 <b>Support:</b> ${text}`
                })
             });
          }
      }
  }
}

export async function getUserTickets(email: string) {
    const q = query(collection(db, 'tickets'), where('userEmail', '==', email.toLowerCase().trim()), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as SupportTicket);
}

export async function deleteTicket(id: string) {
  try {
    const docRef = doc(db, 'tickets', id);
    // Delete messages subcollection first
    const msgSnap = await getDocs(collection(db, 'tickets', id, 'messages'));
    const deletePromises = msgSnap.docs.map(d => deleteDoc(d.ref));
    await Promise.all(deletePromises);
    
    // Delete ticket
    await deleteDoc(docRef);
  } catch (error: any) {
    console.error("Delete ticket failed:", error);
    throw error;
  }
}
