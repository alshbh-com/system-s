## نظام قراءة الباركود الشامل

سأبني نظام Barcode/QR متكامل مع صفحة اسكان احترافية وأوامر جماعية وRealtime.

### 1. قاعدة البيانات (Migration واحدة)

**تعديل جدول `orders`:**
- `tracking_code` text unique - كود التتبع الفريد (مثل TRK-000123)
- `barcode_value` text - قيمة الباركود
- `qr_value` text - قيمة QR

**Trigger:** عند إنشاء أوردر، يولّد `tracking_code` تلقائياً من `order_number` ويملأ `barcode_value` و `qr_value`.

**جدول `scan_sessions`:**
- user_id, username, started_at, ended_at, total_scanned, status (active/completed)

**جدول `scan_session_items`:**
- session_id, order_id, scanned_at

**جدول `scan_logs`:**
- user_id, username, order_id, action (scan/status_change/assign/...), old_value, new_value, session_id, created_at

**جدول `order_status_history`:**
- order_id, old_status, new_status, changed_by, changed_by_username, notes, created_at

ملاحظة: `courier_daily_reports` و agent daily logic موجودة بالفعل عبر `agent_payments` + `agent_daily_closings` + الـ triggers الحالية، فلن أكررها.

**Trigger إضافي:** عند تغيير `orders.status` يُسجَّل في `order_status_history` تلقائياً.

**RLS:** كل الجداول الجديدة public access (نفس باقي النظام).

### 2. الكود

**مكتبات جديدة:** `jsbarcode`, `qrcode`, `react-qr-code`

**ملفات جديدة:**
- `src/pages/admin/BarcodeScanner.tsx` - الصفحة الرئيسية
- `src/components/admin/scanner/ScanInput.tsx` - الإنبوت المخصص للمسدس (auto-focus, blur prevention)
- `src/components/admin/scanner/ScannedOrdersTable.tsx` - الجدول الحي
- `src/components/admin/scanner/BulkActionsDialog.tsx` - نافذة الأوامر الجماعية
- `src/components/admin/scanner/BarcodeLabel.tsx` - مكون لطباعة ملصق الباركود
- `src/hooks/useBarcodeScanner.ts` - منطق الاسكان (debounce على Enter, prevent duplicates, validate status)
- `src/hooks/useScanSession.ts` - إدارة الـ Session (start/end/persist)
- `src/hooks/useOrdersRealtime.ts` - subscription على جدول orders
- `src/lib/scanSounds.ts` - صوت نجاح/خطأ (Web Audio API، بدون ملفات)
- `src/lib/barcodeUtils.ts` - توليد tracking code، جلب بالـ tracking/order_number/id
- `src/lib/exportUtils.ts` - تصدير Excel (CSV) و PDF (jsPDF)

**تعديلات:**
- `src/App.tsx` - إضافة route `/admin/barcode-scanner`
- `src/pages/admin/Dashboard.tsx` - إضافة كارت "قراءة الباركود" بـ permission جديد
- `src/pages/admin/Invoices.tsx` - إضافة Barcode + QR + Tracking رقم في كل فاتورة
- `src/contexts/AdminAuthContext.tsx` (إن وُجدت قائمة permissions) - إضافة `barcode_scanner`

### 3. الأوامر الجماعية

داخل `BulkActionsDialog`:
- تغيير الحالة (8 حالات): تحديث `orders.status` لكل الأوردرات. الـ DB triggers الحالية تتكفل بالـ agent payments والـ daily reports تلقائياً.
- تعيين/إزالة مندوب: تحديث `delivery_agent_id`.
- طباعة فواتير جماعية: فتح نافذة طباعة بكل الفواتير (إعادة استخدام منطق Invoices).
- طباعة باركود جماعية: صفحة طباعة ملصقات.
- تصدير PDF / Excel.
- حذف من القائمة (محلي فقط).

### 4. منع الأخطاء

- `Set` للـ tracking codes داخل الـ session لمنع التكرار.
- رفض الأوردرات بحالة `cancelled` أو `delivered` (إلا لو اخترنا "السماح" صراحة).
- صوت نجاح/خطأ + Toast.
- التحقق من `currentUser` و permission قبل أي action.

### 5. Realtime

`supabase.channel('orders-changes').on('postgres_changes', ...)` على جدول `orders` لتحديث القائمة فوراً، وعلى `scan_session_items` لمشاركة الـ session بين الأجهزة.

### 6. UI

- زر كبير "ابدأ الاسكان" (gradient).
- بعد البدء: input ضخم auto-focus + counter + جدول حي.
- زر "انتهيت" يفتح BulkActionsDialog.
- RTL، dark mode (موجود)، animations عبر Tailwind، Toast (موجود).

### الترتيب
1. أعرض الـ Migration وأنتظر الموافقة.
2. بعد الموافقة: تثبيت المكتبات + كتابة كل الكود.
3. تحديث الفاتورة لإظهار Barcode/QR.
