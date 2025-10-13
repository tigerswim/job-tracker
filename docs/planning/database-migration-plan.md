# Database Migration Plan for LinkedIn Integration

## Current State Analysis

### Existing Database Schema (schema.sql)
```sql
CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  position VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  linkedin TEXT,
  associated_job VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Current TypeScript Interface (supabase.ts)
```typescript
export interface Contact {
  id: string
  name: string
  email?: string
  phone?: string
  current_location?: string
  company?: string
  job_title?: string
  linkedin_url?: string
  notes?: string
  experience?: ExperienceEntry[]
  education?: EducationEntry[]
  mutual_connections?: string[]
  user_id: string
  created_at: string
  updated_at: string
}
```

## Schema Discrepancies

1. **Missing Fields in Database:**
   - `current_location`
   - `job_title` (exists as `position`)
   - `linkedin_url` (exists as `linkedin`)
   - `user_id` (multi-tenancy support)
   - `experience` (stored as JSONB)
   - `education` (stored as JSONB)
   - `mutual_connections` (stored as array)

2. **Database Fields Not in Interface:**
   - `associated_job` (legacy field)

3. **Type Mismatches:**
   - Database uses `SERIAL` (integer), interface uses `string`
   - Field name differences (`position` vs `job_title`, `linkedin` vs `linkedin_url`)

## Migration Strategy

### Phase 1: Core Schema Updates

#### Step 1: Align Existing Fields
```sql
-- Rename and modify existing columns
ALTER TABLE contacts 
  RENAME COLUMN position TO job_title;

ALTER TABLE contacts 
  RENAME COLUMN linkedin TO linkedin_url;

-- Add missing basic fields
ALTER TABLE contacts 
  ADD COLUMN IF NOT EXISTS current_location VARCHAR(255),
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS experience JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS education JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS mutual_connections TEXT[] DEFAULT '{}';
```

#### Step 2: LinkedIn Enhancement Fields
```sql
-- Add LinkedIn-specific fields
ALTER TABLE contacts 
  ADD COLUMN IF NOT EXISTS professional_headline TEXT,
  ADD COLUMN IF NOT EXISTS connections_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS linkedin_profile_data JSONB,
  ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS top_skills TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS about TEXT,
  ADD COLUMN IF NOT EXISTS last_linkedin_update TIMESTAMP;
```

#### Step 3: New Supporting Tables
```sql
-- Certifications table
CREATE TABLE IF NOT EXISTS contact_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
  license_name TEXT NOT NULL,
  issuer_organization TEXT,
  issue_date TEXT,
  expiry_date TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Skills with endorsements
CREATE TABLE IF NOT EXISTS contact_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  endorsement_count INTEGER DEFAULT 0,
  endorsing_organizations TEXT[] DEFAULT '{}',
  skill_type TEXT DEFAULT 'professional',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recommendations
CREATE TABLE IF NOT EXISTS contact_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
  recommender_name TEXT NOT NULL,
  recommender_title TEXT,
  relationship_company TEXT,
  recommendation_date TEXT,
  recommendation_type TEXT,
  text_excerpt TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Awards and honors
CREATE TABLE IF NOT EXISTS contact_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
  award_title TEXT NOT NULL,
  issuing_organization TEXT,
  date_issued TEXT,
  associated_company TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Interests
CREATE TABLE IF NOT EXISTS contact_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
  interest_name TEXT NOT NULL,
  interest_type TEXT,
  meta_info TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Mutual connections with details
