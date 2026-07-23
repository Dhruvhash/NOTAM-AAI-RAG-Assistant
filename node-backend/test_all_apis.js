import axios from 'axios';

const NODE_URL = 'http://localhost:5000';
const PYTHON_URL = 'http://localhost:8000';

async function runTests() {
  console.log('=== STARTING FULL API SUITE TESTS ===\n');

  // 1. Python Health Check
  try {
    const pyHealth = await axios.get(`${PYTHON_URL}/health`);
    console.log('✅ Python Health Check Passed:', pyHealth.data);
  } catch (err) {
    console.error('❌ Python Health Check Failed:', err.message);
  }

  // 2. Node Root Check
  try {
    const nodeRoot = await axios.get(`${NODE_URL}/api`);
    console.log('✅ Node Backend API Root Passed:', nodeRoot.data);
  } catch (err) {
    console.error('❌ Node Backend API Root Failed:', err.message);
  }

  const testUser = {
    name: 'Test Pilot',
    email: `testpilot_${Date.now()}@aai.aero`,
    password: 'Password123!',
    role: 'Pilot',
  };

  let tokenCookie = '';
  let authHeader = '';

  // 3. Auth - Signup
  try {
    const signupRes = await axios.post(`${NODE_URL}/api/auth/signup`, testUser);
    console.log('✅ Auth Signup Passed:', signupRes.data.user.email, '| Role:', signupRes.data.user.role);
    tokenCookie = signupRes.headers['set-cookie'] ? signupRes.headers['set-cookie'][0] : '';
    authHeader = `Bearer ${signupRes.data.token}`;
  } catch (err) {
    console.error('❌ Auth Signup Failed:', err.response?.data || err.message);
  }

  // 4. Auth - Login
  try {
    const loginRes = await axios.post(`${NODE_URL}/api/auth/login`, {
      email: testUser.email,
      password: testUser.password,
    });
    console.log('✅ Auth Login Passed:', loginRes.data.user.name);
    authHeader = `Bearer ${loginRes.data.token}`;
    if (loginRes.headers['set-cookie']) {
      tokenCookie = loginRes.headers['set-cookie'][0];
    }
  } catch (err) {
    console.error('❌ Auth Login Failed:', err.response?.data || err.message);
  }

  const reqConfig = {
    headers: {
      Authorization: authHeader,
      Cookie: tokenCookie,
    },
    withCredentials: true,
  };

  // 5. Auth - Get Me
  try {
    const meRes = await axios.get(`${NODE_URL}/api/auth/me`, reqConfig);
    console.log('✅ Auth GET /me Passed:', meRes.data.user.email);
  } catch (err) {
    console.error('❌ Auth GET /me Failed:', err.response?.data || err.message);
  }

  // 6. NOTAM - Health & Sources Proxy
  try {
    const healthProxy = await axios.get(`${NODE_URL}/api/notam/health`, reqConfig);
    console.log('✅ NOTAM Health Proxy Passed:', healthProxy.data);

    const sourcesProxy = await axios.get(`${NODE_URL}/api/notam/sources`, reqConfig);
    console.log('✅ NOTAM Sources Proxy Passed:', sourcesProxy.data);
  } catch (err) {
    console.error('❌ NOTAM Proxy Endpoints Failed:', err.response?.data || err.message);
  }

  // 7. Chat - Ask Question
  try {
    const chatRes = await axios.post(`${NODE_URL}/api/chat/ask`, { question: 'What is the active NOTAM for runway 09?' }, reqConfig);
    console.log('✅ Chat Ask Question Passed:', chatRes.data.chat.question, '-> Answer:', chatRes.data.chat.answer.substring(0, 60) + '...');

    const historyRes = await axios.get(`${NODE_URL}/api/chat/history`, reqConfig);
    console.log('✅ Chat History Fetched:', historyRes.data.history.length, 'entries');
  } catch (err) {
    console.error('❌ Chat Endpoints Failed:', err.response?.data || err.message);
  }

  // 8. Bookmarks - Create, List, Delete
  let bookmarkId = '';
  try {
    const createBmk = await axios.post(
      `${NODE_URL}/api/bookmarks`,
      {
        question: 'What is the active NOTAM for runway 09?',
        answer: 'Runway 09/27 closed for maintenance daily from 0200Z to 0600Z.',
        sources: [{ filename: 'VABB_NOTAM.pdf', notam_id: 'A1234/26', score: 0.95 }],
        category: 'Runway',
      },
      reqConfig
    );
    console.log('✅ Create Bookmark Passed ID:', createBmk.data.bookmark._id);
    bookmarkId = createBmk.data.bookmark._id;

    const listBmk = await axios.get(`${NODE_URL}/api/bookmarks`, reqConfig);
    console.log('✅ List Bookmarks Passed Count:', listBmk.data.bookmarks.length);

    if (bookmarkId) {
      const delBmk = await axios.delete(`${NODE_URL}/api/bookmarks/${bookmarkId}`, reqConfig);
      console.log('✅ Delete Bookmark Passed:', delBmk.data.message);
    }
  } catch (err) {
    console.error('❌ Bookmarks Endpoints Failed:', err.response?.data || err.message);
  }

  // 9. Analytics Endpoint
  try {
    const analyticsRes = await axios.get(`${NODE_URL}/api/analytics`, reqConfig);
    console.log('✅ Analytics Endpoint Passed Daily Stats Count:', analyticsRes.data.dailyStats.length);
  } catch (err) {
    console.error('❌ Analytics Endpoint Failed:', err.response?.data || err.message);
  }

  // 10. Update Profile & Password
  try {
    const updateProf = await axios.put(`${NODE_URL}/api/auth/profile`, { name: 'Captain Test Pilot' }, reqConfig);
    console.log('✅ Update Profile Passed New Name:', updateProf.data.user.name);

    const updatePass = await axios.put(`${NODE_URL}/api/auth/password`, { currentPassword: 'Password123!', newPassword: 'NewPassword123!' }, reqConfig);
    console.log('✅ Update Password Passed:', updatePass.data.message);
  } catch (err) {
    console.error('❌ Update Profile / Password Failed:', err.response?.data || err.message);
  }

  console.log('\n=== ALL API SUITE TESTS COMPLETED ===');
}

runTests();
