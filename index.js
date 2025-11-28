// index.js
import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();
console.log("VERIFY TOKEN LOADED:", process.env.VERIFY_TOKEN);

const app = express();
app.use(bodyParser.json());

// CONFIG
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Simple in-memory dedupe (use DB in production)
const seenMessageIds = new Set();

// Helper: call OpenAI Chat Completions
async function askOpenAI(userText, meta = {}) {
  // meta can include language hint, topic, etc — optional
  const systemPrompt = `
You are ASKQA — the official answering brain for "AskQA".
Rules:
1) Detect language automatically; reply in the same language (Tamil if input is Tamil).
2) Detect user's tone (emotion) and adapt empathy/strength accordingly.
3) Keep answers clear, practical, and short-first; then provide deeper explanation if needed.
4) Always include a short actionable step or summary at the end.
5) Follow the AskQA persona: friendly, direct, helpful, slightly conversational (MMA style).
6) If user asks for unsafe/illegal instructions, refuse politely and provide safe alternatives.
`;
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userText }
  ];

  try {
    const resp = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini", // change if needed
        messages,
        max_tokens: 700,
        temperature: 0.3
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const answer = resp.data.choices?.[0]?.message?.content;
    return answer || "Sorry, I couldn't generate an answer. Please try again.";
  } catch (err) {
    console.error("OpenAI error:", err?.response?.data || err.message);
    return "Sorry — ASKQA is having trouble thinking right now. Try again in a few seconds.";
  }
}

// Send message back to WhatsApp via Meta Graph API
async function sendWhatsApp(to, text) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        text: { body: text }
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );
    console.log("Reply Sent:", text);
  } catch (err) {
    console.error("WhatsApp send error:", err?.response?.data || err.message);
    throw err;
  }
}

// WEBHOOK VERIFY (GET)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  console.log("WEBHOOK VERIFY REQUEST:", { mode, token, challenge });
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("WEBHOOK VERIFIED SUCCESSFULLY!");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// RECEIVE (POST) - main pipeline
app.post("/webhook", async (req, res) => {
  try {
    console.log("RECEIVED WEBHOOK:", JSON.stringify(req.body, null, 2));

    const data = req.body;

    if (
      data.object === "whatsapp_business_account" &&
      data.entry &&
      data.entry[0].changes &&
      data.entry[0].changes[0].value.messages
    ) {
      const msgObj = data.entry[0].changes[0].value.messages[0];
      const from = msgObj.from;
      const msgId = msgObj.id;
      const text = msgObj.text?.body || "";

      // Deduplicate: Meta sometimes sends same webhook multiple times
      if (seenMessageIds.has(msgId)) {
        console.log("Duplicate message ignored:", msgId);
        return res.sendStatus(200);
      }
      seenMessageIds.add(msgId);
      // keep set small in memory (optional cleanup)
      if (seenMessageIds.size > 10000) {
        // naive cleanup
        const iter = seenMessageIds.values();
        for (let i = 0; i < 1000; i++) {
          const v = iter.next().value;
          if (!v) break;
          seenMessageIds.delete(v);
        }
      }

      console.log("Received Message from", from, "text:", text);

      // Quick routing: handle simple keywords first (menu, help, ping)
      const lower = text.toLowerCase();
      if (lower === "ping" || lower === "hi" || lower === "hello") {
        const quick = "Hi MMA 👋! I am ASKQA. Send your question in Tamil or English — I will answer.";
        await sendWhatsApp(from, quick);
        return res.sendStatus(200);
      }

      // Call OpenAI / ASKQA Brain
      const spinner = await askOpenAI(text, { from, messageId: msgId });

      // Safeguard: limit reply length for WhatsApp (split if needed)
      const maxLen = 2000;
      if (spinner.length <= maxLen) {
        await sendWhatsApp(from, spinner);
      } else {
        // split into chunks
        for (let i = 0; i < spinner.length; i += maxLen) {
          const chunk = spinner.slice(i, i + maxLen);
          await sendWhatsApp(from, chunk);
        }
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("ERROR in /webhook:", err?.response?.data || err.message);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
