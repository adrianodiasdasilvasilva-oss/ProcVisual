import "dotenv/config";
import handler from "./api/webhook-whatsapp.js";

async function run() {
  const req = {
    method: "POST",
    body: {
      messages: [
        {
          id: "MOCK_MSG_LOCAL",
          chat_id: "5519994792245@s.whatsapp.net",
          from: "5519994792245@s.whatsapp.net",
          from_me: false,
          type: "text",
          text: {
            body: "Gastei 150.00 com churrasco hoje"
          },
          timestamp: Math.floor(Date.now() / 1000)
        }
      ]
    }
  };

  const res = {
    status(code: number) {
      console.log("[STATUS]:", code);
      return this;
    },
    send(data: any) {
      console.log("[SEND]:", data);
      return this;
    },
    json(data: any) {
      console.log("[JSON]:", JSON.stringify(data, null, 2));
      return this;
    },
    end() {
      console.log("[END]");
      return this;
    }
  };

  try {
    console.log("Calling local whatsapp handler directly...");
    await handler(req, res);
  } catch (err: any) {
    console.error("Local execution crashed:", err.message, err.stack);
  }
}

run();
