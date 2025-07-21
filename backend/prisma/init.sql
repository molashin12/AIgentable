-- Initialize AIgentable Database
-- This file is executed when the PostgreSQL container starts

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set timezone
SET timezone = 'UTC';

-- Create indexes for better performance (will be created after Prisma migration)
-- These are just placeholders, actual indexes will be created by Prisma

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'AIgentable database initialized successfully';
END $$;