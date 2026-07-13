import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);
router.use(requireRole(['reseller']));

// Helper to generate key formats
function generateRandomKey(prefix = 'KEY') {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) result += '-';
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${result}`;
}

// Generate keys for reseller (Requires app credit validation)
router.post('/keys', async (req, res) => {
  const { count, expiryDays, note, appId } = req.body;

  if (!appId) {
    return res.status(400).json({ success: false, message: 'Application ID is required' });
  }

  const keyCount = Math.min(parseInt(count) || 1, 50); // limit to max 50 keys at once for resellers
  const days = parseInt(expiryDays) || 30;

  try {
    // Check reseller's credits for this appId
    const creditRecord = await db.credits.findOne({ resellerUsername: req.user.username.toLowerCase(), appId });
    if (!creditRecord || creditRecord.credits < keyCount) {
      return res.status(403).json({ 
        success: false, 
        message: `Insufficient credits. You need ${keyCount} credits for this app but have ${creditRecord ? creditRecord.credits : 0}` 
      });
    }

    const generated = [];
    for (let i = 0; i < keyCount; i++) {
      const keyValue = generateRandomKey('AUTH');
      const newKey = await db.keys.insert({
        key: keyValue,
        expiryDays: days,
        createdBy: req.user.username,
        usedBy: null,
        usedAt: null,
        hwid: null,
        isUsed: false,
        appId: appId,
        note: note || ''
      });
      generated.push(newKey);
    }

    // Deduct credits
    const newCredits = creditRecord.credits - keyCount;
    await db.credits.update({ id: creditRecord.id }, { credits: newCredits });

    res.status(201).json({ success: true, keys: generated, remainingCredits: newCredits });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// List reseller's own keys (with appName hydrated)
router.get('/keys', async (req, res) => {
  try {
    const keys = await db.keys.find({ createdBy: req.user.username });
    const hydrated = await Promise.all(keys.map(async (k) => {
      if (k.appId) {
        const app = await db.apps.findOne({ id: k.appId });
        return { ...k, appName: app ? app.name : 'Unknown App' };
      }
      return { ...k, appName: '-' };
    }));
    res.json({ success: true, keys: hydrated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Reset HWID (only keys created by this reseller)
router.post('/hwid/reset', async (req, res) => {
  const { keyId } = req.body;

  if (!keyId) {
    return res.status(400).json({ success: false, message: 'Key ID is required' });
  }

  try {
    const key = await db.keys.findOne({ id: keyId });
    if (!key) {
      return res.status(404).json({ success: false, message: 'Key not found' });
    }

    if (key.createdBy !== req.user.username) {
      return res.status(403).json({ success: false, message: 'Access denied: You do not own this key' });
    }

    await db.keys.update({ id: keyId }, { hwid: null });

    if (key.usedBy) {
      await db.users.update({ username: key.usedBy }, { hwid: null });
    }

    res.json({ success: true, message: 'HWID reset successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create a User Account directly by reseller (requires app credit check)
router.post('/user-account', async (req, res) => {
  const { username, password, expiryDays, note, hwidLockEnabled, appId } = req.body;

  if (!username || !password || !expiryDays || !appId) {
    return res.status(400).json({ success: false, message: 'Username, password, subscription duration and Application ID are required' });
  }

  try {
    // Check reseller's credits for this appId
    const creditRecord = await db.credits.findOne({ resellerUsername: req.user.username.toLowerCase(), appId });
    if (!creditRecord || creditRecord.credits < 1) {
      return res.status(403).json({ 
        success: false, 
        message: `Insufficient credits. You need 1 credit for this app but have ${creditRecord ? creditRecord.credits : 0}` 
      });
    }

    const existingUser = await db.users.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Username is already taken' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Auto-generate a key for this user
    const keyValue = generateRandomKey('AUTH');
    const now = new Date().toISOString();
    const lockHwid = typeof hwidLockEnabled === 'boolean' ? hwidLockEnabled : true;

    const newKey = await db.keys.insert({
      key: keyValue,
      expiryDays: parseInt(expiryDays) || 30,
      createdBy: req.user.username,
      usedBy: username.toLowerCase(),
      usedAt: now,
      hwid: null,
      isUsed: true,
      hwidLockEnabled: lockHwid,
      appId: appId,
      note: note || `Created directly for ${username}`
    });

    const newUser = await db.users.insert({
      username: username.toLowerCase(),
      passwordHash,
      role: 'user',
      createdBy: req.user.username,
      status: 'active',
      hwid: null,
      hwidLockEnabled: lockHwid,
      appId: appId
    });

    // Deduct credit
    const newCredits = creditRecord.credits - 1;
    await db.credits.update({ id: creditRecord.id }, { credits: newCredits });

    res.status(201).json({ success: true, message: `User account ${username} created successfully with key ${keyValue}`, remainingCredits: newCredits });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Reseller assigned apps listing
router.get('/my-apps', async (req, res) => {
  try {
    const records = await db.credits.find({ resellerUsername: req.user.username.toLowerCase() });
    const hydrated = await Promise.all(records.map(async (c) => {
      const app = await db.apps.findOne({ id: c.appId });
      return {
        appId: c.appId,
        appName: app ? app.name : 'Unknown App',
        appDescription: app ? app.description : '',
        credits: c.credits
      };
    }));
    res.json({ success: true, apps: hydrated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// List users created by this reseller
router.get('/my-users', async (req, res) => {
  try {
    const users = await db.users.find({ createdBy: req.user.username });
    const safeUsers = users.map(({ passwordHash, ...u }) => u);
    res.json({ success: true, users: safeUsers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete a user created by this reseller
router.delete('/user/:username', async (req, res) => {
  const targetUsername = req.params.username.toLowerCase();
  try {
    const user = await db.users.findOne({ username: targetUsername });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.createdBy !== req.user.username) {
      return res.status(403).json({ success: false, message: 'Access denied: You did not create this user' });
    }
    await db.users.delete({ username: targetUsername });
    await db.keys.delete({ usedBy: targetUsername });
    res.json({ success: true, message: `User ${targetUsername} deleted successfully` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Change password of a user created by this reseller
router.patch('/user/password', async (req, res) => {
  const { username, newPassword } = req.body;
  if (!username || !newPassword) {
    return res.status(400).json({ success: false, message: 'Username and new password are required' });
  }
  const targetUsername = username.toLowerCase();
  try {
    const user = await db.users.findOne({ username: targetUsername });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.createdBy !== req.user.username) {
      return res.status(403).json({ success: false, message: 'Access denied: You did not create this user' });
    }
    if (newPassword.length < 4) {
      return res.status(400).json({ success: false, message: 'Password must be at least 4 characters' });
    }
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    await db.users.update({ username: targetUsername }, { passwordHash });
    res.json({ success: true, message: `Password for ${targetUsername} updated successfully` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete a key created by this reseller (along with its registered user account)
router.delete('/key/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const key = await db.keys.findOne({ id });
    if (!key) {
      return res.status(404).json({ success: false, message: 'Key not found' });
    }
    if (key.createdBy !== req.user.username) {
      return res.status(403).json({ success: false, message: 'Access denied: You do not own this key' });
    }
    // Delete user registered with this key if active
    if (key.isUsed && key.usedBy) {
      await db.users.delete({ username: key.usedBy });
    }
    await db.keys.delete({ id });
    res.json({ success: true, message: 'Key and its associated user account deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
