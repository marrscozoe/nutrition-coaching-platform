#!/bin/bash
#===============================================================================
# Nutrition Coaching Platform - Database Backup Script
# 
# This script creates a PostgreSQL backup of the Supabase database.
# It can be run manually or scheduled via cron.
#
# Prerequisites:
#   1. Get database password from Supabase Dashboard:
#      - Go to: https://supabase.com/dashboard/project/fbiubwhffoclindynute/settings/database
#      - Copy the "Database password" (postgres user password)
#      - Or use the "Connection string" (URI format)
#
#   2. Set the password as an environment variable:
#      export SUPABASE_DB_PASSWORD='your-database-password'
#
# Usage:
#   ./scripts/backup-database.sh                    # Interactive prompts
#   ./scripts/backup-database.sh --auto            # Automated (uses env var)
#   ./scripts/backup-database.sh --dry-run         # Test connection only
#
# Cron Setup (daily at 2 AM):
#   export SUPABASE_DB_PASSWORD='your-password'
#   0 2 * * * /path/to/nutrition-coaching-platform/scripts/backup-database.sh --auto >> /path/to/backups/backup.log 2>&1
#
# Restoration:
#   # Full restore:
#   psql "postgresql://postgres:PASSWORD@db.fbiubwhffoclindynute.supabase.co:5432/postgres" < backup_file.sql
#
#   # Single table restore (example - milestones):
#   psql "postgresql://postgres:PASSWORD@db.fbiubwhffoclindynute.supabase.co:5432/postgres" \
#     -c "TRUNCATE milestones; COPY milestones FROM STDIN WITH CSV HEADER;" < milestones_backup.csv
#===============================================================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups/manual}"
DATE_STAMP="$(date +%Y%m%d_%H%M%S)"
LOG_FILE="$BACKUP_DIR/backup.log"

# Supabase connection parameters
SUPABASE_DB_HOST="${SUPABASE_DB_HOST:-db.fbiubwhffoclindynute.supabase.co}"
SUPABASE_DB_PORT="${SUPABASE_DB_PORT:-5432}"
SUPABASE_DB_USER="${SUPABASE_DB_USER:-postgres}"
SUPABASE_DB_NAME="${SUPABASE_DB_NAME:-postgres}"
SUPABASE_DB_PASSWORD="${SUPABASE_DB_PASSWORD:-}"

#===============================================================================
# Functions
#===============================================================================

log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo "$msg"
    if [ -d "$(dirname "$LOG_FILE")" ]; then
        echo "$msg" >> "$LOG_FILE"
    fi
}

show_help() {
    cat << EOF
Usage: $0 [OPTIONS]

Options:
  --auto           Run in automated mode (requires SUPABASE_DB_PASSWORD env var)
  --dry-run        Test database connection without creating backup
  --enable-pitr    Show instructions to enable Point-in-Time Recovery
  --help, -h       Show this help message

Environment Variables:
  SUPABASE_DB_PASSWORD    Database password (required)
  SUPABASE_DB_HOST       Database host (default: db.fbiubwhffoclindynute.supabase.co)
  SUPABASE_DB_PORT       Database port (default: 5432)
  SUPABASE_DB_USER       Database user (default: postgres)
  SUPABASE_DB_NAME       Database name (default: postgres)
  BACKUP_DIR             Backup directory (default: ./backups/manual)

Examples:
  # Set password and run backup
  export SUPABASE_DB_PASSWORD='my-password'
  ./scripts/backup-database.sh --auto

  # Test connection first
  ./scripts/backup-database.sh --dry-run

  # View PITR instructions
  ./scripts/backup-database.sh --enable-pitr
EOF
}

test_connection() {
    log "Testing database connection..."
    
    if [ -z "$SUPABASE_DB_PASSWORD" ]; then
        log "ERROR: SUPABASE_DB_PASSWORD is not set"
        log "Set it with: export SUPABASE_DB_PASSWORD='your-password'"
        return 1
    fi
    
    if command -v pg_isready &> /dev/null; then
        PGPASSWORD="$SUPABASE_DB_PASSWORD" pg_isready \
            -h "$SUPABASE_DB_HOST" \
            -p "$SUPABASE_DB_PORT" \
            -U "$SUPABASE_DB_USER" \
            > /dev/null 2>&1
        
        if [ $? -eq 0 ]; then
            log "✓ Database connection successful"
            return 0
        else
            log "✗ Database connection failed"
            return 1
        fi
    else
        log "pg_isready not found, skipping connection test"
        return 0
    fi
}

