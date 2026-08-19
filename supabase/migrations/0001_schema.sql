-- ============================================================================
-- HTBC-X03 — CHƯƠNG TRÌNH HÀNH ĐỘNG SỐ 10/CTR-BCA-X03
-- Migration 0001: Core schema
-- Chủ quản: Cục Công tác chính trị (X03) - Bộ Công an
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- 1. SYSTEM SETTINGS (đơn vị chủ quản / cấu hình chương trình)
-- ============================================================================
create table system_settings (
  id                      uuid primary key default gen_random_uuid(),
  system_name             text not null default 'CHƯƠNG TRÌNH HÀNH ĐỘNG SỐ 10/CTR-BCA-X03',
  system_short_name       text not null default 'HTBC-X03',
  program_number          text not null default '10/CTR-BCA-X03',
  program_date            date not null default '2026-05-12',
  program_title           text not null default 'TĂNG CƯỜNG SIẾT CHẶT KỶ LUẬT, KỶ CƯƠNG, NÂNG CAO Ý THỨC CHẤP HÀNH ĐIỀU LỆNH CÔNG AN NHÂN DÂN',
  owner_unit_code         text not null default 'X03',
  owner_unit_name         text not null default 'CỤC CÔNG TÁC CHÍNH TRỊ',
  owner_organization      text not null default 'BỘ CÔNG AN',
  current_reporting_year  int  not null default extract(isoyear from now())::int,
  current_reporting_week  int  not null default extract(week from now())::int,
  submission_deadline_dow int  not null default 3 check (submission_deadline_dow between 1 and 7), -- ISO: 3 = Thứ 4
  submission_deadline_time time not null default '10:00',
  system_status           text not null default 'active' check (system_status in ('active','maintenance','closed')),
  admin_password_hash     text not null, -- SHA-256(password + salt cố định) — xem hàm hash_admin_password()
  updated_at              timestamptz not null default now()
);

-- Chỉ cho phép đúng 1 dòng cấu hình
create unique index one_settings_row on system_settings ((true));

