export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      message: "LINE callback is working"
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const body = req.body;

  console.log("LINE Webhook 收到：", JSON.stringify(body, null, 2));

  for (const event of body.events || []) {
    const source = event.source || {};

    if (source.type === "group") {
      console.log("群組 groupId =", source.groupId);
    }

    if (source.type === "user") {
      console.log("個人 userId =", source.userId);
    }
  }

  return res.status(200).json({
    status: "ok"
  });
}