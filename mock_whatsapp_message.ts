import "dotenv/config";

async function run() {
  const payload = {
    messages: [
      {
        id: "MOCK_MSG_12345",
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
  };

  try {
    console.log("Sending mock WhatsApp message 'Gasolina 50.00' to webhook...");
    const res = await fetch("http://localhost:3000/api/webhook-whatsapp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    console.log("Status:", res.status);
    const data = await res.json().catch(() => null);
    console.log("ResponseBody:", data);
  } catch (e: any) {
    console.error("Error making requests:", e.message);
  }
}

run();
