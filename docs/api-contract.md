# API Contract — Módulo Horarios (app-dlanonna)

> Contrato REST del módulo horarios. Backend: TypeScript (Hono) + PostgreSQL.
> Versión 1.0 — MVP.

## Formato general

- **Base URL:** `/api`
- **Módulo:** `horarios` → rutas bajo `/api/horarios/*`
- **Content-Type:** `application/json`
- **Fechas:** ISO 8601 con timezone (ej: `2026-07-01T08:05:00-05:00`)
- **Autenticación:** Header `Authorization: Bearer <token>` (endpoints admin)
- **Errores:** `{ "error": "mensaje legible", "code": "ERROR_CODE" }`

## Códigos de error comunes

| Código | Significado |
|--------|-------------|
| `NOT_FOUND` | Recurso no existe |
| `VALIDATION_ERROR` | Datos inválidos en la petición |
| `CONFLICT` | Estado conflicto (ej: doble marcación) |
| `UNAUTHORIZED` | Token inválido o expirado |
| `FORBIDDEN` | No tiene permisos |

---

## 1. Autenticación (global)

### POST /api/auth/login

Inicia sesión en el dashboard admin. Devuelve un JWT con expiración configurable.

**Request:**
```json
{
  "username": "jorge",
  "password": "••••••••"
}
```

