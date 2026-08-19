import { supabase } from './supabaseClient.js';
import { getReportingPeriod, formatDate, toISODateString, sanitizeInt, escapeHtml, statusLabel, uuid, getISOWeek } from './utils.js';

const $ = (id) => document.getElementById(id);
const overlay = $('loadingOverlay');
function showLoading(t) { overlay.querySelector('div').textContent = t || 'Đang xử lý...'; overlay.classList.add('show'); }
function hideLoading() { overlay.classList.remove('show'); }
function msg(el, text, type) { el.innerHTML = `<div class="msg-box msg-${type}">${escapeHtml(text)}</div>`; }

let allUnits = [];
let currentUnit = null;
let currentPeriod = null; // {start, end, week, year}
let existingReportId = null;
let existingPart1Id = null;

const PENALTY_LABELS = [
  ['phe_binh', 'Phê bình'],
  ['ha_1_bac_danh_hieu_nam', 'Hạ một bậc danh hiệu thi đua năm'],
  ['ha_2_bac_danh_hieu_nam', 'Hạ hai bậc danh hiệu thi đua năm'],
  ['ha_1_bac_xep_loai_nam', 'Hạ một bậc xếp loại trong năm'],
  ['ha_2_bac_xep_loai_nam', 'Hạ hai bậc xếp loại thi đua trong năm'],
];

function renderPenaltyTable() {
  const body = $('penaltyTableBody');
  body.innerHTML = PENALTY_LABELS.map(([key, label]) => `
    <tr>
      <td style="text-align:left">${escapeHtml(label)}</td>
      <td><input type="number" min="0" value="0" id="pen_${key}_TT"></td>
      <td><input type="number" min="0" value="0" id="pen_${key}_CN"></td>
    </tr>`).join('');
}

// ---------------------------------------------------------------------------
// CHỌN ĐƠN VỊ (không đăng nhập — chọn từ danh sách)
// ---------------------------------------------------------------------------
async function loadUnitList() {
  const { data, error } = await supabase.from('units')
    .select('*, provinces(province_name)')
    .eq('active', true).eq('is_owner', false)
    .order('unit_type').order('sort_order');
  if (error) { msg($('unitSelectMsg'), 'Lỗi tải danh sách đơn vị: ' + error.message, 'error'); return; }
  allUnits = data || [];
  renderUnitOptions(allUnits);
}

function renderUnitOptions(list) {
  const sel = $('unitSelect');
  sel.innerHTML = list.map(u => {
    const label = u.unit_type === 'congan_tinh'
      ? `${u.unit_name} (${u.unit_code})`
      : `${u.unit_name} (${u.unit_code})`;
    return `<option value="${u.unit_id}">${escapeHtml(label)}</option>`;
  }).join('');
}

function bindUnitSearch() {
  $('unitSearch').addEventListener('input', () => {
    const q = $('unitSearch').value.trim().toLowerCase();
    const filtered = !q ? allUnits : allUnits.filter(u =>
      u.unit_name.toLowerCase().includes(q) || u.unit_code.toLowerCase().includes(q));
    renderUnitOptions(filtered);
  });
}

async function confirmUnit() {
  const unitId = $('unitSelect').value;
  if (!unitId) { msg($('unitSelectMsg'), 'Vui lòng chọn 1 đơn vị trong danh sách.', 'error'); return; }
  currentUnit = allUnits.find(u => u.unit_id === unitId);
  $('unitSelectBox').classList.add('hidden');
  $('appBox').classList.remove('hidden');
  $('unitNameLabel').textContent = `${currentUnit.unit_name} (${currentUnit.unit_code})`;
  setupPeriod();
  await loadExistingReport();
}

// ---------------------------------------------------------------------------
// CHU KỲ BÁO CÁO: Thứ 5 tuần này → Thứ 5 tuần sau
// ---------------------------------------------------------------------------
function setupPeriod() {
  currentPeriod = getReportingPeriod(new Date());
  $('repFrom').value = formatDate(currentPeriod.start);
  $('repTo').value = formatDate(currentPeriod.end);
  $('weekLabel').textContent = `TUẦN ${String(currentPeriod.week).padStart(2,'0')}/${currentPeriod.year} — Từ ${formatDate(currentPeriod.start)} (Thứ 5) đến ${formatDate(currentPeriod.end)} (Thứ 5 tuần sau)`;
}

