# AIgentable Testing Guide

## 📋 Overview

This comprehensive testing guide covers all aspects of testing for the AIgentable platform, including unit tests, integration tests, end-to-end tests, and performance testing strategies.

## 🧪 Testing Strategy

### Testing Pyramid

```
        ┌─────────────────┐
        │   E2E Tests     │  ← Few, Slow, Expensive
        │   (Playwright)  │
        └─────────────────┘
      ┌───────────────────────┐
      │  Integration Tests    │  ← Some, Medium Speed
      │  (API, Components)    │
      └───────────────────────┘
    ┌─────────────────────────────┐
    │      Unit Tests             │  ← Many, Fast, Cheap
    │  (Jest, Vitest, RTL)        │
    └─────────────────────────────┘
```

### Testing Principles
- **Fast Feedback**: Unit tests provide immediate feedback
- **Reliable**: Tests should be deterministic and not flaky
- **Maintainable**: Tests should be easy to understand and modify
- **Comprehensive**: Cover critical user journeys and edge cases
- **Isolated**: Tests should not depend on external services

---

## 🎯 Frontend Testing

### Tech Stack
- **Test Runner**: Vitest
- **Testing Library**: React Testing Library
- **E2E Testing**: Playwright
- **Visual Testing**: Chromatic (Storybook)
- **Mocking**: MSW (Mock Service Worker)

### Unit Testing

#### Component Testing Example
```typescript
// src/components/__tests__/AgentCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { AgentCard } from '../AgentCard';
import { Agent } from '../../types';

const mockAgent: Agent = {
  id: 'agent-1',
  name: 'Customer Support Bot',
  description: 'Handles customer inquiries',
  status: 'ACTIVE',
  personality: 'PROFESSIONAL',
  performance: {
    totalConversations: 150,
    averageRating: 4.2,
    responseTime: 1.8
  },
  createdAt: '2024-01-15T00:00:00.000Z',
  updatedAt: '2024-12-01T00:00:00.000Z'
};

describe('AgentCard', () => {
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnToggleStatus = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders agent information correctly', () => {
    render(
      <AgentCard
        agent={mockAgent}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleStatus={mockOnToggleStatus}
      />
    );

    expect(screen.getByText('Customer Support Bot')).toBeInTheDocument();
    expect(screen.getByText('Handles customer inquiries')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument(); // conversations
    expect(screen.getByText('4.2')).toBeInTheDocument(); // rating
  });

  it('calls onEdit when edit button is clicked', () => {
    render(
      <AgentCard
        agent={mockAgent}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleStatus={mockOnToggleStatus}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(mockOnEdit).toHaveBeenCalledWith(mockAgent);
  });

  it('shows confirmation dialog when delete is clicked', () => {
    render(
      <AgentCard
        agent={mockAgent}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleStatus={mockOnToggleStatus}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument();
  });

  it('displays correct status badge', () => {
    render(
      <AgentCard
        agent={mockAgent}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggleStatus={mockOnToggleStatus}
      />
    );

    const statusBadge = screen.getByText('ACTIVE');
    expect(statusBadge).toHaveClass('bg-green-100', 'text-green-800');
  });
});
```

#### Hook Testing Example
```typescript
// src/hooks/__tests__/useAgents.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { useAgents } from '../useAgents';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

// Mock the API
vi.mock('../../services/api', () => ({
  agentsApi: {
    getAgents: vi.fn(),
    createAgent: vi.fn(),
    updateAgent: vi.fn(),
    deleteAgent: vi.fn()
  }
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useAgents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches agents successfully', async () => {
    const mockAgents = [mockAgent];
    vi.mocked(agentsApi.getAgents).mockResolvedValue({
      data: { agents: mockAgents, pagination: { total: 1 } }
    });

    const { result } = renderHook(() => useAgents(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.agents).toEqual(mockAgents);
  });

  it('handles error state', async () => {
    vi.mocked(agentsApi.getAgents).mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() => useAgents(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});
```

