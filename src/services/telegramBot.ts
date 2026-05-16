import TelegramBot from 'node-telegram-bot-api';
import admin from 'firebase-admin';
import { getFirebaseAdmin } from '../lib/firebaseAdmin.js';

let bot: TelegramBot;
const token = process.env.TELEGRAM_BOT_TOKEN_SUPPORT;
const adminId = process.env.ADMIN_TELEGRAM_ID;

const CATEGORIES: { [key: string]: string } = {
  'Product Inquiry': '📦 Product Inquiry',
  'Shipping': '🚚 Shipping & Delivery',
  'Refund': '💰 Return & Refund',
  'Order Status': '🔍 Order Status',
  'Other': '❓ Other Issue'
};

async function getBotState(chatId: number) {
  const admin = getFirebaseAdmin();
  if (!admin) return null;
  const db = admin.db;
  const snap = await db.collection('botStates').doc(chatId.toString()).get();
  return snap.exists ? snap.data() : null;
}

async function setBotState(chatId: number, state: any) {
  const admin = getFirebaseAdmin();
  if (!admin) return;
  const db = admin.db;
  if (state === null) {
    await db.collection('botStates').doc(chatId.toString()).delete();
  } else {
    await db.collection('botStates').doc(chatId.toString()).set(state);
  }
}

export function sendBotMessage(chatId: string | number, text: string) {
  if (bot) {
    bot.sendMessage(chatId, text, { parse_mode: 'HTML' }).catch(err => {
      console.error(`[TelegramBot] Failed to send message to ${chatId}:`, err.message);
    });
  } else {
    console.warn("[TelegramBot] Bot not initialized. Cannot send message.");
  }
}

