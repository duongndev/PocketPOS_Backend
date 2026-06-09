// Helper: Sanitize input để tránh XSS
export const sanitizeInput = (input) => {
  if (typeof input !== "string") return input;

  return input
    .replace(/[<>]/g, "") // Loại bỏ < >
    .replace(/javascript:/gi, "") // Loại bỏ javascript:
    .replace(/on\w+=/gi, "") // Loại bỏ event handlers
    .trim();
};

// Helper: Check if IP is in allowed range
export const isIPAllowed = (ip, allowedIPs = []) => {
  if (allowedIPs.length === 0) return true;
  return allowedIPs.includes(ip);
};

export const generateSKU = (name) => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  const namePart = name
    ? name.replace(/\s+/g, "").substring(0, 3).toUpperCase()
    : "PRD";
  return `${namePart}-${timestamp}-${randomStr}`;
};

import Counter from "../models/counter.model.js";

export const generateOrderNumber = async () => {
  const now = new Date();

  const date =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0");

  const counter = await Counter.findOneAndUpdate(
    {
      name: `ORDER_${date}`,
    },
    {
      $inc: {
        sequence: 1,
      },
    },
    {
      new: true,
      upsert: true,
    },
  );

  const sequence = String(counter.sequence).padStart(4, "0");

  return `ORD-${date}${sequence}`;
};

export const getDateRange = (period) => {
  const now = new Date();

  let startDate;
  let endDate = new Date();

  switch (period) {
    case "daily":
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      break;

    case "weekly":
      startDate = new Date();
      startDate.setDate(now.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
      break;

    case "monthly":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;

    default:
      throw new Error("Period không hợp lệ");
  }

  return {
    startDate,
    endDate,
  };
};

export const BankList = [
  {
    code: "MB",
    name: "MB Bank",
  },
  {
    code: "VCB",
    name: "Vietcombank",
  },
  {
    code: "TCB",
    name: "Techcombank",
  },
  {
    code: "BIDV",
    name: "BIDV",
  },
  {
    code: "CTG",
    name: "VietinBank",
  },
  {
    code: "ACB",
    name: "ACB",
  },
  {
    code: "VPB",
    name: "VPBank",
  },
  {
    code: "TPB",
    name: "TPBank",
  },
  {
    code: "OCB",
    name: "OCB",
  },
  {
    code: "STB",
    name: "Sacombank",
  },
];

export const generateSePayQrUrl = ({
  amount,
  orderNumber,
  accountNumber,
  bankCode,
}) => {
  const description = encodeURIComponent(`TT ${orderNumber}`);
  return `https://qr.sepay.vn/img?acc=${accountNumber}&bank=${bankCode}&amount=${amount}`;
};
