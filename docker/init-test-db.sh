#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE diratrack_test;
    GRANT ALL PRIVILEGES ON DATABASE diratrack_test TO diratrack;
EOSQL

echo "Test database 'diratrack_test' created successfully"