#### Store Testing Example
```typescript
// src/stores/__tests__/authStore.test.ts
import { act, renderHook } from '@testing-library/react';
import { useAuthStore } from '../authStore';

describe('authStore', () => {
  beforeEach(() => {
    // Reset store state
    useAuthStore.getState().logout();
  });

  it('initializes with default state', () => {
    const { result } = renderHook(() => useAuthStore());
    
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('sets user on login', () => {
    const { result } = renderHook(() => useAuthStore());
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe'
    };

    act(() => {
      result.current.setUser(mockUser);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('clears user on logout', () => {
    const { result } = renderHook(() => useAuthStore());
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe'
    };

    act(() => {
      result.current.setUser(mockUser);
    });

    expect(result.current.isAuthenticated).toBe(true);

    act(() => {
      result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });
});
```

### Integration Testing

#### API Integration Test
```typescript
// src/components/__tests__/AgentList.integration.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AgentList } from '../AgentList';
import { server } from '../../mocks/server';
import { rest } from 'msw';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('AgentList Integration', () => {
  it('displays agents from API', async () => {
    render(<AgentList />, { wrapper: createWrapper() });

    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Customer Support Bot')).toBeInTheDocument();
      expect(screen.getByText('Sales Assistant')).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    server.use(
      rest.get('/api/v1/agents', (req, res, ctx) => {
        return res(ctx.status(500), ctx.json({ error: 'Server Error' }));
      })
    );

    render(<AgentList />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/error loading agents/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when no agents', async () => {
    server.use(
      rest.get('/api/v1/agents', (req, res, ctx) => {
        return res(ctx.json({ data: { agents: [], pagination: { total: 0 } } }));
      })
    );

    render(<AgentList />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/no agents found/i)).toBeInTheDocument();
    });
  });
});
```

### Mock Service Worker Setup

```typescript
// src/mocks/handlers.ts
import { rest } from 'msw';

const baseURL = 'http://localhost:3001/api/v1';

export const handlers = [
  // Auth endpoints
  rest.post(`${baseURL}/auth/login`, (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        data: {
          user: {
            id: 'user-1',
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe'
          },
          tokens: {
            accessToken: 'mock-access-token',
            refreshToken: 'mock-refresh-token'
          }
        }
      })
    );
  }),

  // Agents endpoints
  rest.get(`${baseURL}/agents`, (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        data: {
          agents: [
            {
              id: 'agent-1',
              name: 'Customer Support Bot',
              description: 'Handles customer inquiries',
              status: 'ACTIVE'
            },
            {
              id: 'agent-2',
              name: 'Sales Assistant',
              description: 'Helps with sales inquiries',
              status: 'ACTIVE'
            }
          ],
          pagination: { total: 2, page: 1, limit: 20 }
        }
      })
    );
  }),

  rest.post(`${baseURL}/agents`, (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        success: true,
        data: {
          id: 'agent-3',
          name: 'New Agent',
          status: 'DRAFT'
        }
      })
    );
  })
];
```

```typescript
// src/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

```typescript
// src/setupTests.ts
import '@testing-library/jest-dom';
import { server } from './mocks/server';

// Start server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

// Reset handlers after each test
afterEach(() => server.resetHandlers());

// Clean up after all tests
afterAll(() => server.close());
```

### E2E Testing with Playwright

#### Test Configuration
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] }
    }
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI
  }
});
```

#### E2E Test Examples
```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('user can login successfully', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('[data-testid="email-input"]', 'invalid@example.com');
    await page.fill('[data-testid="password-input"]', 'wrongpassword');
    await page.click('[data-testid="login-button"]');
    
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid credentials');
  });

  test('user can logout', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    
    // Logout
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');
    
    await expect(page).toHaveURL('/login');
  });
});
```

