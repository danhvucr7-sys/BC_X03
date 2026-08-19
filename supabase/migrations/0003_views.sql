-- ============================================================================
-- HTBC-X03 — Migration 0003: Views tổng hợp
-- Toàn bộ số liệu Admin nhìn thấy đều tính trực tiếp từ đây, không hard-code.
-- Views kế thừa RLS của bảng gốc (security_invoker) nên Admin mới thấy toàn bộ.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- get_public_settings(): trả về các trường cấu hình KHÔNG nhạy cảm để hiển thị
-- tiêu đề chương trình ở cả 2 trang, mà không lộ admin_password_hash.
-- security definer để bỏ qua RLS (bảng gốc system_settings chặn anon hoàn toàn).
-- ----------------------------------------------------------------------------
create or replace function get_public_settings()
returns table (
  system_name text, system_short_name text, program_number text, program_date date,
  program_title text, owner_unit_code text, owner_unit_name text, owner_organization text,
  submission_deadline_dow int, submission_deadline_time time, system_status text
)
language sql stable security definer as $$
  select system_name, system_short_name, program_number, program_date,
         program_title, owner_unit_code, owner_unit_name, owner_organization,
         submission_deadline_dow, submission_deadline_time, system_status
  from system_settings limit 1;
$$;
grant execute on function get_public_settings() to anon, authenticated;

-- ----------------------------------------------------------------------------
-- v_report_full: 1 dòng / báo cáo, đã gộp toàn bộ số liệu Phần 1 + Phần 2
-- ----------------------------------------------------------------------------
create view v_report_full
with (security_invoker = true) as
select
  r.report_id, r.report_code, r.reporting_year, r.reporting_week,
  r.week_start_date, r.week_end_date, r.status, r.submitted_at,
  r.reporter_name, r.reporter_phone,
  u.unit_id, u.unit_code, u.unit_name, u.unit_type,
  pr.province_id, pr.province_code, pr.province_name,
  p1.checks_full_time, p1.checks_part_time,
  (coalesce(p1.checks_full_time,0) + coalesce(p1.checks_part_time,0)) as checks_total,
  coalesce(vs_tt.qty, 0) as violation_tt,
  coalesce(vs_cn.qty, 0) as violation_cn,
  coalesce(vs_cap_cuc.qty, 0) as violation_cap_cuc,
  coalesce(vs_cap_phong.qty, 0) as violation_cap_phong,
  coalesce(vs_cap_doi_xa.qty, 0) as violation_cap_doi_xa,
  coalesce(vs_can_bo.qty, 0) as violation_can_bo,
  coalesce(err.total_errors, 0) as total_errors,
  coalesce(pen.phe_binh_tt,0) as phe_binh_tt, coalesce(pen.phe_binh_cn,0) as phe_binh_cn,
  coalesce(pen.ha1_dh_tt,0) as ha1_danh_hieu_tt, coalesce(pen.ha1_dh_cn,0) as ha1_danh_hieu_cn,
  coalesce(pen.ha2_dh_tt,0) as ha2_danh_hieu_tt, coalesce(pen.ha2_dh_cn,0) as ha2_danh_hieu_cn,
  coalesce(pen.ha1_xl_tt,0) as ha1_xeploai_tt, coalesce(pen.ha1_xl_cn,0) as ha1_xeploai_cn,
  coalesce(pen.ha2_xl_tt,0) as ha2_xeploai_tt, coalesce(pen.ha2_xl_cn,0) as ha2_xeploai_cn,
  coalesce(pen.ky_luat,0) as hinh_thuc_ky_luat,
  p2.leader_violation_count, p2.leader_check_count, p2.meeting_count, p2.document_count
from reports r
join units u on u.unit_id = r.unit_id
left join provinces pr on pr.province_id = r.province_id
left join report_part1 p1 on p1.report_id = r.report_id
left join report_part2 p2 on p2.report_id = r.report_id
left join (
  select part1_id, sum(quantity) qty from report_part1_violation_subjects
  where violation_subject = 'TT' group by part1_id
) vs_tt on vs_tt.part1_id = p1.part1_id
left join (
  select part1_id, sum(quantity) qty from report_part1_violation_subjects
  where violation_subject = 'CN' group by part1_id
) vs_cn on vs_cn.part1_id = p1.part1_id
left join (
  select part1_id, sum(quantity) qty from report_part1_violation_subjects
  where subject_level = 'cap_cuc' group by part1_id
) vs_cap_cuc on vs_cap_cuc.part1_id = p1.part1_id
left join (
  select part1_id, sum(quantity) qty from report_part1_violation_subjects
  where subject_level = 'cap_phong' group by part1_id
) vs_cap_phong on vs_cap_phong.part1_id = p1.part1_id
left join (
  select part1_id, sum(quantity) qty from report_part1_violation_subjects
  where subject_level = 'cap_doi_xa' group by part1_id
) vs_cap_doi_xa on vs_cap_doi_xa.part1_id = p1.part1_id
left join (
  select part1_id, sum(quantity) qty from report_part1_violation_subjects
  where subject_level = 'can_bo' group by part1_id
) vs_can_bo on vs_can_bo.part1_id = p1.part1_id
left join (
  select part1_id, sum(quantity) total_errors from report_part1_errors group by part1_id
) err on err.part1_id = p1.part1_id
left join (
  select part1_id,
    sum(quantity) filter (where penalty_type='phe_binh' and violation_subject='TT') phe_binh_tt,
    sum(quantity) filter (where penalty_type='phe_binh' and violation_subject='CN') phe_binh_cn,
    sum(quantity) filter (where penalty_type='ha_1_bac_danh_hieu_nam' and violation_subject='TT') ha1_dh_tt,
    sum(quantity) filter (where penalty_type='ha_1_bac_danh_hieu_nam' and violation_subject='CN') ha1_dh_cn,
    sum(quantity) filter (where penalty_type='ha_2_bac_danh_hieu_nam' and violation_subject='TT') ha2_dh_tt,
    sum(quantity) filter (where penalty_type='ha_2_bac_danh_hieu_nam' and violation_subject='CN') ha2_dh_cn,
    sum(quantity) filter (where penalty_type='ha_1_bac_xep_loai_nam' and violation_subject='TT') ha1_xl_tt,
    sum(quantity) filter (where penalty_type='ha_1_bac_xep_loai_nam' and violation_subject='CN') ha1_xl_cn,
    sum(quantity) filter (where penalty_type='ha_2_bac_xep_loai_nam' and violation_subject='TT') ha2_xl_tt,
    sum(quantity) filter (where penalty_type='ha_2_bac_xep_loai_nam' and violation_subject='CN') ha2_xl_cn,
    sum(quantity) filter (where penalty_type='hinh_thuc_ky_luat') ky_luat
  from report_part1_penalties group by part1_id
) pen on pen.part1_id = p1.part1_id;

