# Documentación — Módulo Horarios (app-dlanonna)

> Fuente de verdad: NAS (`/mnt/kingston/Desarrollos/app-dlanonna/docs/`)
> Última actualización: 2026-07-19

## Documentos

| Documento | Descripción | Estado |
|-----------|-------------|--------|
| [PRD.md](PRD.md) | Product Requirements Document — 14 user stories, MVP + V2 | ✅ Vigente |
| [api-contract.md](api-contract.md) | Contrato REST del módulo horarios (16 endpoints) | ✅ Vigente |
| [schema.sql](schema.sql) | Esquema PostgreSQL 16 (schemas `core` + `horarios`) | ✅ Generado desde BD real |

## Notas

- Este directorio es la fuente de verdad de la documentación. Cualquier cambio se hace aquí.
- El esquema SQL refleja exactamente la BD que corre en producción (dump del 2026-07-19).
- El API contract refleja las rutas reales del backend modular (`/api/horarios/*`).
- Para cambios en la documentación, editar los archivos y sincronizar con NAS.
