#!/usr/bin/env bash
set -e

# Default test database URL
export TEST_DATABASE_URL="${TEST_DATABASE_URL:-postgresql://diratrack:diratrack@localhost:5432/diratrack_test}"

# Validate test database
echo "Validating test database..."
node --experimental-strip-types -e "
import { validateTestDatabaseUrl } from './e2e/test-database-guard.ts';
validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);
console.log('Test database validated successfully');
"

# Run integration tests
echo "Running integration tests..."
(cd packages/database && npm run test:integration)
