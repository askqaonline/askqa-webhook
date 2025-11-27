const express = require('express');  // FIXED: "require" not "requieren"
const app = express();

// Middleware to parse JSON bodies (needed for POST webhook)
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

// Your exact verify token from the Meta dashboard
const VERIFY_TOKEN = 'askqa313';

// ============================
// WEBHOOK VERIFICATION (GET)
// ============================
app.get('/webhook', (req, res) => {
  console.log('WEBHOOK VERIFY REQUEST:', req.query);

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('WEBHOOK VERIFIED SUCCESSFULLY!');
    return res.status(200).type('text/plain').send(challenge);
  }

  console.log('VERIFICATION FAILED - Wrong token');
  res.sendStatus(403);
});

// ============================
// RECEIVE MESSAGES (POST)
// ============================
app.post('/webhook', (req, res) => {
  const body = req.body;

  console.log('RECEIVED WEBHOOK:', JSON.stringify(body, null, 2));

  // Check the payload is from Page/Instagram
  if (body.object) {
    // Acknowledge receipt immediately
    res.sendStatus(200);

    // Process each entry (messages, status updates, etc.)
    body.entry?.forEach(entry => {
      entry.messaging?.forEach(event => {
        if (event.message) {
          console.log('New message:', event.message.text);
          // Here you will later reply or forward the message
        }
      });
    });
  } else {
    res.sendStatus(404);
  }
});

// Root route (optional – just so the URL doesn't 404)
app.get('/', (req, res) => {
  res.send('Webhook is live 🚀');
});

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`VERIFY TOKEN LOADED: ${VERIFY_TOKEN}`);
  console.log(`Server running on port ${PORT}`);
});
