// lib/mock-supabase.js
// In-memory / file-persisted mock Supabase client for local development & fallback
import fs from 'node:fs';

const DB_FILE = '/tmp/training_attendance_db.json';

const INITIAL_TRAININGS = [
  'Fried Food', 'Fresh', 'Say Burger', 'Say Bread', 'PcDel',
  'Special Store', 'YCCG', 'Eva SC', 'Barista', 'Leader Barista',
  'Soft Skill', 'Idel', 'CIF', 'SSL', 'SJL', 'Training DC'
].map((name, index) => ({
  id: `tt-${String(index + 1).padStart(3, '0')}`,
  name,
  description: `Pelatihan standar ${name}`,
  sort_order: index + 1,
  is_active: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}));

const INITIAL_REASONS = [
  'Bencana alam',
  'Cuti',
  'Keluarga inti sakit',
  'Lain - lain',
  'Mangkir',
  'Menggantikan personil lain',
  'Musibah/kecelakaan',
  'Mutasi',
  'Resign',
  'Sakit',
  'Toko tidak jual prodsus',
].map((name, index) => ({
  id: `ar-${String(index + 1).padStart(3, '0')}`,
  name,
  description: `Alasan ketidakhadiran: ${name}`,
  sort_order: index + 1,
  is_active: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}));

const INITIAL_BRANCHES = [];


// admin123 & Admin123! bcrypt hash
const ADMIN_HASH_EXCLAMATION = '$2a$10$cK8aSILI1HDNtig6g5KE.eng5hlEZdT3RuIUtewCXbYyE0BWW2bLm';
const ADMIN_HASH = '$2a$10$U1Hp1eivxEB1/m2CRngclODYURdj0eKxRxRH7dzayBZhhNfD3l7/G';

const INITIAL_USERS = [
  {
    id: 'usr-admin-001',
    username: 'admin.pusat',
    password_hash: ADMIN_HASH_EXCLAMATION,
    full_name: 'Admin Pusat Utama',
    role: 'admin_pusat',
    branch_id: null,
    is_active: true,
    must_change_password: false,
    failed_login_count: 0,
    locked_until: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr-admin-002',
    username: 'admin',
    password_hash: ADMIN_HASH_EXCLAMATION,
    full_name: 'Administrator',
    role: 'admin_pusat',
    branch_id: null,
    is_active: true,
    must_change_password: false,
    failed_login_count: 0,
    locked_until: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr-sby-001',
    username: 'admin.sby',
    password_hash: ADMIN_HASH_EXCLAMATION,
    full_name: 'Admin Cabang Surabaya',
    role: 'admin_cabang',
    branch_id: 'br-sby-001',
    is_active: true,
    must_change_password: false,
    failed_login_count: 0,
    locked_until: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr-jkt-001',
    username: 'adminjkt',
    password_hash: ADMIN_HASH_EXCLAMATION,
    full_name: 'Admin Cabang Jakarta',
    role: 'admin_cabang',
    branch_id: 'br-jkt-001',
    is_active: true,
    must_change_password: false,
    failed_login_count: 0,
    locked_until: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
];

const INITIAL_RECORDS = [];


function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.warn('[Mock DB] Gagal membaca berkas db, inisialisasi ulang:', err.message);
  }

  const initial = {
    branches: INITIAL_BRANCHES,
    users: INITIAL_USERS,
    training_types: INITIAL_TRAININGS,
    absence_reasons: INITIAL_REASONS,
    absence_records: INITIAL_RECORDS,
    audit_logs: [],
  };
  saveDatabase(initial);
  return initial;
}

function saveDatabase(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Mock DB] Gagal menyimpan berkas db:', err.message);
  }
}

export function createMockSupabaseClient() {
  return {
    from(tableName) {
      return new MockQueryBuilder(tableName);
    },
  };
}

class MockQueryBuilder {
  constructor(tableName) {
    this.tableName = tableName;
    this.filters = [];
    this.orders = [];
    this.selectedFields = '*';
    this.countOption = null;
    this.rangeLimit = null;
    this.limitCount = null;
    this.isSingle = false;
    this.isMaybeSingle = false;
    this.insertData = null;
    this.updateData = null;
    this.isDelete = false;
  }

  select(fields = '*', options = {}) {
    this.selectedFields = fields;
    if (options.count) {
      this.countOption = options.count;
    }
    return this;
  }

  insert(data) {
    this.insertData = data;
    return this;
  }

  update(data) {
    this.updateData = data;
    return this;
  }

  delete() {
    this.isDelete = true;
    return this;
  }

  eq(column, value) {
    this.filters.push((item) => String(item[column]) === String(value));
    return this;
  }

  neq(column, value) {
    this.filters.push((item) => String(item[column]) !== String(value));
    return this;
  }

  ilike(column, value) {
    const cleanPattern = String(value).replace(/%/g, '').toLowerCase();
    this.filters.push((item) => {
      const val = String(item[column] || '').toLowerCase();
      return val.includes(cleanPattern);
    });
    return this;
  }

  in(column, values) {
    const set = new Set((values || []).map((v) => String(v)));
    this.filters.push((item) => set.has(String(item[column])));
    return this;
  }

  gte(column, value) {
    this.filters.push((item) => String(item[column]) >= String(value));
    return this;
  }

  lte(column, value) {
    this.filters.push((item) => String(item[column]) <= String(value));
    return this;
  }

  order(column, { ascending = true } = {}) {
    this.orders.push({ column, ascending });
    return this;
  }

