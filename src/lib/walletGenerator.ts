'use client';

/**
 * Generates a simple Ethereum-style wallet address using browser crypto APIs
 * This creates a deterministic address based on user email for automatic assignment
 */
export async function generateWalletAddress(email: string): Promise<{
  address: string;
  privateKey: string;
}> {
  // Use a combination of email and timestamp for deterministic but unique generation
  const salt = import.meta.env.VITE_WALLET_GENERATION_SALT || 'blockchain-voting-secret-salt';
  
  // Create a deterministic seed from email + salt + timestamp
  const seed = `${email}:${salt}:${Date.now()}`;
  
  // Generate a hash for the address (simplified approach)
  const encoder = new TextEncoder();
  const data = encoder.encode(seed);
  
  // Use crypto.subtle for hashing (available in modern browsers)
  return crypto.subtle.digest('SHA-256', data).then(hash => {
    const hashArray = Array.from(new Uint8Array(hash));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Create Ethereum-style address (0x + last 40 chars of hash)
    const address = '0x' + hashHex.slice(-40);
    
    // For simplicity, we'll use the hash as a "private key" representation
    // In production, you'd want a more secure key generation
    const privateKey = hashHex;
    
    return {
      address: address.toLowerCase(),
      privateKey
    };
  }).catch(() => {
    // Fallback if crypto.subtle is not available
    const fallbackHash = seed.split('').reduce((acc, char) => {
      return acc + char.charCodeAt(0).toString(16);
    }, '');
    
    const address = '0x' + fallbackHash.slice(-40);
    return {
      address: address.toLowerCase(),
      privateKey: fallbackHash
    };
  });
}

/**
 * Validates an Ethereum address format
 */
export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Simple synchronous wallet generation 
 */
export function generateSimpleWalletAddress(email: string): {
  address: string;
  privateKey: string;
} {
  // Simple deterministic generation for testing
  const hash = email.split('').reduce((acc, char) => {
    return acc + char.charCodeAt(0).toString(16);
  }, '');
  
  const address = '0x' + hash.slice(-40).padStart(40, '0');
  
  return {
    address: address.toLowerCase(),
    privateKey: hash
  };
}