// ---------------------------------------------------------------------------
// DYNAMIC ROWS: lỗi vi phạm / chi tiết vi phạm
// ---------------------------------------------------------------------------
function addErrorRow(data = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'error-row';
  wrap.innerHTML = `
    <button type="button" class="remove-row-btn" data-remove>&times;</button>
    <div class="grid-2">
      <div><label>Tên lỗi</label><input type="text" class="err_name" value="${escapeHtml(data.error_name||'')}"></div>
      <div><label>Số lượng</label><input type="number" min="0" class="err_qty" value="${data.quantity||0}"></div>
    </div>
    <label>Nội dung lỗi</label><textarea class="err_content" rows="2">${escapeHtml(data.error_content||'')}</textarea>
    <div class="grid-2">
      <div><label>Đối tượng</label>
        <select class="err_subject">
          <option value="">--</option>
          <option value="TT" ${data.violation_subject==='TT'?'selected':''}>Tập thể (TT)</option>
          <option value="CN" ${data.violation_subject==='CN'?'selected':''}>Cá nhân (CN)</option>
        </select>
      </div>
      <div><label>Cấp</label>
        <select class="err_level">
          <option value="">--</option>
          <option value="cap_cuc" ${data.subject_level==='cap_cuc'?'selected':''}>Cấp Cục</option>
          <option value="cap_phong" ${data.subject_level==='cap_phong'?'selected':''}>Cấp phòng</option>
          <option value="cap_doi_xa" ${data.subject_level==='cap_doi_xa'?'selected':''}>Cấp đội/cấp xã</option>
          <option value="can_bo" ${data.subject_level==='can_bo'?'selected':''}>Cán bộ</option>
        </select>
      </div>
    </div>
    <label>Ghi chú</label><input type="text" class="err_note" value="${escapeHtml(data.note||'')}">
  `;
  wrap.querySelector('[data-remove]').onclick = () => wrap.remove();
  $('errorList').appendChild(wrap);
}

function addDetailRow(data = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'detail-row';
  wrap.innerHTML = `
    <button type="button" class="remove-row-btn" data-remove>&times;</button>
    <div class="grid-2">
      <div><label>Tập thể/cá nhân</label>
        <select class="det_type">
          <option value="TT" ${data.subject_type==='TT'?'selected':''}>Tập thể</option>
          <option value="CN" ${data.subject_type!=='TT'?'selected':''}>Cá nhân</option>
        </select>
      </div>
      <div><label>Họ tên/tên tập thể</label><input type="text" class="det_name" value="${escapeHtml(data.full_name||'')}"></div>
    </div>
    <div class="grid-2">
      <div><label>Cấp</label><input type="text" class="det_level" value="${escapeHtml(data.level||'')}"></div>
      <div><label>Chức vụ</label><input type="text" class="det_position" value="${escapeHtml(data.position||'')}"></div>
    </div>
    <label>Đơn vị</label><input type="text" class="det_unit" value="${escapeHtml(data.unit_name||'')}">
    <label>Nội dung vi phạm</label><textarea class="det_content" rows="2">${escapeHtml(data.violation_content||'')}</textarea>
    <label>Hình thức xử lý</label><input type="text" class="det_handling" value="${escapeHtml(data.handling_form||'')}">
    <label>Ghi chú</label><input type="text" class="det_note" value="${escapeHtml(data.note||'')}">
  `;
  wrap.querySelector('[data-remove]').onclick = () => wrap.remove();
  $('detailList').appendChild(wrap);
}

function updateChecksTotal() {
  const ft = sanitizeInt($('checksFullTime').value);
  const pt = sanitizeInt($('checksPartTime').value);
  $('checksTotalDisplay').textContent = ft + pt;
}

