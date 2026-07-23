import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const NODE_URL = 'http://localhost:5000';

async function testUpload() {
  console.log('=== TESTING PDF UPLOAD API WITH VALID SAMPLE PDF ===');
  
  // 1. Signup / Login
  const testUser = {
    name: 'Upload Tester',
    email: `uploader_${Date.now()}@aai.aero`,
    password: 'Password123!',
    role: 'Dispatcher',
  };

  const signupRes = await axios.post(`${NODE_URL}/api/auth/signup`, testUser);
  const token = signupRes.data.token;
  console.log('Logged in as:', signupRes.data.user.email);

  const samplePdfPath = 'd:/AIML/NOTAM-main/python-backend/sample_notam.pdf';
  const pdfBuffer = fs.readFileSync(samplePdfPath);

  const form = new FormData();
  form.append('file', pdfBuffer, {
    filename: 'VOBL_NOTAM_A1226.pdf',
    contentType: 'application/pdf',
  });
  form.append('category', 'Runway');

  try {
    const uploadRes = await axios.post(`${NODE_URL}/api/upload`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${token}`,
      },
    });
    console.log('✅ Upload Endpoint Response:', uploadRes.data);

    // Verify python health/sources now shows chunk/source
    const sourcesRes = await axios.get(`${NODE_URL}/api/notam/sources`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('✅ NOTAM Sources after upload:', sourcesRes.data);

  } catch (err) {
    console.error('❌ Upload failed:', err.response?.data || err.message);
  }
}

testUpload();