```typescript
// e2e/agents.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Agent Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
  });

  test('can create a new agent', async ({ page }) => {
    await page.goto('/agents');
    await page.click('[data-testid="create-agent-button"]');
    
    await page.fill('[data-testid="agent-name-input"]', 'Test Agent');
    await page.fill('[data-testid="agent-description-input"]', 'A test agent for E2E testing');
    await page.selectOption('[data-testid="agent-personality-select"]', 'FRIENDLY');
    
    await page.click('[data-testid="save-agent-button"]');
    
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Agent created successfully');
    await expect(page.locator('[data-testid="agent-card"]')).toContainText('Test Agent');
  });

  test('can edit an existing agent', async ({ page }) => {
    await page.goto('/agents');
    
    // Click edit on first agent
    await page.click('[data-testid="agent-card"]:first-child [data-testid="edit-button"]');
    
    await page.fill('[data-testid="agent-name-input"]', 'Updated Agent Name');
    await page.click('[data-testid="save-agent-button"]');
    
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Agent updated successfully');
    await expect(page.locator('[data-testid="agent-card"]')).toContainText('Updated Agent Name');
  });

  test('can delete an agent', async ({ page }) => {
    await page.goto('/agents');
    
    const initialAgentCount = await page.locator('[data-testid="agent-card"]').count();
    
    // Click delete on first agent
    await page.click('[data-testid="agent-card"]:first-child [data-testid="delete-button"]');
    
    // Confirm deletion
    await page.click('[data-testid="confirm-delete-button"]');
    
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Agent deleted successfully');
    
    const finalAgentCount = await page.locator('[data-testid="agent-card"]').count();
    expect(finalAgentCount).toBe(initialAgentCount - 1);
  });
});
```

---

## 🔧 Backend Testing

### Tech Stack
- **Test Runner**: Jest
- **Testing Framework**: Supertest (API testing)
- **Database**: In-memory SQLite for tests
- **Mocking**: Jest mocks

### Unit Testing

#### Service Testing Example
```typescript
// backend/src/services/__tests__/agentService.test.ts
import { AgentService } from '../agentService';
import { PrismaClient } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

jest.mock('@prisma/client');

const prismaMock = mockDeep<PrismaClient>();
const agentService = new AgentService(prismaMock);

describe('AgentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createAgent', () => {
    it('creates agent successfully', async () => {
      const agentData = {
        name: 'Test Agent',
        description: 'A test agent',
        personality: 'FRIENDLY' as const,
        tenantId: 'tenant-1'
      };

      const mockAgent = {
        id: 'agent-1',
        ...agentData,
        status: 'DRAFT' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      prismaMock.agent.create.mockResolvedValue(mockAgent);

      const result = await agentService.createAgent(agentData);

      expect(prismaMock.agent.create).toHaveBeenCalledWith({
        data: expect.objectContaining(agentData)
      });
      expect(result).toEqual(mockAgent);
    });

    it('throws error for duplicate agent name', async () => {
      const agentData = {
        name: 'Existing Agent',
        description: 'A test agent',
        personality: 'FRIENDLY' as const,
        tenantId: 'tenant-1'
      };

      prismaMock.agent.create.mockRejectedValue(
        new Error('Unique constraint failed')
      );

      await expect(agentService.createAgent(agentData))
        .rejects.toThrow('Agent with this name already exists');
    });
  });

  describe('getAgentsByTenant', () => {
    it('returns paginated agents', async () => {
      const mockAgents = [
        {
          id: 'agent-1',
          name: 'Agent 1',
          status: 'ACTIVE' as const,
          tenantId: 'tenant-1'
        },
        {
          id: 'agent-2',
          name: 'Agent 2',
          status: 'DRAFT' as const,
          tenantId: 'tenant-1'
        }
      ];

      prismaMock.agent.findMany.mockResolvedValue(mockAgents);
      prismaMock.agent.count.mockResolvedValue(2);

      const result = await agentService.getAgentsByTenant('tenant-1', {
        page: 1,
        limit: 10
      });

      expect(result.agents).toEqual(mockAgents);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 2,
        pages: 1
      });
    });
  });
});
```

