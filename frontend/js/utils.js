// ============================================================================
// Tiện ích dùng chung: tuần ISO 8601, định dạng ngày, validate số liệu
// ============================================================================

// Trả về {week, year, monday, sunday} theo chuẩn ISO 8601 cho 1 ngày bất kỳ
export function getISOWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // Chủ nhật = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // đưa về thứ 5 cùng tuần ISO
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);

  const monday = new Date(date);
  monday.setDate(monday.getDate() - dayNum + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return { week, year: d.getUTCFullYear(), monday, sunday };
}

// Chu kỳ báo cáo THỰC TẾ của hệ thống: từ Thứ 5 tuần này đến Thứ 5 tuần sau.
// Trả về {start, end, week, year} — week/year lấy theo tuần ISO của ngày "start"
// (chỉ dùng để định danh/lưu trữ, không ảnh hưởng đến mốc hiển thị Thứ 5 → Thứ 5).
export function getReportingPeriod(refDate = new Date()) {
  const d = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  const dow = d.getDay() || 7; // Thứ 2=1 ... Chủ nhật=7
  const THURSDAY = 4;
  const diff = (dow - THURSDAY + 7) % 7; // số ngày lùi về Thứ 5 gần nhất (kể cả hôm nay nếu là Thứ 5)
  const start = new Date(d);
  start.setDate(d.getDate() - diff);
  const end = new Date(start);
  end.setDate(start.getDate() + 7); // Thứ 5 tuần sau

  const { week, year } = getISOWeek(start);
  return { start, end, week, year };
}

// Trả về {start, end} cho 1 tuần ISO/năm cụ thể, quy đổi sang chu kỳ Thứ 5 → Thứ 5
// chứa ngày Thứ 5 của tuần ISO đó (dùng khi Admin lọc theo tuần đã lưu).
export function getReportingPeriodForWeek(week, year) {
  const { monday } = getWeekRange(week, year);
  const thursdayOfWeek = new Date(monday);
  thursdayOfWeek.setDate(monday.getDate() + 3); // Thứ 5 trong tuần ISO đó
  return getReportingPeriod(thursdayOfWeek);
}

// Trả về {monday, sunday} cho 1 tuần/năm ISO cụ thể (dùng khi người dùng chọn tuần thủ công)
export function getWeekRange(week, year) {
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - jan4Day + 1);
  const monday = new Date(week1Monday);
  monday.setDate(week1Monday.getDate() + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { monday, sunday };
}

export function formatDate(d) {
  if (!d) return '';
  const dt = (d instanceof Date) ? d : new Date(d);
  return dt.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function toISODateString(d) {
  const dt = (d instanceof Date) ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Validate số nguyên >= 0, không NaN, không Infinity, không âm — dùng ở CẢ frontend lẫn double-check trước khi gửi
export function validNonNegativeInt(v) {
  const n = Number(v);
  return Number.isFinite(n) && Number.isInteger(n) && n >= 0;
}

export function sanitizeInt(v) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

// Chống XSS cơ bản khi render text do người dùng nhập ra DOM bằng innerHTML
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

export function statusLabel(status) {
  return {
    draft: '⚪ NHÁP',
    submitted: '🟢 ĐÃ NỘP',
    updated: '🟠 ĐÃ CẬP NHẬT',
    overdue: '🔴 QUÁ HẠN'
  }[status] || status;
}

export function uuid() {
  return crypto.randomUUID();
}
