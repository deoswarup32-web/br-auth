import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../database.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_auth_key_12345';

// Helper to check if key is expired
function isKeyExpired(keyDoc) {
  if (!keyDoc.isUsed || !keyDoc.usedAt) return false;
  const usedDate = new Date(keyDoc.usedAt);
  const expiryDate = new Date(usedDate.getTime() + keyDoc.expiryDays * 24 * 60 * 60 * 1000);
  return new Date() > expiryDate;
}

// Helper to get key remaining time string
function getRemainingTime(keyDoc) {
  if (!keyDoc.isUsed || !keyDoc.usedAt) return `${keyDoc.expiryDays} days`;
  const usedDate = new Date(keyDoc.usedAt);
  const expiryDate = new Date(usedDate.getTime() + keyDoc.expiryDays * 24 * 60 * 60 * 1000);
  const diffMs = expiryDate.getTime() - new Date().getTime();
  if (diffMs <= 0) return 'Expired';
  
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  return `${diffDays}d ${diffHours}h ${diffMins}m`;
}

// 1. Direct Key Authentication (Key + HWID)
router.post('/login-key', async (req, res) => {
  const { key: keyString, hwid, appId } = req.body;

  if (!keyString || !hwid) {
    return res.status(400).json({ success: false, message: 'License key and HWID are required' });
  }

  try {
    const keyDoc = await db.keys.findOne({ key: keyString });
    if (!keyDoc) {
      return res.status(404).json({ success: false, message: 'Invalid license key' });
    }

    // App ID match check
    if (appId && keyDoc.appId && keyDoc.appId !== appId) {
      return res.status(403).json({ success: false, message: 'License key is not authorized for this application' });
    }

    // Check if expired
    if (isKeyExpired(keyDoc)) {
      return res.status(403).json({ success: false, message: 'License key has expired' });
    }

    // First time usage
    if (!keyDoc.isUsed) {
      const now = new Date().toISOString();
      await db.keys.update(
        { id: keyDoc.id },
        {
          isUsed: true,
          usedAt: now,
          hwid: hwid,
          usedBy: `key_user_${keyDoc.id}`
        }
      );
      
      const token = jwt.sign({ keyId: keyDoc.id, type: 'key_session' }, JWT_SECRET, { expiresIn: '24h' });
      return res.json({
        success: true,
        message: 'License activated and locked to HWID',
        token,
        remaining: `${keyDoc.expiryDays} days`
      });
    }

    // Subsequent logins - Check HWID lock
    if (keyDoc.hwidLockEnabled !== false && keyDoc.hwid !== hwid) {
      return res.status(403).json({ success: false, message: 'HWID mismatch. Hardware lock active' });
    }

    const token = jwt.sign({ keyId: keyDoc.id, type: 'key_session' }, JWT_SECRET, { expiresIn: '24h' });
    res.json({
      success: true,
      message: 'Login successful',
      token,
      remaining: getRemainingTime(keyDoc)
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. User Credentials Authentication (Username + Password + HWID)
router.post('/login-user', async (req, res) => {
  const { username, password, hwid, appId } = req.body;

  if (!username || !password || !hwid) {
    return res.status(400).json({ success: false, message: 'Username, password and HWID are required' });
  }

  try {
    const user = await db.users.findOne({ username: username.toLowerCase(), role: 'user' });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Invalid username or password' });
    }

    // App ID match check
    if (appId && user.appId && user.appId !== appId) {
      return res.status(403).json({ success: false, message: 'Account is not authorized for this application' });
    }

    if (user.status === 'blocked') {
      return res.status(403).json({ success: false, message: 'Your account is banned' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid username or password' });
    }

    // Find the associated key for expiry check
    const keyDoc = await db.keys.findOne({ usedBy: user.username });
    if (!keyDoc) {
      return res.status(404).json({ success: false, message: 'No license key associated with this user' });
    }

    if (isKeyExpired(keyDoc)) {
      return res.status(403).json({ success: false, message: 'Subscription has expired' });
    }

    // Lock HWID on first login
    if (user.hwidLockEnabled !== false) {
      if (!user.hwid) {
        await db.users.update({ id: user.id }, { hwid });
        await db.keys.update({ id: keyDoc.id }, { hwid }); // Sync key's HWID
      } else if (user.hwid !== hwid) {
        return res.status(403).json({ success: false, message: 'HWID mismatch. Hardware lock active' });
      }
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: 'user' }, JWT_SECRET, { expiresIn: '24h' });
    res.json({
      success: true,
      message: 'Login successful',
      token,
      remaining: getRemainingTime(keyDoc)
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Session token validation (Verify if JWT session is still active and valid)
router.post('/verify', async (req, res) => {
  const { token, hwid } = req.body;

  if (!token || !hwid) {
    return res.status(400).json({ success: false, valid: false, message: 'Token and HWID are required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.type === 'key_session') {
      const keyDoc = await db.keys.findOne({ id: decoded.keyId });
      if (!keyDoc || isKeyExpired(keyDoc) || (keyDoc.hwidLockEnabled !== false && keyDoc.hwid !== hwid)) {
        return res.status(403).json({ success: false, valid: false, message: 'Session invalid or HWID mismatched' });
      }
      return res.json({ success: true, valid: true, remaining: getRemainingTime(keyDoc) });
    } else {
      const user = await db.users.findOne({ id: decoded.id });
      if (!user || user.status === 'blocked' || (user.hwidLockEnabled !== false && user.hwid !== hwid)) {
        return res.status(403).json({ success: false, valid: false, message: 'Session invalid or HWID mismatched' });
      }

      const keyDoc = await db.keys.findOne({ usedBy: user.username });
      if (!keyDoc || isKeyExpired(keyDoc)) {
        return res.status(403).json({ success: false, valid: false, message: 'Subscription expired' });
      }

      return res.json({ success: true, valid: true, remaining: getRemainingTime(keyDoc) });
    }
  } catch (err) {
    res.status(403).json({ success: false, valid: false, message: 'Invalid session token' });
  }
});

export default router;
