import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import Store from "../models/store.model.js";
import {
  successResponse,
  errorResponse,
  createdResponse,
  badRequestResponse,
  notFoundResponse,
} from "../utils/response.js";
import logger from "../utils/logger.util.js";
import {
  generateOrderNumber,
  generateSePayQrUrl,
} from "../utils/utility.function.js";
import mongoose from "mongoose";
import Payment from "../models/payment.model.js";

export const createOrder = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    const { paymentMethod, note, items } = req.body;

    if (!items || items.length === 0) {
      return badRequestResponse(res, "Đơn hàng phải có ít nhất 1 sản phẩm");
    }

    if (!["cash", "bank_transfer"].includes(paymentMethod)) {
      return badRequestResponse(res, "Phuong thức thanh toán không hợp lệ");
    }

    const store = await Store.findById(req.user.storeId).session(session);

    if (!store) {
      return notFoundResponse(res, "Không tìm thấy cửa hàng");
    }

    if (
      paymentMethod === "bank_transfer" &&
      (!store.bankInfo?.accountNumber || !store.bankInfo?.bankCode)
    ) {
      return badRequestResponse(
        res,
        "Vui lòng cấu hình tài khoản ngân hàng trước khi thanh toán chuyển khoản",
      );
    }

    const itemMap = new Map();

    for (const item of items) {
      if (!item.productId) {
        return badRequestResponse(res, "Sản phẩm không hợp lệ");
      }

      if (item.quantity <= 0) {
        return badRequestResponse(res, "Số lượng phải lớn hơn 0");
      }

      if (itemMap.has(item.productId)) {
        itemMap.get(item.productId).quantity += item.quantity;
      } else {
        itemMap.set(item.productId, {
          productId: item.productId,
          quantity: item.quantity,
        });
      }
    }

    const uniqueItems = Array.from(itemMap.values());

    const productIds = uniqueItems.map((item) => item.productId);

    const products = await Product.find({
      _id: { $in: productIds },
      storeId: req.user.storeId,
      isActive: true,
    }).session(session);

    if (products.length !== productIds.length) {
      return notFoundResponse(
        res,
        "Sản phẩm không tồn tại hoặc ngừng kinh doanh",
      );
    }

    let totalAmount = 0;
    let totalCost = 0;
    let totalQuantity = 0;

    const orderItems = [];
    const stockOperations = [];

    for (const item of uniqueItems) {
      const product = products.find((p) => p._id.toString() === item.productId);

      if (!product) {
        return notFoundResponse(
          res,
          "Sản phẩm không tồn tại hoặc ngừng kinh doanh",
        );
      }

      if (paymentMethod === "cash" && product.stock < item.quantity) {
        return badRequestResponse(
          res,
          `${product.name} không đủ tồn kho (còn ${product.stock})`,
        );
      }

      const subtotal = product.sellingPrice * item.quantity;

      const itemCost = product.costPrice * item.quantity;

      totalAmount += subtotal;
      totalCost += itemCost;
      totalQuantity += item.quantity;

      orderItems.push({
        productId: product._id,
        productName: product.name,
        sku: product.sku,
        barcode: product.barcode,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        quantity: item.quantity,
        subtotal,
      });

      if (paymentMethod === "cash") {
        stockOperations.push({
          updateOne: {
            filter: {
              _id: product._id,
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
    }

    if (totalAmount <= 0) {
      return badRequestResponse(res, "Tổng tiền đơn hàng không hợp lệ");
    }

    const orderNumber = await generateOrderNumber();

    const profit = totalAmount - totalCost;

    const order = await Order.create(
      [
        {
          storeId: req.user.storeId,
          createdBy: req.user._id,

          orderNumber,

          items: orderItems,

          totalAmount,
          totalCost,
          profit,
          totalQuantity,
          note,
          status: paymentMethod === "cash" ? "completed" : "pending",
        },
      ],
      { session },
    );

    const createdOrder = order[0];

    let qrUrl = null;

    if (paymentMethod === "bank_transfer") {
      const transferContent = `TT ${orderNumber}`;

      qrUrl = generateSePayQrUrl({
        amount: totalAmount,
        orderNumber: transferContent,
        accountNumber: store.bankInfo.accountNumber,
        bankCode: store.bankInfo.bankCode,
      });
    }

    const payment = await Payment.create(
      [
        {
          orderId: createdOrder._id,
          storeId: req.user.storeId,
          amount: totalAmount,
          paymentMethod,
          paymentStatus: paymentMethod === "cash" ? "paid" : "pending",
          qrContent:
            paymentMethod === "bank_transfer" ? `TT ${orderNumber}` : null,
          paidAt: paymentMethod === "cash" ? new Date() : null,
        },
      ],
      { session },
    );

    if (paymentMethod === "cash" && stockOperations.length > 0) {
      const result = await Product.bulkWrite(stockOperations, { session });

      if (result.modifiedCount !== stockOperations.length) {
        return badRequestResponse(res, "Không thể cập nhật kho");
      }
    }

    await session.commitTransaction();

    logger.info("Tạo đơn hàng", {
      userId: req.user._id,
      email: req.user.email,
      role: req.user.role,
      storeId: req.user.storeId,
      ip: req.ip,
      action: "CREATE_ORDER",
      details: {
        orderNumber,
        totalAmount,
        totalCost,
        profit,
        paymentMethod,
        paymentStatus: payment[0].paymentStatus,
        qrUrl,
      },
    });

    return createdResponse(res, "Tạo đơn hàng thành công", {
      orderId: createdOrder._id,
      orderNumber,
      totalAmount,
      totalCost,
      profit,
      paymentMethod,
      paymentStatus: payment[0].paymentStatus,
      qrUrl,
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error("Lỗi tạo đơn hàng", {
      error: error.message,
      stack: error.stack,
      userId: req.user._id,
      email: req.user.email,
      role: req.user.role,
      storeId: req.user.storeId,
      ip: req.ip,
      action: "CREATE_ORDER",
    });

    return badRequestResponse(res, error.message);
  } finally {
    await session.endSession();
  }
};

export const getOrderById = async (req, res) => {
  try {
    const [order, payment] = await Promise.all([
      Order.findOne({
        _id: req.params.id,
        storeId: req.user.storeId,
      }).populate("createdBy", "fullName"),
      Payment.findOne({
        orderId: req.params.id,
        storeId: req.user.storeId,
      }).lean(),
    ]);

    if (!order) {
      return notFoundResponse(res, "Không tìm thấy hóa đơn");
    }

    const items = order.items;
    const orderInfo = order.toObject();

    delete orderInfo.items;

    logger.info("Lấy chi tiết đơn hàng", {
      userId: req.user._id,
      email: req.user.email,
      role: req.user.role,
      storeId: req.user.storeId,
      ip: req.ip,
      action: "GET_ORDER_DETAIL",
      details: {
        orderId: req.params.id,
        items,
        paymentStatus: payment?.paymentStatus || null,
      },
    });

    return successResponse(res, "Lấy chi tiết đơn hàng thành công", {
      order: orderInfo,
      items,
      payment: payment || null,
    });
  } catch (error) {
    logger.error("Lỗi khi lấy chi tiết đơn hàng", {
      userId: req.user._id,
      email: req.user.email,
      role: req.user.role,
      storeId: req.user.storeId,
      ip: req.ip,
      action: "GET_ORDER_DETAIL",
      details: {
        orderId: req.params.id,
        error: error.message,
      },
    });

    return errorResponse(res, "Lỗi hệ thống", error.message);
  }
};

export const cancelOrder = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const order = await Order.findOne({
      _id: req.params.id,
      storeId: req.user.storeId,
    }).session(session);

    if (!order) {
      await session.abortTransaction();
      return notFoundResponse(res, "Không tìm thấy hóa đơn");
    }

    if (order.status === "cancelled") {
      await session.abortTransaction();
      return errorResponse(res, "Hóa đơn đã bị hủy", "Hóa đơn đã bị hủy");
    }

    for (const item of order.items) {
      await Product.updateOne(
        { _id: item.productId },
        { $inc: { stock: item.quantity } },
        { session },
      );
    }

    order.status = "cancelled";
    await order.save({ session });
    await session.commitTransaction();

    logger.info("Hủy hóa đơn", {
      userId: req.user._id,
      email: req.user.email,
      role: req.user.role,
      storeId: req.user.storeId,
      ip: req.ip,
      action: "CANCEL_ORDER",
      details: {
        orderId: req.params.id,
        items: order.items,
      },
    });
    return successResponse(res, "Hủy hóa đơn thành công", order);
  } catch (error) {
    await session.abortTransaction();
    return errorResponse(res, "Lỗi hệ thống", error.message);
  } finally {
    session.endSession();
  }
};

export const getOrders = async (req, res) => {
  try {
    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);

    page = !isNaN(page) && page > 0 ? page : 1;
    limit = !isNaN(limit) && limit > 0 ? limit : 10;

    if (limit > 100) limit = 100;

    const skip = (page - 1) * limit;

    const allowedSortFields = ["createdAt", "totalAmount", "status"];

    let sortBy = req.query.sortBy || "createdAt";
    if (!allowedSortFields.includes(sortBy)) {
      sortBy = "createdAt";
    }

    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    const sortOptions = { [sortBy]: sortOrder };

    const query = { storeId: req.user.storeId };

    const [result, total] = await Promise.all([
      Order.find(query)
        .populate("createdBy", "fullName")
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    const pagination = {
      currentPage: page,
      itemsPerPage: limit,
      totalItems: total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };

    logger.info("Lấy danh sách đơn hàng", {
      userId: req.user._id,
      storeId: req.user.storeId,
      action: "GET_ORDERS",
      pagination: { page, limit, total },
    });

    return successResponse(res, "Lấy danh sách đơn hàng thành công", {
      orders: result,
      pagination,
    });
  } catch (error) {
    logger.error("Lỗi khi lấy danh sách đơn hàng", {
      userId: req.user._id,
      error: error.message,
      stack: error.stack,
    });
    return errorResponse(res, "Lỗi hệ thống", error.message);
  }
};

export const updatePaymentStatus = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    const orderId = req.params.id || req.body.orderId;
    const { paymentStatus } = req.body;

    if (!orderId) {
      return badRequestResponse(res, "Thiếu mã đơn hàng");
    }

    if (!['pending', 'paid', 'failed'].includes(paymentStatus)) {
      return badRequestResponse(res, "Trạng thái thanh toán không hợp lệ");
    }

    const order = await Order.findOne({
      _id: orderId,
      storeId: req.user.storeId,
    }).session(session);

    
    if (!order) {
      return notFoundResponse(res, "Không tìm thấy đơn hàng");
    }

    const payment = await Payment.findOne({
      orderId: order._id,
      storeId: req.user.storeId,
    }).session(session);

    if (!payment) {
      return notFoundResponse(res, "Không tìm thấy thông tin thanh toán");
    }

    if (payment.paymentStatus === paymentStatus) {
      return successResponse(res, "Trạng thái thanh toán đã được cập nhật", {
        orderId: order._id,
        orderNumber: order.orderNumber,
        paymentStatus: payment.paymentStatus,
        orderStatus: order.status,
      });
    }

    if (paymentStatus === "paid") {
      if (order.status !== "completed") {
        if (payment.paymentMethod === "bank_transfer") {
          const stockOperations = [];

          for (const item of order.items) {
            stockOperations.push({
              updateOne: {
                filter: {
                  _id: item.productId,
                  stock: { $gte: item.quantity },
                },
                update: {
                  $inc: { stock: -item.quantity },
                },
              },
            });
          }

          if (stockOperations.length > 0) {
            const result = await Product.bulkWrite(stockOperations, { session });

            if (result.modifiedCount !== stockOperations.length) {
              return badRequestResponse(res, "Không thể cập nhật tồn kho");
            }
          }
        }

        order.status = "completed";
      }

      payment.paymentStatus = "paid";
      payment.paidAt = payment.paidAt || new Date();
    } else {
      payment.paymentStatus = paymentStatus;

      if (paymentStatus === "failed") {
        payment.paidAt = null;
      }
    }

    await Promise.all([payment.save({ session }), order.save({ session })]);
    await session.commitTransaction();

    logger.info("CẬP_NHẬT_TRẠNG_THAI_THANH_TOÁN", {
      userId: req.user._id,
      storeId: req.user.storeId,
      orderId: order._id,
      orderNumber: order.orderNumber,
      paymentStatus,
      action: "UPDATE_PAYMENT_STATUS",
    });

    // lấy chi tiết đơn hàng bao gồm cả thanh toán
    const [orderInfo, paymentInfo] = await Promise.all([
      Order.findOne({
        _id: orderId,
        storeId: req.user.storeId,
      }).session(session),
      Payment.findOne({
        orderId: orderId,
        storeId: req.user.storeId,
      }).session(session),
    ]);
    
    return successResponse(res, "Cập nhật trạng thái thanh toán", {
      orderId: orderInfo._id,
      orderNumber: orderInfo.orderNumber,
      paymentStatus: paymentInfo.paymentStatus,
      orderStatus: orderInfo.status,
    });

  } catch (error) {
    await session.abortTransaction();
    logger.error("Lỗi cập nhật trạng thái thanh toán", {
      error: error.message,
      stack: error.stack,
      userId: req.user._id,
      storeId: req.user.storeId,
      action: "UPDATE_PAYMENT_STATUS",
    });

    return errorResponse(res, "Lỗi hệ thống", error.message);
  } finally {
    await session.endSession();
  }
};