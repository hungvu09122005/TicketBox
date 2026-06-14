const http = require('http');

async function testAuth() {
  console.log('Testing login...');
  const loginRes = await fetch('http://localhost:3001/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@ticketbox.com', password: 'password123' })
  });
  const loginData = await loginRes.json();
  if (!loginData.success) {
    console.error('Login failed:', loginData);
    return;
  }
  const { accessToken, refreshToken } = loginData.data;
  console.log('Login success! Got tokens.');
  
  console.log('Testing refresh...');
  const refreshRes = await fetch('http://localhost:3001/api/v1/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });
  const refreshData = await refreshRes.json();
  if (!refreshData.success) {
    console.error('Refresh failed:', refreshData);
    return;
  }
  const newRefreshToken = refreshData.data.refreshToken;
  console.log('Refresh success! Got new refresh token.');

  console.log('Testing reuse of old refresh token (should fail)...');
  const oldRefreshRes = await fetch('http://localhost:3001/api/v1/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });
  const oldRefreshData = await oldRefreshRes.json();
  console.log('Reuse old refresh result (expect success=false):', oldRefreshData.success === false);

  console.log('Testing revoke...');
  const revokeRes = await fetch('http://localhost:3001/api/v1/auth/revoke', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${refreshData.data.accessToken}` 
    },
    body: JSON.stringify({ refreshToken: newRefreshToken })
  });
  const revokeData = await revokeRes.json();
  console.log('Revoke result:', revokeData.success === true);

  console.log('Testing revoked token (should fail)...');
  const revokedRefreshRes = await fetch('http://localhost:3001/api/v1/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: newRefreshToken })
  });
  const revokedRefreshData = await revokedRefreshRes.json();
  console.log('Revoked token refresh result (expect success=false):', revokedRefreshData.success === false);
  
  console.log('All tests finished.');
}

testAuth();
