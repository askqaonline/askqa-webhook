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

// Simple in-memory dedupe
const seenMessageIds = new Set();

// 🔥 REAL INDIA DATE + TIME
function getCurrentDateTime() {
  return new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "long",
    timeStyle: "medium"
  });
}

// -----------------------------------------
// ASK OPENAI (ASKQA BRAIN)
// -----------------------------------------
async function askOpenAI(userText, meta = {}) {

  const today = getCurrentDateTime();

  const systemPrompt = `
TODAY'S REAL DATE-TIME (IST): ${today}

You are ASKQA — the official answering brain for "AskQA".

RULES:
1) Always use the REAL date/time shown above for any date-related answers.
2) Detect input language automatically and reply in the SAME language (Tamil if Tamil).
3) If user asks a question you are unsure about, ASK for clarification instead of guessing.
4) Provide short, clear, practical answers first; then give optional deeper explanation.
5) Always end with a small helpful step ("Let me know if you want...").
6) Use friendly MMA-style tone when appropriate.
7) If user asks for harmful/illegal instructions, refuse politely.
`;

  try {
    const resp = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userText }
        ],
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

    return (
      resp.data.choices?.[0]?.message?.content ||
      "Sorry MMA, I couldn't think clearly. Try again!"
    );
  } catch (err) {
    console.error("OpenAI error:", err?.response?.data || err.message);
    return "AskQA brain is facing an issue — try again in a few seconds, MMA.";
  }
}

// -----------------------------------------
// SEND WHATSAPP MESSAGE (v20.0)
// -----------------------------------------
async function sendWhatsApp(to, text) {
  try {
    const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;

    const payload = {
      messaging_product: "whatsapp",
      to,
      text: { body: text }
    };

    const headers = {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json"
    };

    const resp = await axios.post(url, payload, { headers });

    console.log("Reply Sent Successfully:", resp.data);
  } catch (err) {
    console.error(
      "WhatsApp send error:",
      err?.response?.data || err.message
    );
  }
}

// -----------------------------------------
// WEBHOOK VERIFY (GET)
// -----------------------------------------
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

// -----------------------------------------
// RECEIVE INCOMING WHATSAPP MESSAGES (POST)
// -----------------------------------------
app.post("/webhook", async (req, res) => {
  try {
    console.log(
      "RECEIVED WEBHOOK:",
      JSON.stringify(req.body, null, 2)
    );

    const data = req.body;

    if (
      data.object === "whatsapp_business_account" &&
      data.entry?.[0]?.changes?.[0]?.value?.messages
    ) {
      const msgObj = data.entry[0].changes[0].value.messages[0];
      const from = msgObj.from;
      const msgId = msgObj.id;
      const text = msgObj.text?.body || "";

      // Prevent duplicate replies
      if (seenMessageIds.has(msgId)) {
        console.log("Duplicate message ignored:", msgId);
        return res.sendStatus(200);
      }
      seenMessageIds.add(msgId);

      console.log("Received Message FROM:", from, "| TEXT:", text);

      // Quick hello handler
      const lower = text.toLowerCase();
      if (["hi", "hello", "ping"].includes(lower)) {
        await sendWhatsApp(
          from,
          "Hi MMA 👋! I am ASKQA. Send me any question — Tamil or English!"
        );
        return res.sendStatus(200);
      }

      // Ask ASKQA brain
      const answer = await askOpenAI(text);

      // WhatsApp max length protection
      const maxLen = 2000;
      if (answer.length <= maxLen) {
        await sendWhatsApp(from, answer);
      } else {
        for (let i = 0; i < answer.length; i += maxLen) {
          await sendWhatsApp(from, answer.slice(i, i + maxLen));
        }
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("ERROR in /webhook:", err?.response?.data || err.message);
    res.sendStatus(500);
  }
});

// -----------------------------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);
