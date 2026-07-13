import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API route for LINE messaging
  app.post("/api/line-notify", async (req, res) => {
    try {
      const { channelAccessToken, userId, message } = req.body;

      if (!channelAccessToken || !userId || !message) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      const response = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${channelAccessToken}`
        },
        body: JSON.stringify({
          to: userId,
          messages: [
            {
              type: "text",
              text: message
            }
          ]
        })
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error("LINE API Error:", responseData);
        return res.status(response.status).json({ error: "Failed to send LINE message", details: responseData });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("LINE Notify Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
