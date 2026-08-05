#!/usr/bin/env python3
"""Genera SQL de importación BUK → Superpelu (clientes + citas)."""

from __future__ import annotations

import hashlib
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RAW = ROOT / "scripts/tmp/buk-august-raw.txt"
DEFAULT_OUT = ROOT / "scripts/tmp/buk-import-august.sql"

STAFF = {
    "mónica": ("monica", "Mónica"),
    "monica": ("monica", "Mónica"),
    "olga": ("olga", "Olga"),
    "susana": ("susana", "Susana"),
    "andrea": ("andrea", "Andrea"),
    "inma": ("inma", "Inma"),
}

# Nombre BUK (parte ES o completa) → (service_id, service_name_es)
SERVICE_MAP: list[tuple[str, str, str]] = [
    ("peinado de cabello extra largo", "svc-blowdry-extra-long", "Peinado de cabello EXTRA LARGO"),
    ("peinado de cabello largo", "svc-blowdry-long", "Peinado de cabello LARGO"),
    ("peinado de cabello medio", "svc-blowdry-medium", "Peinado de cabello MEDIO"),
    ("peinado de cabello corto", "svc-blowdry-short", "Peinado de cabello CORTO"),
    ("peinado con difusor", "svc-blowdry-diffuser", "Peinado CON DIFUSOR"),
    ("corte y peinado cabello corto", "svc-haircut-blowdry-short", "Corte y peinado cabello CORTO"),
    ("corte y peinado cabello medio", "svc-haircut-blowdry-medium", "Corte y peinado cabello MEDIO"),
    ("corte y peinado cabello largo", "svc-haircut-blowdry-long", "Corte y peinado cabello LARGO"),
    ("corte de caballero", "svc-gentleman-haircut", "Corte de caballero"),
    ("corte de niño", "svc-boys-haircut", "Corte de NIÑO"),
    ("corte de niña", "svc-girls-haircut", "Corte de NIÑA"),
    ("corte de cabello corto", "svc-haircut-short", "Corte de cabello CORTO"),
    ("corte de cabello medio", "svc-haircut-medium", "Corte de cabello MEDIO"),
    ("corte de cabello largo", "svc-haircut-long", "Corte de cabello LARGO"),
    ("color en raiz", "svc-root-color", "Color en raíz"),
    ("color en raíz", "svc-root-color", "Color en raíz"),
    ("color completo", "svc-complete-color", "Color completo"),
    ("lavar color", "svc-wash-color", "LAVAR COLOR"),
    ("matizar mechas", "svc-highlight-toner", "Matizar mechas"),
    ("mechas clásicas", "svc-classic-highlights", "Mechas clásicas"),
    ("mechas clasicas", "svc-classic-highlights", "Mechas clásicas"),
    ("babylights", "svc-babylights", "Babylights"),
    ("balayage", "svc-balayage", "Balayage"),
    ("manicura esmalte semipermanente", "svc-shellac-manicure", "Manicura semipermanente"),
    ("manicura semipermanente", "svc-shellac-manicure", "Manicura semipermanente"),
    ("manicura", "svc-manicure", "Manicura"),
    ("pintar pies", "svc-pedicure-spa", "Pedicura spa completa"),
    ("pedicura tradicional", "svc-pedicure-spa", "Pedicura spa completa"),
    ("depilacion de cejas", "svc-wax-eyebrows", "Cejas"),
    ("depilación de cejas", "svc-wax-eyebrows", "Cejas"),
    ("extension de uñas", "svc-nail-extensions", "Extensión de uñas"),
    ("extensión de uñas", "svc-nail-extensions", "Extensión de uñas"),
    ("lifting de pestañas", "svc-eyelash-lift", "Lifting de pestañas"),
    ("ritual limpieza", "svc-facial-deep-cleansing", "Limpieza profunda"),
    ("recogido", "svc-upstyle", "Recogido"),
]


def sql_str(value: str | None) -> str:
    if value is None:
        return "NULL"
    return "'" + value.replace("'", "''") + "'"


def normalize_phone(raw: str | None) -> str | None:
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw.strip())
    if not digits:
        return None
    if digits.startswith("00"):
        digits = digits[2:]
    if digits.startswith("34") and len(digits) >= 11:
        return f"+{digits}"
    if len(digits) == 9 and digits[0] in "6789":
        return f"+34{digits}"
    return f"+{digits}"


def synthetic_phone(name: str) -> str:
    digest = hashlib.sha1(name.strip().lower().encode()).hexdigest()
    n = int(digest[:8], 16) % 10_000_000
    return f"+3470{n:07d}"


