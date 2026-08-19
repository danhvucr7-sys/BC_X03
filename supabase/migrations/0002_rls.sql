-- ============================================================================
-- HTBC-X03 — Migration 0002: Row Level Security (BẢN ĐƠN GIẢN HOÁ)
--
-- THEO YÊU CẦU MỚI NHẤT: bỏ hoàn toàn mật khẩu Admin và Netlify Function.
-- Mọi thao tác (đơn vị nộp báo cáo, Admin xem/sửa/xóa/cấu hình) đều đi thẳng
-- bằng anon key, không qua lớp xác thực nào.
--
-- ⚠️ ĐÁNH ĐỔI BẢO MẬT: ai có đường link cũng có TOÀN QUYỀN như Admin
-- (xem toàn bộ báo cáo, xóa báo cáo, đổi cấu hình, bật/tắt đơn vị...).
-- Đây là lựa chọn được yêu cầu để đơn giản hoá triển khai — nếu sau này
-- cần bảo mật lại, có thể khôi phục cơ chế mật khẩu bằng cách thêm lại
-- Netlify Functions (đã có sẵn code mẫu ở các phiên bản trước).
-- ============================================================================

alter table system_settings enable row level security;
alter table provinces enable row level security;
alter table units enable row level security;
alter table reports enable row level security;
alter table report_part1 enable row level security;
alter table report_part1_violation_subjects enable row level security;
alter table report_part1_errors enable row level security;
alter table report_part1_penalties enable row level security;
alter table report_part1_detail enable row level security;
alter table report_part2 enable row level security;
alter table audit_logs enable row level security;

-- system_settings: đọc và sửa tự do
create policy p_settings_select on system_settings for select using (true);
create policy p_settings_update on system_settings for update using (true);

-- provinces: đọc và sửa tự do (không xóa vật lý)
create policy p_provinces_select on provinces for select using (true);
create policy p_provinces_insert on provinces for insert with check (true);
create policy p_provinces_update on provinces for update using (true);

-- units: đọc và sửa tự do (không xóa vật lý)
create policy p_units_select on units for select using (true);
create policy p_units_insert on units for insert with check (true);
create policy p_units_update on units for update using (true);

-- reports: đầy đủ quyền (kể cả xóa, vì không còn Netlify Function riêng cho Admin)
create policy p_reports_all on reports for all using (true) with check (true);

-- report_part1 và các bảng con: đầy đủ quyền
create policy p_part1_all on report_part1 for all using (true) with check (true);
create policy p_p1_subjects_all on report_part1_violation_subjects for all using (true) with check (true);
create policy p_p1_errors_all on report_part1_errors for all using (true) with check (true);
create policy p_p1_penalties_all on report_part1_penalties for all using (true) with check (true);
create policy p_p1_detail_all on report_part1_detail for all using (true) with check (true);
create policy p_part2_all on report_part2 for all using (true) with check (true);

-- audit_logs: đọc tự do (ghi vẫn qua trigger security definer ở migration 0001)
create policy p_audit_select on audit_logs for select using (true);
create policy p_audit_insert on audit_logs for insert with check (true);
