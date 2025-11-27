import express from "express";
import crypto from "crypto";

const app = express();
app.use(express.json());

// VERIFY TOKEN from Render env
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// WEBHOOK VERIFY (GET)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("WEBHOOK VERIFIED!");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403); // forbidden
    }
  }
});

// RECEIVE MESSAGES (POST)
app.post("/webhook", (req, res) => {
  console.log("Incoming message:", JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

app.listen(3000, () => {
  console.log("ASKQA Webhook running on port 3000");
});
