# PRD: App de Horarios — D'la Nonna

## Problem Statement

D'la Nonna es una panadería artesanal en Ambato, Ecuador. El control de horarios de los empleados se maneja actualmente de forma manual o inexistente. Jorge, el dueño, no tiene visibilidad de quién entra, quién sale, y si se cumplen los horarios asignados a cada empleado. Esto genera problemas de operación, costos imprevistos y falta de información para la toma de decisiones.

Jorge es ex-programador (creó Nexus ERP en VFP, 100K líneas) y quiere construir un sistema moderno, modular y evolutivo.

## Solution

Aplicación web para el control de marcaciones de entrada y salida de empleados. Corre sobre un celular viejo fijo en la zona de producción, conectado por WiFi local. Los empleados marcan ingresando su número de cédula. El sistema registra eventos puros (timestamp + empleado + tipo de marcación) y el control de cumplimiento se procesa de forma diferida contra los regímenes de cada empleado.

Arquitectura: backend en TypeScript/C#/Rust (tres implementaciones del mismo contrato) con PostgreSQL. Frontend web para marcación (pantalla táctil simple) y dashboard administrativo protegido por login. Despliegue inicial en el NAS de la panadería.

## User Stories

### MVP (imprecindible para funcionar)

1. Como empleado, quiero marcar entrada con mi cédula, para que quede registrada mi hora de llegada.

2. Como empleado, quiero marcar salida con mi cédula, para que quede registrada mi hora de salida.

3. Como empleado, quiero ver mis marcaciones del día en la pantalla después de marcar, para confirmar que se registraron correctamente.

4. Como empleado, quiero una interfaz táctil grande, simple, con teclado numérico, para marcar rápido sin confusiones ni necesidad de habilidades técnicas.

5. Como administrador, quiero registrar empleados con nombre, cédula y régimen asignado, para que puedan marcar.

6. Como administrador, quiero definir regímenes de horario (fijo y flexible), para adaptarme a distintos tipos de empleado.

7. Como administrador, quiero asignar un horario base a cada empleado con régimen fijo (ej: 08:00-17:00) y tolerancia configurable, para calcular cumplimiento.

8. Como administrador, quiero ver el reporte diario/semanal de marcaciones por empleado, para procesar la nómina y detectar atrasos o ausencias.

### V2 (post-MVP)

9. Como administrador, quiero recibir un email diario a las 18:00 con el resumen de marcaciones del día, y acceder a un dashboard semanal (revisión sabatina), para tomar decisiones correctivas sobre atrasos y ausencias.

10. Como administrador, quiero ajustar manualmente una marcación incorrecta (ej: olvido de marcar), para mantener los registros precisos. El ajuste queda registrado con auditoría (quién, cuándo, valor anterior, motivo).

11. Como administrador, quiero exportar los datos de marcaciones a CSV/Excel, para integrarlos con sistemas de nómina.

12. Como administrador, quiero que cada marcación tenga trazabilidad completa (quién, cuándo, qué cambió), para auditoría y resolución de disputas.

13. Como administrador, quiero poder ver el historial de marcaciones de cualquier empleado en un rango de fechas, para auditoría.

### A futuro

14. Como administrador, quiero manejar roles de usuario (admin / user), para separar permisos según el tipo de acceso.

## Implementation Decisions

- **Metodología:** SDD (Spec Driven Development). Primero la especificación, luego la implementación. Cada historia de usuario guía una iteración. El proyecto se implementará en 3 lenguajes (TypeScript, C#, Rust) como ejercicio de aprendizaje, manteniendo el mismo contrato API y modelo de datos.

- **Modelo de datos:** Marcaciones como eventos puros. Las correcciones no modifican la marcación original sino que crean un registro de ajuste vinculado (auditoría). Ver `docs/schema.sql`.

- **Regímenes de horario:**
  - *Fijo:* El empleado tiene un horario base (ej: 08:00-17:00). El sistema evalúa cumplimiento con tolerancia configurable.
  - *Flexible:* Sin horario base. Solo se registran horas trabajadas.

- **Roles de usuario:** Admin (tú y Maritza) con acceso a dashboard y gestión. Empleado (solo marca con cédula, sin login). User como plan a futuro.

- **Autenticación:** Login simple con username + password (hash) para el dashboard/admin. La pantalla de marcación no requiere autenticación — opera por cédula en entorno controlado.

- **Hardware:** Celular/tablet viejo fijo en la zona de producción, siempre cargando, conectado vía WiFi local al NAS.

- **Input:** Número de cédula (vía teclado numérico táctil). No se requiere credenciales complejas.

- **Frontend marcación:** HTML/CSS/JS plano, táctil, grande, simple. Sin framework.

- **Dashboard admin:** Interfaz web protegida por login, con reportes diarios/semanales y gestión de empleados.

- **Backend:** Tres implementaciones (TypeScript, C#, Rust) con el mismo contrato API REST + PostgreSQL.

- **Persistencia:** PostgreSQL almacena los registros definitivos. Las marcaciones pendientes de sincronización (si aplica) se manejan desde el frontend.

- **Evolución:** Este es el primer módulo de un sistema mayor. El diseño debe permitir añadir módulos de producción, ventas, recetas e insumos sin reescribir.

- **No migrar Nexus ERP:** Se construye desde cero para la panadería, adaptado a sus necesidades reales.

- **Arquitectura (nota):** La #18 original ("escalar a más módulos") se satisface con diseño desacoplado desde el inicio — no requiere una user story específica.

## Testing Decisions

- **Enfoque:** Probar comportamiento a través de la interfaz pública, no implementación interna. Los tests deben sobrevivir a refactors.

- **Seams de prueba:**
  1. *API REST de backend:* Probar endpoints contra PostgreSQL de prueba.
  2. *Frontend:* Probar el flujo de marcación completo simulando eventos de click/teclado en el DOM.
  3. *Lógica de control diferido:* Probar función que evalúa cumplimiento contra régimen.

- **Qué probar:**
  1. Flujo de marcación (entrada → salida → visualización)
  2. Cálculo de cumplimiento vs régimen fijo y flexible
  3. Reportes diarios y semanales
  4. Casos borde: marcación doble, día sin marcar, empleado no registrado, ajuste con auditoría

## Out of Scope

- Gestión de nómina completa (solo se exportan datos, no se calcula pago)
- Módulos de producción, ventas, recetas e insumos (futuras iteraciones)
- Aplicación móvil nativa
- Biometría (huella, facial)
- Integración con sistemas contables externos
- Multi-sucursal

## Further Notes

- **Inspiración:** Las lecciones del Nexus ERP (VFP) informan las decisiones — evitar diseño sobreingenierizado, priorizar lo que realmente se usa en el día a día de la panadería.
- **Filosofía:** Construir para hoy, diseñar para mañana. El módulo de horarios debe estar operativo rápido pero con suficiente calidad para que los módulos siguientes se construyan sobre la misma base.
- **Repositorio:** `\\NAS\Desarrollos\app-horarios` (en el NAS de la panadería, accesible por SMB)
- **Plan de implementación:** 3 sabores (TypeScript → C# → Rust), mismo contrato API. Ver `docs/plan.md`.
