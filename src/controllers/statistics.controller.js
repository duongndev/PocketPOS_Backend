import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  badRequestResponse,
} from "../utils/response.js";
import { getDateRange } from "../utils/utility.function.js";
import {
  buildDailyChart,
  buildMonthlyChart,
  buildWeeklyChart,
} from "../utils/chart.util.js";
import logger from "../utils/logger.util.js";

const getSummary = async (storeId, startDate, endDate) => {
  const result = await Order.aggregate([
    {
      $match: {
        storeId,
        status: "completed",
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },
    {
      $group: {
        _id: null,

        revenue: {
          $sum: "$totalAmount",
        },

        profit: {
          $sum: "$profit",
        },

        orders: {
          $sum: 1,
        },
      },
    },
  ]);

  const summary = result[0] || {
    revenue: 0,
    profit: 0,
    orders: 0,
  };

  return {
    revenue: summary.revenue,
    profit: summary.profit,
    orders: summary.orders,

    averageOrderValue:
      summary.orders > 0 ? Math.round(summary.revenue / summary.orders) : 0,
  };
};

const getTopProducts = async (storeId, startDate, endDate) => {
  return Order.aggregate([
    {
      $match: {
        storeId,
        status: "completed",
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },

    {
      $unwind: "$items",
    },

    {
      $group: {
        _id: "$items.productId",

        productName: {
          $first: "$items.productName",
        },

        quantity: {
          $sum: "$items.quantity",
        },

        revenue: {
          $sum: "$items.subtotal",
        },
      },
    },

    {
      $sort: {
        quantity: -1,
      },
    },

    {
      $limit: 5,
    },
  ]);
};

const getRevenueChart = async (storeId, startDate, endDate, period) => {
  if (period === "daily") {
    const result = await Order.aggregate([
      {
        $match: {
          storeId,
          status: "completed",
          createdAt: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $group: {
          _id: {
            $hour: "$createdAt",
          },
          revenue: {
            $sum: "$totalAmount",
          },
        },
      },
      {
        $sort: {
          _id: 1,
        },
      },
    ]);

    return buildDailyChart(result);
  }

  if (period === "weekly") {
    const result = await Order.aggregate([
      {
        $match: {
          storeId,
          status: "completed",
          createdAt: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%d/%m",
              date: "$createdAt",
            },
          },
          revenue: {
            $sum: "$totalAmount",
          },
        },
      },
      {
        $sort: {
          _id: 1,
        },
      },
    ]);

    return buildWeeklyChart(result, startDate);
  }

  const result = await Order.aggregate([
    {
      $match: {
        storeId,
        status: "completed",
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },
    {
      $group: {
        _id: {
          $dayOfMonth: "$createdAt",
        },
        revenue: {
          $sum: "$totalAmount",
        },
      },
    },
    {
      $sort: {
        _id: 1,
      },
    },
  ]);

  return buildMonthlyChart(result, startDate);
};

export const getDashboardStatistics = async (req, res) => {
  try {
    const period = req.query.period || "daily";

    const { startDate, endDate } = getDateRange(period);

    const storeId = req.user.storeId;

    const [summary, chart, topProducts, totalProducts] = await Promise.all([
      getSummary(storeId, startDate, endDate),

      getRevenueChart(storeId, startDate, endDate, period),

      getTopProducts(storeId, startDate, endDate),

      Product.countDocuments({
        storeId,
        isActive: true,
      }),
    ]);

    if (!summary) {
      return notFoundResponse(res, "Không tìm thấy thống kê");
    }

    logger.info("Lấy thống kê", {
      userId: req.user._id,
      email: req.user.email,
      role: req.user.role,
      storeId: req.user.storeId,
      ip: req.ip,
      action: "GET_DASHBOARD_STATISTICS",
      details: {
        startDate,
        endDate,
        period,
      },
    });

    return successResponse(res, "Lấy thống kê thành công", {
      summary: {
        ...summary,
        totalProducts,
      },
      chart,
      topProducts,
    });
  } catch (error) {
    logger.error("Lỗi khi lấy thống kê", {
      error: error.message,
      stack: error.stack,
      userId: req.user._id,
      ip: req.ip,
      action: "GET_DASHBOARD_STATISTICS",
    });
    return errorResponse(res, "Không thể lấy thống kê", error.message);
  }
};
