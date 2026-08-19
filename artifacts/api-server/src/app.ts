import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { createRouter } from "./routes";
import { logger } from "./lib/logger";
import type { WhatsAppConnection } from "./connection/whatsapp";

export function createApp(whatsapp: WhatsAppConnection): Express {
  const app: Express = express();

  app.use(
    pinoHttp({
      logger,
      serializers: {
        req(req) {
          return {
            id: req.id,
            method: req.method,
            url: req.url?.split("?")[0],
          };
        },
        res(res) {
          return {
            statusCode: res.statusCode,
          };
        },
      },
    }),
  );

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get("/qr", (_req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>AY-LEE BOT - WhatsApp QR</title>
          <style>
            body {
              margin: 0;
              min-height: 100vh;
              display: flex;
              justify-content: center;
              align-items: center;
              background: #111827;
              color: white;
              font-family: Arial, sans-serif;
            }

            .container {
              text-align: center;
              background: #1f2937;
              padding: 30px;
              border-radius: 20px;
              max-width: 400px;
              width: 90%;
            }

            h1 {
              margin-bottom: 10px;
            }

            #status {
              margin-bottom: 20px;
              color: #9ca3af;
            }

            #qr {
              width: 280px;
              height: 280px;
              background: white;
              padding: 10px;
              border-radius: 10px;
            }

            #message {
              margin-top: 15px;
              color: #9ca3af;
            }
          </style>
        </head>

        <body>
          <div class="container">
            <h1>AY-LEE BOT</h1>
            <div id="status">Loading...</div>

            <img id="qr" alt="WhatsApp QR Code" />

            <div id="message">
              Scan this QR code with WhatsApp
            </div>
          </div>

          <script>
            async function loadQR() {
              try {
                const response = await fetch("/api/qr");
                const data = await response.json();

                document.getElementById("status").textContent =
                  "Status: " + data.status;

                if (data.qr) {
                  document.getElementById("qr").src = data.qr;
                  document.getElementById("qr").style.display = "inline-block";
                  document.getElementById("message").textContent =
                    "Scan this QR code with WhatsApp";
                } else {
                  document.getElementById("qr").style.display = "none";
                  document.getElementById("message").textContent =
                    data.message || "QR code is not available.";
                }
              } catch (error) {
                document.getElementById("status").textContent =
                  "Unable to connect to the bot";
                document.getElementById("qr").style.display = "none";
                document.getElementById("message").textContent =
                  "Please try again.";
              }
            }

            loadQR();
            setInterval(loadQR, 5000);
          </script>
        </body>
      </html>
    `);
  });

  app.use("/api", createRouter(whatsapp));

  return app;
}