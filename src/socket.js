import { Server } from "socket.io";

let io;

export const initSocket = (server) => {
  if (io) return io;

  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on("join_store", (payload) => {
      const storeId = typeof payload === "string" ? payload : payload?.storeId;
      const orderId = typeof payload === "string" ? null : payload?.orderId;

      if (storeId) {
        socket.join(`store:${storeId}`);
        console.log(`Socket ${socket.id} joined store:${storeId}`);
      }

      if (orderId) {
        socket.join(`order:${orderId}`);
        console.log(`Socket ${socket.id} joined order:${orderId}`);
      }
    });

    socket.on("join_order", (orderId) => {
      if (!orderId) return;

      socket.join(`order:${orderId}`);
      console.log(`Socket ${socket.id} joined order:${orderId}`);
    });

    socket.on("leave_store", (payload) => {
      const storeId = typeof payload === "string" ? payload : payload?.storeId;

      if (storeId) {
        socket.leave(`store:${storeId}`);
      }
    });

    socket.on("leave_order", (orderId) => {
      if (!orderId) return;

      socket.leave(`order:${orderId}`);
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const emitPaymentUpdate = (storeId, payload) => {
  if (!io) return false;

  if (storeId) {
    io.to(`store:${storeId}`).emit("payment_success", payload);
  }

  if (payload?.orderId) {
    io.to(`order:${payload.orderId}`).emit("payment_success", payload);
  }

  return true;
};
