import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import {
  successResponse,
  errorResponse,
  createdResponse,
  badRequestResponse,
  notFoundResponse,
} from "../utils/response.js";
import logger from "../utils/logger.util.js";
import { generateOrderNumber } from "../utils/utility.function.js";
import mongoose from "mongoose";

export const createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const { paymentMethod, note, items } = req.body;

    if (!items || items.length === 0) {
      await session.abortTransaction();
      return badRequestResponse(res, "Đơn hàng phải có ít nhất một sản phẩm");
    }

    const itemMap = new Map();
    for (const item of items) {
      if (item.quantity <= 0) {
        await session.abortTransaction();
        return badRequestResponse(res, "Số lượng sản phẩm không hợp lệ");
      }
      if (itemMap.has(item.productId)) {
        itemMap.get(item.productId).quantity += item.quantity;
      } else {
        itemMap.set(item.productId, { ...item });
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
      await session.abortTransaction();
      return badRequestResponse(
        res,
        "Sản phẩm không tồn tại hoặc không hoạt động",
      );
    }

    let totalAmount = 0;
    let totalCost = 0;
    let totalQuantity = 0;
    const orderItems = [];
    const bulkOperations = [];

    for (const item of uniqueItems) {
      const product = products.find((p) => p._id.toString() === item.productId);

      if (product.stock < item.quantity) {
        await session.abortTransaction();
        return badRequestResponse(
          res,
          `Sản phẩm ${product.name} không đủ hàng trong kho (hiện có ${product.stock})`,
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

      bulkOperations.push({
        updateOne: {
          filter: {
            _id: product._id,
            stock: { $gte: item.quantity }, // Đảm bảo lúc ghi DB, tồn kho vẫn đủ
          },
          update: { $inc: { stock: -item.quantity } },
        },
      });
    }

    const profit = totalAmount - totalCost;
    const orderNumber = await generateOrderNumber();

    const newOrder = new Order({
      storeId: req.user.storeId,
      createdBy: req.user._id,
      orderNumber,
      totalAmount,
      totalCost,
      profit,
      totalQuantity,
      paymentMethod,
      note,
      status: "completed",
      items: orderItems,
    });

    await newOrder.save({ session });
    await session.commitTransaction();

    logger.info("Tạo đơn hàng", {
      userId: req.user._id,
      email: req.user.email,
      role: req.user.role,
      storeId: req.user.storeId,
      ip: req.ip,
      action: "CREATE_ORDER",
      details: {
        orderNumber: newOrder.orderNumber,
        totalAmount: newOrder.totalAmount,
        totalCost: newOrder.totalCost,
        profit: newOrder.profit,
        totalQuantity: newOrder.totalQuantity,
        paymentMethod: newOrder.paymentMethod,
        note: newOrder.note,
        status: newOrder.status,
        items: newOrder.items,
      },
    });

    return createdResponse(res, "Tạo đơn hàng thành công", newOrder);
  } catch (error) {
    await session.abortTransaction();
    logger.error("Lỗi khi tạo đơn hàng", {
      error: error.message,
      stack: error.stack,
      body: req.body,
    });
    return errorResponse(res, "Đã xảy ra lỗi khi tạo đơn hàng", error.message);
  } finally {
    session.endSession();
  }
};

export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      storeId: req.user.storeId,
    });

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
      },
    });

    return successResponse(res, "Lấy chi tiết đơn hàng thành công", {
      order: orderInfo,
      items,
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
        items: order.items,
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
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(query)
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
      pagination: { page, limit, total }
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