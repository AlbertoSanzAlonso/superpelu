-- Import BUK septiembre 2026 → Superpelu
-- Generado por scripts/generate-buk-import.py
BEGIN;

-- Clientes únicos: 17
-- Citas: 41

INSERT INTO customers (phone, first_name, last_name, email, notes, locale, created_at, updated_at)
VALUES ('+34619225204', 'Adriana', NULL, NULL, NULL, 'es', '2026-08-05T17:45:27.000Z', '2026-08-05T17:45:27.000Z')
ON CONFLICT (phone) DO NOTHING;
INSERT INTO customers (phone, first_name, last_name, email, notes, locale, created_at, updated_at)
VALUES ('+34674543771', 'joseline', NULL, NULL, NULL, 'es', '2026-08-05T17:45:27.000Z', '2026-08-05T17:45:27.000Z')
ON CONFLICT (phone) DO NOTHING;
INSERT INTO customers (phone, first_name, last_name, email, notes, locale, created_at, updated_at)
VALUES ('+34669524511', 'Marisa', NULL, NULL, NULL, 'es', '2026-08-05T17:45:27.000Z', '2026-08-05T17:45:27.000Z')
ON CONFLICT (phone) DO NOTHING;
INSERT INTO customers (phone, first_name, last_name, email, notes, locale, created_at, updated_at)
VALUES ('+34625536489', 'Joan', NULL, NULL, NULL, 'es', '2026-08-05T17:45:27.000Z', '2026-08-05T17:45:27.000Z')
ON CONFLICT (phone) DO NOTHING;
INSERT INTO customers (phone, first_name, last_name, email, notes, locale, created_at, updated_at)
VALUES ('+34669204981', 'Angeles', 'Martinez', NULL, NULL, 'es', '2026-08-05T17:45:27.000Z', '2026-08-05T17:45:27.000Z')
ON CONFLICT (phone) DO NOTHING;
INSERT INTO customers (phone, first_name, last_name, email, notes, locale, created_at, updated_at)
VALUES ('+34664313558', 'Margarita', 'De La Rosa', NULL, NULL, 'es', '2026-08-05T17:45:27.000Z', '2026-08-05T17:45:27.000Z')
ON CONFLICT (phone) DO NOTHING;
INSERT INTO customers (phone, first_name, last_name, email, notes, locale, created_at, updated_at)
VALUES ('+15174102046', 'Rebeca', 'Bardlay', NULL, NULL, 'es', '2026-08-05T17:45:27.000Z', '2026-08-05T17:45:27.000Z')
ON CONFLICT (phone) DO NOTHING;
INSERT INTO customers (phone, first_name, last_name, email, notes, locale, created_at, updated_at)
VALUES ('+353858582104', 'Susan', NULL, NULL, NULL, 'es', '2026-08-05T17:45:27.000Z', '2026-08-05T17:45:27.000Z')
ON CONFLICT (phone) DO NOTHING;
INSERT INTO customers (phone, first_name, last_name, email, notes, locale, created_at, updated_at)
VALUES ('+353861602755', 'mary', 'theresa', NULL, NULL, 'es', '2026-08-05T17:45:27.000Z', '2026-08-05T17:45:27.000Z')
ON CONFLICT (phone) DO NOTHING;
INSERT INTO customers (phone, first_name, last_name, email, notes, locale, created_at, updated_at)
VALUES ('+34952562075', 'Johana', NULL, NULL, NULL, 'es', '2026-08-05T17:45:27.000Z', '2026-08-05T17:45:27.000Z')
ON CONFLICT (phone) DO NOTHING;
INSERT INTO customers (phone, first_name, last_name, email, notes, locale, created_at, updated_at)
VALUES ('+34687422459', 'Conchi', 'Santamaria', NULL, NULL, 'es', '2026-08-05T17:45:27.000Z', '2026-08-05T17:45:27.000Z')
ON CONFLICT (phone) DO NOTHING;
INSERT INTO customers (phone, first_name, last_name, email, notes, locale, created_at, updated_at)
VALUES ('+353851735741', 'Michelle', 'Maguire', NULL, NULL, 'es', '2026-08-05T17:45:27.000Z', '2026-08-05T17:45:27.000Z')
ON CONFLICT (phone) DO NOTHING;
INSERT INTO customers (phone, first_name, last_name, email, notes, locale, created_at, updated_at)
VALUES ('+353872889550', 'katie', 'o rourke', NULL, NULL, 'es', '2026-08-05T17:45:27.000Z', '2026-08-05T17:45:27.000Z')
ON CONFLICT (phone) DO NOTHING;
INSERT INTO customers (phone, first_name, last_name, email, notes, locale, created_at, updated_at)
VALUES ('+34616298112', 'Pepita', 'Cañero', NULL, NULL, 'es', '2026-08-05T17:45:27.000Z', '2026-08-05T17:45:27.000Z')
ON CONFLICT (phone) DO NOTHING;
INSERT INTO customers (phone, first_name, last_name, email, notes, locale, created_at, updated_at)
VALUES ('+34675413523', 'ANGELA', 'DE LUCA', NULL, NULL, 'es', '2026-08-05T17:45:27.000Z', '2026-08-05T17:45:27.000Z')
ON CONFLICT (phone) DO NOTHING;
INSERT INTO customers (phone, first_name, last_name, email, notes, locale, created_at, updated_at)
VALUES ('+447843921387', 'Shirley', 'Putnam', NULL, NULL, 'es', '2026-08-05T17:45:27.000Z', '2026-08-05T17:45:27.000Z')
ON CONFLICT (phone) DO NOTHING;
INSERT INTO customers (phone, first_name, last_name, email, notes, locale, created_at, updated_at)
VALUES ('+34659107661', 'Maria', 'Luisa Perez Dominguez', NULL, NULL, 'es', '2026-08-05T17:45:27.000Z', '2026-08-05T17:45:27.000Z')
ON CONFLICT (phone) DO NOTHING;

