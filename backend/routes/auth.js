import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../database.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_auth_key_12345';

// 1. Dashboard Login (Supports Admin, Seller, Reseller, and Registered User)
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }

  try {
    const user = await db.users.findOne({ username: username.toLowerCase() });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid username or password' });
    }

    if (user.status === 'blocked') {
      return res.status(403).json({ success: false, message: 'Your account is blocked' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid username or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. User Signup / Registration (Strictly requires a valid generated Key)
router.post('/signup', async (req, res) => {
  const { username, password, key: keyString } = req.body;

  if (!username || !password || !keyString) {
    return res.status(400).json({ success: false, message: 'Username, password and license key are required' });
  }

  try {
    // Check if user already exists
    const existingUser = await db.users.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Username is already taken' });
    }

    // Validate license key
    const keyDoc = await db.keys.findOne({ key: keyString });
    if (!keyDoc) {
      return res.status(404).json({ success: false, message: 'Invalid license key' });
    }

    if (keyDoc.isUsed) {
      return res.status(400).json({ success: false, message: 'License key has already been used' });
    }

    // Create the user account
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await db.users.insert({
      username: username.toLowerCase(),
      passwordHash,
      role: 'user',
      createdBy: keyDoc.createdBy, // created via the reseller/seller's key
      status: 'active',
      hwid: null // Will lock on first client login
    });

    // Mark key as used
    await db.keys.update(
      { id: keyDoc.id },
      {
        isUsed: true,
        usedAt: new Date().toISOString(),
        usedBy: username.toLowerCase()
      }
    );

    res.status(201).json({
      success: true,
      message: 'Account registered successfully! Download the client and login to activate HWID.'
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
