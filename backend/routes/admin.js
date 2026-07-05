import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);
router.use(requireRole(['admin']));

// Get overall stats
router.get('/stats', async (req, res) => {
  try {
    const users = db.users.data;
    const keys = db.keys.data;

    const stats = {
      totalUsers: users.filter(u => u.role === 'user').length,
      totalSellers: users.filter(u => u.role === 'seller').length,
      totalResellers: users.filter(u => u.role === 'reseller').length,
      totalKeys: keys.length,
      usedKeys: keys.filter(k => k.isUsed).length,
      unusedKeys: keys.filter(k => !k.isUsed).length,
    };

    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// List all sellers and resellers
router.get('/users', async (req, res) => {
  try {
    // Return users without sensitive password hashes
    const users = db.users.data.map(({ passwordHash, ...user }) => user);
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create a new Seller
router.post('/seller', async (req, res) => {
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
      role: 'seller',
      createdBy: req.user.username,
      status: 'active'
    });

    const { passwordHash: _, ...userWithoutPassword } = newUser;
    res.status(201).json({ success: true, user: userWithoutPassword });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update/Toggle user status (block/unblock)
router.patch('/user/status', async (req, res) => {
  const { userId, status } = req.body; // 'active' or 'blocked'

  if (!userId || !['active', 'blocked'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid parameters' });
  }

  try {
    const updated = await db.users.update({ id: userId }, { status });
    if (updated.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, message: `User status changed to ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete a user (Sellers or Resellers)
router.delete('/user/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const targetUser = await db.users.findOne({ id });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (targetUser.role === 'admin') {
      return res.status(400).json({ success: false, message: 'Cannot delete the admin' });
    }

    await db.users.delete({ id });
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get registration setting
router.get('/settings', async (req, res) => {
  try {
    const regSetting = await db.settings.findOne({ key: 'registration_enabled' });
    res.json({
      success: true,
      registrationEnabled: regSetting ? regSetting.value : false
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update registration setting
router.post('/settings', async (req, res) => {
  const { registrationEnabled } = req.body;

  if (typeof registrationEnabled !== 'boolean') {
    return res.status(400).json({ success: false, message: 'registrationEnabled must be a boolean' });
  }

  try {
    await db.settings.update({ key: 'registration_enabled' }, { value: registrationEnabled });
    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
