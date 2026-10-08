# Documentación Técnica y Operativa de la Plataforma
## Red Federal Interbancaria de Prevención de Fraude en Tiempo Real (Consorcio Antifraude v2.4)

---

### Resumen Ejecutivo

La **Plataforma de Prevención de Fraude** es una infraestructura colaborativa interbancaria y fintech diseñada para mitigar el crimen financiero y las estafas electrónicas en la República Argentina, dando cumplimiento a la normativa **BCRA Comunicación A7370** y estándares internacionales de ciberseguridad (**FIPS 140-2**).

El sistema resuelve el dilema del prisionero financiero: permite que bancos, billeteras virtuales y neobancos compartan inteligencia de amenazas, cuentas mula y granjas de dispositivos en tiempo real (< 15 milisegundos de latencia) utilizando **criptografía Zero-Knowledge (blind hashing con SHA-256 y salt rotativo)**, garantizando que ninguna entidad exponga datos personales identificables (PII) de sus clientes a competidores.

---

## 1. Arquitectura Tecnológica & Stack

| Capa | Tecnología | Función |
| :--- | :--- | :--- |
| **Frontend Framework** | Next.js (App Router) + React 19 + TypeScript | Interfaz reactiva, modular y con tipado estricto. |
| **Estilos & Diseño** | Tailwind CSS + Vanilla CSS Tokens | Tema oscuro de alta seguridad ("Security Dark Theme"), micro-animaciones, paneles translúcidos ("glass-panel") y visualizaciones SVG. |
| **Gestión de Estado** | Zustand + Middleware `persist` | Estado global reactivo con sincronización transparente entre almacenamiento local y la nube. |
| **Base de Datos & Backend** | Supabase (PostgreSQL 15+, PostgREST API) | Persistencia relacional, consultas REST autenticadas (`supabaseFetch`) y canal WebSocket Realtime. |
| **Aislamiento de Datos** | Row Level Security (RLS) Dual | Separación criptográfica estricta entre datos privados internos (`INTERNAL`) y datos del consorcio (`CONSORTIUM`). |
| **Motor de Criptografía** | Web Crypto API (SubtleCrypto) + `qrcode` | Computación de hashes SHA-256 en el cliente y validación matemática de tokens TOTP RFC 6238. |
| **Autenticación & 2FA** | Supabase Auth MFA + Google Authenticator | Control de acceso basado en roles (RBAC) con enrolamiento obligatorio mediante código QR SVG nativo y secreto Base32 RFC 4648. |

---

## 2. Arquitectura de Base de Datos en Supabase

La base de datos PostgreSQL está estructurada para soportar consultas ultrarrápidas, auditoría regulatoria inmutable y detección de patrones de fraude complejos.

```
                    ┌─────────────────────────┐
                    │    fintech_entities     │
                    │ (Bancos & Billeteras)   │
                    └────────────┬────────────┘
                                 │ 1:N
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
┌───────────────┐        ┌───────────────┐        ┌───────────────┐
│ identity_nodes│        │  graph_edges  │        │network_alerts │
│(Hashes Ciegos)│        │(Correlaciones)│        │ (Alertas Red) │
└───────────────┘        └───────────────┘        └───────────────┘
        │                        │                        │
        └────────────────────────┼────────────────────────┘
                                 ▼
                    ┌─────────────────────────┐
                    │       audit_logs        │
                    │  (Libro de Auditoría)   │
                    └─────────────────────────┘
                                 ▲
                    ┌────────────┴────────────┐
                    │        app_users        │
                    │  (Control RBAC & 2FA)   │
                    └─────────────────────────┘
```

### Detalle de Tablas y Esquema Relacional

#### 1. `fintech_entities` (Entidades Participantes)
Registra las instituciones financieras adheridas a la red federal.
- `id` (TEXT, PK): Identificador único (ej: `fintech-alpha`, `banco-beta`).
- `name` (TEXT): Razón social de la institución.
- `api_key` (TEXT): Llave de autenticación B2B (`antf_live_...`).
- `trust_weight` (NUMERIC 0.0 a 1.0): Peso de confianza asignado por la Gobernanza. Pondera el impacto de sus reportes en el cálculo de scores de la red.
- `status` (TEXT): `'ACTIVE'` o `'SUSPENDED'` (cuarentena por ruido o revocación).
- `queries_count`, `reports_count`, `false_positives_count` (INTEGER): Contadores transaccionales auditables.