#### Controller Testing Example
```typescript
// backend/src/controllers/__tests__/agentController.test.ts
import request from 'supertest';
import { app } from '../../app';
import { AgentService } from '../../services/agentService';
import { authMiddleware } from '../../middleware/auth';

jest.mock('../../services/agentService');
jest.mock('../../middleware/auth');

const mockAgentService = AgentService as jest.MockedClass<typeof AgentService>;
const mockAuthMiddleware = authMiddleware as jest.MockedFunction<typeof authMiddleware>;

describe('Agent Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock auth middleware to pass through
    mockAuthMiddleware.mockImplementation((req, res, next) => {
      req.user = {
        id: 'user-1',
        tenantId: 'tenant-1',
        role: 'TENANT_ADMIN'
      };
      next();
    });
  });

  describe('POST /api/v1/agents', () => {
    it('creates agent successfully', async () => {
      const agentData = {
        name: 'Test Agent',
        description: 'A test agent',
        personality: 'FRIENDLY'
      };

      const mockAgent = {
        id: 'agent-1',
        ...agentData,
        status: 'DRAFT',
        tenantId: 'tenant-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockAgentService.prototype.createAgent.mockResolvedValue(mockAgent);

      const response = await request(app)
        .post('/api/v1/agents')
        .send(agentData)
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        data: mockAgent,
        message: 'Agent created successfully'
      });
    });

    it('validates required fields', async () => {
      const response = await request(app)
        .post('/api/v1/agents')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/agents', () => {
    it('returns paginated agents', async () => {
      const mockResult = {
        agents: [
          {
            id: 'agent-1',
            name: 'Agent 1',
            status: 'ACTIVE'
          }
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          pages: 1
        }
      };

      mockAgentService.prototype.getAgentsByTenant.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/v1/agents')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockResult
      });
    });
  });
});
```

### Integration Testing

