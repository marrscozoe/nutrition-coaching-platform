// Gate 1: API/Token chain test
const PRODUCTION_BASE = 'https://nutrition-coaching-platform.vercel.app';
const TRAINER_ID = 'c0efffb0-e93c-4bc1-89cd-ff211169ed58';
const TEST_EMAIL = 'tim-test-gate1@trial.com';

async function runGate1() {
  console.log('=== GATE 1: API/Token Chain Test ===\n');

  // Step 1: POST to /api/auth/pre-signup
  console.log('Step 1: POST /api/auth/pre-signup');
  const preSignupRes = await fetch(`${PRODUCTION_BASE}/api/auth/pre-signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_EMAIL,
      name: 'Tim Gate1',
      password: 'testpass123',
      trainer_id: TRAINER_ID,
    }),
  });

  const preSignupData = await preSignupRes.json();
  console.log('Status:', preSignupRes.status);
  console.log('Response:', JSON.stringify(preSignupData, null, 2));

  if (!preSignupRes.ok || !preSignupData.success) {
    console.error('FAIL: Pre-signup failed');
    return { pass: false, error: 'Pre-signup failed', preSignupData };
  }

  const { token } = preSignupData;
  
  // Step 2: Decode token
  console.log('\nStep 2: Decode token (base64url -> JSON)');
  let tokenData;
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    tokenData = JSON.parse(decoded);
    console.log('Token payload:', JSON.stringify(tokenData, null, 2));
  } catch (e) {
    console.error('FAIL: Could not decode token:', e.message);
    return { pass: false, error: 'Token decode failed' };
  }

  if (tokenData.trainer_id !== TRAINER_ID) {
    console.error(`FAIL: trainer_id mismatch. Expected: ${TRAINER_ID}, Got: ${tokenData.trainer_id}`);
    return { pass: false, error: 'trainer_id mismatch in token' };
  }
  console.log('✓ trainer_id matches in token\n');

  // Step 3: POST to /api/auth/signup
  console.log('Step 3: POST /api/auth/signup');
  const signupRes = await fetch(`${PRODUCTION_BASE}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token,
      gender: 'male',
      programType: 'event_ready',
      currentWeight: 180,
      goalWeight: 170,
      waiver_accepted: true,
    }),
  });

  const signupData = await signupRes.json();
  console.log('Status:', signupRes.status);
  console.log('Response:', JSON.stringify(signupData, null, 2));

  if (!signupRes.ok || !signupData.success) {
    console.error('FAIL: Signup failed');
    return { pass: false, error: 'Signup failed', signupData };
  }

  if (!signupData.clientId) {
    console.error('FAIL: No clientId returned');
    return { pass: false, error: 'No clientId returned' };
  }

  console.log(`\n✓ Signup success. clientId: ${signupData.clientId}`);
  
  return { 
    pass: true, 
    clientId: signupData.clientId,
    email: TEST_EMAIL,
    tokenData,
  };
}

runGate1()
  .then(result => {
    console.log('\n=== GATE 1 RESULT ===');
    console.log(result.pass ? 'PASS ✓' : `FAIL ✗ — ${result.error}`);
    process.exit(result.pass ? 0 : 1);
  })
  .catch(e => {
    console.error('Fatal:', e);
    process.exit(1);
  });
