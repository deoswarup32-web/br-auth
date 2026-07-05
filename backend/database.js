import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const DATA_DIR = path.join(process.cwd(), 'data');

// Helper to ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class JsonCollection {
  constructor(name) {
    this.filePath = path.join(DATA_DIR, `${name}.json`);
    this.data = [];
    this.lock = false;
    this.queue = [];
    this.load();
  }

  load() {
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        this.data = JSON.parse(raw || '[]');
      } catch (err) {
        console.error(`Error reading database file ${this.filePath}:`, err);
        this.data = [];
      }
    } else {
      this.data = [];
      this.saveSync();
    }
  }

  saveSync() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
  }

  async save() {
    if (this.lock) {
      return new Promise((resolve) => {
        this.queue.push(resolve);
      }).then(() => this.save());
    }

    this.lock = true;
    try {
      const tempPath = `${this.filePath}.tmp`;
      await fs.promises.writeFile(tempPath, JSON.stringify(this.data, null, 2), 'utf8');
      await fs.promises.rename(tempPath, this.filePath);
    } catch (err) {
      console.error(`Error saving database file ${this.filePath}:`, err);
    } finally {
      this.lock = false;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        next();
      }
    }
  }

  async find(query = {}) {
    return this.data.filter(item => {
      for (const key in query) {
        if (item[key] !== query[key]) return false;
      }
      return true;
    });
  }

  async findOne(query = {}) {
    return this.data.find(item => {
      for (const key in query) {
        if (item[key] !== query[key]) return false;
      }
      return true;
    }) || null;
  }

  async insert(doc) {
    const newDoc = {
      id: Math.random().toString(36).substring(2, 11) + Date.now().toString(36),
      createdAt: new Date().toISOString(),
      ...doc
    };
    this.data.push(newDoc);
    await this.save();
    return newDoc;
  }

  async update(query, updates) {
    let updatedCount = 0;
    const updatedDocs = [];
    this.data = this.data.map(item => {
      let matches = true;
      for (const key in query) {
        if (item[key] !== query[key]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        const updated = { ...item, ...updates, updatedAt: new Date().toISOString() };
        updatedCount++;
        updatedDocs.push(updated);
        return updated;
      }
      return item;
    });
    if (updatedCount > 0) {
      await this.save();
    }
    return updatedDocs;
  }

  async delete(query) {
    const beforeCount = this.data.length;
    this.data = this.data.filter(item => {
      let matches = true;
      for (const key in query) {
        if (item[key] !== query[key]) {
          matches = false;
          break;
        }
      }
      return !matches;
    });
    const afterCount = this.data.length;
    if (beforeCount !== afterCount) {
      await this.save();
    }
    return beforeCount - afterCount;
  }
}

// Instantiate Collections
export const db = {
  users: new JsonCollection('users'),
  keys: new JsonCollection('keys'),
  settings: new JsonCollection('settings'),
  apps: new JsonCollection('apps'),
  credits: new JsonCollection('credits')
};

// Seed function to initialize default settings and default Admin
export async function seedDatabase() {
  // 1. Seed Admin user if not exists
  const adminExists = await db.users.findOne({ role: 'admin' });
  if (!adminExists) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('admin123', salt);
    await db.users.insert({
      username: 'admin',
      passwordHash,
      role: 'admin',
      createdBy: 'system',
      status: 'active'
    });
    console.log('[Database] Default admin account seeded: admin / admin123');
  }

  // 2. Seed default settings
  const settingsCount = db.settings.data.length;
  if (settingsCount === 0) {
    await db.settings.insert({
      key: 'registration_enabled',
      value: false // By default, public sign up is blocked! Users must use generated keys to sign up.
    });
    console.log('[Database] Default settings seeded: registration_enabled = false');
  }
}
