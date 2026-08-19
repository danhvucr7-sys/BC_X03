import { supabase } from './supabaseClient.js';
import { getISOWeek, getReportingPeriod, toISODateString, sanitizeInt, escapeHtml, statusLabel } from './utils.js';

const $ = (id) => document.getElementById(id);
const overlay = $('loadingOverlay');
function showLoading(t) { overlay.querySelector('div').textContent = t || 'Đang xử lý...'; overlay.classList.add('show'); }
function hideLoading() { overlay.classList.remove('show'); }
function msg(el, text, type) { el.innerHTML = `<div class="msg-box msg-${type}">${escapeHtml(text)}</div>`; }

let unitsCache = [];
let provincesCache = [];

// ---------------------------------------------------------------------------
// TABS
// ---------------------------------------------------------------------------
function bindTabs() {
  document.querySelectorAll('#mainTabs button').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('#mainTabs button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
      btn.classList.add('active');
      $('tab-' + btn.dataset.tab).classList.remove('hidden');
      if (btn.dataset.tab === 'units') renderUnitsTable();
      if (btn.dataset.tab === 'provinces') renderProvincesTable();
      if (btn.dataset.tab === 'audit') loadAudit();
    };
  });
}

// ---------------------------------------------------------------------------
// SHARED
// ---------------------------------------------------------------------------
async function loadUnitsAndProvinces() {
  const { data: units } = await supabase.from('units').select('*').order('sort_order');
  unitsCache = units || [];
  const { data: provs } = await supabase.from('provinces').select('*').order('sort_order');
  provincesCache = provs || [];
}

// ---------------------------------------------------------------------------
// DASHBOARD
// ---------------------------------------------------------------------------
function setQuickFilter(kind) {
  const now = new Date();
  let from, to;
  if (kind === 'period') { const p = getReportingPeriod(now); from = p.start; to = p.end; }
  else if (kind === 'month') { from = new Date(now.getFullYear(), now.getMonth(), 1); to = new Date(now.getFullYear(), now.getMonth()+1, 0); }
  else if (kind === 'quarter') { const q = Math.floor(now.getMonth()/3); from = new Date(now.getFullYear(), q*3, 1); to = new Date(now.getFullYear(), q*3+3, 0); }
  else if (kind === 'half') { const h = now.getMonth() < 6 ? 0 : 6; from = new Date(now.getFullYear(), h, 1); to = new Date(now.getFullYear(), h+6, 0); }
  else if (kind === 'year') { from = new Date(now.getFullYear(), 0, 1); to = new Date(now.getFullYear(), 11, 31); }
  $('filterFrom').value = toISODateString(from);
  $('filterTo').value = toISODateString(to);
}

