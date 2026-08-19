// Sinh file frontend/js/env.js từ biến môi trường Netlify khi build.
// Chỉ đưa vào đây các giá trị PUBLIC (anon key) — an toàn để công khai.
const fs = require('fs');
const path = require('path');

const url = process.env.PUBLIC_SUPABASE_URL || '';
const anonKey = process.env.PUBLIC_SUPABASE_ANON_KEY || '';

const content = `// File này được sinh tự động lúc build (scripts/generate-env.js) — KHÔNG chỉnh tay.
window.__ENV__ = {
  SUPABASE_URL: ${JSON.stringify(url)},
  SUPABASE_ANON_KEY: ${JSON.stringify(anonKey)}
};
`;

const outPath = path.join(__dirname, '..', 'frontend', 'js', 'env.js');
fs.writeFileSync(outPath, content, 'utf8');
console.log('Đã sinh', outPath);
