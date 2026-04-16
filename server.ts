import express from "express";
import { createServer as createViteServer } from "vite";
import { Resend } from "resend";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON bodies
  app.use(express.json());

  // API routes FIRST
  app.post("/api/send-order-email", async (req, res) => {
    try {
      const { orderNumber, customer, items, total, shipping, paymentMethod } = req.body;
      const resendApiKey = process.env.RESEND_API_KEY;

      if (!resendApiKey) {
        console.error("RESEND_API_KEY is not configured.");
        return res.status(500).json({ error: "Email service not configured" });
      }

      const resend = new Resend(resendApiKey);

      // Create a simple HTML email for the order details
      const itemsHtml = items.map((item: any) => 
        `<li>${item.name} - ${item.price} TND</li>`
      ).join("");

      const htmlContent = `
        <h1>Nouvelle Commande: ${orderNumber}</h1>
        <h2>Détails du Client:</h2>
        <p><strong>Nom:</strong> ${customer.firstName} ${customer.lastName}</p>
        <p><strong>Email:</strong> ${customer.email}</p>
        <p><strong>Téléphone:</strong> ${customer.phone}</p>
        <p><strong>Adresse:</strong> ${customer.address}, ${customer.gov}</p>
        
        <h2>Articles:</h2>
        <ul>
          ${itemsHtml}
        </ul>
        
        <h3><strong>Livraison:</strong> ${shipping === 0 ? 'Gratuit' : shipping + ' TND'}</h3>
        <h3><strong>Paiement:</strong> ${paymentMethod === 'cash' ? 'À la livraison (Cash)' : paymentMethod}</h3>
        <h2><strong>Total Payé:</strong> ${total.toFixed(2)} TND</h2>
      `;

      const data = await resend.emails.send({
        from: "Willows Store <onboarding@resend.dev>",
        to: "amine.nagatti@gmail.com",
        subject: `Nouvelle Commande Willows: ${orderNumber}`,
        html: htmlContent,
      });

      res.json({ success: true, data });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: "Failed to send email" });
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