#### Database Integration Test
```typescript
// backend/src/__tests__/integration/agents.integration.test.ts
import request from 'supertest';
import { app } from '../../app';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./test.db'
    }
  }
});

describe('Agents Integration Tests', () => {
  let authToken: string;
  let tenantId: string;

  beforeAll(async () => {
    // Reset test database
    execSync('npx prisma migrate reset --force --skip-seed', {
      env: { ...process.env, DATABASE_URL: 'file:./test.db' }
    });

    // Create test tenant and user
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Test Tenant',
        status: 'ACTIVE'
      }
    });
    tenantId = tenant.id;

    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'TENANT_ADMIN',
        tenantId: tenant.id
      }
    });

    // Generate auth token
    authToken = jwt.sign(
      { userId: user.id, tenantId: tenant.id },
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up agents before each test
    await prisma.agent.deleteMany();
  });

  describe('Agent CRUD Operations', () => {
    it('should create, read, update, and delete an agent', async () => {
      // Create
      const createResponse = await request(app)
        .post('/api/v1/agents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Integration Test Agent',
          description: 'An agent for integration testing',
          personality: 'PROFESSIONAL'
        })
        .expect(201);

      const agentId = createResponse.body.data.id;
      expect(createResponse.body.data.name).toBe('Integration Test Agent');

      // Read
      const readResponse = await request(app)
        .get(`/api/v1/agents/${agentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(readResponse.body.data.name).toBe('Integration Test Agent');

      // Update
      const updateResponse = await request(app)
        .put(`/api/v1/agents/${agentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Agent Name',
          description: 'Updated description'
        })
        .expect(200);

      expect(updateResponse.body.data.name).toBe('Updated Agent Name');

      // Delete
      await request(app)
        .delete(`/api/v1/agents/${agentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify deletion
      await request(app)
        .get(`/api/v1/agents/${agentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should enforce tenant isolation', async () => {
      // Create agent for first tenant
      const agent1Response = await request(app)
        .post('/api/v1/agents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Tenant 1 Agent',
          description: 'Agent for tenant 1',
          personality: 'FRIENDLY'
        })
        .expect(201);

      // Create second tenant and user
      const tenant2 = await prisma.tenant.create({
        data: {
          name: 'Test Tenant 2',
          status: 'ACTIVE'
        }
      });

      const user2 = await prisma.user.create({
        data: {
          email: 'test2@example.com',
          firstName: 'Test2',
          lastName: 'User2',
          role: 'TENANT_ADMIN',
          tenantId: tenant2.id
        }
      });

      const authToken2 = jwt.sign(
        { userId: user2.id, tenantId: tenant2.id },
        process.env.JWT_SECRET || 'test-secret'
      );

      // Try to access agent from different tenant
      await request(app)
        .get(`/api/v1/agents/${agent1Response.body.data.id}`)
        .set('Authorization', `Bearer ${authToken2}`)
        .expect(404);
    });
  });
});
```

---

## 🚀 Performance Testing

### Load Testing with Artillery

#### Configuration
```yaml
# artillery.yml
config:
  target: 'http://localhost:3001'
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 50
      name: "Ramp up load"
    - duration: 300
      arrivalRate: 100
      name: "Sustained load"
  processor: "./test-functions.js"
  variables:
    baseUrl: "http://localhost:3001/api/v1"

scenarios:
  - name: "Authentication Flow"
    weight: 30
    flow:
      - post:
          url: "/auth/login"
          json:
            email: "test@example.com"
            password: "password123"
          capture:
            - json: "$.data.tokens.accessToken"
              as: "authToken"
      - get:
          url: "/agents"
          headers:
            Authorization: "Bearer {{ authToken }}"

  - name: "Agent Operations"
    weight: 50
    flow:
      - function: "authenticate"
      - get:
          url: "/agents"
          headers:
            Authorization: "Bearer {{ authToken }}"
      - post:
          url: "/agents"
          headers:
            Authorization: "Bearer {{ authToken }}"
          json:
            name: "Load Test Agent {{ $randomString() }}"
            description: "Agent created during load test"
            personality: "PROFESSIONAL"

  - name: "Conversation Simulation"
    weight: 20
    flow:
      - function: "authenticate"
      - post:
          url: "/conversations"
          headers:
            Authorization: "Bearer {{ authToken }}"
          json:
            channelId: "{{ channelId }}"
            customerId: "customer-{{ $randomInt(1, 1000) }}"
      - post:
          url: "/conversations/{{ conversationId }}/messages"
          headers:
            Authorization: "Bearer {{ authToken }}"
          json:
            content: "Hello, I need help with my order"
            type: "TEXT"
            sender: "CUSTOMER"
```

#### Test Functions
```javascript
// test-functions.js
module.exports = {
  authenticate: function(context, events, done) {
    // Simulate authentication
    context.vars.authToken = 'mock-token-for-load-test';
    context.vars.channelId = 'channel-123';
    return done();
  },
  
  generateRandomData: function(context, events, done) {
    context.vars.randomEmail = `user${Math.random().toString(36).substr(2, 9)}@example.com`;
    context.vars.randomName = `Agent ${Math.random().toString(36).substr(2, 9)}`;
    return done();
  }
};
```

### Database Performance Testing

```typescript
// backend/src/__tests__/performance/database.perf.test.ts
import { PrismaClient } from '@prisma/client';
import { performance } from 'perf_hooks';

const prisma = new PrismaClient();

describe('Database Performance Tests', () => {
  beforeAll(async () => {
    // Seed test data
    await seedTestData();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should handle large conversation queries efficiently', async () => {
    const start = performance.now();
    
    const conversations = await prisma.conversation.findMany({
      where: {
        tenantId: 'test-tenant',
        status: 'ACTIVE'
      },
      include: {
        messages: {
          take: 10,
          orderBy: { createdAt: 'desc' }
        },
        agent: true,
        channel: true
      },
      take: 100,
      orderBy: { updatedAt: 'desc' }
    });
    
    const end = performance.now();
    const duration = end - start;
    
    expect(conversations.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(1000); // Should complete within 1 second
  });

  it('should handle concurrent agent queries', async () => {
    const promises = Array.from({ length: 10 }, () => 
      prisma.agent.findMany({
        where: { tenantId: 'test-tenant' },
        include: {
          conversations: {
            take: 5,
            orderBy: { createdAt: 'desc' }
          }
        }
      })
    );
    
    const start = performance.now();
    const results = await Promise.all(promises);
    const end = performance.now();
    
    const duration = end - start;
    
    expect(results).toHaveLength(10);
    expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
  });
});

async function seedTestData() {
  // Create test tenant
  const tenant = await prisma.tenant.upsert({
    where: { id: 'test-tenant' },
    update: {},
    create: {
      id: 'test-tenant',
      name: 'Performance Test Tenant',
      status: 'ACTIVE'
    }
  });

  // Create test agents
  for (let i = 0; i < 10; i++) {
    await prisma.agent.upsert({
      where: { id: `test-agent-${i}` },
      update: {},
      create: {
        id: `test-agent-${i}`,
        name: `Test Agent ${i}`,
        description: `Performance test agent ${i}`,
        status: 'ACTIVE',
        personality: 'PROFESSIONAL',
        tenantId: tenant.id
      }
    });
  }

  // Create test conversations and messages
  for (let i = 0; i < 100; i++) {
    const conversation = await prisma.conversation.create({
      data: {
        id: `test-conv-${i}`,
        status: 'ACTIVE',
        priority: 'MEDIUM',
        tenantId: tenant.id,
        agentId: `test-agent-${i % 10}`,
        channelId: 'test-channel',
        customerId: `test-customer-${i % 20}`
      }
    });

    // Create messages for each conversation
    for (let j = 0; j < 5; j++) {
      await prisma.message.create({
        data: {
          content: `Test message ${j} for conversation ${i}`,
          type: 'TEXT',
          sender: j % 2 === 0 ? 'CUSTOMER' : 'AGENT',
          conversationId: conversation.id,
          tenantId: tenant.id
        }
      });
    }
  }
}
```

---

## 📊 Test Coverage & Reporting

### Coverage Configuration

```json
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/setupTests.ts',
        '**/*.d.ts',
        '**/*.config.ts',
        'src/mocks/**',
        'e2e/**'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  }
});
```

```json
// backend/jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types/**',
    '!src/__tests__/**',
    '!src/mocks/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts']
};
```

### CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: |
        npm ci
        cd backend && npm ci
    
    - name: Run frontend tests
      run: npm run test:coverage
    
    - name: Run backend tests
      run: cd backend && npm run test:coverage
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
        REDIS_URL: redis://localhost:6379
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        files: ./coverage/lcov.info,./backend/coverage/lcov.info
        flags: frontend,backend
        name: codecov-umbrella
    
    - name: Run E2E tests
      run: |
        npm run build
        npm run preview &
        cd backend && npm run build && npm start &
        sleep 10
        npx playwright test
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
        REDIS_URL: redis://localhost:6379
    
    - name: Upload E2E test results
      uses: actions/upload-artifact@v3
      if: failure()
      with:
        name: playwright-report
        path: playwright-report/
        retention-days: 30
```

---

## 🎯 Testing Best Practices

### General Principles
1. **Write tests first** (TDD approach when possible)
2. **Test behavior, not implementation**
3. **Keep tests simple and focused**
4. **Use descriptive test names**
5. **Arrange, Act, Assert pattern**
6. **Mock external dependencies**
7. **Test edge cases and error conditions**

### Frontend Testing Best Practices
1. **Use data-testid attributes** for reliable element selection
2. **Test user interactions** rather than component internals
3. **Mock API calls** with MSW
4. **Test accessibility** with jest-axe
5. **Use React Testing Library queries** in order of preference

### Backend Testing Best Practices
1. **Use in-memory database** for unit tests
2. **Test database transactions** and rollbacks
3. **Mock external services** (OpenAI, email, etc.)
4. **Test authentication and authorization**
5. **Validate input sanitization**

### E2E Testing Best Practices
1. **Test critical user journeys**
2. **Use page object model** for maintainability
3. **Run tests in parallel** when possible
4. **Take screenshots** on failures
5. **Test across different browsers**

---

## 📈 Continuous Testing

### Pre-commit Hooks
```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write",
      "npm run test:related"
    ]
  }
}
```

### Test Scripts
```json
// package.json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:related": "vitest related",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:performance": "artillery run artillery.yml",
    "test:all": "npm run test:coverage && npm run test:e2e"
  }
}
```

---

**Testing Guide Version**: 1.0.0  
**Last Updated**: December 2024  
**Support**: testing@aigentable.com