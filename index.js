import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();
console.log("VERIFY TOKEN LOADED:", process.env.VERIFY_TOKEN);

const app = express();
app.use(bodyParser.json());

// =========================
// CONFIGURATION
// =========================
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// =========================
// WEBHOOK VERIFY (GET)
// =========================
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

// =========================
// RECEIVE WHATSAPP MESSAGES (POST)
// =========================
app.post("/webhook", async (req, res) => {
  try {
    console.log("RECEIVED WEBHOOK:", JSON.stringify(req.body, null, 2));

    const data = req.body;

    // Check if incoming message exists
    if (
      data.object === "whatsapp_business_account" &&
      data.entry &&
      data.entry[0].changes &&
      data.entry[0].changes[0].value.messages
    ) {
      const message = data.entry[0].changes[0].value.messages[0];
      const from = message.from;
      const text = message.text?.body || "";

      console.log("Received Message:", text);

      // =========================
      // AUTO-REPLY LOGIC
      // =========================

      let reply = "Hello 👋 This is ASKQA Auto-Reply.\nHow can I help you today?";

      if (text.toLowerCase().includes("hi")) reply = "Hi MMA 👋! How can I support you?";
      if (text.toLowerCase().includes("help")) reply = "Tell me your question. I am here.";
      if (text.toLowerCase().includes("askqa")) reply = "ASKQA is online! 🔥 Ask me anything.";

      // =========================
      // SEND MESSAGE TO WHATSAPP
      // =========================
      await axios.post(
        `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          text: { body: reply }
        },
        {
          headers: {
            Authorization: `Bearer ${WHATSAPP_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Reply Sent:", reply);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("ERROR:", err);
    res.sendStatus(500);
  }
});

// =========================
// SERVER START
// =========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