-- Citas
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  '0a999803-0c24-48c1-b9e5-3eb1e1ac4c5d', 'monica', 'Mónica', 'svc-blowdry-short', 'Peinado de cabello CORTO', 30,
  '2026-09-26', '10:30', 'Adriana', '+34619225204', NULL,
  NULL, 'confirmed', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'backoffice'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  '61d5d3ae-20ff-4282-b964-ddb0ba85db21', 'monica', 'Mónica', 'svc-blowdry-short', 'Peinado de cabello CORTO', 30,
  '2026-09-26', '10:00', 'joseline', '+34674543771', NULL,
  NULL, 'confirmed', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'backoffice'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  '745f782a-2ec9-4199-8a76-6b02c531a009', 'monica', 'Mónica', 'svc-blowdry-medium', 'Peinado de cabello MEDIO', 30,
  '2026-09-25', '12:30', 'Marisa', '+34669524511', NULL,
  NULL, 'confirmed', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'backoffice'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  '270fbafe-60ba-42d8-af1a-c341ed2f2c76', 'monica', 'Mónica', 'svc-blowdry-short', 'Peinado de cabello CORTO', 30,
  '2026-09-25', '12:00', 'Joan', '+34625536489', NULL,
  NULL, 'confirmed', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'backoffice'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  'f9bb7b83-101f-4421-8df5-b93d16f7077c', 'susana', 'Susana', 'svc-blowdry-medium', 'Peinado de cabello MEDIO', 30,
  '2026-09-25', '12:00', 'Angeles Martinez', '+34669204981', NULL,
  NULL, 'cancelled', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'backoffice'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  '704bdc46-2736-430c-b3e8-8d75b2862483', 'monica', 'Mónica', 'svc-blowdry-short', 'Peinado de cabello CORTO', 30,
  '2026-09-25', '10:30', 'Margarita De La Rosa', '+34664313558', NULL,
  NULL, 'confirmed', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'backoffice'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  '329ae637-6499-465d-ac5a-cc8b8e2388ec', 'monica', 'Mónica', 'svc-blowdry-short', 'Peinado de cabello CORTO', 30,
  '2026-09-19', '10:30', 'Adriana', '+34619225204', NULL,
  NULL, 'confirmed', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'backoffice'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  'f1c42fbc-5668-4296-8c80-30c1b8b81eb5', 'monica', 'Mónica', 'svc-blowdry-short', 'Peinado de cabello CORTO', 30,
  '2026-09-19', '10:00', 'joseline', '+34674543771', NULL,
  NULL, 'confirmed', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'backoffice'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  'b0cc578c-6c50-4493-96e9-7a80e8d23776', 'monica', 'Mónica', 'svc-blowdry-medium', 'Peinado de cabello MEDIO', 30,
  '2026-09-18', '12:30', 'Marisa', '+34669524511', NULL,
  NULL, 'confirmed', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'backoffice'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  'd181f63f-2559-4f26-8aad-0a966fe7914a', 'monica', 'Mónica', 'svc-blowdry-short', 'Peinado de cabello CORTO', 30,
  '2026-09-18', '12:00', 'Joan', '+34625536489', NULL,
  NULL, 'confirmed', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'backoffice'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  'fc14bd86-ac34-4655-bb1f-27ad858b468e', 'susana', 'Susana', 'svc-blowdry-medium', 'Peinado de cabello MEDIO', 30,
  '2026-09-18', '12:00', 'Angeles Martinez', '+34669204981', NULL,
  NULL, 'cancelled', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'backoffice'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  '4529b350-18f1-44fa-8405-baf01d0e36a3', 'monica', 'Mónica', 'svc-blowdry-short', 'Peinado de cabello CORTO', 30,
  '2026-09-18', '10:30', 'Margarita De La Rosa', '+34664313558', NULL,
  NULL, 'confirmed', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'backoffice'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  '895979b8-039f-45ce-8b4d-e6ed9ea50c0d', 'monica', 'Mónica', 'svc-blowdry-medium', 'Peinado de cabello MEDIO', 30,
  '2026-09-17', '11:00', 'Rebeca Bardlay', '+15174102046', NULL,
  NULL, 'confirmed', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'backoffice'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  '10436928-5f5b-448f-b18e-5b712341de20', 'monica', 'Mónica', 'svc-root-color', 'Color en raíz', 30,
  '2026-09-17', '10:00', 'Rebeca Bardlay', '+15174102046', NULL,
  NULL, 'confirmed', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'backoffice'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  'b90eb2c2-3a53-46fe-9a61-5eb3a9ff786c', 'monica', 'Mónica', 'svc-blowdry-short', 'Peinado de cabello CORTO', 30,
  '2026-09-12', '10:30', 'Adriana', '+34619225204', NULL,
  NULL, 'confirmed', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'backoffice'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  '8e0ba912-44d2-4447-b384-4b6a66aee570', 'monica', 'Mónica', 'svc-blowdry-short', 'Peinado de cabello CORTO', 30,
  '2026-09-12', '10:00', 'joseline', '+34674543771', NULL,
  NULL, 'confirmed', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'backoffice'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  'f6991ddb-e966-4ac9-92f6-04812de13b4a', 'andrea', 'Andrea', 'svc-haircut-blowdry-medium', 'Corte y peinado cabello MEDIO', 60,
  '2026-09-11', '13:00', 'Susan', '+353858582104', NULL,
  NULL, 'confirmed', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'backoffice'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  'adbbdf02-d30d-4703-9d98-c5f349eb4f3b', 'andrea', 'Andrea', 'svc-highlight-toner', 'Matizar mechas', 30,
  '2026-09-11', '12:30', 'Susan', '+353858582104', NULL,
  NULL, 'confirmed', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'backoffice'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  '7d0f2c68-634e-45e7-ab4c-1576a9c97685', 'monica', 'Mónica', 'svc-blowdry-medium', 'Peinado de cabello MEDIO', 30,
  '2026-09-11', '12:30', 'Marisa', '+34669524511', NULL,
  NULL, 'confirmed', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'backoffice'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  '5341ed00-de82-4ae5-8351-815490513ecf', 'monica', 'Mónica', 'svc-blowdry-short', 'Peinado de cabello CORTO', 30,
  '2026-09-11', '12:00', 'Joan', '+34625536489', NULL,
  NULL, 'confirmed', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'backoffice'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  '756c092d-2807-498f-8ff1-4c274273a7cb', 'susana', 'Susana', 'svc-blowdry-medium', 'Peinado de cabello MEDIO', 30,
  '2026-09-11', '12:00', 'Angeles Martinez', '+34669204981', NULL,
  NULL, 'cancelled', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'backoffice'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  '4045c542-4a3f-4d77-9efe-7e600422bb24', 'monica', 'Mónica', 'svc-blowdry-short', 'Peinado de cabello CORTO', 30,
  '2026-09-11', '10:30', 'Margarita De La Rosa', '+34664313558', NULL,
  NULL, 'confirmed', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'backoffice'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  '63cab06c-0c3f-44c6-957a-24c5c4cd46f1', 'andrea', 'Andrea', 'svc-classic-highlights', 'Mechas clásicas', 75,
  '2026-09-11', '10:00', 'Susan', '+353858582104', NULL,
  NULL, 'confirmed', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'backoffice'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  'b6548fa3-2a59-4fb3-80b4-24dc2bcc7b1c', 'andrea', 'Andrea', 'svc-upstyle', 'Recogido', 90,
  '2026-09-10', '12:00', 'mary theresa', '+353861602755', NULL,
  'upstyle look - i am going to a wedding. is it possible for you to do makeup too?', 'confirmed', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'booking_page'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  '05ad6005-8a32-4768-8c1b-e94881a067ae', 'andrea', 'Andrea', 'svc-haircut-short', 'Corte de cabello CORTO', 30,
  '2026-09-08', '17:00', 'Johana', '+34952562075', NULL,
  'con andrea', 'confirmed', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'backoffice'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  'ce28e813-39f0-401d-8da8-372a343b08d9', 'olga', 'Olga', 'svc-blowdry-short', 'Peinado de cabello CORTO', 30,
  '2026-09-05', '11:00', 'Conchi Santamaria', '+34687422459', NULL,
  NULL, 'confirmed', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'backoffice'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  '8f5a65ac-08a8-4078-87f6-9de756418a19', 'monica', 'Mónica', 'svc-blowdry-short', 'Peinado de cabello CORTO', 30,
  '2026-09-05', '10:30', 'Adriana', '+34619225204', NULL,
  NULL, 'confirmed', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'backoffice'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  '4076e6f1-7fe1-42b0-b266-ed15d32382ae', 'monica', 'Mónica', 'svc-blowdry-short', 'Peinado de cabello CORTO', 30,
  '2026-09-05', '10:00', 'joseline', '+34674543771', NULL,
  NULL, 'confirmed', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'backoffice'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  '2d47a2a7-e90e-4f41-947a-a704b8dbeb02', 'andrea', 'Andrea', 'svc-upstyle', 'Recogido', 90,
  '2026-09-05', '10:00', 'Michelle Maguire', '+353851735741', NULL,
  'upstyle for a wedding', 'cancelled', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'booking_page'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  'f9d1063c-7b88-473c-a0d5-1128942182d8', 'monica', 'Mónica', 'svc-upstyle', 'Recogido', 90,
  '2026-09-05', '10:00', 'katie o rourke', '+353872889550', NULL,
  'upstyle for wedding', 'confirmed', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'booking_page'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  'eea64229-d0cb-4dc2-bb0d-f1c2d8e13f7f', 'monica', 'Mónica', 'svc-blowdry-medium', 'Peinado de cabello MEDIO', 30,
  '2026-09-04', '12:30', 'Marisa', '+34669524511', NULL,
  NULL, 'confirmed', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'backoffice'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  '133b3752-e2b9-4f43-82d2-64e5be4284d7', 'monica', 'Mónica', 'svc-blowdry-short', 'Peinado de cabello CORTO', 30,
  '2026-09-04', '12:00', 'Joan', '+34625536489', NULL,
  NULL, 'confirmed', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'backoffice'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  '0ff16301-3932-4524-a4ff-d8a5ec1e4c56', 'susana', 'Susana', 'svc-blowdry-medium', 'Peinado de cabello MEDIO', 30,
  '2026-09-04', '12:00', 'Angeles Martinez', '+34669204981', NULL,
  NULL, 'cancelled', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'backoffice'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  '623d8f65-ab1d-4e16-bb01-0c590f24d92e', 'andrea', 'Andrea', 'svc-upstyle', 'Recogido', 90,
  '2026-09-04', '11:30', 'Michelle Maguire', '+353851735741', NULL,
  NULL, 'confirmed', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'booking_page'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  '62d06734-0f33-488e-9326-5457f396ff82', 'susana', 'Susana', 'svc-upstyle', 'Recogido', 90,
  '2026-09-04', '11:00', 'Michelle Maguire', '+353851735741', NULL,
  NULL, 'confirmed', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'booking_page'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  '8dca9aa1-370e-40f4-a9a0-a1be0eecd4ad', 'monica', 'Mónica', 'svc-blowdry-short', 'Peinado de cabello CORTO', 30,
  '2026-09-04', '10:30', 'Margarita De La Rosa', '+34664313558', NULL,
  NULL, 'confirmed', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'backoffice'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  'ee48cc06-1206-45d0-a232-e71b852dd754', 'susana', 'Susana', 'svc-blowdry-short', 'Peinado de cabello CORTO', 35,
  '2026-09-04', '10:00', 'Pepita Cañero', '+34616298112', NULL,
  NULL, 'confirmed', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'backoffice'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  'de5273e8-2618-432a-be79-42f3bdb48354', 'andrea', 'Andrea', 'svc-upstyle', 'Recogido', 90,
  '2026-09-04', '10:00', 'Michelle Maguire', '+353851735741', NULL,
  NULL, 'confirmed', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'booking_page'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  'df199ab6-c784-40a7-bdb7-f658abc9ccb3', 'monica', 'Mónica', 'svc-blowdry-short', 'Peinado de cabello CORTO', 30,
  '2026-09-04', '10:00', 'ANGELA DE LUCA', '+34675413523', NULL,
  NULL, 'confirmed', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'backoffice'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  '3ed25ec4-9a5f-472d-9b48-6d406c4de63c', 'monica', 'Mónica', 'svc-haircut-short', 'Corte de cabello CORTO', 30,
  '2026-09-03', '10:30', 'Shirley Putnam', '+447843921387', NULL,
  NULL, 'confirmed', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'booking_page'
);
INSERT INTO appointments (
  id, staff_id, staff_name, service_id, service_name, duration_minutes,
  appointment_date, start_time, customer_name, customer_phone, customer_email,
  notes, status, created_at, locale, color_group_id, color_group_role, origin
) VALUES (
  '0892efc6-d9b9-4307-9016-e24ea3d19090', 'susana', 'Susana', 'svc-blowdry-short', 'Peinado de cabello CORTO', 30,
  '2026-09-01', '11:30', 'Maria Luisa Perez Dominguez', '+34659107661', NULL,
  NULL, 'confirmed', '2026-08-05T17:45:27.000Z', 'es', NULL, NULL, 'backoffice'
);

SELECT COUNT(*) AS appointments FROM appointments;
SELECT COUNT(*) AS customers FROM customers;
COMMIT;
