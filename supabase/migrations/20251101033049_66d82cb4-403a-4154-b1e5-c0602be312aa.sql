-- إضافة محافظة القاهرة مدن
INSERT INTO public.governorates (name, shipping_cost)
VALUES ('القاهرة مدن', 0)
ON CONFLICT DO NOTHING;