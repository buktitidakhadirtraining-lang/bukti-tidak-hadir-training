-- ==============================================================================
-- SCHEMA LENGKAP SUPABASE: SISTEM DATA KETIDAKHADIRAN PESERTA TRAINING
-- ==============================================================================
-- Dikembangkan untuk: Sistem Data Ketidakhadiran Peserta Training (Bang Ajiib 2026)
-- 
-- CARA PENGGUNAAN:
-- 1. Buka Supabase Dashboard (https://supabase.com/dashboard)
-- 2. Pilih project Anda > Menu "SQL Editor" di bilah kiri
-- 3. Klik "+ New query"
-- 4. Salin (copy) dan tempel (paste) SELURUH isi script ini
-- 5. Klik tombol "Run" (atau tekan Ctrl+Enter / Cmd+Enter)
-- ==============================================================================

-- 1. AKTIFKAN EKSTENSI PGCRYPTO (untuk UUID & enkripsi hashing password)
create extension if not exists pgcrypto;

-- ------------------------------------------------------------------------------
-- 2. TABEL: branches (Data Cabang)
-- ------------------------------------------------------------------------------
create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  code text unique not null,
  drive_bridge_url text,
  drive_bridge_secret_enc text,
  is_active boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ------------------------------------------------------------------------------
-- 3. TABEL: users (Akun Pengguna & Hak Akses)
-- ------------------------------------------------------------------------------
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  full_name text not null,
  role text not null check (role in ('admin_pusat', 'admin_cabang')),
  branch_id uuid references branches(id) on delete set null,
  is_active boolean default true not null,
  must_change_password boolean default false not null,
  failed_login_count int default 0 not null,
  locked_until timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint check_branch_role check (
    (role = 'admin_cabang' and branch_id is not null) or
    (role = 'admin_pusat')
  )
);

-- ------------------------------------------------------------------------------
-- 4. TABEL: training_types (Master 16 Jenis Training)
-- ------------------------------------------------------------------------------
create table if not exists training_types (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  description text,
  sort_order int default 0 not null,
  is_active boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ------------------------------------------------------------------------------
-- 5. TABEL: absence_reasons (Master 10 Alasan Ketidakhadiran)
-- ------------------------------------------------------------------------------
create table if not exists absence_reasons (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  description text,
  sort_order int default 0 not null,
  is_active boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ------------------------------------------------------------------------------
-- 6. TABEL: absence_records (Rekap Data Ketidakhadiran Peserta)
-- ------------------------------------------------------------------------------
create table if not exists absence_records (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id) on delete restrict,
  nik text not null,
  nama_peserta text not null,
  jabatan text not null,
  batch int default 1 not null,
  training_id uuid not null references training_types(id) on delete restrict,
  tanggal_pelaksanaan date not null,
  alasan_id uuid not null references absence_reasons(id) on delete restrict,
  keterangan text,
  drive_file_id text,
  drive_file_name text,
  drive_file_url text,
  file_mime_type text,
  file_size_bytes bigint,
  created_by uuid constraint absence_records_created_by_fkey references users(id) on delete set null,
  updated_by uuid references users(id) on delete set null,
  updated_at timestamptz default now() not null,
  created_at timestamptz default now() not null
);

-- ------------------------------------------------------------------------------
-- 7. TABEL: audit_logs (Log Jejak Audit Aktivitas)
-- ------------------------------------------------------------------------------
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  action text not null,
  details jsonb default '{}'::jsonb,
  created_at timestamptz default now() not null
);

-- ------------------------------------------------------------------------------
-- 8. INDEX UNIK & PERFORMA PENCARIAN
-- ------------------------------------------------------------------------------
-- Mencegah duplikasi data: NIK yang sama tidak boleh tercatat 2 kali pada tanggal dan training yang sama di cabang tersebut
create unique index if not exists idx_absence_records_unique_entry 
  on absence_records (branch_id, nik, training_id, tanggal_pelaksanaan);

-- Indeks performa untuk filter, pencarian, dan paginasi
create index if not exists idx_absence_records_branch_id on absence_records(branch_id);
create index if not exists idx_absence_records_tanggal_pelaksanaan on absence_records(tanggal_pelaksanaan);
create index if not exists idx_absence_records_nik on absence_records(nik);
create index if not exists idx_absence_records_training_id on absence_records(training_id);
create index if not exists idx_absence_records_alasan_id on absence_records(alasan_id);
create index if not exists idx_users_username on users(username);
create index if not exists idx_users_branch_id on users(branch_id);
create index if not exists idx_audit_logs_user_id on audit_logs(user_id);
create index if not exists idx_audit_logs_action on audit_logs(action);
create index if not exists idx_audit_logs_created_at on audit_logs(created_at);

-- ------------------------------------------------------------------------------
-- 9. KEAMANAN ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------
-- Seluruh akses data menggunakan Service Role Key dari backend Next.js secara aman
alter table branches enable row level security;
alter table users enable row level security;
alter table training_types enable row level security;
alter table absence_reasons enable row level security;
alter table absence_records enable row level security;
alter table audit_logs enable row level security;

-- ==============================================================================
-- 10. CABANG (Dikelola oleh Admin melalui menu Master Cabang)
-- ==============================================================================
-- Tidak ada cabang demo bawaan. Cabang ditambahkan secara dinamis oleh pengguna.

