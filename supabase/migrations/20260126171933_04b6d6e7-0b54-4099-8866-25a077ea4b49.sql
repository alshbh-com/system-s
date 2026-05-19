-- حذف جميع البيانات المرتبطة بالأوردرات
DELETE FROM returns;
DELETE FROM agent_payments;
DELETE FROM order_items;
DELETE FROM orders;

-- إعادة ضبط تسلسل أرقام الأوردرات ليبدأ من 1
SELECT setval('order_number_seq', 1, false);