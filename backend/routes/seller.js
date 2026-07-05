import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);
router.use(requireRole(['admin', 'seller']));

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

// Create a Reseller (only Admin and Sellers can create Resellers)
router.post('/reseller', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }

  try {
    const existingUser = await db.users.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Username already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await db.users.insert({
      username: username.toLowerCase(),
      passwordHash,
      role: 'reseller',
      createdBy: req.user.username,
      status: 'active'
    });

    const { passwordHash: _, ...userWithoutPassword } = newUser;
    res.status(201).json({ success: true, user: userWithoutPassword });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get Resellers created by this Seller/Admin
router.get('/resellers', async (req, res) => {
  try {
    const query = req.user.role === 'admin' ? { role: 'reseller' } : { role: 'reseller', createdBy: req.user.username };
    const resellers = await db.users.find(query);
    const sanitized = resellers.map(({ passwordHash, ...r }) => r);
    res.json({ success: true, resellers: sanitized });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Generate Keys
router.post('/keys', async (req, res) => {
  const { count, expiryDays, note, appId } = req.body;

  const keyCount = parseInt(count) || 1;
  const days = parseInt(expiryDays) || 30;

  if (keyCount <= 0 || keyCount > 100) {
    return res.status(400).json({ success: false, message: 'Count must be between 1 and 100' });
  }

  try {
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
        appId: appId || null,
        note: note || ''
      });
      generated.push(newKey);
    }

    res.status(201).json({ success: true, keys: generated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// List all generated keys (Admin sees all, Sellers see theirs)
router.get('/keys', async (req, res) => {
  try {
    const query = req.user.role === 'admin' ? {} : { createdBy: req.user.username };
    const keys = await db.keys.find(query);
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

// Reset HWID Lock of a Key/User
router.post('/hwid/reset', async (req, res) => {
  const { keyId, username } = req.body;

  try {
    if (keyId) {
      const key = await db.keys.findOne({ id: keyId });
      if (!key) {
        return res.status(404).json({ success: false, message: 'Key not found' });
      }
      if (req.user.role !== 'admin' && key.createdBy !== req.user.username) {
        return res.status(403).json({ success: false, message: 'Access denied: You did not create this key' });
      }

      await db.keys.update({ id: keyId }, { hwid: null });

      // Find the user who used it and reset their HWID as well
      if (key.usedBy) {
        await db.users.update({ username: key.usedBy }, { hwid: null });
      }

      return res.json({ success: true, message: 'HWID lock reset successfully for this key/user' });
    }

    if (username) {
      const user = await db.users.findOne({ username: username.toLowerCase(), role: 'user' });
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Find associated key to verify creator
      const key = await db.keys.findOne({ usedBy: user.username });
      if (key && req.user.role !== 'admin' && key.createdBy !== req.user.username) {
        return res.status(403).json({ success: false, message: 'Access denied: User belongs to another seller\'s key' });
      }

      await db.users.update({ id: user.id }, { hwid: null });
      if (key) {
        await db.keys.update({ id: key.id }, { hwid: null });
      }

      return res.json({ success: true, message: 'HWID lock reset successfully for user' });
    }

    res.status(400).json({ success: false, message: 'Provide either keyId or username' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete a generated key (only if not used, or always if admin)
router.delete('/key/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const key = await db.keys.findOne({ id });
    if (!key) {
      return res.status(404).json({ success: false, message: 'Key not found' });
    }

    if (req.user.role !== 'admin' && key.createdBy !== req.user.username) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Delete user registered with this key
    if (key.isUsed && key.usedBy) {
      await db.users.delete({ username: key.usedBy });
    }

    await db.keys.delete({ id });
    res.json({ success: true, message: 'Key and its associated user account deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create a User Account directly (creates user + auto-generates & activates key)
router.post('/user-account', async (req, res) => {
  const { username, password, expiryDays, note, hwidLockEnabled, appId } = req.body;

  if (!username || !password || !expiryDays) {
    return res.status(400).json({ success: false, message: 'Username, password and subscription duration are required' });
  }

  try {
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
      appId: appId || null,
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
      appId: appId || null
    });

    res.status(201).json({ success: true, message: `User account ${username} created successfully with key ${keyValue}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// App Management Routes
router.get('/apps', async (req, res) => {
  try {
    let apps;
    if (req.user.role === 'admin') {
      apps = await db.apps.find({});
    } else {
      apps = await db.apps.find({ sellerUsername: req.user.username });
    }
    res.json({ success: true, apps });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/apps', async (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, message: 'App name is required' });
  }
  try {
    const newApp = await db.apps.insert({
      name: name.trim(),
      description: description || '',
      sellerUsername: req.user.username
    });
    res.status(201).json({ success: true, app: newApp });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Reseller Credits Routes
router.post('/reseller-credits', async (req, res) => {
  const { resellerUsername, appId, credits } = req.body;
  if (!resellerUsername || !appId || credits === undefined) {
    return res.status(400).json({ success: false, message: 'Reseller username, app ID and credits count are required' });
  }
  try {
    const reseller = await db.users.findOne({ username: resellerUsername.toLowerCase(), role: 'reseller' });
    if (!reseller) {
      return res.status(404).json({ success: false, message: 'Reseller not found' });
    }
    const app = await db.apps.findOne({ id: appId });
    if (!app) {
      return res.status(404).json({ success: false, message: 'App not found' });
    }

    // Find if credit record already exists
    const creditRecord = await db.credits.findOne({ resellerUsername: resellerUsername.toLowerCase(), appId });
    let updatedRecord;
    if (creditRecord) {
      const newCredits = parseInt(creditRecord.credits) + parseInt(credits);
      const updated = await db.credits.update({ id: creditRecord.id }, { credits: newCredits });
      updatedRecord = updated[0];
    } else {
      updatedRecord = await db.credits.insert({
        resellerUsername: resellerUsername.toLowerCase(),
        appId,
        credits: parseInt(credits),
        sellerUsername: req.user.username
      });
    }

    res.json({ success: true, message: `Successfully assigned ${credits} credits to ${resellerUsername} for app ${app.name}`, record: updatedRecord });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/reseller-credits', async (req, res) => {
  try {
    let list;
    if (req.user.role === 'admin') {
      list = await db.credits.find({});
    } else {
      list = await db.credits.find({ sellerUsername: req.user.username });
    }
    // Hydrate with app names and reseller details
    const hydrated = await Promise.all(list.map(async (c) => {
      const app = await db.apps.findOne({ id: c.appId });
      return {
        ...c,
        appName: app ? app.name : 'Unknown App'
      };
    }));
    res.json({ success: true, credits: hydrated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