-- ============================================================================
-- 2. PROVINCES (34 tỉnh/thành phố)
-- ============================================================================
create table provinces (
  province_id   uuid primary key default gen_random_uuid(),
  province_code text not null unique,
  province_name text not null,
  province_type text not null check (province_type in ('thanh_pho_tw','tinh')),
  active        boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_provinces_active on provinces(active);

-- ============================================================================
-- 3. UNITS (64 Cục/đơn vị trực thuộc Bộ + 34 Công an tỉnh/thành = đơn vị báo cáo)
-- ============================================================================
create table units (
  unit_id     uuid primary key default gen_random_uuid(),
  unit_code   text not null unique,
  unit_name   text not null,
  unit_type   text not null check (unit_type in ('cuc','congan_tinh','khac')),
  province_id uuid references provinces(province_id),
  is_owner    boolean not null default false, -- true cho X03 (chủ quản, không báo cáo)
  active      boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_units_active on units(active);
create index idx_units_province on units(province_id);
create index idx_units_type on units(unit_type);

-- ============================================================================
-- 4. REPORTS (báo cáo tuần — header)
-- Ghi chú kiến trúc: hệ thống KHÔNG dùng tài khoản đăng nhập riêng cho từng
-- đơn vị (theo yêu cầu triển khai thực tế) — đơn vị tự chọn tên đơn vị mình
-- từ danh sách và nhập báo cáo, giống cách vận hành của Google Form nội bộ.
-- Admin bảo vệ bằng 1 mật khẩu chung (xem system_settings.admin_password_hash),
-- các thao tác nhạy cảm (xóa báo cáo, đổi mật khẩu, cấu hình, quản lý danh mục)
-- đều đi qua Netlify Function xác minh mật khẩu trước khi dùng service_role.
-- ============================================================================
create table reports (
  report_id        uuid primary key default gen_random_uuid(),
  report_code      text not null unique,
  reporting_year   int  not null check (reporting_year between 2020 and 2100),
  reporting_week   int  not null check (reporting_week between 1 and 53),
  week_start_date  date not null,
  week_end_date    date not null,
  province_id      uuid references provinces(province_id),
  unit_id          uuid not null references units(unit_id),
  reporter_name    text not null check (char_length(trim(reporter_name)) > 0),
  reporter_phone   text not null check (reporter_phone ~ '^[0-9.+ ]{8,15}$'),
  status           text not null default 'submitted' check (status in ('draft','submitted','updated','overdue')),
  submitted_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint uq_report_unit_week_year unique (unit_id, reporting_week, reporting_year)
);
create index idx_reports_unit on reports(unit_id);
create index idx_reports_province on reports(province_id);
create index idx_reports_week on reports(reporting_week);
create index idx_reports_year on reports(reporting_year);
create index idx_reports_status on reports(status);
create index idx_reports_created_at on reports(created_at);

-- ============================================================================
-- 6. REPORT_PART1 — I. Kết quả công tác kiểm tra điều lệnh, quân sự, võ thuật
-- ============================================================================
create table report_part1 (
  part1_id           uuid primary key default gen_random_uuid(),
  report_id          uuid not null unique references reports(report_id) on delete cascade,
  plan_name          text,        -- Tên kế hoạch
  plan_number        text,        -- Số, ký hiệu kế hoạch
  plan_issue_date    date,        -- Ngày ban hành
  plan_content       text,        -- Nội dung kiểm tra
  plan_period        text,        -- Thời gian thực hiện
  checks_full_time   int not null default 0 check (checks_full_time >= 0),   -- Chuyên trách
  checks_part_time   int not null default 0 check (checks_part_time >= 0),   -- Bán chuyên trách
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Tổng số lượt kiểm tra luôn tính động (không lưu trùng dữ liệu)
create view v_part1_total_checks as
  select part1_id, report_id, checks_full_time, checks_part_time,
         (checks_full_time + checks_part_time) as checks_total
  from report_part1;

-- 6a. Tập thể / cá nhân vi phạm theo cấp
create table report_part1_violation_subjects (
  id                uuid primary key default gen_random_uuid(),
  part1_id          uuid not null references report_part1(part1_id) on delete cascade,
  violation_subject text not null check (violation_subject in ('TT','CN')),
  subject_level     text check (subject_level in ('cap_cuc','cap_phong','cap_doi_xa','can_bo')),
  quantity          int not null default 0 check (quantity >= 0),
  constraint chk_subject_level_required check (
    (violation_subject = 'TT' and subject_level is null) or
    (violation_subject = 'CN' and subject_level is not null)
  )
);
create unique index uq_violation_subject
  on report_part1_violation_subjects (part1_id, violation_subject, coalesce(subject_level,''));

-- 6b. Lỗi vi phạm (nhiều dòng, không giới hạn)
create table report_part1_errors (
  id                uuid primary key default gen_random_uuid(),
  part1_id          uuid not null references report_part1(part1_id) on delete cascade,
  error_name        text not null check (char_length(trim(error_name)) > 0),
  error_content     text,
  quantity          int not null default 0 check (quantity >= 0),
  violation_subject text check (violation_subject in ('TT','CN')),
  subject_level     text check (subject_level in ('cap_cuc','cap_phong','cap_doi_xa','can_bo')),
  note              text,
  created_at        timestamptz not null default now()
);
create index idx_p1_errors_part1 on report_part1_errors(part1_id);

-- 6c. Hình thức vi phạm (Phê bình / Hạ bậc danh hiệu / Hạ bậc xếp loại / Kỷ luật)
create table report_part1_penalties (
  id                uuid primary key default gen_random_uuid(),
  part1_id          uuid not null references report_part1(part1_id) on delete cascade,
  penalty_type      text not null check (penalty_type in (
    'phe_binh',
    'ha_1_bac_danh_hieu_nam',
    'ha_2_bac_danh_hieu_nam',
    'ha_1_bac_xep_loai_nam',
    'ha_2_bac_xep_loai_nam',
    'hinh_thuc_ky_luat'
  )),
  violation_subject text check (violation_subject in ('TT','CN')), -- null khi penalty_type = hinh_thuc_ky_luat
  quantity          int not null default 0 check (quantity >= 0),
  constraint chk_penalty_subject check (
    (penalty_type = 'hinh_thuc_ky_luat' and violation_subject is null) or
    (penalty_type <> 'hinh_thuc_ky_luat' and violation_subject is not null)
  )
);
create unique index uq_penalty
  on report_part1_penalties (part1_id, penalty_type, coalesce(violation_subject,''));

-- 6d. Chi tiết người/tập thể vi phạm (tùy chọn — chỉ bắt buộc khi có vi phạm)
create table report_part1_detail (
  id                 uuid primary key default gen_random_uuid(),
  part1_id           uuid not null references report_part1(part1_id) on delete cascade,
  subject_type       text not null check (subject_type in ('TT','CN')),
  full_name          text not null check (char_length(trim(full_name)) > 0),
  level              text,
  position            text,
  unit_name          text,
  violation_content  text,
  handling_form      text,
  note               text,
  created_at         timestamptz not null default now()
);
create index idx_p1_detail_part1 on report_part1_detail(part1_id);

-- ============================================================================
-- 7. REPORT_PART2 — II. Kết quả công tác nêu gương của lãnh đạo, chỉ huy (04 chỉ tiêu)
-- ============================================================================
create table report_part2 (
  part2_id              uuid primary key default gen_random_uuid(),
  report_id             uuid not null unique references reports(report_id) on delete cascade,
  leader_violation_count int not null default 0 check (leader_violation_count >= 0), -- 1. Vi phạm điều lệnh của LĐCH
  leader_check_count     int not null default 0 check (leader_check_count >= 0),     -- 2. Kiểm tra chấp hành điều lệnh của LĐCH
  meeting_count          int not null default 0 check (meeting_count >= 0),           -- 3. Số cuộc giao ban
  document_count         int not null default 0 check (document_count >= 0),          -- 4. Số văn bản
  note                   text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ============================================================================
-- 8. AUDIT LOGS
-- ============================================================================
create table audit_logs (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid references reports(report_id) on delete set null,
  action      text not null check (action in ('CREATE','UPDATE','DELETE','LOGIN','LOGOUT','EXPORT','CHANGE_SETTING')),
  old_data    jsonb,
  new_data    jsonb,
  admin_id    uuid,
  admin_email text,
  ip_address  text,
  created_at  timestamptz not null default now()
);
create index idx_audit_created_at on audit_logs(created_at);
create index idx_audit_report on audit_logs(report_id);
create index idx_audit_action on audit_logs(action);

-- ============================================================================
-- 8b. HÀM HASH MẬT KHẨU ADMIN
-- Dùng SHA-256 + salt cố định (không cần bcrypt) — đủ dùng cho 1 mật khẩu
-- dùng chung, được đổi định kỳ, không lưu ai đăng nhập bằng mật khẩu đó.
-- Hàm này CHỈ được gọi từ Netlify Function (service_role), không lộ ra frontend.
-- ============================================================================
create extension if not exists pgcrypto;
create or replace function hash_admin_password(p_password text) returns text as $$
  select encode(digest(p_password || 'htbc-x03-salt-2026', 'sha256'), 'hex');
$$ language sql immutable;

-- ============================================================================
-- 9. TRIGGERS: auto updated_at
-- ============================================================================
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_reports_updated before update on reports
  for each row execute function set_updated_at();
create trigger trg_part1_updated before update on report_part1
  for each row execute function set_updated_at();
create trigger trg_part2_updated before update on report_part2
  for each row execute function set_updated_at();
create trigger trg_units_updated before update on units
  for each row execute function set_updated_at();
create trigger trg_provinces_updated before update on provinces
  for each row execute function set_updated_at();

-- ============================================================================
-- 10. TRIGGER: sinh report_code tự động (BC-{unit_code}-W{week}-{year})
-- ============================================================================
create or replace function gen_report_code() returns trigger as $$
declare
  v_unit_code text;
begin
  if new.report_code is null or new.report_code = '' then
    select unit_code into v_unit_code from units where unit_id = new.unit_id;
    new.report_code := 'BC-' || coalesce(v_unit_code,'XX') || '-W' ||
                        lpad(new.reporting_week::text,2,'0') || '-' || new.reporting_year;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_reports_code before insert on reports
  for each row execute function gen_report_code();

-- ============================================================================
-- 11. TRIGGER: audit log tự động cho bảng reports
-- ============================================================================
create or replace function audit_reports() returns trigger as $$
begin
  -- Hệ thống không có tài khoản đăng nhập cho đơn vị nên hành động CREATE/UPDATE
  -- ở đây chủ yếu là do đơn vị tự nộp báo cáo (không có danh tính người dùng).
  -- Hành động DELETE chỉ có thể xảy ra qua Netlify Function admin-action (service_role),
  -- nơi admin_email được ghi bổ sung thủ công ngay sau khi gọi delete (xem admin-action.js).
  if (tg_op = 'INSERT') then
    insert into audit_logs(report_id, action, new_data)
      values (new.report_id, 'CREATE', to_jsonb(new));
    return new;
  elsif (tg_op = 'UPDATE') then
    insert into audit_logs(report_id, action, old_data, new_data)
      values (new.report_id, 'UPDATE', to_jsonb(old), to_jsonb(new));
    return new;
  elsif (tg_op = 'DELETE') then
    insert into audit_logs(report_id, action, old_data)
      values (old.report_id, 'DELETE', to_jsonb(old));
    return old;
  end if;
  return null;
end;
$$ language plpgsql security definer;

create trigger trg_audit_reports
  after insert or update or delete on reports
  for each row execute function audit_reports();