**Response 200:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 28800,
  "usuario": {
    "id": 1,
    "username": "jorge",
    "rol": "admin"
  }
}
```

**Response 401:**
```json
{
  "error": "Credenciales inválidas",
  "code": "UNAUTHORIZED"
}
```

> `expires_in` en segundos (ej: 28800 = 8h). No existe endpoint de logout — el cliente descarta el token al cerrar sesión.

---

## 2. Regímenes de horario (admin)

Todas requieren `Authorization: Bearer <token>`.

### GET /api/horarios/regimenes

Lista todos los regímenes.

**Response 200:**
```json
[
  {
    "id": 1,
    "nombre": "Panadero diurno",
    "tipo": "fijo",
    "tolerancia_min": 15,
    "intervalo_minimo": 30,
    "hora_entrada": "08:00:00",
    "hora_salida": "17:00:00",
    "activo": true
  },
  {
    "id": 2,
    "nombre": "Medio tiempo",
    "tipo": "flexible",
    "tolerancia_min": 0,
    "intervalo_minimo": 30,
    "hora_entrada": null,
    "hora_salida": null,
    "activo": true
  }
]
```

### POST /api/horarios/regimenes

**Request:**
```json
{
  "nombre": "Panadero nocturno",
  "tipo": "fijo",
  "tolerancia_min": 10,
  "intervalo_minimo": 30,
  "hora_entrada": "22:00:00",
  "hora_salida": "06:00:00"
}
```

Para régimen flexible, omitir `hora_entrada` y `hora_salida` (o enviar null).

**Response 201:** Ídem GET con el registro creado (incluye `id`).

### GET /api/horarios/regimenes/:id

**Response 200:** El régimen individual. **404** si no existe.

### PUT /api/horarios/regimenes/:id

Mismos campos que POST. Solo se envían los campos a actualizar.

**Response 200:** El régimen actualizado. **404** si no existe.

### DELETE /api/horarios/regimenes/:id

**No borra físicamente.** Marca `activo = false`.

**Response 204** (sin contenido). **404** si no existe.

---

## 3. Empleados (admin)

Todas requieren `Authorization: Bearer <token>`.

### GET /api/horarios/empleados

Lista todos los empleados. Por defecto solo activos. Usar `?incluir_inactivos=true` para todos.

**Response 200:**
```json
[
  {
    "id": 1,
    "cedula": "1801234567",
    "nombre": "Carlos Pérez",
    "telefono": "0991234567",
    "cargo": "Panadero",
    "fecha_ingreso": "2026-06-01",
    "regimen_id": 1,
    "regimen_nombre": "Panadero diurno",
    "regimen_tipo": "fijo",
    "activo": true
  }
]
```

### POST /api/horarios/empleados

**Request:**
```json
{
  "cedula": "1801234567",
  "nombre": "Carlos Pérez",
  "telefono": "0991234567",
  "cargo": "Panadero",
  "fecha_ingreso": "2026-06-01",
  "regimen_id": 1
}
```

Mínimo requerido: `cedula`, `nombre`, `regimen_id`.

**Response 201:** El empleado creado.

**Validaciones:**
- Cédula: 10 dígitos, única en el sistema
- `regimen_id` debe existir y estar activo

### GET /api/horarios/empleados/:id

**Response 200:** El empleado individual. **404** si no existe.

### PUT /api/horarios/empleados/:id

**Response 200:** Empleado actualizado. **404** si no existe.

### DELETE /api/horarios/empleados/:id

**No borra físicamente.** Marca `activo = false`.

**Response 204.**

---

## 4. Marcaciones (público)

Sin autenticación — operan solo con cédula.

### POST /api/horarios/marcaciones

Registra una marcación de entrada o salida. Si no se envía `tipo`, el sistema lo determina automáticamente.

**Regla de auto-detección de tipo:**
- Sin marcaciones hoy → `entrada`
- Última fue `entrada` → `salida`
- Última fue `salida` → `entrada`

**Request:**
```json
{
  "cedula": "1801234567",
  "tipo": "entrada",
  "dispositivo": "celular-produccion",
  "confirmar": false
}
```

**Response 201:**
```json
{
  "id": 42,
  "empleado_id": 1,
  "empleado_nombre": "Carlos Pérez",
  "timestamp": "2026-07-01T08:05:00-05:00",
  "tipo": "entrada",
  "origen": "app"
}
```

**Errores:**
| Código HTTP | Code | Significado |
|-------------|------|-------------|
| 404 | `NOT_FOUND` | Cédula no existe o empleado inactivo |
| 409 | `SHORT_INTERVAL` | Intervalo mínimo no cumplido. Enviar `confirmar: true` |
| 422 | `VALIDATION_ERROR` | Cédula inválida o campos incorrectos |

**Error SHORT_INTERVAL:**
```json
{
  "error": "Ya existe un registro hace 5 minutos. ¿Confirma este nuevo registro?",
  "code": "SHORT_INTERVAL",
  "ultimo_registro": {
    "timestamp": "2026-07-01T08:05:00-05:00",
    "tipo": "entrada"
  }
}
```

### GET /api/horarios/marcaciones/hoy?cedula=1801234567

Marcaciones del día actual para ese empleado.

**Response 200:** Array de marcaciones. Vacío `[]` si no hay.

### GET /api/horarios/marcaciones?cedula=1801234567&desde=2026-06-30&hasta=2026-07-01

Marcaciones en rango de fechas. `desde` y `hasta` son opcionales.

---

## 5. Ajustes de marcaciones (admin — V2)

Requiere `Authorization: Bearer <token>`.

### PUT /api/horarios/marcaciones/:id

**Status:** ⏳ Pendiente de implementar

---

## 6. Reportes (admin)

Requieren `Authorization: Bearer <token>`.

### GET /api/horarios/reportes/diario?fecha=2026-07-01

**Response 200:**
```json
[
  {
    "empleado_id": 1,
    "nombre": "Carlos Pérez",
    "cedula": "1801234567",
    "regimen": "Panadero diurno",
    "fecha": "2026-07-01",
    "primera_entrada": "2026-07-01T08:05:00-05:00",
    "ultima_salida": "2026-07-01T17:02:00-05:00",
    "total_entradas": 1,
    "total_salidas": 1
  }
]
```

### GET /api/horarios/reportes/semanal?desde=YYYY-MM-DD&hasta=YYYY-MM-DD

Mismo formato que diario pero con datos agrupados por empleado y fecha en el rango.

---

## Resumen de endpoints

| Método | Ruta | Auth | MVP/V2 |
|--------|------|------|--------|
| POST | `/auth/login` | — | MVP |
| GET | `/horarios/regimenes` | Admin | MVP |
| POST | `/horarios/regimenes` | Admin | MVP |
| GET | `/horarios/regimenes/:id` | Admin | MVP |
| PUT | `/horarios/regimenes/:id` | Admin | MVP |
| DELETE | `/horarios/regimenes/:id` | Admin | MVP |
| GET | `/horarios/empleados` | Admin | MVP |
| POST | `/horarios/empleados` | Admin | MVP |
| GET | `/horarios/empleados/:id` | Admin | MVP |
| PUT | `/horarios/empleados/:id` | Admin | MVP |
| DELETE | `/horarios/empleados/:id` | Admin | MVP |
| POST | `/horarios/marcaciones` | — | MVP |
| GET | `/horarios/marcaciones/hoy` | — | MVP |
| GET | `/horarios/marcaciones` | — | MVP |
| PUT | `/horarios/marcaciones/:id` | Admin | V2 |
| GET | `/horarios/reportes/diario` | Admin | MVP |
| GET | `/horarios/reportes/semanal` | Admin | MVP |

---

*Documento vivo. Se actualiza al añadir endpoints en fases posteriores.*
