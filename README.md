# HTBC-X03 (BẢN ĐƠN GIẢN HOÁ — KHÔNG MẬT KHẨU)

**CHƯƠNG TRÌNH HÀNH ĐỘNG SỐ 10/CTR-BCA-X03** — Cục Công tác chính trị, Bộ Công an.

---

## ⚠️ ĐỌC TRƯỚC KHI DÙNG

Theo yêu cầu mới nhất, bản này đã **bỏ hoàn toàn**:
- Mật khẩu Admin
- Netlify Functions (`admin-login`, `admin-action`)

**Ai có đường link `/admin.html` đều có toàn quyền** xem, sửa, xóa báo cáo, đổi cấu hình, bật/tắt đơn vị — không cần đăng nhập gì cả. Đơn giản hoá tối đa để dễ triển khai, đổi lại **không có lớp bảo mật nào cho trang Admin**. Nếu muốn bảo mật lại sau này, cần bổ sung lại cơ chế xác thực.

Mọi thao tác giờ gọi thẳng vào Supabase bằng anon key, không qua server trung gian nào — vì vậy sẽ không còn gặp lỗi 500 do cấu hình Netlify Function/biến môi trường phức tạp như trước.

---

## Triển khai — chỉ còn 2 phần (không cần Netlify Functions/biến SERVICE_ROLE_KEY nữa)

### Phần A — Supabase (Database)

1. Tạo project tại supabase.com (nếu chưa có, hoặc dùng lại project cũ).
2. Vào **SQL Editor**, chạy lần lượt (đúng thứ tự):
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_rls.sql` (**bản mới, mở quyền hoàn toàn — bắt buộc chạy lại bản này nếu bạn từng chạy bản RLS cũ**)
   - `supabase/migrations/0003_views.sql`
   - `supabase/seed/0001_provinces.sql`
   - `supabase/seed/0002_units.sql`
   - `supabase/seed/0003_settings.sql`
3. Kiểm tra: `select count(*) from units;` → phải ra **98**.
4. Lấy **Project URL** và **anon/publishable key** (Project Settings → API). **Không cần lấy service_role key nữa.**

> Nếu bạn đã có project Supabase từ trước và từng chạy bản RLS cũ (yêu cầu mật khẩu), **bắt buộc phải chạy lại file `0002_rls.sql` mới này** để mở quyền, nếu không Admin vẫn sẽ bị chặn thao tác xóa/sửa.

### Phần B — Netlify (Frontend)

1. Đưa toàn bộ nội dung thư mục này lên GitHub (như cũ).
2. Netlify → **Import from Git** → chọn repo.
3. Build settings:
   - Base directory: để trống
   - Build command: `node scripts/generate-env.js`
   - Publish directory: `frontend`
   - (Không cần khai Functions directory nữa)
4. Environment variables — **chỉ cần 2 biến**:

   | Key | Value |
   |---|---|
   | `PUBLIC_SUPABASE_URL` | Project URL |
   | `PUBLIC_SUPABASE_ANON_KEY` | anon/publishable key |

5. Deploy.

### Kiểm tra

- Vào link chính → chọn đơn vị → gửi thử báo cáo.
- Vào `<link>/admin.html` → vào thẳng Dashboard, không cần đăng nhập.

---

## Cấu trúc thư mục

```
HTBC-X03/
├── frontend/
│   ├── index.html       # Chọn đơn vị + gửi báo cáo
│   ├── admin.html       # Dashboard quản trị (không cần đăng nhập)
│   ├── manifest.json / sw.js / assets/   # PWA — thêm vào màn hình chính
│   ├── css/style.css
│   └── js/ (supabaseClient.js, utils.js, report-form.js, admin.js, env.js)
├── supabase/
│   ├── migrations/ (0001_schema, 0002_rls, 0003_views)
│   └── seed/ (0001_provinces, 0002_units, 0003_settings)
├── scripts/generate-env.js
├── package.json / netlify.toml / .env.example
```

## Dùng như 1 app trên điện thoại

Android (Chrome): mở link → menu ⋮ → "Thêm vào Màn hình chính".
iPhone (Safari): mở link → nút Chia sẻ → "Thêm vào MH chính".

## Chu kỳ báo cáo

Thứ 5 tuần này → Thứ 5 tuần sau, tự động tính theo ngày hiện tại.