async function loadDashboard() {
  const from = $('filterFrom').value, to = $('filterTo').value;
  if (!from || !to) return;
  showLoading('Đang tổng hợp...');

  const { data: sum, error } = await supabase.rpc('get_summary_period', { p_from: from, p_to: to });
  const { data: units } = await supabase.from('units').select('unit_id').eq('active', true).eq('is_owner', false);
  const { data: reportsInRange } = await supabase.from('reports').select('unit_id').gte('week_start_date', from).lte('week_end_date', to);

  hideLoading();
  if (error) { console.error(error); return; }
  const s = (sum && sum[0]) || {};
  const totalUnits = (units || []).length;
  const submittedUnits = new Set((reportsInRange||[]).map(r => r.unit_id)).size;
  const rate = totalUnits ? Math.round((submittedUnits/totalUnits)*100) : 0;

  $('statGrid').innerHTML = [
    ['TỔNG SỐ ĐƠN VỊ', totalUnits], ['ĐÃ NỘP', submittedUnits], ['CHƯA NỘP', totalUnits - submittedUnits],
    ['TỶ LỆ HOÀN THÀNH', rate + '%'], ['TỔNG LƯỢT KIỂM TRA', s.checks_total || 0],
    ['TỔNG SỐ VI PHẠM', (Number(s.violation_tt||0) + Number(s.violation_cn||0))],
    ['VI PHẠM LÃNH ĐẠO, CHỈ HUY', s.leader_violation_count || 0], ['KIỂM TRA LÃNH ĐẠO, CHỈ HUY', s.leader_check_count || 0],
    ['SỐ CUỘC GIAO BAN', s.meeting_count || 0], ['SỐ VĂN BẢN', s.document_count || 0],
  ].map(([lbl,val]) => `<div class="stat-box gold"><div class="lbl">${lbl}</div><div class="val">${val}</div></div>`).join('');

  $('summaryPart1Table').innerHTML = `
    <thead><tr><th>Chỉ tiêu</th><th>Giá trị</th></tr></thead>
    <tbody>
      <tr><td>Số lượt kiểm tra - Chuyên trách</td><td>${s.checks_full_time||0}</td></tr>
      <tr><td>Số lượt kiểm tra - Bán chuyên trách</td><td>${s.checks_part_time||0}</td></tr>
      <tr><td>Tổng số lượt kiểm tra</td><td>${s.checks_total||0}</td></tr>
      <tr><td>Vi phạm - Tập thể (TT)</td><td>${s.violation_tt||0}</td></tr>
      <tr><td>Vi phạm - Cá nhân (CN)</td><td>${s.violation_cn||0}</td></tr>
      <tr><td>&nbsp;&nbsp;Cấp Cục</td><td>${s.violation_cap_cuc||0}</td></tr>
      <tr><td>&nbsp;&nbsp;Cấp phòng</td><td>${s.violation_cap_phong||0}</td></tr>
      <tr><td>&nbsp;&nbsp;Cấp đội/cấp xã</td><td>${s.violation_cap_doi_xa||0}</td></tr>
      <tr><td>&nbsp;&nbsp;Cán bộ</td><td>${s.violation_can_bo||0}</td></tr>
      <tr><td>Phê bình - TT / CN</td><td>${s.phe_binh_tt||0} / ${s.phe_binh_cn||0}</td></tr>
      <tr><td>Hạ 1 bậc danh hiệu TĐ năm - TT / CN</td><td>${s.ha1_danh_hieu_tt||0} / ${s.ha1_danh_hieu_cn||0}</td></tr>
      <tr><td>Hạ 2 bậc danh hiệu TĐ năm - TT / CN</td><td>${s.ha2_danh_hieu_tt||0} / ${s.ha2_danh_hieu_cn||0}</td></tr>
      <tr><td>Hạ 1 bậc xếp loại trong năm - TT / CN</td><td>${s.ha1_xeploai_tt||0} / ${s.ha1_xeploai_cn||0}</td></tr>
      <tr><td>Hạ 2 bậc xếp loại TĐ trong năm - TT / CN</td><td>${s.ha2_xeploai_tt||0} / ${s.ha2_xeploai_cn||0}</td></tr>
      <tr><td>Hình thức kỷ luật</td><td>${s.hinh_thuc_ky_luat||0}</td></tr>
    </tbody>`;

  $('summaryPart2Table').innerHTML = `
    <thead><tr><th>Chỉ tiêu</th><th>Giá trị</th></tr></thead>
    <tbody>
      <tr><td>1. Vi phạm Điều lệnh CAND của lãnh đạo, chỉ huy</td><td>${s.leader_violation_count||0}</td></tr>
      <tr><td>2. Kiểm tra chấp hành Điều lệnh CAND của lãnh đạo, chỉ huy</td><td>${s.leader_check_count||0}</td></tr>
      <tr><td>3. Số cuộc giao ban được tổ chức</td><td>${s.meeting_count||0}</td></tr>
      <tr><td>4. Số văn bản về công tác siết chặt kỷ luật, kỷ cương</td><td>${s.document_count||0}</td></tr>
    </tbody>`;
}

