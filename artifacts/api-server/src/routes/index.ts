import { Router, type IRouter } from "express";
import healthRouter from "./health";
import type { WhatsAppConnection } from "../connection/whatsapp";

export function createRouter(whatsapp: WhatsAppConnection): IRouter {
  const router: IRouter = Router();

  router.use(healthRouter);

  // WhatsApp QR API
  router.get("/qr", (_req, res) => {
    try {
      const qr = whatsapp.getQrCode();
      const status = whatsapp.getStatus();

      if (!qr) {
        return res.json({
          status,
          qr: null,
          message: "WhatsApp QR code is not currently available.",
        });
      }

      return res.json({
        status,
        qr,
      });
    } catch (error) {
      console.error("QR API error:", error);

      return res.status(500).json({
        status: "error",
        qr: null,
        message: "Unable to retrieve WhatsApp QR code.",
      });
    }
  });

  // Status API
  router.get("/status", (_req, res) => {
    try {
      return res.json({
        status: whatsapp.getStatus(),
      });
    } catch (error) {
      console.error("Status API error:", error);

      return res.status(500).json({
        status: "error",
      });
    }
  });

  // QR webpage
  router.get("/qr-page", (_req, res) => {
    res.type("html").send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />

          <title>AY-LEE BOT — WhatsApp QR</title>

          <style>
            body {
              margin: 0;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #111827;
              color: white;
              font-family: Arial, sans-serif;
              text-align: center;
            }

            .container {
              width: 90%;
              max-width: 420px;
              padding: 30px;
              background: #1f2937;
              border-radius: 20px;
              box-sizing: border-box;
            }

            h1 {
              margin-bottom: 10px;
            }

            #qr {
              width: 300px;
              max-width: 80vw;
              background: white;
              padding: 10px;
              border-radius: 12px;
              display: none;
            }

            #status {
              color: #9ca3af;
              margin: 15px 0;
            }

            #message {
              color: #9ca3af;
            }
          </style>
        </head>

        <body>
          <div class="container">
            <h1>AY-LEE BOT</h1>

            <div id="status">
              Connecting...
            </div>

            <img
              id="qr"
              alt="WhatsApp QR Code"
            />

            <p id="message">
              Loading QR code...
            </p>
          </div>

          <script>
            async function loadQR() {
              try {
                const response = await fetch("/api/qr", {
                  cache: "no-store"
                });

                if (!response.ok) {
                  throw new Error(
                    "HTTP " + response.status
                  );
                }

                const data = await response.json();

                document.getElementById("status").textContent =
                  "Status: " + (data.status || "Unknown");

                const qrImage =
                  document.getElementById("qr");

                const message =
                  document.getElementById("message");

                if (data.qr) {
                  qrImage.src = data.qr;
                  qrImage.style.display = "inline-block";

                  message.textContent =
                    "Open WhatsApp → Linked devices → Link a device";
                } else {
                  qrImage.style.display = "none";

                  message.textContent =
                    data.message ||
                    "QR code is not available.";
                }

              } catch (error) {
                console.error(error);

                document.getElementById("status").textContent =
                  "Unable to connect to the bot";

                document.getElementById("qr").style.display =
                  "none";

                document.getElementById("message").textContent =
                  "Please wait and try again.";
              }
            }

            loadQR();

            setInterval(loadQR, 5000);
          </script>
        </body>
      </html>
    `);
  });

  return router;
}
