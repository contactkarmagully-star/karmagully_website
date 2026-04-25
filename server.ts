import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Razorpay from "razorpay";
import crypto from "crypto";
import dotenv from "dotenv";
import { Resend } from "resend";
import axios from "axios";
import cors from "cors";

dotenv.config();

async function startServer() {
  const app = express();
const PORT = process.env.PORT || 3000;
  app.use(express.json());

  // Resend Initialization
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  // Razorpay Initialization
  const razorpayKeyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID;
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

  const razorpay = razorpayKeyId ? new Razorpay({
    key_id: razorpayKeyId,
    key_secret: razorpayKeySecret,
  }) : null;

  // --- API Routes ---

  app.post("/api/notifications/order", async (req, res) => {
    const { order, customerEmail, customerName } = req.body;

    try {
      // 1. Send Email Notification via Resend
      if (resend) {
        try {
          await resend.emails.send({
            from: 'KARMAGULLY <orders@resend.dev>', // Note: Custom domains need verification on Resend
            to: customerEmail,
            subject: 'ORDER CONFIRMED | KARMAGULLY',
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
                <h1 style="color: #9333ea; text-transform: uppercase;">KarmaGully</h1>
                <p>Hi ${customerName},</p>
                <p>Your order <strong>${order.id}</strong> has been received and is being processed by our manufacturing unit.</p>
                <hr />
                <h3>Order Details:</h3>
                <p>Total Amount: ₹${order.totalAmount}</p>
                <p>Shipping Address: ${order.customerInfo.address}, ${order.customerInfo.city}</p>
                <p>Estimated Delivery: 4-7 Days</p>
                <hr />
                <p>Elevate your aesthetic,<br/>Team KarmaGully</p>
              </div>
            `,
          });
          console.log("Email sent successfully to", customerEmail);
        } catch (emailErr) {
          console.error("Resend Email Error:", emailErr);
          // Don't throw, allow Telegram to try
        }
      }

      // 2. Send Telegram Notification to Admin
      if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
        try {
          let subtotal = 0;
          const itemsList = order.items.map((i: any) => {
            const variant = i.variantName && i.variantName !== 'Standard' ? ` <i>(${i.variantName})</i>` : '';
            const itemTotal = i.price * i.quantity;
            subtotal += itemTotal;
            return `🏷 <b>${i.name.toUpperCase()}</b>${variant}\n   └ Qty: ${i.quantity} | Total: ₹${itemTotal}`;
          }).join('\n\n');
          
          const addr = order.address;
          const fullAddressText = `${addr.fullAddress}${addr.landmark ? `\n<b>📍 Landmark:</b> ${addr.landmark}` : ''}\n<b>📍 City:</b> ${addr.city}, ${addr.state} - ${addr.pincode}`;
          
          const discountAmount = subtotal - order.totalAmount;
          const discountLine = discountAmount > 0.1 ? `\n<b>🏷️ Discount Applied:</b> -₹${discountAmount.toFixed(2)}` : '';

          const message = `
<b>🛍️ ORDER: ${order.items[0].name.toUpperCase()}</b> ${order.items.length > 1 ? `(+${order.items.length - 1} more)` : ''}

<b>📦 Items:</b>
${itemsList}${discountLine}

<b>🆔 Order ID:</b> <code>${order.id}</code>
<b>👤 Customer:</b> ${customerName}
<b>📧 Email:</b> ${order.customerInfo.email}
<b>💰 Pay Amount:</b> ₹${order.totalAmount}
<b>💳 Payment:</b> ${order.paymentType} (${order.paymentStatus})

<b>🏠 Address:</b>
${fullAddressText}
<b>📞 Phone:</b> ${order.customerInfo.phone}
          `.trim();

          await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: process.env.TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'HTML'
          });
          console.log("Telegram notification sent to Chat ID:", process.env.TELEGRAM_CHAT_ID);
        } catch (teleErr: any) {
          console.error("Telegram API Error:", teleErr.response?.data || teleErr.message);
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Notification handler failed:", error);
      res.status(500).json({ error: "Notification processing failed" });
    }
  });

  // Test Route for Telegram
  app.get("/api/test-telegram", async (req, res) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return res.status(400).json({ 
        error: "Missing credentials", 
        tokenSet: !!token, 
        chatIdSet: !!chatId 
      });
    }

    try {
      await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: chatId,
        text: "✅ <b>KarmaGully Bot Connected!</b>\nYour Telegram integration is working correctly.",
        parse_mode: 'HTML'
      });
      res.json({ success: true, message: "Test message sent!" });
    } catch (err: any) {
      res.status(500).json({ 
        success: false, 
        error: err.response?.data || err.message 
      });
    }
  });

  app.post("/api/razorpay/order", async (req, res) => {
    if (!razorpay) {
      console.error("Razorpay Error: Keys are missing in environment variables.");
      return res.status(500).json({ error: "Razorpay keys not configured. Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to Settings." });
    }

    const { amount, currency = "INR", receipt } = req.body;

    try {
      const order = await razorpay.orders.create({
        amount: Math.round(Number(amount) * 100), // Razorpay expects paisa
        currency,
        receipt,
      });
      res.json(order);
    } catch (error: any) {
      console.error("Razorpay Order creation failed:", error);
      res.status(500).json({ error: error.message || "Failed to create Razorpay order." });
    }
  });

  app.post("/api/razorpay/verify", async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpayKeySecret) {
       return res.status(500).json({ error: "Razorpay secret not configured." });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", razorpayKeySecret)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature === razorpay_signature) {
      res.json({ status: "success" });
    } else {
      res.status(400).json({ status: "failure" });
    }
  });

  // --- Vite Middleware / Static Assets ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
