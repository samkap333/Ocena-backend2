const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();
require('./config/database');

// Import routes
const contactRoutes = require('./routes/api');
const emailRoutes   = require('./routes/emailRoute');
const chatRoutes    = require('./routes/chatRoute');
const careerRoutes  = require('./routes/careerRoute');
const authRoutes = require('./routes/auth.routes');
const leadsRoutes = require('./routes/leads.routes');
const campaignsRoutes = require('./routes/campaigns.routes');
const invoicesRoutes = require('./routes/invoices.routes');
const paymentsRoutes = require('./routes/payments.routes');
const tasksRoutes = require('./routes/tasks.routes');
const reportsRoutes = require('./routes/reports.routes');
const settingsRoutes = require('./routes/settings.routes');
const integrationsRoutes = require('./routes/integrations.routes');
const workflowsRoutes = require('./routes/workflows.routes');
const ticketsRoutes = require('./routes/tickets.routes');
const notificationsRoutes = require('./routes/notifications.routes');

// Import middleware
const middleware = require('./middleware');
const authMiddleware = require('./middleware/auth.middleware');
const tenantMiddleware = require('./middleware/tenant.middleware');
const rateLimitMiddleware = require('./middleware/rateLimit.middleware');
const errorHandler = require('./middleware/errorHandler.middleware');
const notificationService = require('./services/notification.service');

const server = express();
const httpServer = http.createServer(server);
const io = new Server(httpServer, { cors: { origin: '*' } });
notificationService.attachSocket(io);

// Apply middleware
middleware(server);
server.use('/api/v1', rateLimitMiddleware);

// Routes
server.use('/', contactRoutes);
server.use('/', emailRoutes);
server.use('/', chatRoutes);
server.use('/', careerRoutes);

server.use('/api/v1/auth', authRoutes);
server.use('/api/v1/leads', authMiddleware, tenantMiddleware, leadsRoutes);
server.use('/api/v1/campaigns', authMiddleware, tenantMiddleware, campaignsRoutes);
server.use('/api/v1/invoices', authMiddleware, tenantMiddleware, invoicesRoutes);
server.use('/api/v1/payments', authMiddleware, tenantMiddleware, paymentsRoutes);
server.use('/api/v1/tasks', authMiddleware, tenantMiddleware, tasksRoutes);
server.use('/api/v1/reports', authMiddleware, tenantMiddleware, reportsRoutes);
server.use('/api/v1/settings', authMiddleware, tenantMiddleware, settingsRoutes);
server.use('/api/v1/integrations', authMiddleware, tenantMiddleware, integrationsRoutes);
server.use('/api/v1/workflows', authMiddleware, tenantMiddleware, workflowsRoutes);
server.use('/api/v1/tickets', authMiddleware, tenantMiddleware, ticketsRoutes);
server.use('/api/v1/notifications', authMiddleware, tenantMiddleware, notificationsRoutes);

server.use(errorHandler);

// Start the server
const port = process.env.PORT || 8000;
httpServer.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
