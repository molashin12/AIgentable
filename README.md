# AIgentable - Multi-Tenant AI Agent Platform

## 🚀 Project Overview

AIgentable is a comprehensive multi-tenant SaaS platform that enables businesses to create, deploy, and manage custom AI agents for various business roles including sales, customer service, and support across multiple communication channels.

### Key Features
- **Multi-tenant Architecture**: Secure tenant isolation with role-based access control
- **AI Agent Builder**: Create custom AI agents with personality settings and business context
- **RAG Technology**: ChromaDB integration for vectorized knowledge base
- **Omnichannel Support**: WhatsApp, Facebook, Instagram, Telegram, and website widgets
- **Real-time Analytics**: Performance metrics and business intelligence dashboard
- **Scalable Infrastructure**: Docker-based deployment with PostgreSQL, Redis, and ChromaDB

## 🏗️ Architecture Overview

### Tech Stack

**Frontend:**
- React 18 + TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- Zustand for state management
- React Router for navigation
- Recharts for analytics visualization

**Backend:**
- Node.js + Express + TypeScript
- Prisma ORM with PostgreSQL
- Redis for caching and sessions
- ChromaDB for vector storage
- JWT authentication
- Socket.io for real-time features

**Infrastructure:**
- Docker Compose for local development
- PostgreSQL 15 for primary database
- Redis 7 for caching
- ChromaDB for vector embeddings

## 📁 Project Structure

```
AIgentable/
├── backend/                 # Node.js API server
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   ├── middleware/     # Express middleware
│   │   ├── services/       # Business logic
│   │   ├── utils/          # Utility functions
│   │   └── types/          # TypeScript definitions
│   ├── prisma/            # Database schema and migrations
│   └── package.json
├── src/                    # React frontend
│   ├── components/        # Reusable UI components
│   ├── pages/            # Page components
│   ├── contexts/         # React contexts
│   ├── hooks/            # Custom hooks
│   ├── lib/              # API client and utilities
│   └── assets/           # Static assets
├── docker-compose.yml     # Development infrastructure
├── .env                   # Frontend environment variables
└── README.md             # This file
```

## 🚦 Current Status

### ✅ Completed Features

**Infrastructure & Setup:**
- [x] Docker Compose configuration (PostgreSQL, Redis, ChromaDB)
- [x] Backend API server with Express + TypeScript
- [x] Frontend React application with Vite
- [x] Database schema design with Prisma
- [x] Environment configuration
- [x] TypeScript configuration and linting

**Authentication & Security:**
- [x] JWT-based authentication system
- [x] Multi-tenant architecture
- [x] Role-based access control (Platform Admin, Tenant Admin, Tenant User)
- [x] Password hashing with bcrypt
- [x] API security middleware (helmet, cors, rate limiting)

**Database & Models:**
- [x] Complete Prisma schema with all entities
- [x] User, Tenant, Agent, Channel, Conversation models
- [x] Database migrations and seeding
- [x] Relationship mapping between entities

**API Foundation:**
- [x] RESTful API structure
- [x] Authentication endpoints
- [x] Tenant management endpoints
- [x] Agent CRUD operations
- [x] Channel integration endpoints
- [x] Error handling and validation

**Frontend Foundation:**
- [x] React Router setup
- [x] Authentication context
- [x] API client with Axios
- [x] Tailwind CSS styling system
- [x] Component structure
- [x] State management with Zustand

### 🚧 In Progress

**UI Components:**
- [x] Basic layout structure
- [x] Navigation components
- [x] Authentication forms
- [ ] Dashboard components
- [ ] Agent builder interface
- [ ] Channel integration UI

**Core Features:**
- [ ] AI agent creation and management
- [ ] RAG system integration
- [ ] File upload and processing
- [ ] Real-time chat interface
- [ ] Analytics dashboard

## 🎯 Next Steps to Complete

### Phase 1: Core AI Features (2-3 weeks)

1. **AI Agent Implementation**
   - OpenAI API integration
   - Agent personality and role configuration
   - Response generation with business context
   - Agent testing interface

2. **RAG System Development**
   - ChromaDB integration
   - Document processing (PDF, DOCX, TXT)
   - Vector embedding generation
   - Knowledge base management

3. **Training Center**
   - File upload interface
   - Document processing pipeline
   - Knowledge base organization
   - Training status monitoring

### Phase 2: Channel Integrations (2-3 weeks)

1. **WhatsApp Business API**
   - Webhook setup
   - Message handling
   - Media support
   - Business verification

2. **Social Media Channels**
   - Facebook Messenger integration
   - Instagram Direct Messages
   - Telegram Bot API

3. **Website Widget**
   - Embeddable chat widget
   - Customization options
   - Real-time messaging

### Phase 3: Advanced Features (3-4 weeks)

1. **Real-time Features**
   - Socket.io implementation
   - Live chat monitoring
   - Real-time notifications
   - Agent handover system

2. **Analytics & Reporting**
   - Performance metrics collection
   - Dashboard visualizations
   - Custom report generation
   - Export functionality

3. **Advanced Management**
   - Bulk operations
   - Advanced filtering
   - Automation rules
   - Integration webhooks

### Phase 4: Production Readiness (2-3 weeks)

1. **Performance Optimization**
   - Database query optimization
   - Caching strategies
   - API response optimization
   - Frontend performance tuning

2. **Security Hardening**
   - Security audit
   - Input validation enhancement
   - Rate limiting refinement
   - HTTPS enforcement

3. **Deployment & Monitoring**
   - Production Docker configuration
   - CI/CD pipeline setup
   - Monitoring and logging
   - Backup strategies

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+
- Docker and Docker Compose
- Git

### Quick Start

1. **Clone and Setup**
   ```bash
   git clone <repository-url>
   cd AIgentable
   npm install
   cd backend && npm install
   ```

2. **Environment Configuration**
   ```bash
   # Copy environment files
   cp .env.example .env
   cp backend/.env.example backend/.env
   
   # Update environment variables as needed
   ```

3. **Start Infrastructure**
   ```bash
   docker-compose up -d
   ```

4. **Database Setup**
   ```bash
   cd backend
   npm run db:migrate
   npm run db:seed
   ```

5. **Start Development Servers**
   ```bash
   # Terminal 1: Backend
   cd backend
   npm run dev
   
   # Terminal 2: Frontend
   npm run dev
   ```

6. **Access Applications**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001
   - Database Studio: http://localhost:5555 (run `npm run db:studio`)

## 📚 Documentation

- [Backend API Documentation](./backend/README.md)
- [Frontend Development Guide](./docs/FRONTEND.md)
- [Database Schema](./backend/prisma/schema.prisma)
- [Product Requirements](./.trae/documents/AIgentable_Product_Requirements.md)

## 🤝 Contributing

1. Follow the established code style and conventions
2. Write tests for new features
3. Update documentation as needed
4. Submit pull requests for review

## 📄 License

MIT License - see LICENSE file for details

---

**Status**: 🟡 In Development | **Target**: Production-ready SaaS platform
**Last Updated**: December 2024
