// Simple WhatsApp Webhook Server for Meta Cloud API
// Works on Render Free Tier

const express = require("express");
const app = express();
app.use(express.json());

const VERIFY_TOKEN = "askqa313";   // You chose this token

// VERIFY WEBHOOK
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

// RECEIVE MESSAGES
app.post("/webhook", (req, res) => {
  console.log("Incoming:", JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("Server running on port " + PORT));