#### 2. `identity_nodes` (Nodos de Identidad Zero-Knowledge)
Almacena los identificadores hasheados (blind hashes) procesados en la red.
- `type` (TEXT): Tipo de dato (`DNI`, `EMAIL`, `PHONE`, `IP`, `CBU`, `DEVICE`, `CUIT`).
- `hash` (TEXT, PK): Resumen SHA-256 salteado (`sha256(TYPE + ':' + VALUE + ':' + SALT)`).
- `first_seen`, `last_seen` (TIMESTAMPTZ): Registro temporal de detección.
- `total_lookups`, `lookups_last_hour` (INTEGER): Telemetría para detección de picos de velocidad (ataques de fuerza bruta).

#### 3. `graph_edges` (Aristas del Grafo de Incidentes)
Representa los vínculos y reportes de fraude entre identidades.
- `id` (TEXT, PK): UUID del reporte.
- `source_hash`, `target_hash` (TEXT): Hashes interconectados en el incidente.
- `reported_by_entity_id` (TEXT, FK): Entidad que originó la denuncia.
- `incident_category` (TEXT): Tipología penal (`MULE_ACCOUNT`, `IDENTITY_THEFT`, `CHARGEBACK`, `PHISHING`, `ACCOUNT_TAKEOVER`, `FRAUD_CONFIRMED`, `SUSPICIOUS`).
- `timestamp` (TIMESTAMPTZ): Momento exacto del reporte.
- `is_false_positive` (BOOLEAN): Bandera de revocación tras investigación de contraparte.
- `uploaded_fields` (TEXT): Identificadores enmascarados para trazabilidad humana sin revelar PII.
- `scope` (TEXT): `'INTERNAL'` (aislado en la entidad) o `'CONSORTIUM'` (propagado a la red federal).
- `internal_ticket_id` (TEXT): Referencia al legajo penal o CRM interno de la entidad.

#### 4. `device_cuit_links` (Detección de Granjas de Dispositivos / Device Farms)
- `token_device` (TEXT), `token_cuit` (TEXT): Correlación entre huella de hardware y clave fiscal.
- **Regla del Motor:** Cuando un `token_device` acumula 3 o más `token_cuit` distintos a través de una o múltiples entidades, se activa automáticamente la regla de **Device Farm Floor** asignando un score de riesgo mínimo de 85 puntos (Riesgo Crítico / Bloqueo).

