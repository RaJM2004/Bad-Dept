import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('--- Starting API Tests ---');
  let token = '';

  try {
    // 1. Get Auth Token (assume admin@example.com is seeded)
    const authRes = await axios.post(`${BASE_URL}/auth/login`, { email: 'admin@example.com', password: 'password123' });
    token = authRes.data.token;
    console.log('✅ Auth successful');
  } catch (e) {
    console.error('❌ Auth failed. Please ensure DB is seeded and server is running.', e);
    return;
  }

  const headers = { Authorization: `Bearer ${token}` };

  try {
    // 2. Fetch a seeded customer to use for tests
    const custRes = await axios.get(`${BASE_URL}/customers`, { headers });
    const customerId = custRes.data[0]._id;
    console.log('✅ Fetched customer:', customerId);

    // 3. Test Repayment Plan Agent
    console.log('Testing Repayment Plan Agent...');
    const repayRes = await axios.post(`${BASE_URL}/agents/repayment-plan`, {
      customerId,
      proposedAmount: 500,
      hardshipReason: 'Lost my job'
    }, { headers });
    console.log('✅ Repayment Agent Response:', repayRes.data);

    // 4. Test Dispute Management Agent
    console.log('Testing Dispute Management Agent...');
    const disputeRes = await axios.post(`${BASE_URL}/agents/dispute`, {
      customerId,
      disputeReason: 'I never made these charges'
    }, { headers });
    console.log('✅ Dispute Agent Response:', disputeRes.data);

    // 5. Test Analytics and Report Agent
    console.log('Testing Analytics & Report Agent...');
    const analyticsRes = await axios.post(`${BASE_URL}/agents/analytics-report`, {
      metrics: { totalCustomers: 10, successRate: 50, amountRecovered: 5000 }
    }, { headers });
    console.log('✅ Analytics Agent Response:', analyticsRes.data);

    console.log('--- All Agent Tests Completed ---');
  } catch (e: any) {
    console.error('❌ Test failed:', e.response?.data || e.message);
  }
}

runTests();