// ---------------------------------------------------------------------------
// TẢI BÁO CÁO ĐÃ CÓ (nếu đơn vị đã nộp tuần này rồi thì cho sửa)
// ---------------------------------------------------------------------------
async function loadExistingReport() {
  const { week, year } = currentPeriod;
  const { data: report, error } = await supabase
    .from('reports').select('*')
    .eq('unit_id', currentUnit.unit_id)
    .eq('reporting_week', week).eq('reporting_year', year)
    .maybeSingle();

  const statusBox = $('existingStatusBox');
  if (error) { console.error(error); return; }

  if (!report) {
    existingReportId = null; existingPart1Id = null;
    statusBox.innerHTML = `<div class="msg-box msg-error">Chưa có báo cáo cho kỳ này — điền và bấm GỬI BÁO CÁO.</div>`;
    resetFormFields();
    return;
  }

  existingReportId = report.report_id;
  statusBox.innerHTML = `<div class="msg-box msg-success">Đã có báo cáo (${statusLabel(report.status)}) — mã ${escapeHtml(report.report_code)}. Chỉnh sửa và bấm GỬI để cập nhật.</div>`;
  $('reporterName').value = report.reporter_name || '';
  $('reporterPhone').value = report.reporter_phone || '';

  const { data: p1 } = await supabase.from('report_part1').select('*').eq('report_id', report.report_id).maybeSingle();
  if (p1) {
    existingPart1Id = p1.part1_id;
    $('planName').value = p1.plan_name || '';
    $('planNumber').value = p1.plan_number || '';
    $('planIssueDate').value = p1.plan_issue_date || '';
    $('planContent').value = p1.plan_content || '';
    $('planPeriod').value = p1.plan_period || '';
    $('checksFullTime').value = p1.checks_full_time || 0;
    $('checksPartTime').value = p1.checks_part_time || 0;
    updateChecksTotal();

    const { data: subs } = await supabase.from('report_part1_violation_subjects').select('*').eq('part1_id', p1.part1_id);
    (subs||[]).forEach(s => {
      if (s.violation_subject === 'TT') $('vTT').value = s.quantity;
      else if (s.subject_level === 'cap_cuc') $('vCapCuc').value = s.quantity;
      else if (s.subject_level === 'cap_phong') $('vCapPhong').value = s.quantity;
      else if (s.subject_level === 'cap_doi_xa') $('vCapDoiXa').value = s.quantity;
      else if (s.subject_level === 'can_bo') $('vCanBo').value = s.quantity;
    });

    const { data: errs } = await supabase.from('report_part1_errors').select('*').eq('part1_id', p1.part1_id);
    $('errorList').innerHTML = ''; (errs||[]).forEach(addErrorRow);

    const { data: pens } = await supabase.from('report_part1_penalties').select('*').eq('part1_id', p1.part1_id);
    (pens||[]).forEach(p => {
      if (p.penalty_type === 'hinh_thuc_ky_luat') { $('penKyLuat').value = p.quantity; return; }
      const el = $(`pen_${p.penalty_type}_${p.violation_subject}`);
      if (el) el.value = p.quantity;
    });

    const { data: details } = await supabase.from('report_part1_detail').select('*').eq('part1_id', p1.part1_id);
    $('detailList').innerHTML = ''; (details||[]).forEach(addDetailRow);
  }

  const { data: p2 } = await supabase.from('report_part2').select('*').eq('report_id', report.report_id).maybeSingle();
  if (p2) {
    $('p2LeaderViolation').value = p2.leader_violation_count || 0;
    $('p2LeaderCheck').value = p2.leader_check_count || 0;
    $('p2Meeting').value = p2.meeting_count || 0;
    $('p2Document').value = p2.document_count || 0;
    $('p2Note').value = p2.note || '';
  }
}

function resetFormFields() {
  ['planName','planNumber','planIssueDate','planContent','planPeriod'].forEach(id => $(id).value = '');
  ['checksFullTime','checksPartTime','vTT','vCapCuc','vCapPhong','vCapDoiXa','vCanBo','penKyLuat',
   'p2LeaderViolation','p2LeaderCheck','p2Meeting','p2Document'].forEach(id => $(id).value = 0);
  $('p2Note').value = ''; $('reporterName').value = ''; $('reporterPhone').value = '';
  $('errorList').innerHTML = ''; $('detailList').innerHTML = '';
  updateChecksTotal();
}

