// E2E points system test
// Run: node test_e2e_points.js

import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const API_BASE = 'http://localhost:8787';
const SUPABASE_URL = 'https://bqbtkaljxsmdcpedrerg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxYnRrYWxqeHNtZGNwZWRyZXJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NDg0NDUsImV4cCI6MjA3NDAyNDQ0NX0._XIcJcSg_00b_iOs90QM5GNaKAg5_LEHGDrexDTFcMQ';

async function main() {
  const username = `e2e_${Date.now()}`;
  const password = 'test123456';
  const email = `${username}@cookapp.local`;

  console.log('1) Register user:', username);
  let res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const reg = await res.json();
  console.log('Register:', reg);
  if (!reg.success) throw new Error('Registration failed');
  if (reg.points !== 100) throw new Error('Expected 100 points on registration');
  if (!reg.username || reg.username === '用户') throw new Error('Username not set correctly on registration');

  console.log('2) Login via Supabase to get token');
  const supa = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data: loginData, error: loginErr } = await supa.auth.signInWithPassword({ email, password });
  if (loginErr) throw loginErr;
  const { data: sessionData } = await supa.auth.getSession();
  const token = sessionData.session.access_token;

  console.log('3) Fetch /auth/user');
  res = await fetch(`${API_BASE}/auth/user`, { headers: { Authorization: `Bearer ${token}` } });
  const userInfo = await res.json();
  console.log('User info:', userInfo);
  if (userInfo.points !== 100) throw new Error('Expected 100 points at login');
  if (!userInfo.username || userInfo.username === '用户') throw new Error('Username not set correctly at login');

  console.log('4) Consume points 10x');
  for (let i = 0; i < 10; i++) {
    res = await fetch(`${API_BASE}/auth/consume-points`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ points: 10 })
    });
    const d = await res.json();
    console.log(`consume #${i + 1}:`, d);
    if (!d.success) break;
  }

  console.log('5) Check insufficient (requiredPoints=10)');
  res = await fetch(`${API_BASE}/auth/check-points`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ requiredPoints: 10 })
  });
  const chk = await res.json();
  console.log('check-points:', chk);
  if (chk.hasEnough) throw new Error('Expected insufficient points after draining');

  console.log('6) Try create job (should be blocked due to insufficient points)');
  const form = new FormData();
  form.append('image', new Blob(['x'], { type: 'image/png' }), 'a.png');
  res = await fetch(`${API_BASE}/jobs`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  const txt = await res.text();
  console.log('create /jobs status:', res.status);
  console.log('create /jobs body:', txt);
  if (res.status === 201) throw new Error('Job should not be created when points are insufficient');

  console.log('\n✅ E2E points test passed');
}

main().catch((e) => { console.error('E2E FAILED:', e); process.exit(1); });
