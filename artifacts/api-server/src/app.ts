import { Router, type IRouter } from "express";
import healthRouter from "./health";
import type { WhatsAppConnection } from "../connection/whatsapp";

export function createRouter(whatsapp: WhatsAppConnection): IRouter {
  const router: IRouter = Router();

  router.use(healthRouter);

  // API endpoint
  // Because this router is mounted with "/api" in app.ts,
  // this becomes: GET /api/qr
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

  return router;
}