// ---------------------------------------------------------------------------
// TRACKING
// ---------------------------------------------------------------------------
async function loadTracking() {
  const week = parseInt($('trackWeek').value, 10);
  const year = parseInt($('trackYear').value, 10);
  if (!week || !year) return;
  showLoading('Đang tải...');

  const { data: missing } = await supabase.rpc('get_units_missing', { p_week: week, p_year: year });
  const { data: submitted } = await supabase.from('v_report_full').select('*').eq('reporting_week', week).eq('reporting_year', year);

  hideLoading();
  const total = (missing?.length || 0) + (submitted?.length || 0);
  $('trackStatGrid').innerHTML = [
    ['TỔNG SỐ ĐƠN VỊ', total], ['ĐÃ NỘP', submitted?.length || 0], ['CHƯA NỘP', missing?.length || 0],
  ].map(([lbl,val]) => `<div class="stat-box"><div class="lbl">${lbl}</div><div class="val">${val}</div></div>`).join('');

  $('missingTable').innerHTML = `
    <thead><tr><th>STT</th><th>Loại</th><th>Tỉnh/thành</th><th>Mã đơn vị</th><th>Tên đơn vị</th></tr></thead>
    <tbody>${(missing||[]).map((u,i) => `<tr>
      <td>${i+1}</td><td>${u.unit_type==='cuc'?'Cục':'CA tỉnh'}</td>
      <td>${escapeHtml(u.province_name||'')}</td><td>${escapeHtml(u.unit_code)}</td><td style="text-align:left">${escapeHtml(u.unit_name)}</td>
    </tr>`).join('') || '<tr><td colspan="5">Không có đơn vị nào chưa nộp 🎉</td></tr>'}</tbody>`;

  $('submittedTable').innerHTML = `
    <thead><tr><th>STT</th><th>Tỉnh/thành</th><th>Mã ĐV</th><th>Tên đơn vị</th><th>Trạng thái</th><th>Người báo cáo</th><th>Lượt KT</th><th>Vi phạm</th><th>VP LĐ</th></tr></thead>
    <tbody>${(submitted||[]).map((r,i) => `<tr>
      <td>${i+1}</td><td>${escapeHtml(r.province_name||'')}</td><td>${escapeHtml(r.unit_code)}</td>
      <td style="text-align:left">${escapeHtml(r.unit_name)}</td><td>${statusLabel(r.status)}</td>
      <td>${escapeHtml(r.reporter_name)}</td><td>${r.checks_total||0}</td>
      <td>${(r.violation_tt||0)+(r.violation_cn||0)}</td><td>${r.leader_violation_count||0}</td>
    </tr>`).join('') || '<tr><td colspan="9">Chưa có đơn vị nào nộp</td></tr>'}</tbody>`;
}

// ---------------------------------------------------------------------------
// REPORTS: tìm kiếm / xóa (gọi thẳng Supabase, không qua Function)
// ---------------------------------------------------------------------------
async function searchReports() {
  const week = parseInt($('repSearchWeek').value, 10) || null;
  const year = parseInt($('repSearchYear').value, 10) || null;
  let q = supabase.from('v_report_full').select('*').order('unit_name');
  if (week) q = q.eq('reporting_week', week);
  if (year) q = q.eq('reporting_year', year);
  const { data, error } = await q;
  if (error) { console.error(error); return; }
  $('reportsTable').innerHTML = `
    <thead><tr><th>Mã BC</th><th>Đơn vị</th><th>Tuần/Năm</th><th>Trạng thái</th><th>Lượt KT</th><th>Vi phạm</th><th>Thao tác</th></tr></thead>
    <tbody>${(data||[]).map(r => `<tr>
      <td>${escapeHtml(r.report_code)}</td><td style="text-align:left">${escapeHtml(r.unit_name)}</td>
      <td>${r.reporting_week}/${r.reporting_year}</td><td>${statusLabel(r.status)}</td>
      <td>${r.checks_total||0}</td><td>${(r.violation_tt||0)+(r.violation_cn||0)}</td>
      <td><button class="btn btn-sm btn-danger" data-del="${r.report_id}">Xóa</button></td>
    </tr>`).join('') || '<tr><td colspan="7">Không tìm thấy</td></tr>'}</tbody>`;
  document.querySelectorAll('[data-del]').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Xóa báo cáo này? Hành động này sẽ được ghi vào audit log.')) return;
      const { error } = await supabase.from('reports').delete().eq('report_id', btn.dataset.del);
      if (error) { alert('Lỗi: ' + error.message); return; }
      searchReports();
    };
  });
}

