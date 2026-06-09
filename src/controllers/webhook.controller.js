import mongoose from "mongoose";
import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import Payment from "../models/payment.model.js";
import { emitPaymentUpdate } from "../socket.js";
import logger from "../utils/logger.util.js";

const normalizeText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();

const emitPaymentSuccess = (payment, order, transactionId, gateway, referenceCode) => {
  emitPaymentUpdate(payment.storeId, {
    event: "payment_success",
    orderId: order._id.toString(),
    orderNumber: order.orderNumber,
    paymentStatus: "paid",
    orderStatus: order.status,
    amount: Number(payment.amount),
    transactionId,
    referenceCode,
    gateway,
    timestamp: new Date().toISOString(),
  });
};

export const sepayWebhook = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    const {
      id,
      gateway,
      transactionDate,
      content,
      transferType,
      transferAmount,
      referenceCode,
      code,
    } = req.body;

    logger.info("SEPAY_WEBHOOK_RECEIVED", {
      payload: req.body,
      rawContent: content,
      rawReferenceCode: referenceCode,
      rawCode: code,
      transferType,
      transferAmount,
      gateway,
      transactionDate,
    });

    /**
     * Chỉ xử lý giao dịch tiền vào
     */
    if (transferType !== "in") {
      await session.commitTransaction();

      return res.status(200).json({
        success: true,
        message: "Bỏ qua giao dịch tiền ra",
      });
    }

    /**
     * Chống webhook trùng
     */
    const existedTransaction =
      await Payment.findOne({
        transactionId: id,
      }).session(session);

    if (existedTransaction) {
      await session.commitTransaction();

      return res.status(200).json({
        success: true,
        message: "Webhook đã được xử lý",
      });
    }

    /**
     * Tìm payment theo nội dung CK
     *
     * Ví dụ:
     * TT ORD202606080001
     */
    const normalizedContent = normalizeText(content);
    const normalizedReferenceCode = normalizeText(referenceCode);
    const normalizedCode = normalizeText(code);

    const paymentCandidates = await Payment.find({
      paymentMethod: "bank_transfer",
      paymentStatus: "pending",
      $or: [
        { qrContent: { $exists: true, $ne: null } },
        { referenceCode: { $exists: true, $ne: null } },
      ],
    })
      .sort({ createdAt: -1 })
      .session(session);

    let matchedPayment = null;

    if (referenceCode || content) {
      matchedPayment = paymentCandidates.find((item) => {
        const normalizedQrContent = normalizeText(item.qrContent);
        const normalizedPaymentReferenceCode = normalizeText(item.referenceCode);

        const byReferenceCode =
          normalizedReferenceCode &&
          normalizedPaymentReferenceCode &&
          (normalizedReferenceCode.includes(normalizedPaymentReferenceCode) ||
            normalizedPaymentReferenceCode.includes(normalizedReferenceCode));

        const byCode =
          normalizedCode &&
          normalizedQrContent &&
          (normalizedCode.includes(normalizedQrContent) ||
            normalizedQrContent.includes(normalizedCode));

        const byContent =
          normalizedContent &&
          normalizedQrContent &&
          (normalizedContent.includes(normalizedQrContent) ||
            normalizedQrContent.includes(normalizedContent));

        return byReferenceCode || byCode || byContent;
      });
    }

    if (!matchedPayment) {
      matchedPayment = paymentCandidates.find((item) => {
        const normalizedQrContent = normalizeText(item.qrContent);

        return (
          normalizedContent.includes(normalizedQrContent) ||
          normalizedQrContent.includes(normalizedContent)
        );
      });
    }

    if (!matchedPayment) {
      const amountMatches = paymentCandidates.filter(
        (item) => Number(item.amount) === Number(transferAmount),
      );

      if (amountMatches.length > 0) {
        matchedPayment = amountMatches[0];
      }
    }

    if (!matchedPayment) {
      logger.warn("PAYMENT_NOT_FOUND", {
        content,
        referenceCode,
        paymentCandidatesCount: paymentCandidates.length,
        normalizedContent,
        normalizedReferenceCode,
        normalizedCode,
        transferAmount,
      });

      await session.commitTransaction();

      return res.status(200).json({
        success: true,
        message: "Không tìm thấy payment",
      });
    }

    /**
     * Đã thanh toán rồi
     */
    const payment = matchedPayment;

    if (payment.paymentStatus === "paid") {
      await session.commitTransaction();

      return res.status(200).json({
        success: true,
        message: "Payment đã thanh toán",
      });
    }

    /**
     * Kiểm tra số tiền
     */
    if (
      Number(transferAmount) <
      Number(payment.amount)
    ) {
      throw new Error(
        `Số tiền không hợp lệ. Yêu cầu ${payment.amount}, nhận ${transferAmount}`,
      );
    }

    const order =
      await Order.findById(
        payment.orderId,
      ).session(session);

    if (!order) {
      throw new Error(
        "Không tìm thấy đơn hàng",
      );
    }

    /**
     * Đơn hàng đã hoàn thành
     */
    if (order.status === "completed") {
      payment.paymentStatus = "paid";

      payment.transactionId = id;

      payment.referenceCode =
        referenceCode;

      payment.bankName = gateway;

      payment.paidAt =
        transactionDate
          ? new Date(transactionDate)
          : new Date();

      await payment.save({
        session,
      });

      await session.commitTransaction();

      emitPaymentSuccess(payment, order, id, gateway, referenceCode);

      return res.status(200).json({
        success: true,
      });
    }

    /**
     * Trừ tồn kho
     */
    const stockOperations = [];

    for (const item of order.items) {
      stockOperations.push({
        updateOne: {
          filter: {
            _id: item.productId,
            stock: {
              $gte: item.quantity,
            },
          },

          update: {
            $inc: {
              stock: -item.quantity,
            },
          },
        },
      });
    }

    if (stockOperations.length > 0) {
      const result =
        await Product.bulkWrite(
          stockOperations,
          {
            session,
          },
        );

      if (
        result.modifiedCount !==
        stockOperations.length
      ) {
        throw new Error(
          "Không thể cập nhật tồn kho",
        );
      }
    }

    /**
     * Update Payment
     */
    payment.paymentStatus = "paid";

    payment.transactionId = id;

    payment.referenceCode =
      referenceCode;

    payment.bankName = gateway;

    payment.paidAt =
      transactionDate
        ? new Date(transactionDate)
        : new Date();

    await payment.save({
      session,
    });

    /**
     * Update Order
     */
    order.status = "completed";

    await order.save({
      session,
    });

    await session.commitTransaction();

    emitPaymentSuccess(payment, order, id, gateway, referenceCode);

    logger.info(
      "PAYMENT_COMPLETED",
      {
        orderId: order._id,
        orderNumber:
          order.orderNumber,

        paymentId: payment._id,

        transactionId: id,

        amount:
          transferAmount,

        gateway,
      },
    );

    return res.status(200).json({
      success: true,
      message:
        "Thanh toán thành công",
    });
  } catch (error) {
    await session.abortTransaction();

    logger.error(
      "SEPAY_WEBHOOK_ERROR",
      {
        error: error.message,
        stack: error.stack,
        payload: req.body,
      },
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  } finally {
    await session.endSession();
  }
};