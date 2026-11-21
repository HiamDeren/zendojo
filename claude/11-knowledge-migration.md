# 11 · Kiểm kê chuyển Knowledge sang Next.js (UI v3)

Bước 1 của mục Knowledge trong prompt UI v3. **Chưa xoá gì**: trang học cũ trong `apps/web/public/` vẫn chạy (`/learn`, `/levels`, `/tools`, `/plan`, `/quiz`, bản `.en`, iframe `/knowledge/[course]`). Chờ Deren duyệt kế hoạch dưới đây rồi mới chuyển từng khoá.

## 1. Nội dung hiện có (2026-11-21)

| Khoá | File VI / EN | Kích thước VI | Chương (slug · số · tiêu đề) |
|---|---|---|---|
| TPO Level | `levels.html` / `levels.en.html` + `levels-data.js`, `levels-page.js`, `ema-page.js` | 68 KB HTML + 89 KB JS | tong-quan 00 Tổng quan · nen-tang 01 Nền tảng TPO · cau-truc 02 Day & Open types · initial-balance 03 Initial Balance · levels 04 Level map · vwap 05 VWAP RTH · ema 06 EMA 9/34 · cvd 07 CVD divergence · plan 08 Lên plan mỗi ngày |
| Orderflow Tools | `tools.html` / `.en` + `tools-page.js`, `tape-pats.js`, `fp.js` | 76 KB HTML + 37 KB JS | tong-quan 00 · nen-tang 01 · thuat-ngu 02 Thuật ngữ · footprint 03 · delta 04 Delta & CVD · dom 05 DOM · tape 06 Tape · kich-ban 07 13 kịch bản · ket-hop 08 Kết hợp tại level |
| Trade Plan (khung) | `plan.html` / `.en` + `plan-core.js`, `plan-page.js` | 36 KB HTML + 64 KB JS | khung 00 · hvn 01 Xác định HVN · bias 02 Đọc bias · vwap 03 VWAP RTH · builder 04 Plan Builder · quy-trinh 05 Quy trình trade · quiz 06 Quiz |
| Trắc nghiệm | `quiz.html` / `.en` + `quiz.js`, `bank-levels.js` (94 câu), `bank-tools.js` (88 câu), `bank-ema.js` | 4 KB HTML + 85 KB JS | luyen-tap A Luyện tập · thi-thu B Thi thử (50 / 100 câu) · cau-sai C Ôn câu sai |
| Trang chủ học | `index.html` / `.en` + `home.js` | 9 KB | Hệ thống 4 lớp, khoá học, tiến độ quiz, công cụ trong phiên, sao lưu / khôi phục tiến độ |

Bản EN: sinh tự động bằng `python3 i18n/build_en.py` từ `i18n/en.tsv` + `en_extra.tsv` (không sửa tay).

## 2. Widget tương tác (phải viết lại thành client component)

| Khoá · chương | Widget (id trong JS cũ) | Ghi chú |
|---|---|---|
| Level · 02 Day & Open types | `dt-buttons`, `dt-svg`, `dt-info`, `anatomy` | chọn day type → vẽ profile SVG |
| Level · 03 Initial Balance | `ib-h`, `ib-l`, `ib-px`, `ib-out`, `ib-scen`, `ib-setups`, `ib-check`, **IB Journal** `ibj-*` (thêm dòng, CSV, nhập) | IB Journal lưu localStorage — cân nhắc gộp vào Journal Supabase |
| Level · 04 Level map | `decision`, `hatch`, `cl-*` checklist | chấm level Tier 1–4 |
| Level · 06 EMA 9/34 | `chAnat`, `chMgmt`, `gradeBox/gradeD/gradeG`, `score`, `sim*` (mô phỏng), `w*` | mô phỏng nhiều state, nặng nhất |
| Level · 07 CVD | `cvd-check`, `cvd-matrix` | |
| Tools · 02 Thuật ngữ | `gloss` | 36 thuật ngữ — nguồn cho "thuật ngữ" ở rail bài học |
| Tools · 03–07 | `anat`, `dcalc`, `dcomp`, `cvd`, `ice`, `cst`, `scs`; renderer footprint `fp.js` (13 kịch bản), tape `tape-pats.js` | `fp.js` vẽ footprint kiểu ATAS bằng SVG — port nguyên thuật toán |
| Plan · 01 HVN | `h-*` tìm HVN bằng chồng VA | dùng `plan-core.js` |
| Plan · 04 Builder | `b-*` | **không port**: trỏ sang `/trade-plan` (prompt) |
| Quiz | `qz-practice`, `qz-exam`, `qz-wrong`, `qz-filter` | giữ ngân hàng câu + tiến độ |

## 3. Tiến độ người học (localStorage, phải giữ khoá cũ)
`ofs.quiz.v1` (câu trả lời), `ofs.exam.cur` (bài thi dở), `ofs.seen` (chương đã xem), `ofs.last` (chương gần nhất — hub v3 đã đọc khoá này), `ofs.lang`, `ofs.tape.layout`, `ofs.tp.builder*`, `ofs.tp.hvn`, `ofs.api.token` (Plan Builder cũ). Trang chủ học có sao lưu / khôi phục JSON các khoá này.

## 4. Đề xuất cách chuyển

**Định dạng nội dung: module TypeScript, không dùng MDX.** `apps/web/content/knowledge/<course>/<chapter>.ts` export mảng block có kiểu (`h2`, `p`, `list`, `table`, `callout: tip|warn`, `figure` (SVG), `widget: <tên>`, `quiz: <id câu>`), mỗi chuỗi là câu VI (khoá) dịch qua `lib/i18n-en.ts` như dashboard.
Lý do: không thêm dependency (stack D26 không có MDX); widget là component có kiểu, không phải JSX lẫn trong markdown; i18n dùng chung một cơ chế với dashboard thay cho `build_en.py`; kiểm được bằng `tsc`.

**Route:** `/knowledge` (hub, đã làm v3) · `/knowledge/[course]` (mục lục + tiến độ) · `/knowledge/[course]/[chapter]` (trang bài 3 cột theo `Lesson.dc.html`). Redirect: `/knowledge/levels#ema` → `/knowledge/levels/ema` (client, vì hash không tới server); `/levels.html#ch` và `.en.html` → route mới trong `next.config.ts` (giữ query `?lang=en`).

**Thứ tự đề xuất** (mỗi khoá một PR, so từng chương với bản cũ trước khi bỏ iframe):
1. Trang bài + renderer block + rail (mục lục, thuật ngữ, ghi chú, "Đánh dấu đã học" dùng `ofs.seen`).
2. Khoá Trade Plan (ít widget nhất; chương builder → `/trade-plan`).
3. Quiz (engine + 3 chế độ, đọc / ghi `ofs.quiz.v1`, `ofs.exam.cur`).
4. Orderflow Tools (port `fp.js`, tape).
5. TPO Level (EMA simulator, IB Journal — quyết định có gộp IB Journal vào Journal Supabase không).
6. Sau khi Deren duyệt từng khoá: bỏ iframe + `?embed=1`, rồi mới xoá file trong `public/` (giữ `plan-core.js` vì server dùng).

**Ước lượng:** ~600 KB nội dung + JS cũ; mỗi khoá 1–2 phiên làm việc. Không làm trong PR UI v3 đầu tiên.

## 5. Cần Deren quyết
- Duyệt định dạng module TS (thay vì MDX).
- IB Journal (localStorage) có chuyển vào Journal Supabase không (cần migration).
- Có giữ trang chủ học `/learn` sau khi hub Knowledge thay thế không.
