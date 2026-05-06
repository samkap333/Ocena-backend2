const { Notification } = require('../models/crm');

let io;

exports.attachSocket = (socketServer) => {
  io = socketServer;
};

exports.notifyUser = async ({ userId, type, message }) => {
  const notification = await Notification.create({ userId, type, message });
  if (io) {
    io.to(userId).emit('notification', notification);
  }
  return notification;
};
