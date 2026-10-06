-- ==============================================================================
-- SCHEMA SQL: TABEL GOOGLE SPREADSHEET SYNC & CETAK REKAP DISPENSASI
-- ==============================================================================
-- Untuk: Sistem Data Ketidakhadiran Peserta Training (Indomaret)
-- Link Spreadsheet Sumber:
-- https://docs.google.com/spreadsheets/d/1X9rBiIzAo-PHIAPAFcAU3ElpHBSVDga_BftgSeqWdqY/edit?gid=1583921750#gid=1583921750
--
-- CARA PENGGUNAAN DI SUPABASE SQL EDITOR:
-- 1. Buka Supabase Dashboard > Project Anda > SQL Editor
-- 2. Buat query baru, salin seluruh isi file ini, lalu klik Run.
-- ==============================================================================

-- 1. TABEL: cetak_rekap (Sesuai Sheet cetak_rekap Google Sheets)
-- Header: NO, JENIS TRAINING, TARGET LSKT, DISPENSASI, TARGET TC REPORT, HADIR, TIDAK HADIR, NO LIST PESERTA TIDAK HADIR
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

-- Indeks unik berdasarkan jenis_training agar dapat di-upsert otomatis
create unique index if not exists idx_cetak_rekap_training on cetak_rekap (jenis_training);

-- ------------------------------------------------------------------------------
-- 2. TABEL: list_tidak_hadir (Sesuai Sheet list_tidak_hadir Google Sheets)
-- Header: NO, TRAINING, NIK, NAMA, KD TOKO, NAMA TOKO, ALASAN TIDAK HADIR
-- ------------------------------------------------------------------------------
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

-- Indeks untuk pencarian dan filter per training / NIK
create index if not exists idx_list_tidak_hadir_training on list_tidak_hadir (training);
create index if not exists idx_list_tidak_hadir_nik on list_tidak_hadir (nik);

-- ------------------------------------------------------------------------------
-- 3. TABEL: data_tambahan (Sesuai Sheet Data_tambahan)
-- Header: NO, TRAINING, NIK, NAMA, KD TOKO, NAMA TOKO, ALASAN TIDAK HADIR
-- Otomatis mencatat data baru yang diinput ke Supabase
-- ------------------------------------------------------------------------------
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

create index if not exists idx_data_tambahan_nik on data_tambahan (nik);
create index if not exists idx_data_tambahan_training on data_tambahan (training);

-- ------------------------------------------------------------------------------
-- 4. TABEL: cetak_list_tidak_hadir (Sesuai Sheet cetak_list_tidak_hadir)
-- Header: NO, TRAINING, NIK, NAMA, KD TOKO, NAMA TOKO, ALASAN TIDAK HADIR
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 5. TABEL: list_soft_skill (Sesuai Sheet list_soft_skill Google Sheets)
-- Header: NIK, Nama, Jabatan, Kategory, Detail Alasan
-- Otomatis ditarik & disinkronisasi setiap 10 detik dari spreadsheet
-- ------------------------------------------------------------------------------
create table if not exists list_soft_skill (
  id uuid primary key default gen_random_uuid(),
  no int,
  nik text not null,
  nama text not null,
  jabatan text default '',
  kategory text default '',
  detail_alasan text default '',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists idx_list_soft_skill_nik on list_soft_skill (nik);

-- ------------------------------------------------------------------------------
-- 6. TRIGGER OTOMATIS: Pencatatan ke data_tambahan saat ada input baru di absence_records
-- ------------------------------------------------------------------------------
create or replace function fn_auto_record_to_data_tambahan()
returns trigger as $$
declare
  v_training_name text;
  v_alasan_name text;
  v_next_no int;
begin
  -- Ambil nama training
  select name into v_training_name from training_types where id = new.training_id;
  if v_training_name is null then
    v_training_name := 'TRAINING';
  end if;

  -- Ambil nama alasan
  select name into v_alasan_name from absence_reasons where id = new.alasan_id;
  if v_alasan_name is null then
    v_alasan_name := coalesce(new.keterangan, '-');
  end if;

  -- Hitung nomor urut berikutnya
  select coalesce(max(no), 0) + 1 into v_next_no from data_tambahan;

  -- Insert ke data_tambahan
  insert into data_tambahan (
    no,
    training,
    nik,
    nama,
    kd_toko,
    nama_toko,
    alasan_tidak_hadir,
    source_record_id,
    created_at
  ) values (
    v_next_no,
    v_training_name,
    new.nik,
    new.nama_peserta,
    coalesce(new.jabatan, '-'),
    '-',
    v_alasan_name,
    new.id,
    now()
  );

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_absence_records_to_data_tambahan on absence_records;
create trigger trg_absence_records_to_data_tambahan
after insert on absence_records
for each row
execute function fn_auto_record_to_data_tambahan();

-- ------------------------------------------------------------------------------
-- 7. HAK AKSES RLS (Row Level Security)
-- ------------------------------------------------------------------------------
alter table cetak_rekap enable row level security;
alter table list_tidak_hadir enable row level security;
alter table data_tambahan enable row level security;
alter table cetak_list_tidak_hadir enable row level security;
alter table list_soft_skill enable row level security;

-- Izinkan full access untuk backend / service_role
create policy "Full access cetak_rekap" on cetak_rekap for all using (true) with check (true);
create policy "Full access list_tidak_hadir" on list_tidak_hadir for all using (true) with check (true);
create policy "Full access data_tambahan" on data_tambahan for all using (true) with check (true);
create policy "Full access cetak_list_tidak_hadir" on cetak_list_tidak_hadir for all using (true) with check (true);
create policy "Full access list_soft_skill" on list_soft_skill for all using (true) with check (true);

-- ------------------------------------------------------------------------------
-- 8. REFRESH SCHEMA CACHE
-- ------------------------------------------------------------------------------
notify pgrst, 'reload schema';
