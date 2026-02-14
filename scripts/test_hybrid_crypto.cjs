const fs = require('fs');
const path = require('path');

// Read .env manually if it exists, otherwise use defaults
let RUST_CRYPTO_URL = 'http://localhost:8080';
try {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        if (key === 'RUST_CRYPTO_URL') {
          let value = parts.slice(1).join('=').trim();
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
          }
          RUST_CRYPTO_URL = value;
        }
      }
    });
  }
} catch (e) {
  // Ignore error
}

console.log(`Testing Hybrid Crypto Architecture`);
console.log(`Target Service: ${RUST_CRYPTO_URL}`);

async function runTests() {
  try {
    // 1. Health Check
    console.log('\n[1] Checking Service Health...');
    try {
      const healthRes = await fetch(`${RUST_CRYPTO_URL}/health`);
      if (healthRes.ok) {
        const healthData = await healthRes.json();
        console.log('✅ Service is healthy:', healthData);
      } else {
        console.error('❌ Service returned error:', healthRes.status);
        return;
      }
    } catch (e) {
      console.error('❌ Failed to connect to service. Is it running?', e.cause || e.message);
      return;
    }

    // 2. Generate Hash
    console.log('\n[2] Testing Hash Generation (Sample Vote)...');
    const voteData = {
      previousHash: "0000000000000000000000000000000000000000000000000000000000000000",
      voterId: "user-123",
      candidateId: "candidate-456",
      electionId: "election-789",
      position: "President",
      timestamp: new Date().toISOString()
    };
    
    const startTime = performance.now();
    const hashRes = await fetch(`${RUST_CRYPTO_URL}/crypto/hash`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(voteData)
    });
    
    if (hashRes.ok) {
      const hashData = await hashRes.json();
      const duration = performance.now() - startTime;
      console.log(`✅ Hash generated in ${duration.toFixed(2)}ms`);
      console.log('   Hash:', hashData.hash);
      console.log('   Nonce:', hashData.nonce);
      
      // 3. Verify Batch
      console.log('\n[3] Testing Batch Verification...');
      const block = {
        block_number: 1,
        previous_hash: voteData.previousHash,
        current_hash: hashData.hash,
        voter_id: voteData.voterId,
        candidate_id: voteData.candidateId,
        election_id: voteData.electionId,
        position: voteData.position,
        timestamp: voteData.timestamp,
        nonce: hashData.nonce
      };
      
      const verifyRes = await fetch(`${RUST_CRYPTO_URL}/crypto/verify-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks: [block] })
      });
      
      if (verifyRes.ok) {
        const verifyData = await verifyRes.json();
        console.log('✅ Verification result:', verifyData);
        if (verifyData.valid) {
          console.log('   SUCCESS: Chain integrity verified.');
        } else {
          console.error('   FAILURE: Chain invalid.');
        }
      } else {
        console.error('❌ Verification failed:', verifyRes.status);
      }

    } else {
      console.error('❌ Hash generation failed:', hashRes.status);
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

runTests();