def split_name(full: str) -> tuple[str, str]:
    parts = full.strip().split(None, 1)
    if not parts:
        return ("Cliente", "")
    if len(parts) == 1:
        return (parts[0], "")
    return (parts[0], parts[1])


def map_service(raw: str) -> tuple[str, str]:
    key = raw.strip().lower()
    # Prefer Spanish side before " - "
    es = key.split(" - ", 1)[0].strip()
    es = es.replace("·", " ").replace("  ", " ")
    for needle, sid, sname in SERVICE_MAP:
        if es.startswith(needle) or needle in es or needle in key:
            return sid, sname
    raise KeyError(f"Servicio no mapeado: {raw!r}")


def map_status(raw: str) -> str:
    s = raw.strip().lower()
    if s == "cancelada":
        return "cancelled"
    return "confirmed"  # Programada / Completada


def map_origin(raw: str) -> str:
    s = raw.strip().lower()
    if s == "online":
        return "booking_page"
    return "backoffice"


def parse_rows(text: str) -> list[dict]:
    lines = [ln.rstrip("\n") for ln in text.splitlines()]
    # Skip header noise until first date
    i = 0
    while i < len(lines) and not re.match(r"^\d{2}/\d{2}/\d{4}$", lines[i].strip()):
        i += 1

    rows: list[dict] = []
    date_re = re.compile(r"^\d{2}/\d{2}/\d{4}$")
    time_re = re.compile(r"^\d{1,2}:\d{2}$")
    phone_re = re.compile(r"^\+?\d[\d\s-]{6,}$")

    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        if not date_re.match(line):
            i += 1
            continue

        date_raw = line
        i += 1
        if i >= len(lines) or not time_re.match(lines[i].strip()):
            continue
        time_raw = lines[i].strip()
        i += 1
        if i >= len(lines):
            break
        name = lines[i].strip()
        i += 1

        phone = None
        if i < len(lines) and phone_re.match(lines[i].strip().replace(" ", "")):
            # phone alone on line
            candidate = lines[i].strip()
            if "\t" not in candidate:
                phone = candidate
                i += 1

        if i >= len(lines):
            break
        detail = lines[i]
        i += 1

        # detail: staff \t service \t duration \t status \t origin \t price \t notes
        parts = detail.split("\t")
        if len(parts) < 5:
            # Sometimes staff is first token without tabs if weird paste — skip
            print(f"WARN fila incompleta tras {date_raw} {time_raw} {name}: {detail!r}")
            continue

        staff_raw = parts[0].strip()
        service_raw = parts[1].strip()
        duration_raw = parts[2].strip()
        status_raw = parts[3].strip()
        origin_raw = parts[4].strip() if len(parts) > 4 else "Backoffice"
        notes_raw = parts[6].strip() if len(parts) > 6 else ""
        if notes_raw in ("-", ""):
            notes_raw = ""

        d, m, y = date_raw.split("/")
        hh, mm = time_raw.split(":")
        appointment_date = f"{y}-{m}-{d}"
        start_time = f"{int(hh):02d}:{int(mm):02d}"

        staff_key = staff_raw.lower()
        if staff_key not in STAFF:
            raise KeyError(f"Staff desconocido: {staff_raw!r}")
        staff_id, staff_name = STAFF[staff_key]

        service_id, service_name = map_service(service_raw)
        duration = int(duration_raw)
        status = map_status(status_raw)
        origin = map_origin(origin_raw)

        phone_norm = normalize_phone(phone)
        if not phone_norm:
            phone_norm = synthetic_phone(name)
            synthetic = True
        else:
            synthetic = False

        first, last = split_name(name)
        rows.append(
            {
                "appointment_date": appointment_date,
                "start_time": start_time,
                "customer_name": name.strip(),
                "first_name": first,
                "last_name": last,
                "phone": phone_norm,
                "synthetic_phone": synthetic,
                "staff_id": staff_id,
                "staff_name": staff_name,
                "service_id": service_id,
                "service_name": service_name,
                "duration_minutes": duration,
                "status": status,
                "origin": origin,
                "notes": notes_raw or None,
                "is_color": service_id == "svc-root-color" or service_id == "svc-complete-color",
                "is_wash": service_id == "svc-wash-color",
            }
        )
    return rows


