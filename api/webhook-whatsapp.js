export default async function handler(req, res) {
  if (req.method === 'POST') {
    const data = req.body;

    console.log("Webhook recebido:", data);

    const message = data?.messages?.[0];

    if (message) {
      const numero = message.from;
      const texto = message.body;

      console.log("Numero:", numero);
      console.log("Mensagem:", texto);
    }

    res.status(200).json({ ok: true });
  } else {
    res.status(405).end();
  }
}
