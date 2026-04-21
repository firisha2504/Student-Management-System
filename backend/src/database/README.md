# Database Scripts

This directory contains database initialization and migration scripts.

## Essential Scripts

### Initialization
- **`init.js`** - Initialize database with schema from schema.sql
- **`drop-and-init.js`** - Drop all tables and reinitialize (⚠️ DESTRUCTIVE)
- **`setup-default-admin.js`** - Create default admin user (MJA001/admin123)
- **`reset-database.js`** - Reset database to clean state

### Migrations (Applied)
These migrations have been applied to fix issues during development:

- **`add-staff-id.js`** - Added staff_id column to profiles table
- **`migrate-usernames.js`** - Migrated username format
- **`fix-all-stream-enums.js`** - Changed stream ENUM from Science/Arts/Commerce to natural/social
- **`enforce-one-teacher-per-subject.js`** - Added constraint: only ONE teacher per subject per grade
- **`prevent-duplicate-assessments.js`** - Added constraint: only ONE assessment name per subject/grade

### Utilities
- **`clear-data.js`** - Clear all data but keep schema

## Important Notes

### Stream Values
- **Students**: `'natural'` or `'social'`
- **Subjects**: `'natural'`, `'social'`, or `NULL` (common)
- **Teacher Assignments**: `''` (empty string) for common subjects
- **Assessment Types**: `''` (empty string) for common subjects

### Constraints
1. **One Teacher Per Subject**: Only ONE teacher can teach a subject per grade level
   - Example: English Grade 12 can only be assigned to ONE teacher
   
2. **Unique Assessment Names**: Each assessment name can only be created once per subject/grade
   - Example: Only ONE "Mid Exam" for Mathematics Grade 12

### Default Credentials
- **Admin**: MJA001 / admin123

## Running Migrations

```bash
# Initialize database
node src/database/drop-and-init.js

# Run specific migration
node src/database/[migration-name].js
```

## Schema File
- **`schema.sql`** - Complete database schema definition
