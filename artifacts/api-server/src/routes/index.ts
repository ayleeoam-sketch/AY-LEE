import { Router, type IRouter } from "express";
import healthRouter from "./health";
import type { WhatsAppConnection } from "../connection/whatsapp";

export function createRouter(whatsapp: WhatsAppConnection): IRouter {
  const router: IRouter = Router();

  // Health routes
  router.use(healthRouter);

  // =========================
  // WHATSAPP QR API
  // =========================
  router.get("/qr", (_req, res) => {
    try {
      const qr = whatsapp.getQrCode();
      const status = whatsapp.getStatus();

      return res.json({
        status,
        qr: qr || null,
        message: qr
          ? undefined
          : "WhatsApp QR code is not currently available.",
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

  // =========================
  // WHATSAPP STATUS API
  // =========================
  router.get("/status", (_req, res) => {
    try {
      return res.json({
        status: whatsapp.getStatus(),
      });
    } catch (error) {
      console.error("Status API error:", error);

      return res.status(500).json({
        status: "error",
        message: "Unable to retrieve WhatsApp status.",
      });
    }
  });

  return router;
}