-- ----------------------------------------------------------------------------
-- v_units_missing: đơn vị chưa nộp cho 1 tuần/năm cụ thể
-- Dùng: select * from v_units_missing where reporting_week = 31 and reporting_year = 2026
-- (Truy vấn qua RPC function bên dưới vì view thường không nhận tham số)
-- ----------------------------------------------------------------------------
create or replace function get_units_missing(p_week int, p_year int)
returns table (unit_id uuid, unit_code text, unit_name text, unit_type text,
               province_id uuid, province_name text)
language sql stable security invoker as $$
  select u.unit_id, u.unit_code, u.unit_name, u.unit_type, u.province_id, pr.province_name
  from units u
  left join provinces pr on pr.province_id = u.province_id
  where u.active = true and u.is_owner = false
  and not exists (
    select 1 from reports r
    where r.unit_id = u.unit_id and r.reporting_week = p_week and r.reporting_year = p_year
  )
  order by u.unit_type, u.sort_order;
$$;

-- ----------------------------------------------------------------------------
-- v_summary_period: tổng hợp toàn quốc theo khoảng ngày tùy chọn
-- ----------------------------------------------------------------------------
create or replace function get_summary_period(p_from date, p_to date, p_province_id uuid default null, p_unit_id uuid default null)
returns table (
  total_reports bigint,
  checks_full_time bigint, checks_part_time bigint, checks_total bigint,
  violation_tt bigint, violation_cn bigint,
  violation_cap_cuc bigint, violation_cap_phong bigint, violation_cap_doi_xa bigint, violation_can_bo bigint,
  phe_binh_tt bigint, phe_binh_cn bigint,
  ha1_danh_hieu_tt bigint, ha1_danh_hieu_cn bigint,
  ha2_danh_hieu_tt bigint, ha2_danh_hieu_cn bigint,
  ha1_xeploai_tt bigint, ha1_xeploai_cn bigint,
  ha2_xeploai_tt bigint, ha2_xeploai_cn bigint,
  hinh_thuc_ky_luat bigint,
  leader_violation_count bigint, leader_check_count bigint,
  meeting_count bigint, document_count bigint
)
language sql stable security invoker as $$
  select
    count(*),
    sum(checks_full_time), sum(checks_part_time), sum(checks_total),
    sum(violation_tt), sum(violation_cn),
    sum(violation_cap_cuc), sum(violation_cap_phong), sum(violation_cap_doi_xa), sum(violation_can_bo),
    sum(phe_binh_tt), sum(phe_binh_cn),
    sum(ha1_danh_hieu_tt), sum(ha1_danh_hieu_cn),
    sum(ha2_danh_hieu_tt), sum(ha2_danh_hieu_cn),
    sum(ha1_xeploai_tt), sum(ha1_xeploai_cn),
    sum(ha2_xeploai_tt), sum(ha2_xeploai_cn),
    sum(hinh_thuc_ky_luat),
    sum(leader_violation_count), sum(leader_check_count),
    sum(meeting_count), sum(document_count)
  from v_report_full
  where week_start_date >= p_from and week_end_date <= p_to
  and (p_province_id is null or province_id = p_province_id)
  and (p_unit_id is null or unit_id = p_unit_id);
$$;

-- ----------------------------------------------------------------------------
-- v_summary_by_unit: tổng hợp theo từng đơn vị trong khoảng ngày (cho bảng xếp hạng / sheet Excel)
-- ----------------------------------------------------------------------------
create or replace function get_summary_by_unit(p_from date, p_to date)
returns table (
  unit_id uuid, unit_code text, unit_name text, unit_type text, province_name text,
  total_reports bigint, checks_total bigint,
  total_violation bigint, leader_violation_count bigint, leader_check_count bigint,
  meeting_count bigint, document_count bigint
)
language sql stable security invoker as $$
  select unit_id, unit_code, unit_name, unit_type, province_name,
    count(*),
    sum(checks_total),
    sum(violation_tt + violation_cn),
    sum(leader_violation_count), sum(leader_check_count),
    sum(meeting_count), sum(document_count)
  from v_report_full
  where week_start_date >= p_from and week_end_date <= p_to
  group by unit_id, unit_code, unit_name, unit_type, province_name
  order by unit_name;
$$;

grant execute on function get_units_missing(int, int) to anon, authenticated;
grant execute on function get_summary_period(date, date, uuid, uuid) to anon, authenticated;
grant execute on function get_summary_by_unit(date, date) to anon, authenticated;
grant select on v_report_full to anon, authenticated;
