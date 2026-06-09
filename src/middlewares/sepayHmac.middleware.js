import crypto from "crypto";

export const sepayHmac = (req, res, next) => {
  try {
    const secret = process.env.SEPAY_WEBHOOK_SECRET;

    const signatureHeader = req.headers["x-sepay-signature"];
    const timestamp = req.headers["x-sepay-timestamp"];

    if (!secret) {
      return res.status(500).json({
        success: false,
        message: "Missing SEPAY_WEBHOOK_SECRET",
      });
    }

    if (!signatureHeader || !timestamp) {
      return res.status(401).json({
        success: false,
        message: "Missing SePay headers",
      });
    }

    const rawBody = req.rawBody;

    if (!rawBody) {
      return res.status(400).json({
        success: false,
        message: "Missing raw body",
      });
    }

    // 1. Create string theo đúng SePay spec
    const payloadToSign = `${timestamp}.${rawBody}`;

    // 2. Generate HMAC SHA256
    const hash = crypto
      .createHmac("sha256", secret)
      .update(payloadToSign, "utf8")
      .digest("hex");

    const expectedSignature = `sha256=${hash}`;

    // 3. Verify signature (timing safe)
    const isValid =
      signatureHeader.length === expectedSignature.length &&
      crypto.timingSafeEqual(
        Buffer.from(signatureHeader),
        Buffer.from(expectedSignature),
      );

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid SePay signature",
      });
    }

    next();
  } catch (error) {
    console.error("SePay HMAC error:", error);
    return res.status(500).json({
      success: false,
      message: "Webhook verification error",
    });
  }
};