function collectErrorRows() {
  return [...$('errorList').children].map(row => ({
    error_name: row.querySelector('.err_name').value.trim(),
    error_content: row.querySelector('.err_content').value.trim(),
    quantity: sanitizeInt(row.querySelector('.err_qty').value),
    violation_subject: row.querySelector('.err_subject').value || null,
    subject_level: row.querySelector('.err_level').value || null,
    note: row.querySelector('.err_note').value.trim(),
  })).filter(e => e.error_name.length > 0);
}

function collectDetailRows() {
  return [...$('detailList').children].map(row => ({
    subject_type: row.querySelector('.det_type').value,
    full_name: row.querySelector('.det_name').value.trim(),
    level: row.querySelector('.det_level').value.trim(),
    position: row.querySelector('.det_position').value.trim(),
    unit_name: row.querySelector('.det_unit').value.trim(),
    violation_content: row.querySelector('.det_content').value.trim(),
    handling_form: row.querySelector('.det_handling').value.trim(),
    note: row.querySelector('.det_note').value.trim(),
  })).filter(d => d.full_name.length > 0);
}

// ---------------------------------------------------------------------------
// GỬI BÁO CÁO
// ---------------------------------------------------------------------------
async function submitReport(status) {
  const reporterName = $('reporterName').value.trim().toUpperCase();
  const reporterPhone = $('reporterPhone').value.trim();
  const resultBox = $('submitResultBox');

  if (!reporterName || !reporterPhone) {
    msg(resultBox, 'Vui lòng nhập Người báo cáo và Số điện thoại.', 'error'); return;
  }
  if (!/^[0-9.+ ]{8,15}$/.test(reporterPhone)) {
    msg(resultBox, 'Số điện thoại không hợp lệ.', 'error'); return;
  }

  showLoading('Đang gửi báo cáo...');
  try {
    const { week, year, start, end } = currentPeriod;
    const reportPayload = {
      reporting_year: year, reporting_week: week,
      week_start_date: toISODateString(start), week_end_date: toISODateString(end),
      province_id: currentUnit.province_id || null,
      unit_id: currentUnit.unit_id,
      reporter_name: reporterName, reporter_phone: reporterPhone,
      status, submitted_at: status === 'draft' ? null : new Date().toISOString(),
    };

    let reportId = existingReportId;
    if (reportId) {
      reportPayload.status = status === 'draft' ? 'draft' : 'updated';
      const { error } = await supabase.from('reports').update(reportPayload).eq('report_id', reportId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from('reports').insert(reportPayload).select().single();
      if (error) throw error;
      reportId = data.report_id;
    }

    const part1Payload = {
      report_id: reportId,
      plan_name: $('planName').value.trim(), plan_number: $('planNumber').value.trim(),
      plan_issue_date: $('planIssueDate').value || null, plan_content: $('planContent').value.trim(),
      plan_period: $('planPeriod').value.trim(),
      checks_full_time: sanitizeInt($('checksFullTime').value), checks_part_time: sanitizeInt($('checksPartTime').value),
    };
    let part1Id = existingPart1Id;
    if (part1Id) {
      const { error } = await supabase.from('report_part1').update(part1Payload).eq('part1_id', part1Id);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from('report_part1').insert(part1Payload).select().single();
      if (error) throw error;
      part1Id = data.part1_id;
    }

    await supabase.from('report_part1_violation_subjects').delete().eq('part1_id', part1Id);
    const subjRows = [
      { part1_id: part1Id, violation_subject: 'TT', subject_level: null, quantity: sanitizeInt($('vTT').value) },
      { part1_id: part1Id, violation_subject: 'CN', subject_level: 'cap_cuc', quantity: sanitizeInt($('vCapCuc').value) },
      { part1_id: part1Id, violation_subject: 'CN', subject_level: 'cap_phong', quantity: sanitizeInt($('vCapPhong').value) },
      { part1_id: part1Id, violation_subject: 'CN', subject_level: 'cap_doi_xa', quantity: sanitizeInt($('vCapDoiXa').value) },
      { part1_id: part1Id, violation_subject: 'CN', subject_level: 'can_bo', quantity: sanitizeInt($('vCanBo').value) },
    ];
    { const { error } = await supabase.from('report_part1_violation_subjects').insert(subjRows); if (error) throw error; }

    await supabase.from('report_part1_errors').delete().eq('part1_id', part1Id);
    const errRows = collectErrorRows().map(e => ({ ...e, part1_id: part1Id }));
    if (errRows.length) { const { error } = await supabase.from('report_part1_errors').insert(errRows); if (error) throw error; }

    await supabase.from('report_part1_penalties').delete().eq('part1_id', part1Id);
    const penRows = [];
    PENALTY_LABELS.forEach(([key]) => {
      penRows.push({ part1_id: part1Id, penalty_type: key, violation_subject: 'TT', quantity: sanitizeInt($(`pen_${key}_TT`).value) });
      penRows.push({ part1_id: part1Id, penalty_type: key, violation_subject: 'CN', quantity: sanitizeInt($(`pen_${key}_CN`).value) });
    });
    penRows.push({ part1_id: part1Id, penalty_type: 'hinh_thuc_ky_luat', violation_subject: null, quantity: sanitizeInt($('penKyLuat').value) });
    { const { error } = await supabase.from('report_part1_penalties').insert(penRows); if (error) throw error; }

    await supabase.from('report_part1_detail').delete().eq('part1_id', part1Id);
    const detailRows = collectDetailRows().map(d => ({ ...d, part1_id: part1Id }));
    if (detailRows.length) { const { error } = await supabase.from('report_part1_detail').insert(detailRows); if (error) throw error; }

    const part2Payload = {
      report_id: reportId,
      leader_violation_count: sanitizeInt($('p2LeaderViolation').value),
      leader_check_count: sanitizeInt($('p2LeaderCheck').value),
      meeting_count: sanitizeInt($('p2Meeting').value),
      document_count: sanitizeInt($('p2Document').value),
      note: $('p2Note').value.trim(),
    };
    const { data: existingP2 } = await supabase.from('report_part2').select('part2_id').eq('report_id', reportId).maybeSingle();
    if (existingP2) {
      const { error } = await supabase.from('report_part2').update(part2Payload).eq('part2_id', existingP2.part2_id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('report_part2').insert(part2Payload);
      if (error) throw error;
    }

    existingReportId = reportId; existingPart1Id = part1Id;
    hideLoading();
    msg(resultBox, `ĐÃ GỬI BÁO CÁO THÀNH CÔNG — Đơn vị: ${currentUnit.unit_name} — Tuần ${week}/${year} — Trạng thái: ${status === 'draft' ? 'Nháp' : 'Đã nộp'}`, 'success');
    loadExistingReport();
  } catch (e) {
    hideLoading(); console.error(e);
    msg(resultBox, 'Lỗi khi gửi báo cáo: ' + (e.message || e), 'error');
  }
}

// ---------------------------------------------------------------------------
// BIND
// ---------------------------------------------------------------------------
function bindEvents() {
  bindUnitSearch();
  $('confirmUnitBtn').onclick = confirmUnit;
  $('changeUnitBtn').onclick = () => {
    $('appBox').classList.add('hidden');
    $('unitSelectBox').classList.remove('hidden');
    currentUnit = null; existingReportId = null; existingPart1Id = null;
  };
  $('checksFullTime').addEventListener('input', updateChecksTotal);
  $('checksPartTime').addEventListener('input', updateChecksTotal);
  $('addErrorBtn').onclick = () => addErrorRow();
  $('addDetailBtn').onclick = () => addDetailRow();
  $('saveDraftBtn').onclick = () => submitReport('draft');
  $('submitBtn').onclick = () => submitReport('submitted');
}

(async function init() {
  renderPenaltyTable();
  bindEvents();
  await loadUnitList();

  // Đăng ký service worker (cho phép "Thêm vào màn hình chính" hoạt động ổn định hơn)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