-- ==============================================================================
-- 11. SEED DATA AWAL: 16 JENIS TRAINING RESMI
-- ==============================================================================
insert into training_types (name, sort_order, is_active) values
  ('Fried Food', 1, true),
  ('Fresh', 2, true),
  ('Say Burger', 3, true),
  ('Say Bread', 4, true),
  ('PcDel', 5, true),
  ('Special Store', 6, true),
  ('YCCG', 7, true),
  ('Eva SC', 8, true),
  ('Barista', 9, true),
  ('Leader Barista', 10, true),
  ('Soft Skill', 11, true),
  ('Idel', 12, true),
  ('CIF', 13, true),
  ('SSL', 14, true),
  ('SJL', 15, true),
  ('Training DC', 16, true)
on conflict (name) do nothing;

-- ==============================================================================
-- 12. SEED DATA AWAL: 11 ALASAN KETIDAKHADIRAN RESMI
-- ==============================================================================
insert into absence_reasons (name, sort_order, is_active) values
  ('Bencana alam', 1, true),
  ('Cuti', 2, true),
  ('Keluarga inti sakit', 3, true),
  ('Lain - lain', 4, true),
  ('Mangkir', 5, true),
  ('Menggantikan personil lain', 6, true),
  ('Musibah/kecelakaan', 7, true),
  ('Mutasi', 8, true),
  ('Resign', 9, true),
  ('Sakit', 10, true),
  ('Toko tidak jual prodsus', 11, true)
on conflict (name) do nothing;


-- ==============================================================================
-- 13. SEED AKUN PENGGUNA DEFAULT (Password default: Admin123!)
-- ==============================================================================
-- Akun Admin Pusat Utama
insert into users (
  username,
  password_hash,
  full_name,
  role,
  branch_id,
  is_active,
  must_change_password
) values (
  'admin.pusat',
  crypt('Admin123!', gen_salt('bf', 10)),
  'Admin Pusat Utama',
  'admin_pusat',
  null,
  true,
  false
)
on conflict (username) do nothing;

-- Akun alternatif 'admin'
insert into users (
  username,
  password_hash,
  full_name,
  role,
  branch_id,
  is_active,
  must_change_password
) values (
  'admin',
  crypt('Admin123!', gen_salt('bf', 10)),
  'Administrator',
  'admin_pusat',
  null,
  true,
  false
)
on conflict (username) do nothing;

-- Akun Admin Cabang Surabaya
insert into users (
  username,
  password_hash,
  full_name,
  role,
  branch_id,
  is_active,
  must_change_password
) 
select 
  'admin.sby',
  crypt('Admin123!', gen_salt('bf', 10)),
  'Admin Cabang Surabaya',
  'admin_cabang',
  b.id,
  true,
  false
from branches b
where b.code = 'SBY1'
on conflict (username) do nothing;

-- ==============================================================================
-- 15. TABEL TAMBAHAN: SINKRONISASI SPREADSHEET & CETAK BERITA ACARA REKAP
-- ==============================================================================
create table if not exists cetak_rekap (
  id uuid primary key default gen_random_uuid(),
  no int,
  jenis_training text not null,
  target_lskt text default '0',
  dispensasi text default '0',
  target_tc_report text default '',
  hadir text default '',
  tidak_hadir text default '',
  no_list_peserta_tidak_hadir text default '',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
create unique index if not exists idx_cetak_rekap_training on cetak_rekap (jenis_training);

create table if not exists list_tidak_hadir (
  id uuid primary key default gen_random_uuid(),
  no int,
  training text not null,
  nik text not null,
  nama text not null,
  kd_toko text,
  nama_toko text,
  alasan_tidak_hadir text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
create index if not exists idx_list_tidak_hadir_training on list_tidak_hadir (training);
create index if not exists idx_list_tidak_hadir_nik on list_tidak_hadir (nik);

create table if not exists data_tambahan (
  id uuid primary key default gen_random_uuid(),
  no serial,
  training text not null,
  nik text not null,
  nama text not null,
  kd_toko text,
  nama_toko text,
  alasan_tidak_hadir text,
  source_record_id uuid,
  created_at timestamptz default now() not null
);

create table if not exists cetak_list_tidak_hadir (
  id uuid primary key default gen_random_uuid(),
  no int,
  training text not null,
  nik text not null,
  nama text not null,
  kd_toko text,
  nama_toko text,
  alasan_tidak_hadir text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists ttd_cabang (
  id uuid primary key default gen_random_uuid(),
  cabang text not null,
  peran text not null check (peran in ('dbm_operasional', 'dbm_admin', 'hrd_manager', 'tc_supervisor')),
  drive_file_id text not null,
  file_name text,
  mime_type text default 'image/png',
  updated_by uuid references users(id) on delete set null,
  updated_at timestamptz default now() not null,
  unique (cabang, peran)
);
create index if not exists idx_ttd_cabang_lookup on ttd_cabang (cabang, peran);

alter table cetak_rekap enable row level security;
alter table list_tidak_hadir enable row level security;
alter table data_tambahan enable row level security;
alter table cetak_list_tidak_hadir enable row level security;
alter table ttd_cabang enable row level security;

create policy "Allow all on ttd_cabang" on ttd_cabang for all using (true) with check (true);

-- ==============================================================================
-- 16. RELOAD SCHEMA CACHE POSTGREST
-- ==============================================================================
notify pgrst, 'reload schema';
