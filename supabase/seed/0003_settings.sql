-- Seed: cấu hình hệ thống mặc định (đơn vị chủ quản X03)
-- Bảng system_settings chỉ có đúng 1 dòng (ràng buộc one_settings_row)
-- Mật khẩu Admin mặc định: admin123 (đổi ngay sau khi deploy, tại tab "Cấu hình hệ thống")
insert into system_settings (
  system_name, system_short_name, program_number, program_date, program_title,
  owner_unit_code, owner_unit_name, owner_organization,
  current_reporting_year, current_reporting_week, admin_password_hash
) values (
  'CHƯƠNG TRÌNH HÀNH ĐỘNG SỐ 10/CTR-BCA-X03',
  'HTBC-X03',
  '10/CTR-BCA-X03',
  '2026-05-12',
  'TĂNG CƯỜNG SIẾT CHẶT KỶ LUẬT, KỶ CƯƠNG, NÂNG CAO Ý THỨC CHẤP HÀNH ĐIỀU LỆNH CÔNG AN NHÂN DÂN',
  'X03',
  'CỤC CÔNG TÁC CHÍNH TRỊ',
  'BỘ CÔNG AN',
  extract(isoyear from now())::int,
  extract(week from now())::int,
  hash_admin_password('admin123')
);