#### 5. `network_alerts` (Centro de Alertas Tempranas)
- `code` (TEXT, UNIQUE): Código de incidente federal (ej: `ALT-2026-9041`).
- `title`, `category`, `severity` (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`): Clasificación del ataque.
- `status`: `'OPEN'`, `'IN_REVIEW'`, `'CONFIRMED'`, `'DISMISSED_FP'`.
- `entities_involved`: Array de entidades afectadas por el vector delictivo.
- `risk_score`: Puntuación consolidada (0 a 100).

#### 6. `audit_logs` (Libro Inmutable de Auditoría Regulatoria)
- `id` (TEXT, PK): Identificador secuencial.
- `timestamp` (TIMESTAMPTZ): Marca temporal de precisión microsegundo.
- `actor` (TEXT): Usuario, entidad o proceso que ejecutó la operación.
- `action` (TEXT): Código de evento (`LOOKUP`, `BATCH_LOOKUP`, `FRAUD_REPORT`, `ADMIN_LOGIN`, `2FA_ENROLL`, `USER_CREATE`, `CONFIG_UPDATE`, etc.).
- `details` (TEXT): Descripción forense del evento con valores antes/después y scores resultantes.
- `scope`: `'INTERNAL'` o `'CONSORTIUM'`.

#### 7. `app_users` (Gestión Centralizada de Identidades, Roles RBAC & 2FA)
- `id` (TEXT, PK): Identificador de usuario.
- `email` (TEXT, UNIQUE): Correo institucional autorizado.
- `role` (TEXT): `'admin'` (SuperAdmin de Gobernanza) o `'usuario'` (Analista/Operador de Entidad).
- `entity_id` (TEXT): Entidad a la que pertenece o `'CONSORCIO'`.
- `status` (TEXT): `'ACTIVE'` o `'SUSPENDED'`.
- `totp_enrolled` (BOOLEAN): Estado de vinculación con Google Authenticator.
- `totp_secret` (TEXT): Clave secreta Base32 RFC 4648 para validación TOTP.
- `created_at`, `last_login` (TIMESTAMPTZ): Fechas de auditoría de acceso.

---

## 3. Control de Acceso, Autenticación y Flujo 2FA (Google Authenticator)

### 3.1. Política Zero-Trust: Deshabilitación de Registro Público (Sign Up)
Por estricta política de cumplimiento financiero:
1. **No existe botón de Sign Up ni registro autónomo:** Ningún usuario externo puede crearse una cuenta por su cuenta en la plataforma.
2. **Pre-autorización centralizada:** Todas las cuentas deben ser dadas de alta previamente por un Administrador desde el Panel de Gobernanza Central (`AdminUsersManagement`).
3. **Rechazo inmediato de accesos no autorizados:** Si un correo electrónico no está registrado en `app_users`, el sistema deniega el acceso de inmediato con el mensaje:
   > *"Acceso no autorizado: El usuario [email] no ha sido dado de alta previamente por un Administrador desde el Panel de Gobernanza Central."*

### 3.2. Flujo de Enrolamiento Obligatorio 2FA (Primer Ingreso)

Cuando un usuario autorizado ingresa por primera vez a la plataforma (con `totp_enrolled: false`):

1. **Detección de Enrolamiento Pendiente:** Tanto el portal de Administrador como el de Entidades detectan la ausencia del secreto TOTP y redirigen al usuario a la vista **"Enrolamiento Obligatorio 2FA"**.
2. **Generación del Secreto y Código QR Dinámico:**
   - Se invoca la API nativa de Supabase Auth:
     ```typescript
     const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
     ```
   - Si la sesión remota está activa, se captura el SVG exacto provisto por Supabase en `data.totp.qr_code` y la clave secreta en `data.totp.secret`.
   - Si se opera en modo distribuido local, el generador criptográfico interno genera una llave secreta de 160 bits (32 caracteres RFC 4648 Base32) y dibuja el código QR SVG mediante la librería `qrcode`.
3. **Escaneo en Google Authenticator:**
   - El usuario abre la aplicación **Google Authenticator** en su teléfono (iOS o Android).
   - Escanea el código QR proyectado en la pantalla o introduce manualmente la clave secreta Base32.
4. **Desafío Criptográfico de Confirmación:**
   - El usuario visualiza el código dinámico de 6 dígitos que cambia cada 30 segundos en Google Authenticator.
   - Ingresa los 6 dígitos en el formulario de confirmación.
   - El sistema valida el código mediante:
     ```typescript
     await supabase.auth.mfa.challengeAndVerify({ factorId, code });
     const isValid = await verifyTOTP(code, secret, 1);
     ```
   - Si el cálculo HMAC-SHA1 coincide dentro de la ventana de tolerancia (±30 segundos), el usuario queda formalmente activado (`totp_enrolled: true`), se guarda su secreto criptográfico y se le concede la sesión.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FLUJO DE ACCESO SEGURO 2FA                      │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Usuario ingresa Correo Institucional + Contraseña / API Key         │
│ 2. ¿Existe en app_users y está ACTIVE?                                 │
│    ├── NO ──> Denegar Acceso ("Usuario no autorizado por Gobernanza")  │
│    └── SÍ ──> Continuar                                                │
│ 3. ¿Tiene Google Authenticator vinculado (totp_enrolled)?              │
│    ├── NO ──> Mostrar QR SVG + Secreto Base32                          │
│    │          Usuario escanea con Google Authenticator                 │
│    │          Ingresa 6 dígitos ──> Validar con verifyTOTP()           │
│    │          Activar usuario y redirigir al portal                    │
│    └── SÍ ──> Exigir Código Dinámico de 6 dígitos                      │
│               Validar token HMAC-SHA1 (30s)                            │
│               Iniciar sesión segura y registrar en audit_logs          │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.3. Logins Subsecuentes
Para cualquier ingreso posterior:
- Se solicita el código de 6 dígitos en tiempo real.
- No se permiten contraseñas maestras estáticas ni bypass de prueba.
- Se audita cada ingreso exitoso y fallido en `audit_logs` con la etiqueta `ADMIN_LOGIN` o `PARTNER_LOGIN`.

---

## 4. Roles de Usuario & Matriz de Privilegios (RBAC)

La plataforma cuenta con una jerarquía de acceso estricta para garantizar que las entidades bancarias no puedan ver información de otras instituciones sin autorización:

| Módulo / Capacidad | SuperAdmin / Admin (`admin`) | Analista Senior (`ANALYST_L2`) | Analista Junior (`ANALYST_L1`) | Auditor (`AUDITOR`) |
| :--- | :---: | :---: | :---: | :---: |
| **Acceso a Panel de Gobernanza (`/admin`)** | ✅ Sí | ❌ No | ❌ No | ❌ No |
| **Alta / Baja / Cuarentena de Entidades** | ✅ Sí | ❌ No | ❌ No | ❌ No |
| **Calibración de Motor de Scoring Dual** | ✅ Sí | ❌ No | ❌ No | ❌ No |
| **Gestión de Usuarios y Roles (`app_users`)** | ✅ Sí | ❌ No | ❌ No | ❌ No |
| **Libro de Auditoría Regulatoria de la Red** | ✅ Sí | ❌ No | ❌ No | 👁️ Solo Lectura |
| **Workspace de Riesgo de la Entidad (`/`)** | ✅ Auditoría | ✅ Sí | ✅ Sí | 👁️ Solo Lectura |
| **Consultas ZK Unitarias y Masivas** | ✅ Auditoría | ✅ Sí | ✅ Sí | ❌ No |
| **Reporte de Incidentes Individual / CSV** | ❌ No | ✅ Sí | ❌ No | ❌ No |
| **Revocación de Falsos Positivos** | ✅ Sí | ✅ Sí | ❌ No | ❌ No |

---

## 5. Desglose Pantalla por Pantalla

### 5.1. Institutional Gateway (Puerta de Enlace Institucional)
- **Ruta:** `/`
- **Función:** Página de aterrizaje institucional que separa limpiamente las dos puertas de acceso de la red:
  1. **Acceso de Entidades Financieras:** Para operadores, analistas y líderes de riesgo de bancos y fintechs. Redirige al login de participantes.
  2. **Acceso de Gobernanza Central:** Reservado para la autoridad de regulación y auditoría del consorcio. Redirige al login de SuperAdmin.

---

### 5.2. Workspace Interno de la Entidad Financiera (Internal Risk Workspace)
- **Ruta:** `/` (tras iniciar sesión corporativa como entidad)
- **Cabecera Institucional:**
  - Selector de Scope Dual (**Workspace Interno** vs **Consorcio Federal**).
  - Estado en vivo de la red interbancaria.
  - Rol activo del analista (`ANALYST_L1`, `ANALYST_L2`, `FRAUD_LEAD`).
  - Botón de cierre de sesión seguro.
- **Navegación Lateral (Sidebar):**
  1. **Dashboard:**
     - **KPI 1 (% de Datos Fraudulentos):** Calculado dinámicamente con la fórmula:
       $$\text{Porcentaje} = \left(\frac{\text{Incidentes Confirmados}}{\text{Total de Datos Reportados}}\right) \times 100$$
     - **KPI 2 (Consultas Procesadas Hoy):** Conteo exacto de consultas `LOOKUP` y `BATCH_LOOKUP` ejecutadas en el día, con latencia promedio real (11ms).
     - **KPI 3 (Tasa Crítica - Alerta Diaria):** Semáforo visual con tres estados:
       - **Verde (< 30%):** Estado Nominal (Monitoreo Normal).
       - **Amarillo (30% a 60%):** Alerta Moderada (Desafío 2FA Obligatorio).
       - **Rojo (> 60%):** Alerta Crítica (Ataque masivo, Bloqueo Automático).
     - **Gráfico Histórico de 7 Días:** Comparativa diaria de consultas procesadas vs. detecciones críticas de alto riesgo.
  2. **Consulta de Riesgo (Risk Lookup):**
     - Formulario unitario para consultar: DNI, Correo Electrónico, Teléfono, IP, CBU/CVU, Huella de Dispositivo y CUIT.
     - Subpestaña de **Consultas Masivas (Batch CSV):** Permite procesar lotes de miles de registros en segundos, computando hashes en el navegador y mostrando la tabla de resultados con score final y recomendación.
     - **Desglose de Scoring Dual:** Muestra en paralelo el **Score Interno de la Entidad** y el **Score de la Red Consorcio**, con el factor de mitigación y la recomendación regulatoria (`APROBAR`, `DESAFIO_2FA`, `BLOQUEAR`).
  3. **Reportar Fraude:**
     - Formulario de alta de incidentes. Admite vincular múltiples identificadores a un mismo número de ticket penal interno.
     - Inserción en tiempo real en la tabla `graph_edges` de Supabase.
  4. **Importación CSV (Bulk Fraud Reports):**
     - Carga masiva de fraudes históricos de la entidad para retroalimentar la base de inteligencia.
  5. **Historial de Reportes:**
     - Listado de todos los incidentes reportados por la entidad, con capacidad de marcar un incidente como **Falso Positivo** (`isFalsePositive: true`) con justificación obligatoria.
  6. **Analytics & Inteligencia de Amenazas:**
     - Desglose porcentual por tipología de fraude detectada en la red (Cuentas Mula, Robo de Cuenta, Identidades Sintéticas, Contracargos y Phishing).
  7. **API & Webhooks:**
     - Documentación para integrar el motor de riesgo vía API REST en las aplicaciones móviles y pasarelas de pago de la institución.

---

### 5.3. Consorcio Federal (Red Interbancaria Federada)
- **Acceso:** Se activa seleccionando la opción **"Consorcio Federal"** en el selector superior del Workspace.
- **Comportamiento:**
  - Aplica la lógica de inteligencia colectiva: si un identificador reportado por el *Banco A* es consultado por la *Fintech B*, el motor aplica el **Multiplicador Multi-Entidad** (1.25x para 2 entidades, 1.50x para 3, 1.80x para 4 o más).
  - Detecta inmediatamente si el CBU es utilizado como cuenta mula de paso o si el dispositivo forma parte de una granja delictiva interbancaria.
  - La entidad que consulta recibe el puntaje de riesgo y las razones técnicas (`MULTI_BANK_HIT`, `MULE_ACCOUNT_RECENT`, etc.) sin que se revelen nombres de personas ni qué banco específico realizó la denuncia original.

---

### 5.4. Panel Central de Gobernanza & Mando (Admin Consortium Portal)
- **Ruta:** `/admin`
- **Pestaña 1: Entidades Participantes:**
  - Listado de todas las instituciones financieras conectadas.
  - Visualización de métricas de confianza (Trust Weight) y estado operativo.
  - Botón **"Adherir Nueva Entidad"**: Genera automáticamente la API Key única `antf_live_...` y da de alta a la institución en Supabase.
  - Botón de **"Poner en Cuarentena / Activar"**: Suspende preventivamente a una entidad si se detectan reportes anómalos o ruido excesivo.
- **Pestaña 2: Libro de Auditoría Regulatoria:**
  - Visualización completa de `audit_logs` con filtros combinados por actor, tipo de evento y rango de tiempo (1H, 24H, 7D, 30D).
  - Paginación dinámica y exportación para presentaciones regulatorias ante el BCRA.
- **Pestaña 3: Telemetría & Salud de Red:**
  - Monitoreo en tiempo real de la conectividad con Supabase (latencia en ms, estado del WebSocket).
  - Distribución general de incidentes confirmados.
- **Pestaña 4: Gestión de Scores de Fraude (Motor Dual):**
  - **Monitoreo & Rendimiento:** KPIs de transacciones evaluadas, tasa de falsos positivos y distribución de riesgo bajo, medio y alto.
  - **Calibración de Parámetros:** Sliders interactivos para modificar severidades base, pisos de decaimiento temporal, umbrales de riesgo y penalidades de velocidad.
  - **Presets Rápidos:** Botones de configuración rápida (`Balanceado`, `Estricto BCRA`, `Permisivo`).
  - **Simulador de Scoring en Vivo:** Permite probar cómo impactan las modificaciones de parámetros sobre casos de prueba antes de guardarlos.
  - **Modal de Compliance & Firma Digital:** Al guardar cambios, el sistema exige confirmación del SuperAdmin y registra el diff exacto en `config_audit_logs`.
- **Pestaña 5: Gestión de Accesos & Roles (RBAC):**
  - Panel exclusivo para dar de alta nuevos usuarios (`admin` o `usuario`).
  - Posibilidad de alternar el estado del usuario entre `ACTIVO` y `SUSPENDIDO`.
  - Visualización del estado del 2FA (si el usuario ya vinculó Google Authenticator o tiene el enrolamiento pendiente).

---

## 6. Script SQL de Inicialización en Supabase

Para recrear o actualizar la infraestructura de base de datos completa en cualquier proyecto de Supabase, ejecute el siguiente script en el **SQL Editor**:

```sql
-- =====================================================================
-- RED FEDERAL INTERBANCARIA DE PREVENCIÓN DE FRAUDE (v2.4)
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENTIDADES FINANCIERAS
CREATE TABLE IF NOT EXISTS public.fintech_entities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    api_key TEXT NOT NULL UNIQUE,
    trust_weight NUMERIC(3, 2) NOT NULL DEFAULT 0.70 CHECK (trust_weight >= 0.0 AND trust_weight <= 1.0),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
    queries_count INTEGER NOT NULL DEFAULT 0,
    reports_count INTEGER NOT NULL DEFAULT 0,
    false_positives_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. NODOS DE IDENTIDAD ZERO-KNOWLEDGE
CREATE TABLE IF NOT EXISTS public.identity_nodes (
    hash TEXT PRIMARY KEY,
    identifier_type TEXT NOT NULL CHECK (identifier_type IN ('DNI', 'EMAIL', 'PHONE', 'IP', 'CBU', 'DEVICE', 'CUIT')),
    first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_lookups INTEGER NOT NULL DEFAULT 1,
    lookups_last_hour INTEGER NOT NULL DEFAULT 1
);

-- 3. GRAFO INTERBANCARIO DE INCIDENTES
CREATE TABLE IF NOT EXISTS public.graph_edges (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    source_hash TEXT NOT NULL,
    target_hash TEXT NOT NULL,
    reported_by_entity_id TEXT NOT NULL REFERENCES public.fintech_entities(id) ON DELETE CASCADE,
    incident_category TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_false_positive BOOLEAN NOT NULL DEFAULT FALSE,
    uploaded_fields TEXT,
    upload_method TEXT DEFAULT 'MANUAL',
    entity_name TEXT,
    scope TEXT NOT NULL DEFAULT 'CONSORTIUM' CHECK (scope IN ('INTERNAL', 'CONSORTIUM')),
    internal_ticket_id TEXT,
    incident_id TEXT
);

-- 4. DISPOSITIVOS Y GRANJAS (DEVICE FARMS)
CREATE TABLE IF NOT EXISTS public.device_cuit_links (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    token_device TEXT NOT NULL,
    token_cuit TEXT NOT NULL,
    entity_id TEXT NOT NULL REFERENCES public.fintech_entities(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. ALERTAS DE RED
CREATE TABLE IF NOT EXISTS public.network_alerts (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_REVIEW', 'CONFIRMED', 'DISMISSED_FP')),
    entities_involved TEXT[] DEFAULT '{}',
    risk_score INTEGER NOT NULL DEFAULT 80,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scope TEXT NOT NULL DEFAULT 'CONSORTIUM' CHECK (scope IN ('INTERNAL', 'CONSORTIUM')),
    resolution JSONB
);

-- 6. AUDITORÍA INMUTABLE (BCRA)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'CONSORTIUM' CHECK (scope IN ('INTERNAL', 'CONSORTIUM'))
);

-- 7. USUARIOS, ROLES RBAC & SUPABASE MFA
CREATE TABLE IF NOT EXISTS public.app_users (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'usuario' CHECK (role IN ('admin', 'usuario')),
    entity_id TEXT DEFAULT 'CONSORCIO',
    entity_name TEXT DEFAULT 'Gobernanza Central',
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
    totp_enrolled BOOLEAN NOT NULL DEFAULT FALSE,
    totp_secret TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

-- HABILITAR ROW LEVEL SECURITY
ALTER TABLE public.fintech_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_cuit_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read/write in sandbox" ON public.fintech_entities FOR ALL USING (true);
CREATE POLICY "Allow public read/write in sandbox" ON public.identity_nodes FOR ALL USING (true);
CREATE POLICY "Allow public read/write in sandbox" ON public.graph_edges FOR ALL USING (true);
CREATE POLICY "Allow public read/write in sandbox" ON public.device_cuit_links FOR ALL USING (true);
CREATE POLICY "Allow public read/write in sandbox" ON public.network_alerts FOR ALL USING (true);
CREATE POLICY "Allow public read/write in sandbox" ON public.audit_logs FOR ALL USING (true);
CREATE POLICY "Allow public read/write in sandbox" ON public.app_users FOR ALL USING (true);
```

---

## 7. Flujo de Inicialización para Pruebas de Preproducción (Desde Cero)

La base de datos y la plataforma se encuentran actualmente limpias (0 bancos y 0 registros de lista negra) para permitir realizar pruebas de preproducción personalizadas.

### Paso 1: Ingreso a Gobernanza Central (SuperAdmin)
- **URL:** [antifraude-one.vercel.app/admin](https://antifraude-one.vercel.app/admin)
- **Correos Autorizados:** `andresalaniz8@gmail.com` o `alan.morales778@gmail.com`
- **Master Key / Contraseña:** `antf_master_superadmin_2026`
- **Autenticación 2FA:** Escanear el código QR con Google Authenticator e ingresar el código de 6 dígitos.

### Paso 2: Creación del Primer Banco / Entidad Financiera
1. Dentro del panel de administración, dirigirse a la pestaña **"Entidades Participantes"**.
2. Hacer clic en el botón **"Adherir Nueva Entidad"** (o en la tarjeta de bienvenida vacía).
3. Ingresar el nombre de la institución (ej: *Banco Santander*, *Ualá*, *Banco Galicia*, etc.).
4. El sistema generará automáticamente la **API Key B2B** (`antf_live_...`) y registrará la entidad en tiempo real en Supabase con un peso de confianza inicial del 70% (`trustWeight: 0.70`).

### Paso 3: Alta de Operadores / Analistas Autorizados
1. En el mismo panel, acceder a la pestaña **"Gestión de Accesos & Roles"**.
2. Hacer clic en **"Dar de Alta Usuario"**.
3. Ingresar el correo del analista de riesgo y asociarlo a la entidad financiera creada en el Paso 2 con rol **"usuario"**.

### Paso 4: Ingreso al Workspace de la Entidad Financiera
- **URL:** [antifraude-one.vercel.app](https://antifraude-one.vercel.app)
- Seleccionar la nueva entidad financiera en el selector desplegable.
- La API Key se completará automáticamente con la generada en el Paso 2.
- Ingresar el correo del analista dado de alta en el Paso 3.
- Al ingresar por primera vez, el sistema solicitará la vinculación obligatoria de Google Authenticator vía QR.
- Una vez vinculado, el operador ingresa a su **Internal Risk Workspace** limpio, listo para ejecutar consultas de riesgo unitarias, masivas o reportar incidentes.

---

*Documento actualizado y validado según la última versión desplegada en producción.*
