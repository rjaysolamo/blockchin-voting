-- Add wallet_address column to profiles table for automatic wallet assignment
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS wallet_address TEXT UNIQUE;

-- Create index for faster wallet address lookups
CREATE INDEX IF NOT EXISTS idx_profiles_wallet_address ON public.profiles(wallet_address);

-- Update RLS policies to include wallet_address
COMMENT ON COLUMN public.profiles.wallet_address IS 'Automatically assigned Ethereum wallet address for blockchain voting';

-- Function to validate Ethereum address format
CREATE OR REPLACE FUNCTION public.is_valid_ethereum_address(address TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN address ~ '^0x[a-fA-F0-9]{40}$';
END;
$$;

-- Add check constraint for valid Ethereum addresses
ALTER TABLE public.profiles 
ADD CONSTRAINT valid_wallet_address_format 
CHECK (wallet_address IS NULL OR public.is_valid_ethereum_address(wallet_address));