// ---------------------------------------------------------------------------
// UNITS
// ---------------------------------------------------------------------------
function renderUnitsTable() {
  $('unitsCount').textContent = unitsCache.length;
  $('unitsTable').innerHTML = `
    <thead><tr><th>STT</th><th>Mã</th><th>Tên đơn vị</th><th>Loại</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
    <tbody>${unitsCache.map((u,i) => `<tr>
      <td>${i+1}</td><td>${escapeHtml(u.unit_code)}</td><td style="text-align:left">${escapeHtml(u.unit_name)}${u.is_owner?' <strong>(Chủ quản)</strong>':''}</td>
      <td>${u.unit_type}</td><td>${u.active ? '🟢 Hoạt động' : '⚪ Vô hiệu hoá'}</td>
      <td><button class="btn btn-sm btn-secondary" data-toggle="${u.unit_id}">${u.active?'Vô hiệu hoá':'Kích hoạt'}</button></td>
    </tr>`).join('')}</tbody>`;
  document.querySelectorAll('#unitsTable [data-toggle]').forEach(btn => {
    btn.onclick = async () => {
      const u = unitsCache.find(x => x.unit_id === btn.dataset.toggle);
      const { error } = await supabase.from('units').update({ active: !u.active }).eq('unit_id', u.unit_id);
      if (error) { alert('Lỗi: ' + error.message); return; }
      await loadUnitsAndProvinces(); renderUnitsTable();
    };
  });
}

async function addUnit() {
  const code = $('newUnitCode').value.trim();
  const name = $('newUnitName').value.trim();
  if (!code || !name) { alert('Nhập đủ mã và tên đơn vị.'); return; }
  const { error } = await supabase.from('units').insert({ unit_code: code, unit_name: name, unit_type: 'khac', sort_order: unitsCache.length + 1 });
  if (error) { alert('Lỗi: ' + error.message); return; }
  $('newUnitCode').value = ''; $('newUnitName').value = '';
  await loadUnitsAndProvinces(); renderUnitsTable();
}

// ---------------------------------------------------------------------------
// PROVINCES
// ---------------------------------------------------------------------------
function renderProvincesTable() {
  $('provincesTable').innerHTML = `
    <thead><tr><th>STT</th><th>Mã</th><th>Tên</th><th>Loại</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
    <tbody>${provincesCache.map((p,i) => `<tr>
      <td>${i+1}</td><td>${escapeHtml(p.province_code)}</td><td style="text-align:left">${escapeHtml(p.province_name)}</td>
      <td>${p.province_type==='thanh_pho_tw'?'Thành phố TW':'Tỉnh'}</td>
      <td>${p.active ? '🟢 Hoạt động' : '⚪ Vô hiệu hoá'}</td>
      <td><button class="btn btn-sm btn-secondary" data-toggle="${p.province_id}">${p.active?'Vô hiệu hoá':'Kích hoạt'}</button></td>
    </tr>`).join('')}</tbody>`;
  document.querySelectorAll('#provincesTable [data-toggle]').forEach(btn => {
    btn.onclick = async () => {
      const p = provincesCache.find(x => x.province_id === btn.dataset.toggle);
      const { error } = await supabase.from('provinces').update({ active: !p.active }).eq('province_id', p.province_id);
      if (error) { alert('Lỗi: ' + error.message); return; }
      await loadUnitsAndProvinces(); renderProvincesTable();
    };
  });
}

// ---------------------------------------------------------------------------
// SETTINGS
// ---------------------------------------------------------------------------
async function loadSettingsForm() {
  const { data: s } = await supabase.from('system_settings').select('*').limit(1).single();
  if (!s) return;
  $('cfgSystemName').value = s.system_name;
  $('cfgProgramNumber').value = s.program_number;
  $('cfgProgramDate').value = s.program_date;
  $('cfgProgramTitle').value = s.program_title;
  $('cfgOwnerCode').value = s.owner_unit_code;
  $('cfgOwnerName').value = s.owner_unit_name;
  $('cfgStatus').value = s.system_status;
}

