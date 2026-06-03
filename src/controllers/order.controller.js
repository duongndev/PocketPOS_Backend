import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import OrderItem from "../models/orderItem.model.js";
import {
  paginate,
  parsePaginationParams,
  parseSortParams,
  createPaginationMeta,
} from "../utils/pagination.util.js";
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

    const productIds = items.map((item) => item.productId);

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

    for (const item of items) {
      const product = products.find((p) => p._id.toString() === item.productId);
      if (!product) {
        await session.abortTransaction();
        return badRequestResponse(res, "Không tìm thấy sản phẩm");
      }

      if (item.quantity <= 0) {
        await session.abortTransaction();
        return badRequestResponse(
          res,
          `Số lượng không hợp lệ: ${product.name}`,
        );
      }

      if (product.stock < item.quantity) {
        await session.abortTransaction();
        return badRequestResponse(res, `${product.name} không đủ tồn kho`);
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
      product.stock -= item.quantity;
      await product.save({ session });
    }

    const profit = totalAmount - totalCost;

    const orderNumber = await generateOrderNumber();
    const order = await Order.create(
      [
        {
          storeId: req.user.storeId,
          createdBy: req.user._id,
          orderNumber,
          totalQuantity,
          totalCost,
          totalAmount,
          profit,
          paymentMethod,
          note,
          status: "completed",
        },
      ],
      { session },
    );

    const orderId = order[0]._id;

    const orderItemDocuments = orderItems.map((item) => ({
      ...item,
      orderId,
    }));

    await OrderItem.insertMany(orderItemDocuments, { session });

    await session.commitTransaction();

    logger.info("Tạo đơn hàng mới", {
      userId: req.user._id,
      email: req.user.email,
      role: req.user.role,
      storeId: req.user.storeId,
      ip: req.ip,
      action: "CREATE_ORDER",
    });

    return createdResponse(res, "Đơn hàng đã được tạo thành công", {
      orderId,
      orderNumber,
      totalQuantity,
      totalAmount,
      profit,
    });
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

export const getOrders = async (req, res) => {
  try {
    // Parse pagination parameters
    const paginationParams = parsePaginationParams(req, {
      defaultPage: 1,
      defaultLimit: 10,
      maxLimit: 100,
    });

    // Parse sort parameters
    const sortParams = parseSortParams(req, ["createdAt", "totalAmount", "status"], "createdAt", "desc");

    // Build query
    const query = {
      storeId: req.user.storeId,
    };

    // Execute paginated query
    const result = await Order.find(query)
      .populate("createdBy", "fullName")
      .sort(sortParams.sortOptions)
      .skip(paginationParams.skip)
      .limit(paginationParams.limit)
      .lean();

    // Get total count
    const total = await Order.countDocuments(query);

    // Create pagination metadata
    const pagination = createPaginationMeta(paginationParams.page, paginationParams.limit, total);

    if (result.length === 0 && paginationParams.page === 1) {
      return notFoundResponse(res, "Không tìm thấy đơn hàng");
    }

    logger.info("Lấy danh sách đơn hàng", {
      userId: req.user._id,
      email: req.user.email,
      role: req.user.role,
      storeId: req.user.storeId,
      ip: req.ip,
      action: "GET_ORDERS",
      pagination: {
        page: paginationParams.page,
        limit: paginationParams.limit,
        total,
      },
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

export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      storeId: req.user.storeId,
    });

    if (!order) {
      return notFoundResponse(res, "Không tìm thấy hóa đơn");
    }

    const items = await OrderItem.find({
      orderId: order._id,
    });

    logger.info("Lấy chi tiết đơn hàng", {
      userId: req.user._id,
      email: req.user.email,
      role: req.user.role,
      storeId: req.user.storeId,
      ip: req.ip,
      action: "GET_ORDER_DETAIL",
      details: {
        orderId: order._id,
      },
    });

    return successResponse(res, "Lấy chi tiết đơn hàng thành công", {
      order,
      items,
    });
  } catch (error) {
    logger.error("Lỗi khi lấy chi tiết đơn hàng", {
      error: error.message,
      stack: error.stack,
      body: req.body,
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

    const items = await OrderItem.find({
      orderId: order._id,
    }).session(session);

    for (const item of items) {
      await Product.findByIdAndUpdate(
        item.productId,
        {
          $inc: {
            stock: item.quantity,
          },
        },
        {
          session,
        },
      );
    }

    order.status = "cancelled";

    await order.save({
      session,
    });

    await session.commitTransaction();

    logger.info("Hủy hóa đơn", {
      userId: req.user._id,
      email: req.user.email,
      role: req.user.role,
      storeId: req.user.storeId,
      ip: req.ip,
      action: "CANCEL_ORDER",
      details: {
        orderId: order._id,
      },
    });

    return successResponse(res, "Hủy hóa đơn thành công", null);
  } catch (error) {
    await session.abortTransaction();

    logger.error("Lỗi khi hủy hóa đơn", {
        error: error.message,
        stack: error.stack,
        body: req.body,
    })
    return errorResponse(res, "Lỗi hệ thống", error.message);
  } finally {
    session.endSession();
  }
};