CREATE TABLE IF NOT EXISTS mutual_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
  connection_name TEXT NOT NULL,
  connection_title TEXT,
  connection_details TEXT,
  existing_contact_id INTEGER REFERENCES contacts(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Referral opportunities
CREATE TABLE IF NOT EXISTS referral_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
  contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
  mutual_connection_id UUID REFERENCES mutual_connections(id),
  strength_score INTEGER DEFAULT 0,
  referral_path TEXT[] DEFAULT '{}',
  opportunity_type TEXT DEFAULT 'direct',
  status TEXT DEFAULT 'potential',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Step 4: Performance Indexes
```sql
-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_contact_skills_skill_name ON contact_skills(skill_name);
CREATE INDEX IF NOT EXISTS idx_contact_skills_contact_id ON contact_skills(contact_id);
CREATE INDEX IF NOT EXISTS idx_mutual_connections_name ON mutual_connections(connection_name);
CREATE INDEX IF NOT EXISTS idx_referral_opportunities_job_contact ON referral_opportunities(job_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_skills ON contacts USING GIN(skills);
CREATE INDEX IF NOT EXISTS idx_contacts_mutual_connections ON contacts USING GIN(mutual_connections);
```

### Phase 2: Data Migration Script

```sql
-- Migrate existing data to new structure
-- Set user_id for existing contacts (assuming single user for now)
UPDATE contacts SET user_id = 'default-user-uuid' WHERE user_id IS NULL;

-- Migrate existing experience data if stored differently
-- This would need to be customized based on current data format

-- Clean up legacy fields
ALTER TABLE contacts DROP COLUMN IF EXISTS associated_job;
```

### Phase 3: Updated TypeScript Interfaces

```typescript
// Updated Contact interface to match new schema
export interface Contact {
  id: number // Keep as number to match SERIAL
  name: string
  email?: string
  phone?: string
  current_location?: string
  company?: string
  job_title?: string
  linkedin_url?: string
  notes?: string
  experience?: ExperienceEntry[]
  education?: EducationEntry[]
  mutual_connections?: string[]
  user_id: string
  created_at: string
  updated_at: string
  
  // LinkedIn enhancement fields
  professional_headline?: string
  connections_count?: number
  linkedin_profile_data?: LinkedInProfileData
  skills?: string[]
  top_skills?: string[]
  about?: string
  last_linkedin_update?: string
}

// New interfaces for related tables
export interface ContactCertification {
  id: string
  contact_id: number
  license_name: string
  issuer_organization?: string
  issue_date?: string
  expiry_date?: string
  created_at: string
  updated_at: string
}

export interface ContactSkill {
  id: string
  contact_id: number
  skill_name: string
  endorsement_count: number
  endorsing_organizations: string[]
  skill_type: string
  created_at: string
}

export interface ContactRecommendation {
  id: string
  contact_id: number
  recommender_name: string
  recommender_title?: string
  relationship_company?: string
  recommendation_date?: string
  recommendation_type?: string
  text_excerpt?: string
  created_at: string
}

export interface ContactAward {
  id: string
  contact_id: number
  award_title: string
  issuing_organization?: string
  date_issued?: string
  associated_company?: string
  description?: string
  created_at: string
}

export interface ContactInterest {
  id: string
  contact_id: number
  interest_name: string
  interest_type?: string
  meta_info?: string
  created_at: string
}

export interface MutualConnection {
  id: string
  contact_id: number
  connection_name: string
  connection_title?: string
  connection_details?: string
  existing_contact_id?: number
  created_at: string
}

export interface ReferralOpportunity {
  id: string
  job_id: number
  contact_id: number
  mutual_connection_id?: string
  strength_score: number
  referral_path: string[]
  opportunity_type: string
  status: string
  notes?: string
  created_at: string
  updated_at: string
}
```

## Migration SQL Scripts

### migration_001_align_fields.sql
```sql
-- Migration 001: Align existing fields with TypeScript interface
-- Backup: Create backup table first
CREATE TABLE contacts_backup AS SELECT * FROM contacts;

-- Rename columns to match interface
ALTER TABLE contacts 
  RENAME COLUMN position TO job_title;

ALTER TABLE contacts 
  RENAME COLUMN linkedin TO linkedin_url;

-- Add missing basic fields
ALTER TABLE contacts 
  ADD COLUMN IF NOT EXISTS current_location VARCHAR(255),
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS experience JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS education JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS mutual_connections TEXT[] DEFAULT '{}';

-- Set default user_id for existing records (single user migration)
-- Replace 'your-default-user-uuid' with actual UUID
UPDATE contacts 
SET user_id = 'your-default-user-uuid' 
WHERE user_id IS NULL;

-- Make user_id not null after setting defaults
ALTER TABLE contacts 
  ALTER COLUMN user_id SET NOT NULL;

-- Clean up legacy field
ALTER TABLE contacts 
  DROP COLUMN IF EXISTS associated_job;

-- Verify migration
SELECT 
  COUNT(*) as total_contacts,
  COUNT(user_id) as contacts_with_user_id,
  COUNT(job_title) as contacts_with_job_title
FROM contacts;
```

### migration_002_linkedin_fields.sql
```sql
-- Migration 002: Add LinkedIn-specific enhancement fields
ALTER TABLE contacts 
  ADD COLUMN IF NOT EXISTS professional_headline TEXT,
  ADD COLUMN IF NOT EXISTS connections_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS linkedin_profile_data JSONB,
  ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS top_skills TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS about TEXT,
  ADD COLUMN IF NOT EXISTS last_linkedin_update TIMESTAMP;

-- Update the updated_at trigger to include new fields
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
CREATE TRIGGER update_contacts_updated_at 
    BEFORE UPDATE ON contacts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Verify LinkedIn fields added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'contacts' 
AND column_name IN ('professional_headline', 'connections_count', 'linkedin_profile_data', 'skills', 'about');
```

### migration_003_supporting_tables.sql
```sql
-- Migration 003: Create supporting tables for LinkedIn data

-- Certifications table
CREATE TABLE IF NOT EXISTS contact_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  license_name TEXT NOT NULL,
  issuer_organization TEXT,
  issue_date TEXT,
  expiry_date TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Skills with endorsements table
CREATE TABLE IF NOT EXISTS contact_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  endorsement_count INTEGER DEFAULT 0,
  endorsing_organizations TEXT[] DEFAULT '{}',
  skill_type TEXT DEFAULT 'professional',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Unique constraint to prevent duplicate skills per contact
  UNIQUE(contact_id, skill_name)
);

-- Recommendations table
CREATE TABLE IF NOT EXISTS contact_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  recommender_name TEXT NOT NULL,
  recommender_title TEXT,
  relationship_company TEXT,
  recommendation_date TEXT,
  recommendation_type TEXT,
  text_excerpt TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Awards and honors table
CREATE TABLE IF NOT EXISTS contact_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  award_title TEXT NOT NULL,
  issuing_organization TEXT,
  date_issued TEXT,
  associated_company TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Interests table
CREATE TABLE IF NOT EXISTS contact_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  interest_name TEXT NOT NULL,
  interest_type TEXT,
  meta_info TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Unique constraint to prevent duplicate interests per contact
  UNIQUE(contact_id, interest_name)
);

-- Mutual connections with details table
CREATE TABLE IF NOT EXISTS mutual_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  connection_name TEXT NOT NULL,
  connection_title TEXT,
  connection_details TEXT,
  existing_contact_id INTEGER REFERENCES contacts(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Unique constraint to prevent duplicate mutual connections
  UNIQUE(contact_id, connection_name)
);

-- Referral opportunities table
CREATE TABLE IF NOT EXISTS referral_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  mutual_connection_id UUID REFERENCES mutual_connections(id),
  strength_score INTEGER DEFAULT 0 CHECK (strength_score >= 0 AND strength_score <= 100),
  referral_path TEXT[] DEFAULT '{}',
  opportunity_type TEXT DEFAULT 'direct' CHECK (opportunity_type IN ('direct', 'mutual', 'alumni', 'skills')),
  status TEXT DEFAULT 'potential' CHECK (status IN ('potential', 'identified', 'requested', 'accepted', 'declined', 'expired')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Unique constraint to prevent duplicate opportunities
  UNIQUE(job_id, contact_id)
);

-- Add updated_at triggers for new tables
CREATE TRIGGER update_contact_certifications_updated_at 
    BEFORE UPDATE ON contact_certifications 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_referral_opportunities_updated_at 
    BEFORE UPDATE ON referral_opportunities 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Verify tables created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'contact_%' OR table_name = 'mutual_connections' OR table_name = 'referral_opportunities';
```

### migration_004_indexes.sql
```sql
-- Migration 004: Create performance indexes

-- Indexes for contacts table
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company);
CREATE INDEX IF NOT EXISTS idx_contacts_job_title ON contacts(job_title);
CREATE INDEX IF NOT EXISTS idx_contacts_current_location ON contacts(current_location);
CREATE INDEX IF NOT EXISTS idx_contacts_skills ON contacts USING GIN(skills);
CREATE INDEX IF NOT EXISTS idx_contacts_mutual_connections ON contacts USING GIN(mutual_connections);
CREATE INDEX IF NOT EXISTS idx_contacts_linkedin_url ON contacts(linkedin_url) WHERE linkedin_url IS NOT NULL;

-- Indexes for contact_skills table
CREATE INDEX IF NOT EXISTS idx_contact_skills_contact_id ON contact_skills(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_skills_skill_name ON contact_skills(skill_name);
CREATE INDEX IF NOT EXISTS idx_contact_skills_endorsement_count ON contact_skills(endorsement_count DESC);
CREATE INDEX IF NOT EXISTS idx_contact_skills_skill_type ON contact_skills(skill_type);

-- Indexes for contact_certifications table
CREATE INDEX IF NOT EXISTS idx_contact_certifications_contact_id ON contact_certifications(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_certifications_license_name ON contact_certifications(license_name);
CREATE INDEX IF NOT EXISTS idx_contact_certifications_issuer ON contact_certifications(issuer_organization);

-- Indexes for contact_recommendations table
CREATE INDEX IF NOT EXISTS idx_contact_recommendations_contact_id ON contact_recommendations(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_recommendations_recommender ON contact_recommendations(recommender_name);

-- Indexes for contact_awards table
CREATE INDEX IF NOT EXISTS idx_contact_awards_contact_id ON contact_awards(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_awards_organization ON contact_awards(issuing_organization);

-- Indexes for contact_interests table
CREATE INDEX IF NOT EXISTS idx_contact_interests_contact_id ON contact_interests(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_interests_name ON contact_interests(interest_name);
CREATE INDEX IF NOT EXISTS idx_contact_interests_type ON contact_interests(interest_type);

-- Indexes for mutual_connections table
CREATE INDEX IF NOT EXISTS idx_mutual_connections_contact_id ON mutual_connections(contact_id);
CREATE INDEX IF NOT EXISTS idx_mutual_connections_name ON mutual_connections(connection_name);
CREATE INDEX IF NOT EXISTS idx_mutual_connections_existing_contact ON mutual_connections(existing_contact_id) WHERE existing_contact_id IS NOT NULL;

-- Indexes for referral_opportunities table
CREATE INDEX IF NOT EXISTS idx_referral_opportunities_job_id ON referral_opportunities(job_id);
CREATE INDEX IF NOT EXISTS idx_referral_opportunities_contact_id ON referral_opportunities(contact_id);
CREATE INDEX IF NOT EXISTS idx_referral_opportunities_job_contact ON referral_opportunities(job_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_referral_opportunities_strength ON referral_opportunities(strength_score DESC);
CREATE INDEX IF NOT EXISTS idx_referral_opportunities_status ON referral_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_referral_opportunities_type ON referral_opportunities(opportunity_type);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_contacts_company_user ON contacts(company, user_id);
CREATE INDEX IF NOT EXISTS idx_referral_status_strength ON referral_opportunities(status, strength_score DESC);

-- Verify indexes created
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
AND (tablename LIKE 'contact_%' OR tablename IN ('contacts', 'mutual_connections', 'referral_opportunities'))
ORDER BY tablename, indexname;
```

### migration_005_data_migration.sql
```sql
-- Migration 005: Data migration and cleanup

-- Migrate any existing LinkedIn URLs to proper format
UPDATE contacts 
SET linkedin_url = CASE 
    WHEN linkedin_url IS NOT NULL AND linkedin_url != '' 
    AND NOT linkedin_url ILIKE 'https://linkedin.com%' 
    AND NOT linkedin_url ILIKE 'https://www.linkedin.com%'
    THEN 'https://www.linkedin.com/in/' || linkedin_url
    ELSE linkedin_url
END
WHERE linkedin_url IS NOT NULL AND linkedin_url != '';

-- Set default values for new fields based on existing data
UPDATE contacts 
SET professional_headline = job_title 
WHERE professional_headline IS NULL AND job_title IS NOT NULL;

-- Initialize empty arrays for new JSONB and array fields
UPDATE contacts 
SET 
    experience = COALESCE(experience, '[]'::jsonb),
    education = COALESCE(education, '[]'::jsonb),
    skills = COALESCE(skills, '{}'),
    top_skills = COALESCE(top_skills, '{}'),
    mutual_connections = COALESCE(mutual_connections, '{}')
WHERE 
    experience IS NULL 
    OR education IS NULL 
    OR skills IS NULL 
    OR top_skills IS NULL 
    OR mutual_connections IS NULL;

-- Create sample referral opportunities for existing job-contact combinations
-- This creates potential referrals where contact company matches job company
INSERT INTO referral_opportunities (job_id, contact_id, strength_score, opportunity_type, status)
SELECT DISTINCT 
    j.id as job_id,
    c.id as contact_id,
    CASE 
        WHEN c.company = j.company THEN 75  -- Current employee
        ELSE 25  -- Default strength
    END as strength_score,
    'direct' as opportunity_type,
    'potential' as status
FROM jobs j
CROSS JOIN contacts c
WHERE c.company IS NOT NULL 
AND j.company IS NOT NULL
AND (c.company ILIKE '%' || j.company || '%' OR j.company ILIKE '%' || c.company || '%')
AND c.user_id = 'your-default-user-uuid'  -- Replace with actual user ID
ON CONFLICT (job_id, contact_id) DO NOTHING;

-- Add data validation constraints
ALTER TABLE contacts 
  ADD CONSTRAINT chk_connections_count_positive 
  CHECK (connections_count >= 0);

ALTER TABLE contacts 
  ADD CONSTRAINT chk_linkedin_url_format 
  CHECK (linkedin_url IS NULL OR linkedin_url ILIKE 'https://linkedin.com%' OR linkedin_url ILIKE 'https://www.linkedin.com%');

-- Verify data migration
SELECT 
    'contacts' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN experience != '[]'::jsonb THEN 1 END) as with_experience,
    COUNT(CASE WHEN education != '[]'::jsonb THEN 1 END) as with_education,
    COUNT(CASE WHEN array_length(skills, 1) > 0 THEN 1 END) as with_skills,
    COUNT(CASE WHEN linkedin_url IS NOT NULL THEN 1 END) as with_linkedin
FROM contacts
UNION ALL
SELECT 
    'referral_opportunities' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN strength_score > 50 THEN 1 END) as high_strength,
    COUNT(CASE WHEN opportunity_type = 'direct' THEN 1 END) as direct_opportunities,
    COUNT(CASE WHEN status = 'potential' THEN 1 END) as potential_status,
    NULL as with_linkedin
FROM referral_opportunities;
```

### migration_006_cleanup.sql
```sql
-- Migration 006: Final cleanup and verification

-- Drop backup table if migration successful
-- Uncomment after verifying migration worked correctly
-- DROP TABLE IF EXISTS contacts_backup;

-- Add helpful views for common queries
CREATE OR REPLACE VIEW v_contact_summary AS
SELECT 
    c.id,
    c.name,
    c.company,
    c.job_title,
    c.current_location,
    c.connections_count,
    c.professional_headline,
    array_length(c.skills, 1) as total_skills,
    array_length(c.mutual_connections, 1) as mutual_connections_count,
    COUNT(DISTINCT cs.id) as detailed_skills_count,
    COUNT(DISTINCT cc.id) as certifications_count,
    COUNT(DISTINCT cr.id) as recommendations_count,
    COUNT(DISTINCT ca.id) as awards_count,
    COUNT(DISTINCT ro.id) as referral_opportunities_count
FROM contacts c
LEFT JOIN contact_skills cs ON c.id = cs.contact_id
LEFT JOIN contact_certifications cc ON c.id = cc.contact_id
LEFT JOIN contact_recommendations cr ON c.id = cr.contact_id
LEFT JOIN contact_awards ca ON c.id = ca.contact_id
LEFT JOIN referral_opportunities ro ON c.id = ro.contact_id
GROUP BY c.id, c.name, c.company, c.job_title, c.current_location, 
         c.connections_count, c.professional_headline, c.skills, c.mutual_connections;

-- View for referral opportunities with contact details
CREATE OR REPLACE VIEW v_referral_opportunities AS
SELECT 
    ro.id,
    ro.job_id,
    j.company as job_company,
    j.position as job_title,
    ro.contact_id,
    c.name as contact_name,
    c.company as contact_company,
    c.job_title as contact_job_title,
    ro.strength_score,
    ro.opportunity_type,
    ro.status,
    ro.notes,
    mc.connection_name as mutual_connection_name,
    mc.connection_title as mutual_connection_title
FROM referral_opportunities ro
JOIN jobs j ON ro.job_id = j.id
JOIN contacts c ON ro.contact_id = c.id
LEFT JOIN mutual_connections mc ON ro.mutual_connection_id = mc.id;

-- Add comments to tables for documentation
COMMENT ON TABLE contacts IS 'Enhanced contacts table with LinkedIn integration support';
COMMENT ON TABLE contact_skills IS 'Skills with endorsement tracking from LinkedIn profiles';
COMMENT ON TABLE contact_certifications IS 'Professional certifications and licenses';
COMMENT ON TABLE contact_recommendations IS 'LinkedIn recommendations and testimonials';
COMMENT ON TABLE contact_awards IS 'Professional awards and recognition';
COMMENT ON TABLE contact_interests IS 'Professional and personal interests';
COMMENT ON TABLE mutual_connections IS 'Mutual connections between contacts with context';
COMMENT ON TABLE referral_opportunities IS 'Potential referral opportunities for job applications';

-- Final verification query
SELECT 
    'Migration Complete' as status,
    (SELECT COUNT(*) FROM contacts) as total_contacts,
    (SELECT COUNT(*) FROM contact_skills) as total_skills,
    (SELECT COUNT(*) FROM contact_certifications) as total_certifications,
    (SELECT COUNT(*) FROM contact_recommendations) as total_recommendations,
    (SELECT COUNT(*) FROM contact_awards) as total_awards,
    (SELECT COUNT(*) FROM contact_interests) as total_interests,
    (SELECT COUNT(*) FROM mutual_connections) as total_mutual_connections,
    (SELECT COUNT(*) FROM referral_opportunities) as total_referral_opportunities;
```

## Migration Execution Plan

### Step 1: Backup Current Database
```bash
# Create backup before migration
pg_dump your_database > backup_before_linkedin_migration.sql

# Or for Supabase users
supabase db dump --db-url "your-connection-string" > backup_before_linkedin_migration.sql
```

### Step 2: Run Schema Migrations
```bash
# Apply migrations in order
psql your_database < migration_001_align_fields.sql
psql your_database < migration_002_linkedin_fields.sql
psql your_database < migration_003_supporting_tables.sql
psql your_database < migration_004_indexes.sql
psql your_database < migration_005_data_migration.sql
psql your_database < migration_006_cleanup.sql

# Or for Supabase users
supabase db reset --db-url "your-connection-string"
# Then run each migration file through Supabase dashboard SQL editor
```

### Step 3: Verification Queries
```sql
-- Verify all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check contacts table structure
\d contacts

-- Verify foreign key relationships
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_schema='public'
ORDER BY tc.table_name;

-- Test data integrity
SELECT * FROM v_contact_summary LIMIT 5;
SELECT * FROM v_referral_opportunities LIMIT 5;
```

### Step 3: Update Application Code
1. Update TypeScript interfaces
2. Update API endpoints to handle new fields
3. Update React components to display new data
4. Update form handling for LinkedIn imports

### Step 4: Testing Plan
1. Test existing functionality with migrated data
2. Test new LinkedIn import features
3. Test referral matching capabilities
4. Performance testing with new indexes

## Updated User Stories Impact

The user stories remain valid but need these additions:

### US-000: Database Migration (New)
```
As a developer,
I want to migrate the existing contacts database to support LinkedIn integration
So that existing data is preserved while enabling new features

Acceptance Criteria:
- All existing contact data is preserved
- New LinkedIn fields are added without breaking existing functionality
- Database performance is maintained or improved
- Multi-tenancy support is added via user_id
- Migration can be rolled back if needed
```

### Updated Implementation Timeline

**Pre-Phase 1: Database Migration (1 week)**
- Schema updates and data migration
- Interface alignment
- Testing existing functionality

**Phase 1: LinkedIn Import (2-3 weeks)**
- Core LinkedIn parsing with updated schema
- Enhanced contact forms
- Basic referral matching

**Phases 2-5: Continue as planned**

## Risk Mitigation

1. **Data Loss Prevention:**
   - Full database backup before migration
   - Incremental migration with rollback capability
   - Extensive testing on copy of production data

2. **Downtime Minimization:**
   - Run migrations during low-usage periods
   - Use database migrations that don't lock tables
   - Prepare rollback scripts

3. **Feature Compatibility:**
   - Maintain backward compatibility for existing API endpoints
   - Update frontend components incrementally
   - Feature flags for LinkedIn functionality

This migration plan ensures that your existing contacts database is properly expanded to support the LinkedIn integration while preserving all current functionality.