cleanup_old_backups() {
    # Keep last 14 backups
    local backups=($(ls -t "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null || echo ""))
    if [ ${#backups[@]} -gt 14 ]; then
        log "Cleaning up old backups (keeping last 14)..."
        for backup in "${backups[@]:14}"; do
            log "  Removing: $backup"
            rm -f "$backup"
        done
    fi
}

run_backup() {
    local backup_file="$BACKUP_DIR/backup_${DATE_STAMP}.sql"
    local backup_gz="${backup_file}.gz"
    
    log "=========================================="
    log "Starting Database Backup"
    log "=========================================="
    log "Host: $SUPABASE_DB_HOST:$SUPABASE_DB_PORT"
    log "Database: $SUPABASE_DB_NAME"
    log "User: $SUPABASE_DB_USER"
    log "Backup file: $backup_gz"
    log ""
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    # Check for pg_dump
    if ! command -v pg_dump &> /dev/null; then
        log "ERROR: pg_dump not found"
        log "Install PostgreSQL client tools:"
        log "  macOS: brew install postgresql@16"
        log "  Ubuntu/Debian: apt-get install postgresql-client"
        return 1
    fi
    
    # Run pg_dump with compression
    log "Running pg_dump..."
    PGPASSWORD="$SUPABASE_DB_PASSWORD" pg_dump \
        --host "$SUPABASE_DB_HOST" \
        --port "$SUPABASE_DB_PORT" \
        --username "$SUPABASE_DB_USER" \
        --dbname "$SUPABASE_DB_NAME" \
        --no-owner \
        --no-acl \
        --format=plain \
        --file "$backup_file" \
        2>&1
    
    if [ $? -ne 0 ]; then
        log "ERROR: pg_dump failed"
        rm -f "$backup_file" 2>/dev/null
        return 1
    fi
    
    log "Compressing backup..."
    gzip "$backup_file"
    
    local size=$(du -h "$backup_gz" | cut -f1)
    log "✓ Backup completed: $backup_gz ($size)"
    
    # Cleanup old backups
    cleanup_old_backups
    
    return 0
}

show_pitr_info() {
    cat << 'EOF'
========================================
Point-in-Time Recovery (PITR) Info
========================================

Current Status:
  - WALG (Physical Backups): ENABLED
  - PITR: DISABLED

PITR allows you to restore to ANY point in time within the retention period.

To Enable PITR:
  1. Go to: https://supabase.com/dashboard/project/fbiubwhffoclindynute/settings/database
  2. Scroll to "Point in Time Recovery"
  3. Toggle PITR to ON
  4. Select retention period (7 days for Pro plan)

Note: PITR requires Supabase Pro plan or higher.

Manual Backup (Alternative to PITR):
  If PITR is not available, use this script to create periodic backups:
  
  # Daily backup via cron:
  0 2 * * * /path/to/scripts/backup-database.sh --auto
  
  # Get database password from:
  # https://supabase.com/dashboard/project/fbiubwhffoclindynute/settings/database

Restoration Options:
  1. Via Supabase Dashboard:
     - Go to Database → Backups
     - Select a backup and click "Restore"
  
  2. Via pg_dump restore:
     - Decompress: gunzip backup_*.sql.gz
     - Restore: psql "postgresql://postgres:PASS@HOST:5432/postgres" < backup.sql
  
  3. Via PITR (if enabled):
     - Go to Database → Point in Time Recovery
     - Select target time and restore

EOF
}

#===============================================================================
# Main
#===============================================================================

main() {
    local mode="interactive"
    
    # Parse arguments
    case "${1:-}" in
        --auto|-y)
            mode="auto"
            ;;
        --dry-run)
            mode="dry-run"
            ;;
        --enable-pitr)
            mode="pitr-info"
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
    esac
    
    if [ "$mode" = "pitr-info" ]; then
        show_pitr_info
        exit 0
    fi
    
    log ""
    log "=========================================="
    log "Nutrition Platform Database Backup"
    log "=========================================="
    log ""
    
    # Show PITR status
    log "Current Backup Configuration:"
    log "  - WALG (Physical Backups): ENABLED"
    log "  - PITR: DISABLED (enable via Supabase Dashboard)"
    log ""
    
    if [ "$mode" = "dry-run" ]; then
        test_connection
        exit $?
    fi
    
    # Test connection
    if ! test_connection; then
        log ""
        log "To get database credentials:"
        log "  1. Go to: https://supabase.com/dashboard/project/fbiubwhffoclindynute/settings/database"
        log "  2. Copy the 'Connection string' (URI) or use the 'Database password'"
        log "  3. Set: export SUPABASE_DB_PASSWORD='your-password'"
        log ""
        log "Or run with --enable-pitr for backup strategy info"
        exit 1
    fi
    
    # Run backup
    if run_backup; then
        log ""
        log "✓ Backup process completed successfully"
        exit 0
    else
        log ""
        log "✗ Backup process failed"
        exit 1
    fi
}

main "$@"