  range(from, to) {
    this.rangeLimit = { from, to };
    return this;
  }

  limit(count) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  async execute() {
    const db = loadDatabase();
    if (!db[this.tableName]) {
      db[this.tableName] = [];
    }

    const table = db[this.tableName];

    // Handle INSERT
    if (this.insertData) {
      const recordsToInsert = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
      const inserted = recordsToInsert.map((item) => ({
        id: item.id || `${this.tableName.slice(0, 3)}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        created_at: item.created_at || new Date().toISOString(),
        updated_at: item.updated_at || new Date().toISOString(),
        ...item,
      }));

      // Check duplicate uniqueness for absence_records: branch_id + nik + training_id + tanggal_pelaksanaan
      if (this.tableName === 'absence_records') {
        for (const item of inserted) {
          const duplicate = table.find(
            (r) =>
              r.branch_id === item.branch_id &&
              String(r.nik).toLowerCase() === String(item.nik).toLowerCase() &&
              r.training_id === item.training_id &&
              r.tanggal_pelaksanaan === item.tanggal_pelaksanaan
          );
          if (duplicate) {
            return {
              data: null,
              error: {
                code: '23505',
                message: 'Data untuk NIK ini pada training dan tanggal tersebut sudah ada.',
              },
            };
          }
        }
      }

      table.push(...inserted);
      saveDatabase(db);

      if (this.isSingle) {
        return { data: inserted[0], error: null };
      }
      return { data: Array.isArray(this.insertData) ? inserted : inserted[0], error: null };
    }

    // Handle UPDATE
    if (this.updateData) {
      let matchedCount = 0;
      let lastUpdated = null;
      for (const item of table) {
        const matches = this.filters.every((fn) => fn(item));
        if (matches) {
          Object.assign(item, this.updateData, { updated_at: new Date().toISOString() });
          matchedCount++;
          lastUpdated = item;
        }
      }
      saveDatabase(db);
      if (this.isSingle) {
        return { data: lastUpdated, error: null };
      }
      return { data: lastUpdated, count: matchedCount, error: null };
    }

    // Handle DELETE
    if (this.isDelete) {
      const remaining = table.filter((item) => !this.filters.every((fn) => fn(item)));
      db[this.tableName] = remaining;
      saveDatabase(db);
      return { error: null };
    }

    // Handle SELECT
    let results = table.filter((item) => this.filters.every((fn) => fn(item)));

    // Handle Sorting
    if (this.orders.length > 0) {
      results = [...results].sort((a, b) => {
        for (const { column, ascending } of this.orders) {
          const valA = a[column];
          const valB = b[column];
          if (valA === valB) continue;
          if (valA == null) return ascending ? 1 : -1;
          if (valB == null) return ascending ? -1 : 1;
          if (valA < valB) return ascending ? -1 : 1;
          if (valA > valB) return ascending ? 1 : -1;
        }
        return 0;
      });
    }

    const totalCount = results.length;

    // Handle Pagination
    if (this.rangeLimit) {
      results = results.slice(this.rangeLimit.from, this.rangeLimit.to + 1);
    } else if (this.limitCount != null) {
      results = results.slice(0, this.limitCount);
    }

    // Expand Relational Joins if requested in selectedFields
    const branchesMap = new Map(db.branches.map((b) => [b.id, b]));
    const trainingsMap = new Map(db.training_types.map((t) => [t.id, t]));
    const reasonsMap = new Map(db.absence_reasons.map((r) => [r.id, r]));
    const usersMap = new Map(db.users.map((u) => [u.id, u]));

    const fieldsStr = typeof this.selectedFields === 'string' ? this.selectedFields : '*';
    const wantsBranches = fieldsStr.includes('branches');
    const wantsTrainings = fieldsStr.includes('training_types');
    const wantsReasons = fieldsStr.includes('absence_reasons');
    const wantsUsers = fieldsStr.includes('users');

    const mappedResults = results.map((item) => {
      const clone = { ...item };
      if (this.tableName === 'absence_records') {
        if (wantsBranches) {
          const br = branchesMap.get(item.branch_id);
          clone.branches = br ? { id: br.id, name: br.name, code: br.code, drive_bridge_url: br.drive_bridge_url, drive_bridge_secret_enc: br.drive_bridge_secret_enc } : null;
        }
        if (wantsTrainings) {
          const tr = trainingsMap.get(item.training_id);
          clone.training_types = tr ? { id: tr.id, name: tr.name } : null;
        }
        if (wantsReasons) {
          const re = reasonsMap.get(item.alasan_id);
          clone.absence_reasons = re ? { id: re.id, name: re.name } : null;
        }
        if (wantsUsers) {
          const us = usersMap.get(item.created_by);
          clone.users = us ? { id: us.id, full_name: us.full_name, username: us.username } : null;
        }
      } else if (this.tableName === 'users' && wantsBranches) {
        const br = branchesMap.get(item.branch_id);
        clone.branches = br ? { id: br.id, name: br.name, code: br.code } : null;
      }
      return clone;
    });

    if (this.isSingle) {
      if (mappedResults.length === 0) {
        return { data: null, error: { message: 'Row not found' } };
      }
      return { data: mappedResults[0], error: null };
    }

    if (this.isMaybeSingle) {
      return { data: mappedResults[0] || null, error: null };
    }

    return {
      data: mappedResults,
      count: totalCount,
      error: null,
    };
  }

  // Thenable for await syntax: await supabase.from(...).select(...)
  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }
}
