import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(bodyParser.json());

// ===== VERIFY WEBHOOK (GET) =====
app.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

// ===== RECEIVE WHATSAPP MESSAGES (POST) =====
app.post("/webhook", (req, res) => {
  console.log("Incoming WhatsApp Message:", JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

// ===== DEFAULT ROUTE =====
app.get("/", (req, res) => {
  res.send("ASKQA Webhook Working 🚀");
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