async function saveSettings() {
  const { data: existing } = await supabase.from('system_settings').select('id').limit(1).single();
  const payload = {
    system_name: $('cfgSystemName').value.trim(),
    program_number: $('cfgProgramNumber').value.trim(),
    program_date: $('cfgProgramDate').value,
    program_title: $('cfgProgramTitle').value.trim(),
    owner_unit_code: $('cfgOwnerCode').value.trim(),
    owner_unit_name: $('cfgOwnerName').value.trim(),
    system_status: $('cfgStatus').value,
  };
  const { error } = await supabase.from('system_settings').update(payload).eq('id', existing.id);
  if (error) { msg($('settingsMsg'), 'Lỗi: ' + error.message, 'error'); return; }
  await supabase.from('audit_logs').insert({ action: 'CHANGE_SETTING', new_data: payload });
  msg($('settingsMsg'), 'Đã lưu cấu hình.', 'success');
}

// ---------------------------------------------------------------------------
// AUDIT LOG
// ---------------------------------------------------------------------------
async function loadAudit() {
  const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(300);
  if (error) { console.error(error); return; }
  $('auditTable').innerHTML = `
    <thead><tr><th>Thời gian</th><th>Hành động</th><th>Report ID</th></tr></thead>
    <tbody>${(data||[]).map(a => `<tr>
      <td>${new Date(a.created_at).toLocaleString('vi-VN')}</td><td>${a.action}</td>
      <td style="font-size:0.7rem">${a.report_id||''}</td>
    </tr>`).join('')}</tbody>`;
}

