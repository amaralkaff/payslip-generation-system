# Payslip Generation System - Setup Guide

## 🚀 Quick Start

### Prerequisites
- **Node.js** v18+ (LTS recommended)
- **PostgreSQL** v12+ 
- **npm** v9+
- **Docker** (optional, for containerized setup)

### 1. Clone and Install

```bash
# Clone the repository (if not already done)
git clone <your-repo-url>
cd payslip-generation-system

# Install dependencies
npm install
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### 3. Database Setup

#### Option A: Local PostgreSQL
```bash
# Create database
createdb payslip_system
createdb payslip_system_test

# Run migrations (when available)
npm run migrate
```

#### Option B: Docker PostgreSQL
```bash
# Start PostgreSQL with Docker
docker-compose up postgres -d

# Check database is ready
docker-compose logs postgres
```

### 4. Start Development Server

```bash
# Start in development mode
npm run dev

# Or start normally
npm start
```

The server will be available at:
- **API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health
- **API Docs**: http://localhost:3000/api-docs (when available)

---

## 🐋 Docker Setup (Recommended)

### Full Development Environment

```bash
# Start all services
docker-compose up

# Start specific services
docker-compose up postgres app

# Background mode
docker-compose up -d
```

### With Additional Tools

```bash
# Include pgAdmin for database management
docker-compose --profile tools up

# Include Redis for caching
docker-compose --profile caching up

# Include test database
docker-compose --profile testing up
```

### Docker Services

| Service | Port | Description |
|---------|------|-------------|
| **app** | 3000 | Node.js application |
| **postgres** | 5432 | Main database |
| **postgres_test** | 5433 | Test database |
| **pgadmin** | 5050 | Database management UI |
| **redis** | 6379 | Caching (optional) |

---

## 📁 Project Structure

```
payslip-generation-system/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # API controllers
│   ├── middleware/      # Custom middleware
│   ├── repositories/    # Data access layer
│   ├── services/        # Business logic
│   ├── utils/           # Utility functions
│   ├── migrations/      # Database migrations
│   ├── seeds/           # Database seeds
│   └── server.js        # Main application entry
├── tests/
│   ├── unit/            # Unit tests
│   ├── integration/     # Integration tests
│   ├── e2e/             # End-to-end tests
│   └── fixtures/        # Test data
├── spec/                # Detailed specifications
├── docs/                # Documentation
├── scripts/             # Utility scripts
└── logs/                # Application logs
```

---

## 🛠️ Available Scripts

```bash
# Development
npm run dev              # Start with auto-reload
npm start               # Start production server

# Testing
npm test                # Run all tests
npm run test:unit       # Run unit tests only
npm run test:integration # Run integration tests
npm run test:e2e        # Run end-to-end tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Run tests with coverage

# Database
npm run migrate         # Run migrations
npm run migrate:create  # Create new migration
npm run seed           # Seed database with sample data

# Code Quality
npm run lint           # Run ESLint
npm run lint:fix       # Fix ESLint issues

# Docker
npm run docker:build   # Build Docker image
npm run docker:run     # Run with Docker Compose
npm run docker:down    # Stop Docker services
```

---

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | development | Application environment |
| `PORT` | 3000 | Server port |
| `HOST` | localhost | Server host |
| `DB_HOST` | localhost | Database host |
| `DB_PORT` | 5432 | Database port |
| `DB_NAME` | payslip_system | Database name |
| `DB_USER` | postgres | Database username |
| `DB_PASSWORD` | - | Database password |
| `JWT_SECRET` | - | JWT signing secret |
| `JWT_EXPIRES_IN` | 24h | Token expiration time |
| `LOG_LEVEL` | info | Logging level |
| `API_DOCS_ENABLED` | true | Enable API documentation |

### Database Configuration

The application uses PostgreSQL with connection pooling:

- **Pool Size**: 5-50 connections (configurable)
- **Connection Timeout**: 2 seconds
- **Idle Timeout**: 30 seconds
- **SSL**: Configurable per environment

### Security Features

- **Helmet.js**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: Request throttling
- **JWT Authentication**: Secure token-based auth
- **Password Hashing**: bcrypt with configurable salt rounds
- **Input Validation**: Joi schema validation
- **SQL Injection Protection**: Parameterized queries

---

## 🏥 Health Checks

### Basic Health Check
```bash
curl http://localhost:3000/health
```

### Detailed Health Check
```bash
curl http://localhost:3000/health/detailed
```

Response includes:
- Server status and uptime
- Database connection status
- Memory usage statistics
- Connection pool statistics

---

## 📊 Monitoring & Logging

### Log Files (when configured)
- `logs/app.log` - Application logs
- `logs/error.log` - Error logs only
- `logs/audit.log` - Audit trail
- `logs/exceptions.log` - Uncaught exceptions

### Log Levels
- **debug** - Detailed debugging information
- **info** - General information
- **warn** - Warning messages
- **error** - Error messages

### Performance Monitoring
- Request timing and performance metrics
- Slow query detection (>1000ms threshold)
- Database connection pool monitoring
- Memory usage tracking

---

## 🧪 Testing

### Running Tests
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Watch mode for development
npm run test:watch

# Coverage report
npm run test:coverage
```

### Test Database
Tests use a separate database (`payslip_system_test`) to avoid conflicts with development data.

---

## 🚀 Production Deployment

### Environment Setup
1. Set `NODE_ENV=production`
2. Configure production database
3. Set secure JWT secret
4. Configure file logging
5. Set appropriate log levels

### Docker Production
```bash
# Build production image
docker build --target production -t payslip-system:latest .

# Run with production profile
docker-compose --profile production up -d
```

### Health Monitoring
- Health check endpoints available
- Graceful shutdown handling
- Process restart on failure
- Memory and performance monitoring

---

## 🔍 Troubleshooting

### Common Issues

#### Database Connection Failed
```bash
# Check PostgreSQL is running
ps aux | grep postgres

# Check database exists
psql -l | grep payslip

# Test connection
psql -h localhost -U postgres -d payslip_system
```

#### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

#### Docker Issues
```bash
# Reset Docker environment
docker-compose down -v
docker-compose up --build

# Check service logs
docker-compose logs app
docker-compose logs postgres
```

#### Permission Issues
```bash
# Fix file permissions
chmod -R 755 .
chown -R $USER:$USER .
```

---

## 📚 Next Steps

1. **Phase 2**: Set up database schema and migrations
2. **Phase 3**: Implement authentication system
3. **Phase 4**: Build API endpoints
4. **Phase 5**: Add business logic
5. **Phase 6**: Comprehensive testing
6. **Phase 7**: Production deployment
7. **Phase 8**: Performance optimization

---

## 🆘 Support

If you encounter any issues:

1. Check the [troubleshooting section](#-troubleshooting)
2. Review the logs: `npm run logs` or `docker-compose logs`
3. Verify environment configuration
4. Check database connectivity
5. Ensure all dependencies are installed

For development questions, refer to the detailed specifications in the `spec/` directory. 