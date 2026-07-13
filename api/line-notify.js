export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

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

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("LINE Notify Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
