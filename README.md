# Ocena Backend API

Robust RESTful API and WebSocket service powering the **Ocena Smart Solutions** platform, website, CRM, HRMS, and analytics engine.

Built with **Node.js**, **Express**, **MongoDB (Mongoose)**, and **Socket.io**.

---

## 📋 Table of Contents
- [Features](#-features)
- [Architecture & Tech Stack](#-architecture--tech-stack)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Environment Configuration](#-environment-configuration)
- [Database Seeding](#-database-seeding)
- [Running the Server](#-running-the-server)
  - [Development Mode](#development-mode)
  - [Standard Start](#standard-start)
- [Production Deployment](#-production-deployment)
  - [Process Management with PM2 (Recommended)](#process-management-with-pm2-recommended)
  - [Sample `ecosystem.config.js`](#sample-ecosystemconfigjs)
  - [Nginx Reverse Proxy Configuration](#nginx-reverse-proxy-configuration)
  - [SSL with Let's Encrypt](#ssl-with-lets-encrypt)
  - [Systemd Service Setup (Alternative)](#systemd-service-setup-alternative)
- [API Endpoints Overview](#-api-endpoints-overview)
- [Health Check & Monitoring](#-health-check--monitoring)
- [Troubleshooting & FAQs](#-troubleshooting--faqs)

---

## ✨ Features

- **Authentication & RBAC**: JWT access & refresh tokens, password hashing with bcrypt, role-based and multi-tenant access control.
- **CRM Suite**:
  - Leads tracking & CSV import/export
  - Deals pipeline & Quotes generation
  - Customer directory & Products catalog
  - Campaign management & Workflows automation
  - Invoicing (with automated PDF generation using PDFKit)
  - Payment processing with Stripe
  - Tasks & Support Tickets tracking
- **HRMS & Employee Management**: Employee records, attendance, and leave management.
- **Real-Time Communications**:
  - WebSockets powered by Socket.IO for instant in-app alerts and notifications.
  - Email automation with Brevo API.
  - SMS & WhatsApp notifications via Twilio.
- **Website Analytics Engine**:
  - Real-time visitor tracking and session analytics.
  - Geo-location lookup using `geoip-lite`.
  - Referrer, device, country, and page views breakdown.
- **Cloud Storage**: AWS S3 integration for secure file uploads and assets.
- **Google Sheets Sync**: Two-way synchronization for incoming leads and form submissions.

---

## 🛠 Architecture & Tech Stack

| Component | Technology |
|---|---|
| **Runtime** | Node.js (v18+ LTS recommended) |
| **Framework** | Express.js 4.x |
| **Database** | MongoDB with Mongoose ODM |
| **WebSockets** | Socket.IO 4.x |
| **Security & Auth** | JWT, Bcrypt, CORS, Express Rate Limit |
| **File Storage** | AWS S3 SDK (`@aws-sdk/client-s3`), Multer |
| **Third-Party Services** | Stripe, Brevo (Sendinblue), Twilio, Google APIs |

---

## 📦 Prerequisites

Before starting, ensure you have the following installed on your machine or server:

- **Node.js**: `v18.x` or `v20.x` LTS ([Download](https://nodejs.org/))
- **npm**: `v9.x` or higher (bundled with Node.js)
- **MongoDB**: MongoDB instance running locally (v5.0+) or a hosted cluster on [MongoDB Atlas](https://www.mongodb.com/atlas)
- **Git**

Verify your local versions:
```bash
node -v
npm -v
```

---

## 📥 Installation

1. **Clone the repository** (if not already cloned):
   ```bash
   git clone https://github.com/samkap333/Ocena-backend2.git
   cd Ocena-backend2
   ```

2. **Install project dependencies**:
   ```bash
   npm install
   ```

---

## ⚙️ Environment Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and fill in the required environment variables:
   ```env
   # Server Configuration
   PORT=8000
   NODE_ENV=development

   # Database
   MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/ocena_db?retryWrites=true&w=majority

   # Authentication Secrets
   JWT_SECRET=your_super_secret_jwt_access_key
   REFRESH_TOKEN_SECRET=your_super_secret_jwt_refresh_key

   # Email Service (Brevo / Sendinblue)
   BREVO_API_KEY=your_brevo_api_key
   EMAIL_FROM_NAME="Ocena Smart Solutions"
   EMAIL_FROM_EMAIL=support@ocenasolutions.com

   # SMS & WhatsApp (Twilio)
   TWILIO_ACCOUNT_SID=your_twilio_account_sid
   TWILIO_AUTH_TOKEN=your_twilio_auth_token
   TWILIO_FROM=+1234567890
   TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890

   # Payments (Stripe)
   STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key

   # AWS S3 Storage
   AWS_REGION=us-east-1
   AWS_BUCKET_NAME=your-s3-bucket-name
   AWS_ACCESS_KEY_ID=your_aws_access_key_id
   AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
   ```

> ⚠️ **Important**: Never commit your `.env` file or Google service credentials to version control. They are already listed in `.gitignore`.

---

## 🌾 Database Seeding

To initialize the database with demo users and CRM test fixtures:

```bash
# Seed default demo account
npm run seed:demo

# Seed CRM users and roles
npm run seed:crm-users

# (Optional) Sync historical submissions from Google Sheets
npm run sync:submissions
```

---

## 🚀 Running the Server

### Development Mode
Runs the server with `nodemon` for auto-reloading upon file changes:
```bash
npm run dev
```

### Standard Start
Runs the server using Node directly:
```bash
npm start
```

Once started, the backend server will listen at:
```
http://localhost:8000
```

---

## 🌐 Production Deployment

For reliable, high-uptime production deployments, follow the steps below.

### Process Management with PM2 (Recommended)

[PM2](https://pm2.keymetrics.io/) ensures the application stays alive, restarts automatically after crashes or server reboots, and enables zero-downtime reloads.

1. **Install PM2 globally**:
   ```bash
   sudo npm install -g pm2
   ```

2. **Start the application**:
   ```bash
   # Single instance
   pm2 start server.js --name "ocena-backend"

   # Or in cluster mode utilizing all available CPU cores:
   pm2 start server.js --name "ocena-backend" -i max --env production
   ```

3. **Useful PM2 commands**:
   ```bash
   pm2 status               # Check status of processes
   pm2 logs ocena-backend   # View real-time logs
   pm2 restart ocena-backend # Restart server
   pm2 reload ocena-backend  # Zero-downtime reload
   pm2 stop ocena-backend    # Stop application
   ```

4. **Configure PM2 to resurrect on system boot**:
   ```bash
   pm2 startup
   pm2 save
   ```

---

### Sample `ecosystem.config.js`

You can also run PM2 using a dedicated configuration file. Create `ecosystem.config.js` in the project root:

```javascript
module.exports = {
  apps: [
    {
      name: 'ocena-backend',
      script: 'server.js',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production',
        PORT: 8000
      }
    }
  ]
};
```

Run with:
```bash
pm2 start ecosystem.config.js --env production
```

---

### Nginx Reverse Proxy Configuration

To expose the backend behind standard ports (`80` / `443`) and support WebSockets, configure an Nginx server block:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    # Client body limit for file uploads (e.g., invoices/resumes)
    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;

        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';

        # Real Client IP forwarding (Critical for accurate geo analytics)
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and reload Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

### SSL with Let's Encrypt

Secure the API endpoint with free HTTPS using Certbot:
```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

---

### Systemd Service Setup (Alternative)

If you prefer `systemd` over PM2:

1. Create a service file:
   ```bash
   sudo nano /etc/systemd/system/ocena-backend.service
   ```

2. Add configuration:
   ```ini
   [Unit]
   Description=Ocena Backend Node.js Server
   After=network.target

   [Service]
   Type=simple
   User=www-data
   WorkingDirectory=/var/www/Ocena-backend2
   ExecStart=/usr/bin/node server.js
   Restart=always
   RestartSec=10
   Environment=NODE_ENV=production PORT=8000

   [Install]
   WantedBy=multi-user.target
   ```

3. Enable and start:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable ocena-backend
   sudo systemctl start ocena-backend
   sudo systemctl status ocena-backend
   ```

---

## 📡 API Endpoints Overview

| Base Route | Description | Auth Required |
|---|---|:---:|
| `GET /health` | Basic server health check | No |
| `GET /api/health` | API health check | No |
| `POST /api/v1/auth/login` | User authentication & JWT issuance | No |
| `POST /api/v1/auth/register` | Tenant / User registration | No |
| `POST /api/v1/auth/refresh` | Refresh access token | No |
| `GET /api/v1/leads` | Leads pipeline management | Yes |
| `GET /api/v1/campaigns` | Marketing campaigns | Yes |
| `GET /api/v1/invoices` | Invoices and billing | Yes |
| `POST /api/v1/payments` | Stripe payment checkout & webhooks | Yes |
| `GET /api/v1/tasks` | Task and team assignments | Yes |
| `GET /api/v1/tickets` | Support desk tickets | Yes |
| `GET /api/v1/customers` | Customer Directory | Yes |
| `GET /api/v1/products` | Product catalogue | Yes |
| `GET /api/v1/deals` | Sales deals and stages | Yes |
| `GET /api/v1/quotes` | Sales quotes and estimates | Yes |
| `GET /api/v1/hrms` | HRMS management | Yes |
| `GET /api/v1/employees` | Employee records | Yes |
| `POST /api/v1/analytics/collect` | Visitor event / pageview tracking | No |
| `GET /api/v1/analytics/stats` | Aggregated analytics stats | Yes |
| `GET /api/v1/analytics/realtime` | Real-time visitors & active counters | Yes |
| `GET /api/v1/notifications` | User notifications list | Yes |

---

## 🩺 Health Check & Monitoring

You can quickly verify that the server is operational:

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "UP",
  "message": "Server is running",
  "timestamp": "2026-09-26T06:30:00.000Z"
}
```

---

## ❓ Troubleshooting & FAQs

- **MongoDB connection fails**:
  - Verify that `MONGO_URI` is correct in `.env`.
  - Ensure your IP address is whitelisted in MongoDB Atlas Network Access rules.
- **Port already in use**:
  - If port 8000 is occupied, set `PORT=8080` (or another port) in `.env` or kill the existing process:
    ```bash
    lsof -i :8000
    kill -9 <PID>
    ```
- **Real client IPs not showing in analytics**:
  - Ensure your reverse proxy (e.g. Nginx or Cloudflare) forwards `X-Real-IP` and `X-Forwarded-For` headers.

---

## 📄 License

Proprietary © [Ocena Smart Solutions](https://ocenasolutions.com). All rights reserved.
