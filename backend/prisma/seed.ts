import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create a test tenant
  const tenant = await prisma.tenant.upsert({
    where: { domain: 'demo.aigentable.com' },
    update: {},
    create: {
      name: 'Demo Company',
      domain: 'demo.aigentable.com',
      subdomain: 'demo',
      description: 'Demo tenant for testing',
      industry: 'Technology',
      companySize: '10-50',
      plan: 'STARTER',
      status: 'ACTIVE',
    },
  });

  console.log('✅ Created tenant:', tenant.name);

  // Create a test admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@demo.aigentable.com' },
    update: {},
    create: {
      email: 'admin@demo.aigentable.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'TENANT_ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
      tenantId: tenant.id,
    },
  });

  console.log('✅ Created admin user:', adminUser.email);

  // Create a test agent
  const agent = await prisma.agent.upsert({
    where: { id: 'demo-agent-1' },
    update: {},
    create: {
      id: 'demo-agent-1',
      name: 'Customer Support Agent',
      description: 'AI agent for customer support',
      personality: {
        traits: ['helpful', 'professional', 'empathetic'],
        tone: 'friendly',
        style: 'conversational'
      },
      role: 'support',
      prompt: 'You are a helpful customer support agent. Be professional, empathetic, and provide clear solutions to customer inquiries.',
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 1000,
      status: 'ACTIVE',
      isActive: true,
      tenantId: tenant.id,
      creatorId: adminUser.id,
    },
  });

  console.log('✅ Created agent:', agent.name);

  // Create a test channel
  const channel = await prisma.channel.upsert({
    where: { id: 'demo-website-channel' },
    update: {},
    create: {
      id: 'demo-website-channel',
      type: 'WEBSITE',
      name: 'Website Chat',
      config: {
        widgetColor: '#007bff',
        welcomeMessage: 'Hello! How can I help you today?',
        position: 'bottom-right'
      },
      status: 'ACTIVE',
      isActive: true,
      tenantId: tenant.id,
    },
  });

  console.log('✅ Created channel:', channel.name);

  // Connect agent to channel
  const channelAgent = await prisma.channelAgent.upsert({
    where: {
      channelId_agentId: {
        channelId: channel.id,
        agentId: agent.id,
      },
    },
    update: {},
    create: {
      channelId: channel.id,
      agentId: agent.id,
      isActive: true,
      config: {
        autoResponse: true,
        handoverThreshold: 0.8
      },
    },
  });

  console.log('✅ Connected agent to channel');

  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });