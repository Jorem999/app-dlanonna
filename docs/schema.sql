-- ============================================================
-- ESQUEMA BD: Módulo Horarios — D'la Nonna
-- Base de datos: dlanonna (PostgreSQL 16)
-- Generado desde: BD real en producción (dump 2026-07-19)
-- ============================================================
-- Schemas usados:
--   core        → usuarios del sistema, auditoría
--   horarios    → regímenes, empleados, marcaciones, pagos, cargos
-- ============================================================

-- ============================================================
-- SCHEMAS
-- ============================================================
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS horarios;

-- ============================================================
-- FUNCIÓN: Trigger de auditoría genérica
-- ============================================================
CREATE OR REPLACE FUNCTION core.audit_trigger()
RETURNS TRIGGER AS $
DECLARE
    v_user_id INTEGER;
    v_ip INET;
BEGIN
    BEGIN
        v_user_id := current_setting('session.audit_user_id')::INTEGER;
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    BEGIN
        v_ip := current_setting('session.audit_ip')::INET;
    EXCEPTION WHEN OTHERS THEN
        v_ip := NULL;
    END;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO core.audit_log (schema_name, table_name, record_id, action, user_id, new_data, ip_address)
        VALUES (TG_TABLE_SCHEMA, TG_TABLE_NAME, NEW.id, 'INSERT', v_user_id, row_to_json(NEW)::JSONB, v_ip);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO core.audit_log (schema_name, table_name, record_id, action, user_id, old_data, new_data, ip_address)
        VALUES (TG_TABLE_SCHEMA, TG_TABLE_NAME, NEW.id, 'UPDATE', v_user_id, row_to_json(OLD)::JSONB, row_to_json(NEW)::JSONB, v_ip);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO core.audit_log (schema_name, table_name, record_id, action, user_id, old_data, ip_address)
        VALUES (TG_TABLE_SCHEMA, TG_TABLE_NAME, OLD.id, 'DELETE', v_user_id, row_to_json(OLD)::JSONB, v_ip);
        RETURN OLD;
    END IF;
END;
$ LANGUAGE plpgsql;

-- ============================================================
-- TABLA: core.audit_log
-- Registro de cambios (INSERT, UPDATE, DELETE) en todas las
-- tablas del sistema habilitadas con trigger.
-- ============================================================
CREATE TABLE IF NOT EXISTS core.audit_log (
    id              SERIAL PRIMARY KEY,
    schema_name     VARCHAR(50) NOT NULL,
    table_name      VARCHAR(50) NOT NULL,
    record_id       INTEGER NOT NULL,
    action          VARCHAR(10) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    user_id         INTEGER,
    old_data        JSONB,
    new_data        JSONB,
    ip_address      INET,
    changed_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_record ON core.audit_log(schema_name, table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed ON core.audit_log(changed_at);

-- ============================================================
-- TABLA: core.usuario
-- Acceso al dashboard/admin. Empleado se autentica por cédula
-- en la pantalla de marcación.
-- ============================================================
CREATE TABLE IF NOT EXISTS core.usuario (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(50) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    rol             VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (rol IN ('admin', 'user')),
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: horarios.regimen
-- Configuración de horarios: fijo (hora base) o flexible
-- (solo registrar horas trabajadas).
-- ============================================================
CREATE TABLE IF NOT EXISTS horarios.regimen (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(100) NOT NULL,
    tipo            VARCHAR(10) NOT NULL DEFAULT 'fijo'
                    CHECK (tipo IN ('fijo', 'flexible')),
    tolerancia_min  INTEGER NOT NULL DEFAULT 0
                    CHECK (tolerancia_min >= 0),
    intervalo_minimo INTEGER NOT NULL DEFAULT 30
                    CHECK (intervalo_minimo >= 0),
    hora_entrada    TIME,
    hora_salida     TIME,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE horarios.regimen IS
    'Configuracion de horarios: fijo (hora base) o flexible (solo registrar horas)';

-- ============================================================
-- TABLA: horarios.empleado
-- ============================================================
CREATE TABLE IF NOT EXISTS horarios.empleado (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(100) NOT NULL,
    cedula          VARCHAR(10) NOT NULL UNIQUE,
    telefono        VARCHAR(20),
    cargo           VARCHAR(50),
    fecha_ingreso   DATE DEFAULT CURRENT_DATE,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    regimen_id      INTEGER REFERENCES horarios.regimen(id)
);

COMMENT ON COLUMN horarios.empleado.cedula IS 'Cedula ecuatoriana (10 digitos)';

CREATE INDEX IF NOT EXISTS idx_empleado_cedula ON horarios.empleado(cedula);
CREATE INDEX IF NOT EXISTS idx_empleado_active ON horarios.empleado(activo);

-- ============================================================
-- TABLA: horarios.marcacion
-- Eventos puros de entrada/salida. Cada marcación es inmutable;
-- las correcciones se registran vía UPDATE con auditoría.
-- ============================================================
CREATE TABLE IF NOT EXISTS horarios.marcacion (
    id              SERIAL PRIMARY KEY,
    id_empleado     INTEGER NOT NULL REFERENCES horarios.empleado(id),
    fecha_hora      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tipo            VARCHAR(10) NOT NULL
                    CHECK (tipo IN ('entrada', 'salida', 'pausa_inicio', 'pausa_fin')),
    origen          VARCHAR(20) NOT NULL DEFAULT 'app'
                    CHECK (origen IN ('app', 'web', 'manual', 'ajuste_admin')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    dispositivo     VARCHAR(100),
    metadata        JSONB
);

COMMENT ON TABLE horarios.marcacion IS
    'Registro de marcaciones de entrada/salida. Modificable solo por admin';

CREATE INDEX IF NOT EXISTS idx_marcacion_empleado ON horarios.marcacion(id_empleado);
CREATE INDEX IF NOT EXISTS idx_marcacion_fecha ON horarios.marcacion(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_marcacion_empleado_fecha ON horarios.marcacion(id_empleado, fecha_hora);

-- ============================================================
-- TABLA: horarios.cargo
-- Catálogo de cargos/puestos de trabajo (ej: panadero, ayudante)
-- ============================================================
CREATE TABLE IF NOT EXISTS horarios.cargo (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(50) NOT NULL UNIQUE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: horarios.pago
-- Registro de pagos semanales a empleados
-- ============================================================
CREATE TABLE IF NOT EXISTS horarios.pago (
    id              SERIAL PRIMARY KEY,
    id_empleado     INTEGER NOT NULL REFERENCES horarios.empleado(id),
    semana_numero   INTEGER NOT NULL,
    semana_inicio   DATE NOT NULL,
    monto           NUMERIC(10,2) NOT NULL,
    horas_trabajadas NUMERIC(6,2),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (id_empleado, semana_numero)
);

CREATE INDEX IF NOT EXISTS idx_pago_empleado ON horarios.pago(id_empleado);
CREATE INDEX IF NOT EXISTS idx_pago_semana ON horarios.pago(semana_numero);

-- ============================================================
-- TRIGGERS DE AUDITORÍA
-- ============================================================
DROP TRIGGER IF EXISTS audit_usuario ON core.usuario;
CREATE TRIGGER audit_usuario
    AFTER INSERT OR DELETE OR UPDATE ON core.usuario
    FOR EACH ROW EXECUTE FUNCTION core.audit_trigger();

DROP TRIGGER IF EXISTS audit ON horarios.regimen;
CREATE TRIGGER audit_regimen
    AFTER INSERT OR DELETE OR UPDATE ON horarios.regimen
    FOR EACH ROW EXECUTE FUNCTION core.audit_trigger();

DROP TRIGGER IF EXISTS audit ON horarios.empleado;
CREATE TRIGGER audit
    AFTER INSERT OR DELETE OR UPDATE ON horarios.empleado
    FOR EACH ROW EXECUTE FUNCTION core.audit_trigger();

DROP TRIGGER IF EXISTS audit ON horarios.marcacion;
CREATE TRIGGER audit
    AFTER INSERT OR DELETE OR UPDATE ON horarios.marcacion
    FOR EACH ROW EXECUTE FUNCTION core.audit_trigger();

DROP TRIGGER IF EXISTS audit ON horarios.cargo;
CREATE TRIGGER audit
    AFTER INSERT OR DELETE OR UPDATE ON horarios.cargo
    FOR EACH ROW EXECUTE FUNCTION core.audit_trigger();

DROP TRIGGER IF EXISTS audit ON horarios.pago;
CREATE TRIGGER audit
    AFTER INSERT OR DELETE OR UPDATE ON horarios.pago
    FOR EACH ROW EXECUTE FUNCTION core.audit_trigger();