// ---------------------------------------------------------------------------
// EXCEL EXPORT
// ---------------------------------------------------------------------------
async function exportExcel() {
  const from = $('filterFrom').value, to = $('filterTo').value;
  showLoading('Đang xuất Excel...');
  try {
    const { data: sum } = await supabase.rpc('get_summary_period', { p_from: from, p_to: to });
    const { data: full } = await supabase.from('v_report_full').select('*').gte('week_start_date', from).lte('week_end_date', to);
    const iso = getISOWeek(new Date(to));
    const { data: missing } = await supabase.rpc('get_units_missing', { p_week: iso.week, p_year: iso.year });

    const wb = XLSX.utils.book_new();
    const s = (sum && sum[0]) || {};
    const wsSummary = XLSX.utils.json_to_sheet([{
      'Từ ngày': from, 'Đến ngày': to, 'Tổng số báo cáo': s.total_reports||0,
      'Lượt KT chuyên trách': s.checks_full_time||0, 'Lượt KT bán chuyên trách': s.checks_part_time||0, 'Tổng lượt KT': s.checks_total||0,
      'Vi phạm TT': s.violation_tt||0, 'Vi phạm CN': s.violation_cn||0,
      'VP Cấp Cục': s.violation_cap_cuc||0, 'VP Cấp phòng': s.violation_cap_phong||0,
      'VP Cấp đội/xã': s.violation_cap_doi_xa||0, 'VP Cán bộ': s.violation_can_bo||0,
      'Phê bình TT': s.phe_binh_tt||0, 'Phê bình CN': s.phe_binh_cn||0,
      'Hạ 1 bậc DH TT': s.ha1_danh_hieu_tt||0, 'Hạ 1 bậc DH CN': s.ha1_danh_hieu_cn||0,
      'Hạ 2 bậc DH TT': s.ha2_danh_hieu_tt||0, 'Hạ 2 bậc DH CN': s.ha2_danh_hieu_cn||0,
      'Hạ 1 bậc XL TT': s.ha1_xeploai_tt||0, 'Hạ 1 bậc XL CN': s.ha1_xeploai_cn||0,
      'Hạ 2 bậc XL TT': s.ha2_xeploai_tt||0, 'Hạ 2 bậc XL CN': s.ha2_xeploai_cn||0,
      'Hình thức kỷ luật': s.hinh_thuc_ky_luat||0,
      'VP lãnh đạo': s.leader_violation_count||0, 'KT lãnh đạo': s.leader_check_count||0,
      'Số giao ban': s.meeting_count||0, 'Số văn bản': s.document_count||0,
    }]);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'TỔNG HỢP');

    const wsDetail = XLSX.utils.json_to_sheet((full||[]).map(r => ({
      'Mã BC': r.report_code, 'Đơn vị': r.unit_name, 'Mã ĐV': r.unit_code, 'Tỉnh/thành': r.province_name,
      'Tuần': r.reporting_week, 'Năm': r.reporting_year, 'Trạng thái': r.status,
      'Người báo cáo': r.reporter_name, 'SĐT': r.reporter_phone,
      'Lượt KT chuyên trách': r.checks_full_time, 'Lượt KT bán CT': r.checks_part_time, 'Tổng lượt KT': r.checks_total,
      'VP TT': r.violation_tt, 'VP CN': r.violation_cn,
      'VP lãnh đạo': r.leader_violation_count, 'KT lãnh đạo': r.leader_check_count,
      'Giao ban': r.meeting_count, 'Văn bản': r.document_count,
    })));
    XLSX.utils.book_append_sheet(wb, wsDetail, 'CHI TIẾT ĐƠN VỊ');

    const wsMissing = XLSX.utils.json_to_sheet((missing||[]).map(u => ({
      'Mã đơn vị': u.unit_code, 'Tên đơn vị': u.unit_name, 'Loại': u.unit_type, 'Tỉnh/thành': u.province_name || ''
    })));
    XLSX.utils.book_append_sheet(wb, wsMissing, 'ĐƠN VỊ CHƯA NỘP');

    const wsPart1 = XLSX.utils.json_to_sheet((full||[]).map(r => ({
      'Đơn vị': r.unit_name, 'Tuần/Năm': `${r.reporting_week}/${r.reporting_year}`,
      'Chuyên trách': r.checks_full_time, 'Bán chuyên trách': r.checks_part_time,
      'TT': r.violation_tt, 'CN': r.violation_cn,
      'Cấp Cục': r.violation_cap_cuc, 'Cấp phòng': r.violation_cap_phong,
      'Cấp đội/xã': r.violation_cap_doi_xa, 'Cán bộ': r.violation_can_bo,
      'Phê bình TT': r.phe_binh_tt, 'Phê bình CN': r.phe_binh_cn,
      'Hạ 1 DH TT': r.ha1_danh_hieu_tt, 'Hạ 1 DH CN': r.ha1_danh_hieu_cn,
      'Hạ 2 DH TT': r.ha2_danh_hieu_tt, 'Hạ 2 DH CN': r.ha2_danh_hieu_cn,
      'Hạ 1 XL TT': r.ha1_xeploai_tt, 'Hạ 1 XL CN': r.ha1_xeploai_cn,
      'Hạ 2 XL TT': r.ha2_xeploai_tt, 'Hạ 2 XL CN': r.ha2_xeploai_cn,
      'Kỷ luật': r.hinh_thuc_ky_luat,
    })));
    XLSX.utils.book_append_sheet(wb, wsPart1, 'PHẦN 1 - ĐIỀU LỆNH');

    const wsPart2 = XLSX.utils.json_to_sheet((full||[]).map(r => ({
      'Đơn vị': r.unit_name, 'Tuần/Năm': `${r.reporting_week}/${r.reporting_year}`,
      'VP lãnh đạo': r.leader_violation_count, 'KT lãnh đạo': r.leader_check_count,
      'Giao ban': r.meeting_count, 'Văn bản': r.document_count,
    })));
    XLSX.utils.book_append_sheet(wb, wsPart2, 'PHẦN 2 - NÊU GƯƠNG');

    XLSX.writeFile(wb, `Bao_cao_HTBC_X03_${from}_${to}.xlsx`);
    hideLoading();
  } catch (e) {
    hideLoading();
    alert('Lỗi xuất Excel: ' + e.message);
  }
}

// ---------------------------------------------------------------------------
// BIND
// ---------------------------------------------------------------------------
function bindEvents() {
  bindTabs();
  document.querySelectorAll('[data-quick]').forEach(btn => {
    btn.addEventListener('click', () => { setQuickFilter(btn.dataset.quick); loadDashboard(); });
  });
  $('applyFilterBtn').onclick = loadDashboard;
  $('exportExcelBtn').onclick = exportExcel;
  $('trackLoadBtn').onclick = loadTracking;
  $('repSearchBtn').onclick = searchReports;
  $('addUnitBtn').onclick = addUnit;
  $('saveSettingsBtn').onclick = saveSettings;

  const iso = getISOWeek(new Date());
  $('trackWeek').value = iso.week; $('trackYear').value = iso.year;
}

(async function init() {
  bindEvents();
  await loadUnitsAndProvinces();
  setQuickFilter('period');
  await loadDashboard();
  await loadSettingsForm();
})();
