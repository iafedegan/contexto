-- Datos adicionales del alta al boletín + trazabilidad interna (IP/ciudad).
alter table newsletter_subscribers add column if not exists first_name text;
alter table newsletter_subscribers add column if not exists last_name text;
alter table newsletter_subscribers add column if not exists birth_date date;
alter table newsletter_subscribers add column if not exists mobile text;
alter table newsletter_subscribers add column if not exists signup_ip text;
alter table newsletter_subscribers add column if not exists signup_city text;
alter table newsletter_subscribers add column if not exists signup_country text;
alter table newsletter_subscribers add column if not exists signup_lat numeric;
alter table newsletter_subscribers add column if not exists signup_lon numeric;
-- El formulario solo pedía "celular"; "teléfono" se descartó por duplicado.
alter table newsletter_subscribers drop column if exists phone;
-- Barrio declarado por el suscriptor (la geo-IP solo resuelve ciudad).
alter table newsletter_subscribers add column if not exists neighborhood text;