export async function initBot() {
  if (!token) {
    console.warn("TELEGRAM_BOT_TOKEN_SUPPORT not set. Support bot disabled.");
    return;
  }

  if (bot) {
    console.log("Shutting down existing bot instance...");
    try {
      await bot.stopPolling();
    } catch (err) {
      console.error("Error stopping bot polling:", err);
    }
  }

  // Pre-emptive stop of any existing webhooks that might conflict
  const tempBot = new TelegramBot(token);
  try {
    await tempBot.deleteWebHook();
  } catch (e) {
    // Ignore errors here
  }

  // Add a small delay to ensure previous process has released the connection
  await new Promise(resolve => setTimeout(resolve, 1000));

  bot = new TelegramBot(token, { 
    polling: {
      autoStart: true,
      params: {
        timeout: 10
      }
    } 
  });

  bot.on('polling_error', (error: any) => {
    // Ignore "terminated by other getUpdates request" and ECONNRESET as they are common during restarts/network blips
    const isCommonError = error.message.includes('terminated by other getUpdates request') || 
                         error.message.includes('ECONNRESET') || 
                         error.message.includes('EFATAL');
    
    if (error.message.includes('409 Conflict') || error.message.includes('401 Unauthorized')) {
      console.warn(`[TelegramBot] Critical Polling alert: ${error.message}`);
    } else if (!isCommonError) {
      console.error(`[TelegramBot] Polling error: ${error.message}`);
    }
  });

  // Handle process termination
  process.once('SIGINT', () => bot?.stopPolling());
  process.once('SIGTERM', () => bot?.stopPolling());

  bot.on('error', (error) => {
    console.error(`[TelegramBot] General error: ${error.message}`);
  });
  const firebaseAdmin = getFirebaseAdmin();
  if (!firebaseAdmin) {
    console.error("Firebase Admin failed to initialize. Bot functionality will be limited.");
    return;
  }
  const db = firebaseAdmin.db;

  console.log("Support Telegram Bot initialized.");

  // Handle /start
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    await setBotState(chatId, null); // Reset state

    const welcomeMsg = `
👋 <b>Welcome to Karma Gully Support!</b>

I'm here to help you with your orders and inquiries. Please choose an option from the menu below:

🔍 <b>Order Status</b> - Quickly check your order's progress.
🎫 <b>Open a Ticket</b> - Get help from our human team.
    `;

    const keyboard = {
      reply_markup: {
        keyboard: [
          [{ text: '🔍 Order Status' }],
          [{ text: '🎫 Open a Ticket' }],
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      }
    };

    bot.sendMessage(chatId, welcomeMsg, { parse_mode: 'HTML', ...keyboard });
  });

  // Handle Keyboard Buttons
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (text === '🔍 Order Status') {
      await setBotState(chatId, { step: 'waiting_for_order_id_status' });
      bot.sendMessage(chatId, "Please enter your <b>Order ID</b> (e.g., KG26-XXXXXX):", { parse_mode: 'HTML' });
      return;
    }

    if (text === '🎫 Open a Ticket') {
      const categoryButtons = Object.entries(CATEGORIES).map(([id, label]) => [{ text: label }]);
      await setBotState(chatId, { step: 'waiting_for_category' });
      bot.sendMessage(chatId, "What kind of issue are you facing? Please select a category:", {
        reply_markup: {
          keyboard: categoryButtons,
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
      return;
    }

    // Handle Category Selection
    const state = await getBotState(chatId) as any;
    if (state?.step === 'waiting_for_category') {
      const categoryKey = Object.keys(CATEGORIES).find(key => CATEGORIES[key] === text);
      if (categoryKey) {
        await setBotState(chatId, { step: 'waiting_for_issue_desc', category: categoryKey });
        bot.sendMessage(chatId, `Got it. Now, please describe your issue in detail. You can even send a photo if needed (coming soon!).`, {
          reply_markup: { remove_keyboard: true }
        });
      } else {
        bot.sendMessage(chatId, "Please select a valid category from the keyboard.");
      }
      return;
    }
  });

  // Handle All Messages (for steps)
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith('/')) return;

    // Handle Admin Natural Chat FIRST
    if (isAdmin(msg.from?.id)) {
      const statesSnap = await db.collection('botStates').doc(chatId.toString()).get();
      const adminState = statesSnap.exists ? statesSnap.data() : null;
      
      if (adminState?.step === 'admin_replying' && adminState.category) {
        const ticketId = adminState.category;
        try {
          const snap = await db.collection('tickets').doc(ticketId).get();
          if (snap.exists) {
            const ticket = snap.data() as any;
            
            if (ticket.status === 'closed') {
              bot.sendMessage(chatId, `⚠️ Ticket <b>${ticketId}</b> is closed. Re-accept it or open a new one if needed.`, { parse_mode: 'HTML' });
              return;
            }

            // Log message to Firestore
            await db.collection('tickets').doc(ticketId).collection('messages').add({
              text,
              senderId: adminId || 'admin',
              senderName: 'Support',
              senderType: 'admin',
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            await db.collection('tickets').doc(ticketId).update({ updatedAt: Date.now() });

            if (ticket.telegramChatId) {
              await bot.sendMessage(ticket.telegramChatId, `👤 <b>Support:</b> ${text}`, { parse_mode: 'HTML' });
              bot.sendMessage(chatId, `📤 Sent to <b>${ticket.username}</b>.`, { parse_mode: 'HTML' });
            }
          }
        } catch (err) {
          console.error(`[Admin] Error forwarding chat for ${ticketId}:`, err);
        }
      }
      return; // Admin messages handled
    }

    const state = await getBotState(chatId) as any;
    
    // Customer flow
    if (state) {
      if (state.step === 'waiting_for_order_id_status') {
        const orderId = text.trim().toUpperCase();
        try {
          const orderSnap = await db.collection('orders').doc(orderId).get();

          if (orderSnap.exists) {
            const order = orderSnap.data() as any;
            const itemsList = order.items?.map((i: any) => `• ${i.title || i.name} (x${i.quantity})`).join('\n') || 'No items listed';
            const dateStr = order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Recently';
            const response = `
📦 <b>Order Found!</b>
🆔 <b>ID:</b> <code>${orderId}</code>
🚦 <b>Status:</b> ${order.orderStatus || 'Processing'}
💰 <b>Total:</b> ₹${order.totalAmount}
💳 <b>Payment:</b> ${order.paymentType || 'N/A'} (${order.paymentStatus || 'Pending'})
📅 <b>Date:</b> ${dateStr}

🛒 <b>Items:</b>
${itemsList}

We'll drop you an update when it ships!
            `.trim();
            bot.sendMessage(chatId, response, { parse_mode: 'HTML' });
          } else {
            bot.sendMessage(chatId, "❌ Order ID not found. Please double check and try again.");
          }
        } catch (err) {
          bot.sendMessage(chatId, "Error fetching order status. Try again later.");
        }
        await setBotState(chatId, null);
      } 
      else if (state.step === 'waiting_for_issue_desc') {
        const category = state.category;
        await setBotState(chatId, { step: 'waiting_for_order_id_optional', category, message: text });
        bot.sendMessage(chatId, `📝 Received your <b>${category}</b> details.\n\nNow, is this regarding a specific order ID?\n\nIf yes, please enter the <b>Order ID</b> (e.g., KG26-XXXXXX).\nIf not, just type <b>'No'</b>.`, { parse_mode: 'HTML' });
        return; // Ensure we stop processing this message
      }
      else if (state.step === 'waiting_for_order_id_optional') {
        const { category, message } = state as any;
        const orderIdInput = text.trim().toUpperCase();
        const linkedOrderId = orderIdInput === 'NO' ? null : orderIdInput;
        const ticketId = 'T-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        
        console.log(`[Bot] Creating ticket ${ticketId} for user ${chatId}`);
        
        try {
          const ticketData = {
            ticketId,
            userId: msg.from?.id.toString() || 'unknown',
            username: msg.from?.username || msg.from?.first_name || 'Guest',
            telegramChatId: chatId.toString(),
            category,
            message,
            linkedOrderId,
            status: 'pending',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            source: 'telegram'
          };

          await db.collection('tickets').doc(ticketId).set(ticketData);
          
          // Log initial message to subcollection
          await db.collection('tickets').doc(ticketId).collection('messages').add({
            text: message,
            senderId: chatId.toString(),
            senderName: ticketData.username,
            senderType: 'user',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });

          await setBotState(chatId, null); // Clear state after success

          await bot.sendMessage(chatId, `✅ <b>Ticket Created!</b>\nYour Ticket ID: <code>${ticketId}</code>\n\nOur team will review your query and reply here soon.`, { parse_mode: 'HTML' });
          
          // Notify Admin
          if (adminId) {
            let adminMsg = `
🎫 <b>NEW TICKET: ${ticketId}</b> (Telegram)
👤 <b>User:</b> ${ticketData.username}
📂 <b>Category:</b> ${category}
💬 <b>Message:</b> ${message}
🔗 <b>Order ID:</b> ${linkedOrderId || 'None'}
            `.trim();

            if (linkedOrderId) {
              const oSnap = await db.collection('orders').doc(linkedOrderId).get();
              if (oSnap.exists) {
                const o = oSnap.data() as any;
                const adminItems = o.items?.map((i: any) => `• ${i.title || i.name} (x${i.quantity})`).join('\n') || 'No items';
                adminMsg += `\n\n📋 <b>Order Snapshot:</b>\n👤 ${o.customerInfo?.fullName || 'N/A'}\n📧 ${o.customerInfo?.email || 'N/A'}\n📞 ${o.customerInfo?.phone || 'N/A'}\n🚦 Status: ${o.orderStatus}\n💳 Pay: ${o.paymentType || 'N/A'} (${o.paymentStatus || 'Pending'})\n💰 Total: ₹${o.totalAmount}\n\n🛒 <b>Items:</b>\n${adminItems}`;
              }
            }

            adminMsg += `\n\n/accept_${ticketId} | /reject_${ticketId}`;
            bot.sendMessage(adminId, adminMsg, { parse_mode: 'HTML' });
          }
          return; // Stop processing
        } catch (err: any) {
          console.error("Ticket creation failed:", err);
          bot.sendMessage(chatId, `❌ Failed to create ticket. Please try again.`);
          await setBotState(chatId, null);
          return;
        }
      }
    } else {
        // Customer is not in a setup step, handle replies to support
        const snap = await db.collection('tickets')
          .where('telegramChatId', '==', chatId.toString())
          .get();

        if (!snap.empty) {
          // Find the most recent active ticket
          const activeTicketDoc = snap.docs.sort((a, b) => b.data().updatedAt - a.data().updatedAt)[0];
          const ticket = activeTicketDoc.data();
          const ticketId = activeTicketDoc.id;

          if (ticket.status === 'closed') {
            await bot.sendMessage(chatId, `📴 This ticket (<b>${ticketId}</b>) is now <b>Closed</b>.\n\nIf you have a new issue, please use /start to create a new ticket.`, { parse_mode: 'HTML' });
            return;
          }

          if (ticket.status !== 'accepted') {
             await bot.sendMessage(chatId, `⏳ Your ticket (<b>${ticketId}</b>) is pending review. Please wait for an admin to accept it.`, { parse_mode: 'HTML' });
             return;
          }

          // Log user message to Firestore
          await db.collection('tickets').doc(ticketId).collection('messages').add({
            text,
            senderId: chatId.toString(),
            senderName: ticket.username,
            senderType: 'user',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
          await db.collection('tickets').doc(ticketId).update({ updatedAt: Date.now() });

          if (adminId) {
            await bot.sendMessage(adminId, `📩 <b>Reply from ${ticket.username} (${ticketId}):</b>\n${text}`, { parse_mode: 'HTML' });
            bot.sendMessage(chatId, `📤 <b>Message Sent.</b>`, { parse_mode: 'HTML' });
          }
        } else {
           bot.sendMessage(chatId, `👋 Use /start to open a support ticket.`, { parse_mode: 'HTML' });
        }
    }
  });

  // --- ADMIN COMMANDS ---

  const isAdmin = (id?: number) => id?.toString() === adminId;

  // Search Orders
  bot.onText(/\/search (.+)/, async (msg, match) => {
    if (!isAdmin(msg.from?.id)) return;
    const orderId = match?.[1].trim().toUpperCase();

    try {
      const oSnap = await db.collection('orders').doc(orderId).get();
      if (!oSnap.exists) {
        return bot.sendMessage(msg.chat.id, `❌ Order <code>${orderId}</code> not found.`, { parse_mode: 'HTML' });
      }

      const o = oSnap.data() as any;
      const adminItems = o.items?.map((i: any) => `• ${i.title || i.name} (x${i.quantity})`).join('\n') || 'No items';
      const addr = o.customerInfo?.address || o.address;
      const addrStr = typeof addr === 'object' ? `${addr.fullAddress || ''} ${addr.city || ''} ${addr.pincode || ''}` : addr;
      
      const dateStr = o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A';
      
      const response = `
📋 <b>Order Details: ${orderId}</b>
👤 <b>Customer:</b> ${o.customerInfo?.fullName || 'N/A'}
📧 <b>Email:</b> ${o.customerInfo?.email || 'N/A'}
📞 <b>Phone:</b> ${o.customerInfo?.phone || 'N/A'}
🚦 <b>Status:</b> ${o.orderStatus}
💳 <b>Payment:</b> ${o.paymentType || 'N/A'} (${o.paymentStatus || 'Pending'})
💰 <b>Total:</b> ₹${o.totalAmount}
📅 <b>Created:</b> ${dateStr}

🛒 <b>Items:</b>
${adminItems}

📍 <b>Address:</b>
${addrStr || 'N/A'}
      `.trim();

      bot.sendMessage(msg.chat.id, response, { parse_mode: 'HTML' });
    } catch (err) {
      console.error("Search failed:", err);
      bot.sendMessage(msg.chat.id, "❌ Error searching order.");
    }
  });

  // Accept Ticket
  bot.onText(/\/accept_([T][A-Z0-9-]+)/, async (msg, match) => {
    if (!isAdmin(msg.from?.id)) return;
    const ticketId = match?.[1].trim();
    
    try {
      const ticketRef = db.collection('tickets').doc(ticketId || '');
      const snap = await ticketRef.get();
      if (!snap.exists) {
        return bot.sendMessage(msg.chat.id, `❌ Ticket <code>${ticketId}</code> not found.`, { parse_mode: 'HTML' });
      }

      const ticket = snap.data() as any;
      if (ticket.status === 'closed') {
        return bot.sendMessage(msg.chat.id, `⚠️ Ticket <code>${ticketId}</code> is <b>CLOSED</b>. Use /reopen_${ticketId} or open a new one.`, { parse_mode: 'HTML' });
      }

      await ticketRef.update({ status: 'accepted', updatedAt: Date.now() });

      // Context
      const msgsSnap = await ticketRef.collection('messages').orderBy('createdAt', 'desc').limit(5).get();
      const context = msgsSnap.docs.reverse().map(d => {
        const m = d.data();
        const time = m.createdAt?.toDate ? m.createdAt.toDate().toLocaleTimeString() : '...';
        return `[${time}] <b>${m.senderName}:</b> ${m.text}`;
      }).join('\n');

      await setBotState(msg.chat.id, { step: 'admin_replying', category: ticketId });

      let resp = `✅ <b>Accepted!</b> You are chatting with <b>${ticket.username}</b>.`;
      if (context) resp += `\n\n<b>Context:</b>\n${context}`;
      resp += `\n\n/close_${ticketId} to end.`;

      bot.sendMessage(msg.chat.id, resp, { parse_mode: 'HTML' });
      
      if (ticket.telegramChatId) {
        bot.sendMessage(ticket.telegramChatId, `👋 <b>Support Accepted!</b> An admin is now reviewing your ticket (<code>${ticketId}</code>).`, { parse_mode: 'HTML' });
      }
    } catch (err) {
      bot.sendMessage(msg.chat.id, "Error updating ticket.");
    }
  });

  // Re-open Ticket
  bot.onText(/\/reopen_([T][A-Z0-9-]+)/, async (msg, match) => {
    if (!isAdmin(msg.from?.id)) return;
    const ticketId = match?.[1].trim();
    try {
      const ticketRef = db.collection('tickets').doc(ticketId || '');
      await ticketRef.update({ status: 'accepted', updatedAt: Date.now() });
      await setBotState(msg.chat.id, { step: 'admin_replying', category: ticketId });
      bot.sendMessage(msg.chat.id, `🔄 Ticket <code>${ticketId}</code> re-opened.`, { parse_mode: 'HTML' });
    } catch (err) {
      bot.sendMessage(msg.chat.id, "Error re-opening ticket.");
    }
  });

  // Reject Ticket
  bot.onText(/\/reject_([T][A-Z0-9-]+)/, async (msg, match) => {
    if (!isAdmin(msg.from?.id)) return;
    const ticketId = match?.[1].trim();
    try {
      const ticketRef = db.collection('tickets').doc(ticketId || '');
      const snap = await ticketRef.get();
      if (!snap.exists) return bot.sendMessage(msg.chat.id, "Ticket not found.");
      await ticketRef.update({ status: 'rejected', updatedAt: Date.now() });
      const ticket = snap.data() as any;
      bot.sendMessage(msg.chat.id, `❌ Ticket <b>${ticketId}</b> Rejected.`, { parse_mode: 'HTML' });
      if (ticket.telegramChatId) {
        bot.sendMessage(ticket.telegramChatId, `❌ Sorry, your ticket (<code>${ticketId}</code>) was rejected.`, { parse_mode: 'HTML' });
      }
    } catch (err) {
      bot.sendMessage(msg.chat.id, "Error updating ticket.");
    }
  });

  // Reply
  bot.onText(/\/(?:reply|r)_([T][A-Z0-9-]+)(?: (.+))?/, async (msg, match) => {
    if (!isAdmin(msg.from?.id)) return;
    const ticketId = match?.[1].trim();
    const replyText = match?.[2]?.trim();
    if (!replyText) {
      await setBotState(msg.chat.id, { step: 'admin_replying', category: ticketId });
      return bot.sendMessage(msg.chat.id, `📝 Context set to <b>${ticketId}</b>. Type message below.`, { parse_mode: 'HTML' });
    }
    try {
      const snap = await db.collection('tickets').doc(ticketId || '').get();
      if (!snap.exists) return bot.sendMessage(msg.chat.id, "Ticket not found.");
      const ticket = snap.data() as any;
      
      await db.collection('tickets').doc(ticketId).collection('messages').add({
        text: replyText,
        senderId: adminId || 'admin',
        senderName: 'Support',
        senderType: 'admin',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      await db.collection('tickets').doc(ticketId).update({ updatedAt: Date.now() });

      if (ticket.telegramChatId) {
        bot.sendMessage(ticket.telegramChatId, `👤 <b>Support:</b> ${replyText}`, { parse_mode: 'HTML' });
        bot.sendMessage(msg.chat.id, `📤 Replied to <b>${ticket.username}</b>.`, { parse_mode: 'HTML' });
      }
      await setBotState(msg.chat.id, { step: 'admin_replying', category: ticketId });
    } catch (err) {
      bot.sendMessage(msg.chat.id, "Error sending reply.");
    }
  });

  // Close Ticket
  bot.onText(/\/close_([T][A-Z0-9-]+)/, async (msg, match) => {
    if (!isAdmin(msg.from?.id)) return;
    const ticketId = match?.[1].trim();
    try {
      const ticketRef = db.collection('tickets').doc(ticketId || '');
      const snap = await ticketRef.get();
      if (!snap.exists) return bot.sendMessage(msg.chat.id, "Ticket not found.");

      await ticketRef.update({ status: 'closed', updatedAt: Date.now() });
      await ticketRef.collection('messages').add({
        text: "🚩 Ticket status updated to: CLOSED",
        senderId: 'system',
        senderName: 'System',
        senderType: 'admin',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const ticket = snap.data() as any;
      const currentState = await getBotState(msg.chat.id) as any;
      if (currentState?.category === ticketId) await setBotState(msg.chat.id, null);

      bot.sendMessage(msg.chat.id, `🏁 Ticket <b>${ticketId}</b> closed.`, { parse_mode: 'HTML' });
      if (ticket.telegramChatId) {
        bot.sendMessage(ticket.telegramChatId, `🚩 <b>Ticket Closed:</b> Your ticket <b>${ticketId}</b> is now closed. Thank you!`, { parse_mode: 'HTML' });
      }
    } catch (err) {
      bot.sendMessage(msg.chat.id, "Error closing ticket.");
    }
  });
}