def link_color_groups(rows: list[dict]) -> None:
    """Enlaza color + lavar del mismo cliente/día/staff cuando hay pareja."""
    from collections import defaultdict

    buckets: dict[tuple, list[int]] = defaultdict(list)
    for idx, row in enumerate(rows):
        if row["is_color"] or row["is_wash"]:
            key = (row["phone"], row["appointment_date"], row["staff_id"], row["status"])
            buckets[key].append(idx)

    for idxs in buckets.values():
        colors = [i for i in idxs if rows[i]["is_color"]]
        washes = [i for i in idxs if rows[i]["is_wash"]]
        # Emparejar por orden de hora
        colors.sort(key=lambda i: rows[i]["start_time"])
        washes.sort(key=lambda i: rows[i]["start_time"])
        for c_idx, w_idx in zip(colors, washes):
            gid = str(uuid.uuid4())
            rows[c_idx]["color_group_id"] = gid
            rows[c_idx]["color_group_role"] = "color"
            rows[w_idx]["color_group_id"] = gid
            rows[w_idx]["color_group_role"] = "wash"


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Genera SQL import BUK → Superpelu")
    parser.add_argument("--raw", type=Path, default=DEFAULT_RAW, help="Texto pegado desde BUK")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="SQL de salida")
    parser.add_argument("--label", default="BUK", help="Etiqueta en comentarios SQL")
    args = parser.parse_args()

    text = args.raw.read_text(encoding="utf-8")
    rows = parse_rows(text)
    link_color_groups(rows)

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    customers: dict[str, dict] = {}
    for row in rows:
        phone = row["phone"]
        if phone not in customers:
            customers[phone] = {
                "phone": phone,
                "first_name": row["first_name"],
                "last_name": row["last_name"],
                "synthetic": row["synthetic_phone"],
            }

    lines: list[str] = []
    lines.append(f"-- Import {args.label} → Superpelu")
    lines.append("-- Generado por scripts/generate-buk-import.py")
    lines.append("BEGIN;")
    lines.append("")
    lines.append(f"-- Clientes únicos: {len(customers)}")
    lines.append(f"-- Citas: {len(rows)}")
    lines.append("")

    for c in customers.values():
        note = "Import BUK: teléfono sintético (sin móvil en export)" if c["synthetic"] else None
        lines.append(
            "INSERT INTO customers (phone, first_name, last_name, email, notes, locale, created_at, updated_at)\n"
            f"VALUES ({sql_str(c['phone'])}, {sql_str(c['first_name'])}, {sql_str(c['last_name'] or None)}, "
            f"NULL, {sql_str(note)}, 'es', {sql_str(now)}, {sql_str(now)})\n"
            "ON CONFLICT (phone) DO NOTHING;"
        )

    lines.append("")
    lines.append("-- Citas")
    for row in rows:
        apt_id = str(uuid.uuid4())
        color_gid = row.get("color_group_id")
        color_role = row.get("color_group_role")
        lines.append(
            "INSERT INTO appointments (\n"
            "  id, staff_id, staff_name, service_id, service_name, duration_minutes,\n"
            "  appointment_date, start_time, customer_name, customer_phone, customer_email,\n"
            "  notes, status, created_at, locale, color_group_id, color_group_role, origin\n"
            ") VALUES (\n"
            f"  {sql_str(apt_id)}, {sql_str(row['staff_id'])}, {sql_str(row['staff_name'])}, "
            f"{sql_str(row['service_id'])}, {sql_str(row['service_name'])}, {row['duration_minutes']},\n"
            f"  {sql_str(row['appointment_date'])}, {sql_str(row['start_time'])}, "
            f"{sql_str(row['customer_name'])}, {sql_str(row['phone'])}, NULL,\n"
            f"  {sql_str(row['notes'])}, {sql_str(row['status'])}, {sql_str(now)}, 'es', "
            f"{sql_str(color_gid)}, {sql_str(color_role)}, {sql_str(row['origin'])}\n"
            ");"
        )

    lines.append("")
    lines.append("SELECT COUNT(*) AS appointments FROM appointments;")
    lines.append("SELECT COUNT(*) AS customers FROM customers;")
    lines.append("COMMIT;")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text("\n".join(lines) + "\n", encoding="utf-8")

    synth = sum(1 for c in customers.values() if c["synthetic"])
    by_status: dict[str, int] = {}
    for r in rows:
        by_status[r["status"]] = by_status.get(r["status"], 0) + 1
    linked = sum(1 for r in rows if r.get("color_group_id"))

    print(f"OK → {args.out}")
    print(f"  citas: {len(rows)}")
    print(f"  clientes únicos: {len(customers)} (sintéticos: {synth})")
    print(f"  status: {by_status}")
    print(f"  color links (filas): {linked}")


if __name__ == "__main__":
    main()
