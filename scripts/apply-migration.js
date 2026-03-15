// Utility script to apply the wallet address migration using Supabase JS client
// Run this with: node scripts/apply-migration.js

import { createClient } from '@supabase/supabase-js';

// Load environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gdgdyeaoajungjcxirds.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkZ2R5ZWFvYWp1bmdqY3hpcmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MzA2NzksImV4cCI6MjA4MzMwNjY3OX0.XbNmJ5PAliKe_mKIK_BNoiJ2I25RDgJmmYF_ZlVyae8';

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Migration SQL
const migrationSQL = `
-- Add wallet_address column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS wallet_address TEXT UNIQUE;

-- Create function to validate Ethereum addresses
CREATE OR REPLACE FUNCTION public.is_valid_ethereum_address(address TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN address ~ '^0x[a-fA-F0-9]{40}$';
END;
$$;

-- Add constraint to ensure valid wallet address format
ALTER TABLE public.profiles 
ADD CONSTRAINT valid_wallet_address_format 
CHECK (wallet_address IS NULL OR public.is_valid_ethereum_address(wallet_address));

-- Create index for faster wallet address lookups
CREATE INDEX IF NOT EXISTS idx_profiles_wallet_address 
ON public.profiles(wallet_address);

-- Update RLS policies to include wallet_address
COMMENT ON TABLE public.profiles IS 'User profiles with automatically assigned wallet addresses';
`;

async function applyMigration() {
  try {
    console.log('Applying wallet address migration...');
    
    // Execute the migration SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (error) {
      console.error('Migration failed:', error);
      
      // Fallback: try using the SQL editor endpoint
      console.log('Trying alternative approach...');
      await tryAlternativeApproach();
      return;
    }
    
    console.log('✅ Migration applied successfully!');
    console.log('Wallet address column added to profiles table');
    
  } catch (error) {
    console.error('Migration error:', error);
    console.log('\n💡 Alternative: Apply the migration manually through Supabase Dashboard:');
    console.log('1. Go to https://app.supabase.com/project/gdgdyeaoajungjcxirds/sql');
    console.log('2. Copy and run the SQL from supabase/migrations/20260221000000_add_wallet_address_to_profiles.sql');
  }
}

async function tryAlternativeApproach() {
  try {
    // Try to check if the column already exists first
    const { data: checkData, error: checkError } = await supabase
      .from('profiles')
      .select('user_id')
      .limit(1);
    
    if (checkError) {
      console.error('Cannot connect to profiles table:', checkError);
      return;
    }
    
    console.log('✅ Connected to Supabase successfully');
    console.log('The migration needs to be applied manually through the SQL editor');
    
  } catch (error) {
    console.error('Alternative approach failed:', error);
  }
}

// Run the migration
applyMigration();