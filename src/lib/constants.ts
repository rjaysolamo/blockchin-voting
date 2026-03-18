// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// Application Constants
export const APP_NAME = 'Blockchain Voting System';
export const APP_VERSION = '1.0.0';

// Blockchain Constants
export const BLOCKCHAIN_NETWORK = import.meta.env.VITE_BLOCKCHAIN_NETWORK || 'baseSepolia';
export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '';

// Supabase Configuration
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Feature Flags
export const ENABLE_BLOCKCHAIN_VOTING = import.meta.env.VITE_ENABLE_BLOCKCHAIN_VOTING === 'true';
export const ENABLE_ATTENDANCE_TRACKING = import.meta.env.VITE_ENABLE_ATTENDANCE_TRACKING === 'true';