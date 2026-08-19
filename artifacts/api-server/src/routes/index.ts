import { Router, type IRouter } from "express";
import healthRouter from "./health";
import type { WhatsAppConnection } from "../connection/whatsapp";

export function createRouter(whatsapp: WhatsAppConnection): IRouter {
  const router: IRouter = Router();

  router.use(healthRouter);

  // API endpoint — returns the QR as JSON
  router.get("/qr", (_req, res) => {
    const qr = whatsapp.getQrCode();

    if (!qr) {
      return res.status(404).json({
        status: whatsapp.getStatus(),
        message: "WhatsApp QR code is not currently available.",
      });
    }

    return res.json({
      status: whatsapp.getStatus(),
      qr,
    });
  });

  // QR webpage — displays the QR code
  router.get("/qr-page", (_req, res) => {
    res.type("html").send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>AY-LEE BOT — WhatsApp QR</title>
          <style>
            body {
              margin: 0;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #111;
              color: white;
              font-family: Arial, sans-serif;
              text-align: center;
            }

            .container {
              padding: 30px;
            }

            img {
              width: 320px;
              max-width: 90vw;
              background: white;
              padding: 12px;
              border-radius: 12px;
            }

            h1 {
              margin-bottom: 10px;
            }

            p {
              color: #bbb;
            }
          </style>
        </head>

        <body>
          <div class="container">
            <h1>AY-LEE BOT</h1>
            <p>Scan this QR code with WhatsApp</p>

            <img id="qr" alt="WhatsApp QR Code">

            <p id="status">Loading QR...</p>
          </div>

          <script>
            async function loadQR() {
              try {
                const response = await fetch("/api/qr");
                const data = await response.json();

                if (data.qr) {
                  document.getElementById("qr").src = data.qr;
                  document.getElementById("status").textContent =
                    "Open WhatsApp → Linked devices → Link a device";
                } else {
                  document.getElementById("status").textContent =
                    data.message || "QR code is not available.";
                }
              } catch (error) {
                document.getElementById("status").textContent =
                  "Unable to load QR code.";
              }
            }

            loadQR();

            // Refresh every 5 seconds
            setInterval(loadQR, 5000);
          </script>
        </body>
      </html>
    `);
  });

  return router;
}