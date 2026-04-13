import { supabase } from '../config/supabase.js';
import { saveAuth, clearAuth, getState } from './state.js';

// Team Login
export async function teamLogin(teamId, password) {
  // Query team by team_id
  const { data: team, error } = await supabase
    .from('teams')
    .select('*')
    .eq('team_id', teamId)
    .single();
  
  if (error || !team) {
    throw new Error('Invalid Team ID');
  }

  // Verify password using DB function
  const { data: match, error: verifyErr } = await supabase.rpc('verify_password', {
    p_password: password,
    p_hash: team.password_hash
  });

  if (verifyErr || !match) {
    throw new Error('Invalid password');
  }

  if (team.status === 'eliminated') {
    // Still allow login but mark as eliminated
    const sessionToken = crypto.randomUUID();
    await supabase.from('teams').update({ session_token: sessionToken }).eq('id', team.id);
    
    saveAuth({
      id: team.id,
      team_id: team.team_id,
      team_name: team.team_name,
      members: team.members,
      role: 'team',
      status: 'eliminated',
      session_token: sessionToken,
      event_id: team.event_id
    });
    return { success: true, eliminated: true };
  }

  // Generate session token for single-session enforcement
  const sessionToken = crypto.randomUUID();
  await supabase.from('teams').update({ session_token: sessionToken }).eq('id', team.id);

  saveAuth({
    id: team.id,
    team_id: team.team_id,
    team_name: team.team_name,
    members: team.members,
    role: 'team',
    status: 'active',
    session_token: sessionToken,
    event_id: team.event_id
  });

  return { success: true, eliminated: false };
}

// Admin Login
export async function adminLogin(username, password) {
  const { data: admin, error } = await supabase
    .from('admins')
    .select('*')
    .eq('username', username)
    .single();

  if (error || !admin) {
    throw new Error('Invalid username');
  }

  const { data: match, error: verifyErr } = await supabase.rpc('verify_password', {
    p_password: password,
    p_hash: admin.password_hash
  });

  if (verifyErr || !match) {
    throw new Error('Invalid password');
  }

  const sessionToken = crypto.randomUUID();
  await supabase.from('admins').update({ session_token: sessionToken }).eq('id', admin.id);

  saveAuth({
    id: admin.id,
    username: admin.username,
    role: 'admin',
    session_token: sessionToken
  });

  return { success: true };
}

// Register Team
export async function registerTeam({ teamName, members, contactEmail, contactPhone, eventId, extraData = {} }) {
  // Generate a sequential team ID by finding the max existing one
  const { data: lastTeam } = await supabase
    .from('teams')
    .select('team_id')
    .order('team_id', { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextNum = 1;
  if (lastTeam && lastTeam.team_id) {
    const lastNum = parseInt(lastTeam.team_id.replace('HB-', ''));
    if (!isNaN(lastNum)) nextNum = lastNum + 1;
  }
  
  const teamId = `HB-${String(nextNum).padStart(3, '0')}`;
  
  // Generate random password
  const password = generatePassword();
  
  // Hash password using DB function
  const { data: hash, error: hashErr } = await supabase.rpc('hash_password', {
    p_password: password
  });

  if (hashErr) throw new Error('Registration failed: ' + hashErr.message);

  const { data, error } = await supabase.from('teams').insert({
    event_id: eventId,
    team_id: teamId,
    team_name: teamName,
    password_hash: hash,
    plaintext_password: password,
    members: members,
    contact_email: contactEmail,
    contact_phone: contactPhone,
    metadata: Object.keys(extraData).length > 0 ? extraData : {}
  }).select().single();

  if (error) throw new Error('Registration failed: ' + error.message);

  return { team_id: teamId, password, team: data };
}

function generatePassword(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Validate session is still active
export async function validateSession() {
  const user = getState('user');
  if (!user) return false;

  if (user.role === 'admin') {
    const { data } = await supabase
      .from('admins')
      .select('session_token')
      .eq('id', user.id)
      .single();
    return data?.session_token === user.session_token;
  } else {
    const { data } = await supabase
      .from('teams')
      .select('session_token, status')
      .eq('id', user.id)
      .single();
    return data?.session_token === user.session_token;
  }
}

export function logout() {
  clearAuth();
  window.location.hash = '#/';
}
