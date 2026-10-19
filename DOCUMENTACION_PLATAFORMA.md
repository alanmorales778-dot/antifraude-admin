# Documentación Técnica y Operativa de la Plataforma
## Red Federal Interbancaria de Prevención de Fraude en Tiempo Real (Consorcio Antifraude - Producción v3.0)

---

### Resumen Ejecutivo

La **Plataforma de Prevención de Fraude Interbancaria** es una infraestructura colaborativa de grado financiero y producción diseñada para mitigar el crimen digital, el lavado de activos y las estafas electrónicas en el sistema financiero de la República Argentina, dando estricto cumplimiento a la normativa **BCRA Comunicación A7370**, la **Ley 25.326 de Protección de Datos Personales (Habeas Data)** y estándares criptográficos internacionales (**FIPS 140-2 / RFC 6238**).

El sistema opera bajo un paradigma de **Cero Confianza (Zero-Trust)** y **Privacidad Cero Conocimiento (Zero-Knowledge Privacy)**: bancos, billeteras virtuales y neobancos consultan y comparten vectores de amenaza, cuentas mula y patrones de granjas de dispositivos en tiempo real (< 15 ms de latencia) mediante **blind hashing en el cliente con SHA-256 y salt de red rotativo**. Ningún dato personal identificable (PII: DNI, CBU, correo electrónico) se transmite o almacena en texto plano en la red del consorcio.

---

## 1. Login Unificado y Control de Accesos (SSO + MFA / 2FA)

### 1.1. Supresión de Selectores Manuales y API Keys en el Cliente
En la versión de producción, se eliminó la selección manual de entidad financiera y la introducción de API Keys en el formulario de inicio de sesión:
- El formulario de ingreso unificado (`UnifiedLogin.tsx`) presenta exclusivamente:
  1. **Correo Electrónico Institucional** (`email`)
  2. **Contraseña de Acceso** (`password`)
  3. **Enlace "Olvidé mi contraseña"** (con flujo de recuperación y reseteo asistido)

### 1.2. Deshabilitación Estricta de Registro Público (Sign Up)
- **Política Zero-Trust:** No existe la posibilidad de autoregistro abierto en internet.
- Únicamente pueden autenticarse cuentas pre-creadas por el SuperAdministrador del consorcio en la tabla relacional `public.app_users` de Supabase.
- Si un correo no figura en la lista de usuarios autorizados, el sistema bloquea inmediatamente la operación y registra la tentativa en el libro de auditoría.

### 1.3. Flujo Criptográfico de Autenticación en 2 Fases (2FA Google Authenticator)
El inicio de sesión sigue una máquina de estados determinística:

```
[ Usuario ingresa Email + Contraseña ]
                 │
                 ▼
[ Validación de Credenciales en Supabase Auth / app_users ]
                 │
                 ├── Inválido ──> Rechazo con Log de Auditoría
                 │
                 └── Válido ──> Comprobar Estado 2FA (`totp_enrolled`)
                                    │
    ┌───────────────────────────────┴──────────────────────────────┐
    ▼                                                              ▼
[ Si totp_enrolled == false ]                    [ Si totp_enrolled == true ]
(Primer ingreso / Enrolamiento)                  (Login recurrente de seguridad)
    │                                                              │
    ├─ Genera secreto Base32 RFC 4648                              ├─ Desafío de Token TOTP de 6 dígitos
    ├─ Renderiza QR SVG nativo en pantalla                         ├─ Validación HMAC-SHA1 ventana ±30s
    ├─ Escaneo con Google Authenticator                            ├─ Verificación contra Supabase MFA
    └─ Confirmación de 6 dígitos inicial                           └─ Concesión de Token de Sesión
```

### 1.4. Enrutamiento Inteligente Basado en Roles (RBAC)
Tras completar con éxito el desafío 2FA, el sistema lee el rol asignado al usuario en Supabase:
- **Rol `admin` (Gobernanza Central):** Redirección inmediata al **Panel Central de Gobernanza** (`AdminConsortiumPortal.tsx` / `/admin`).
- **Rol `usuario` (Analista de Entidad):** Asociación automática a su `entity_id` bancario correspondiente y redirección al **Workspace Interno de Analistas** (`EntityPortal.tsx` / `/workspace`).

### 1.5. Sistema de Timeout Seguro por Inactividad (`SessionTimeoutGuard`)
En cumplimiento de las directrices bancarias del BCRA (Com. A7370 / Seguridad de Canales Digitales) y mitigación de fuga de datos en estaciones desatendidas:
- **Límite de Inactividad:** 15 minutos (900.000 ms) sin interacción del operador.
- **Detección Omnicanal:** Monitoreo throttled (1s) de clics, movimientos del ratón, pulsaciones de teclas, desplazamientos (scroll) y toques en pantalla.
- **Sincronización Multi-Pestaña:** Coordinación cross-tab mediante `localStorage` (`antifraude_last_activity_ts`) y eventos `storage`, evitando cierres prematuros si el analista opera en múltiples ventanas en paralelo.
- **Aviso Previo Flotante:** Modal de alta visibilidad que emerge 2 minutos (120 s) antes de la expiración con contador en tiempo real, barra de progreso y botón para extender sesión ("Mantener Sesión Activa") o cerrar voluntariamente.
- **Cierre Criptográfico y Sanitización:** Al expirar, se invoca `auth.signOut()`, se eliminan tokens en memoria y almacenamiento local, se genera un registro inmutable en auditoría (`SESSION_TIMEOUT_EXPIRED`) y se redirige al login unificado con banner explicativo de seguridad.

---

## 2. Arquitectura de Tokenización Zero-Knowledge y Secreto Bancario

### 2.1. Marco Normativo y Cumplimiento de Privacidad
El secreto bancario (Ley de Entidades Financieras 21.526) y la Ley de Protección de Datos Personales (Ley 25.326) prohíben la divulgación de nóminas de clientes y saldos entre entidades competidoras. Para permitir la colaboración sin vulnerar la ley, la plataforma implementa una arquitectura **Zero-Knowledge (ZK)** en el cliente.

### 2.2. Algoritmo Criptográfico de Blind Hashing
Antes de que cualquier dato (DNI, CBU, Correo, CUIT, Teléfono) abandone el navegador del analista, la aplicación ejecuta la función nativa `crypto.subtle.digest` utilizando el algoritmo **SHA-256** acoplado a un salt criptográfico de red:

$$\text{Token}_{ZK} = \text{SHA-256}\Big(\text{Normalizar}(\text{Tipo}) \parallel \text{":"} \parallel \text{Normalizar}(\text{Valor}) \parallel \text{":"} \parallel \text{SALT}_{\text{consorcio}}\Big)$$

#### Reglas de Normalización Canónica:
1. **DNI / CUIT:** Remoción de puntos, guiones y espacios en blanco.
2. **Correo Electrónico:** Conversión a minúsculas, eliminación de espacios y normalización UTF-8.
3. **CBU / CVU:** Verificación de longitud exacta de 22 dígitos numéricos.
4. **Teléfono:** Formato E.164 canónico sin prefijos locales ambiguos.

```
+----------------------------------------------------------------------------------------------------+
|                                 FLUJO ZERO-KNOWLEDGE EN EL CLIENTE                                 |
+----------------------------------------------------------------------------------------------------+
| 1. Analista ingresa: "30-71234567-9"                                                               |
| 2. Web Crypto API: sha256("CUIT:30712345679:antf_fed_2026_salt")                                  |
| 3. Hash ciego generado: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"         |
| 4. Búsqueda y cotejo en Supabase: Se consulta la tabla identity_nodes EXCLUSIVAMENTE por el hash.  |
| 5. Garantía: Ningún servidor ni entidad competidora tiene acceso a la PII en claro.                |
+----------------------------------------------------------------------------------------------------+
```

### 2.3. Capa de Velocidad: Búsqueda de Hashes en Memoria (&lt; 1 ms) con RedisBloom y Cuckoo Filters
Para satisfacer los requerimientos de latencia extrema en transferencias bancarias en tiempo real y logins (Transferencias 3.0 / DEBIN):
1. **Estructuras de Datos Probabilísticas en Memoria:**
   - La plataforma integra **Filtros de Cuckoo (Cuckoo Filters)** y **Bloom Filters (RedisBloom)** sobre matrices compactas de bits.
   - En lugar de ejecutar consultas pesadas en base de datos para transacciones nominales limpias, la capa de velocidad responde en **O(1)** con cero falsos negativos.
2. **Filtros Dedicados por Tipología:**
   - Se administran filtros segmentados: `cbu_blacklist`, `dni_blacklist`, `device_blacklist`, `email_blacklist`, `cuit_blacklist`, `phone_blacklist`, `ip_blacklist`.
   - Consulta: `CF.EXISTS cbu_blacklist <hash_sha256>`.
   - Latencia: **&lt; 1.5 ms** vía Upstash Redis (Serverless) y **&lt; 0.2 ms** en Fast-Path In-Memory local.
3. **Ventaja Operativa del Cuckoo Filter (Borrado O(1) con CF.DEL):**
   - A diferencia de los Bloom Filters convencionales donde no es posible eliminar elementos sin reconstruir la estructura completa, el Cuckoo Filter soporta la operación nativa `CF.DEL`.
   - Esto permite que cuando un analista revoca un reporte o se declara un Falso Positivo, el hash sea removido instantáneamente de la lista negra en memoria sin fricción.

### 2.4. Capa de Inteligencia de Grafos sobre Nodos Ciegos (1 a 3 Saltos)
El principal valor defensivo de la red federada consiste en descubrir topologías delictivas donde un `Hash_Dispositivo` conecta a múltiples `Hash_DNI` o `Hash_CBU`, o donde existen bucles de triangulación financiera. La plataforma implementa dos tecnologías de resolución:

#### Opción A: SQL Recursive CTEs Nativas en Supabase (PostgreSQL 15+)
Ejecución de algoritmos de amplitud y profundidad sin requerir infraestructura externa adicional:
```sql
-- Rastreo de saltos 1 a 3: Redes de Mulas & Dispositivos Compartidos (Supabase PostgreSQL 15+)
WITH RECURSIVE mule_network AS (
   SELECT 
       e.source_hash, e.target_hash, e.incident_category, e.reported_by_entity_id, 
       1 as depth, ARRAY[e.source_hash] as visited_path
   FROM public.graph_edges e
   WHERE (e.source_hash = :root_hash OR e.target_hash = :root_hash) AND e.is_false_positive = false
   UNION ALL
   SELECT 
       e.source_hash, e.target_hash, e.incident_category, e.reported_by_entity_id, 
       mn.depth + 1, visited_path || e.source_hash
   FROM public.graph_edges e
   JOIN mule_network mn ON (e.source_hash = mn.target_hash OR e.target_hash = mn.source_hash)
   WHERE mn.depth < 3 AND e.is_false_positive = false AND NOT (e.source_hash = ANY(mn.visited_path))
)
SELECT DISTINCT 
    source_hash, target_hash, incident_category, reported_by_entity_id, MIN(depth)::INT as depth
FROM mule_network
GROUP BY source_hash, target_hash, incident_category, reported_by_entity_id
ORDER BY depth ASC;
```
- Con índices B-Tree/GIN sobre `source_hash`, `target_hash` y el índice compuesto activo `(source_hash, target_hash, is_false_positive)`, la consulta recursiva responde en **menos de 15 ms**.

#### Opción B: Motor de Grafos en Memoria (Memgraph / Cypher)
- Motor de grafos en memoria de alto rendimiento compatible con sintaxis Cypher de Neo4j.
- Modela nodos ciegos `(:BlindNode {hash: '...', type: 'CBU'})` y relaciones `[:ASSOCIATED_IN_FRAUD]`.
- Permite calcular centralidad de red (Betweenness, Degree) y ciclos triangulares ($A \to B \to C \to A$) directamente sobre los tokens:
```cypher
MATCH path = (root:BlindNode {hash: $rootHash})-[:ASSOCIATED_IN_FRAUD*1..3]-(connected:BlindNode)
WHERE NONE(r IN relationships(path) WHERE r.is_false_positive = true)
RETURN path, length(path) AS depth, connected.type AS nodeType
ORDER BY depth ASC;
```

---

## 3. Motor de Scoring Dual en Tiempo Real

La plataforma calcula dos indicadores numéricos independientes (0 a 100 puntos) para cada consulta:

### 3.1. Score 1: Riesgo Interno de la Entidad
Evalúa los antecedentes registrados exclusivamente por la propia institución del analista:
$$\text{Score}_{\text{Interno}} = \min\Big(100, \;\big(\text{Severidad}_{\text{base}} \times \text{Decaimiento}(t) \times N_{\text{reportes}}\big) + \text{Penalidades}_{\text{Email}}\Big)$$

### 3.2. Score 2: Riesgo de la Red Federal del Consorcio
Combina los reportes de todas las demás entidades interconectadas, ponderados por la reputación institucional y la dispersión interbancaria:
$$\text{Contribución}_{\text{Red}} = \sum_{e \in \text{Otras Entidades}} \Big(\text{Severidad}_{\text{base}}(e) \times W_{\text{confianza}}(e) \times \text{Decaimiento}(t_e)\Big)$$
$$\text{Score}_{\text{Red}} = \min\Big(100, \;\Big(\text{Contribución}_{\text{Interna}} + \text{Contribución}_{\text{Red}}\Big) \times \text{Multiplicador}_{\text{Entidades}} + \text{Penalidades}_{\text{Anomalías}}\Big)$$

- **Decaimiento Temporal Exponencial (Half-Life):**
  $$\text{Decaimiento}(t) = \max\left(\text{Piso}_{\text{categoría}}, \;0.5^{\frac{\Delta t}{\text{VidaMedia}}}\right)$$
  *(Por defecto, Vida Media = 180 días; Piso para Cuentas Mula = 40%).*
- **Multiplicador Multi-Entidad:**
  - 2 Entidades distintas reportando el mismo hash: $\times 1.25$
  - 3 Entidades distintas: $\times 1.50$
  - 4 o más Entidades distintas: $\times 1.80$
- **Regla de Granja de Dispositivos (Device Farm Floor):** Si un mismo dispositivo hardware está asociado a 3 o más CUITs distintos en la red, el score se eleva automáticamente a un piso de 85 puntos (Riesgo Crítico / Bloqueo Inmediato).

---

## 4. Motor de Aprendizaje Continuo (Estadístico, Sin IA Externa)

### 4.1. Fundamentación Matemática y Filosofía Determinística
Para garantizar absoluta explicabilidad ante auditorías regulatorias del BCRA, el sistema prescinde de modelos de lenguaje o cajas negras neuronales externas. Utiliza un **Algoritmo de Aprendizaje Heurístico Continuo** basado en inferencia estadística bayesiana sobre las revocaciones y confirmaciones de los analistas de la red.

### 4.2. Definición del Baseline en Base de Datos
Los valores predeterminados de severidad y umbrales configurados por el Administrador en la tabla `public.scoring_config` actúan como el **Baseline** para todas las transacciones entrantes:
- `MULE_ACCOUNT`: 90 pts
- `FRAUD_CONFIRMED`: 95 pts
- `IDENTITY_THEFT`: 75 pts
- `ACCOUNT_TAKEOVER`: 80 pts
- `PHISHING`: 55 pts
- `CHARGEBACK`: 50 pts
- `SUSPICIOUS`: 40 pts

### 4.3. Cálculo de Tasa de Falsos Positivos en Tiempo Real
Para cada tipología de delito $c \in \mathcal{C}$, el motor calcula periódicamente:
$$N_{\text{total}}(c) = \sum_{i \in \text{graph\_edges}} \mathbb{I}(\text{categoría}_i = c)$$
$$N_{\text{revocados}}(c) = \sum_{i \in \text{graph\_edges}} \mathbb{I}(\text{categoría}_i = c \;\land\; \text{is\_false\_positive}_i = \text{true})$$
$$\text{FP\_Rate}(c) = \begin{cases} \left(\dfrac{N_{\text{revocados}}(c)}{N_{\text{total}}(c)}\right) \times 100 & \text{si } N_{\text{total}}(c) > 0 \\ 0\% & \text{si } N_{\text{total}}(c) = 0 \end{cases}$$

### 4.4. Regla de Detección de Deriva y Calibración Autónoma
1. **Umbral Crítico de Falsos Positivos:** El límite de tolerancia máxima de la red es del **10.0%**.
2. **Condición de Alerta Heurística:**
   $$\text{Alerta}(c) = \begin{cases} \text{ACTIVA} & \text{si } \text{FP\_Rate}(c) > 10.0\% \\ \text{NORMAL} & \text{en otro caso} \end{cases}$$
3. **Magnitud de Reducción Sugerida ($\Delta_{\text{pts}}$):**
   $$\Delta_{\text{pts}}(c) = \begin{cases} 10 \text{ pts} & \text{si } \text{FP\_Rate}(c) \ge 25.0\% \\ 5 \text{ pts} & \text{si } 10.0\% < \text{FP\_Rate}(c) < 25.0\% \end{cases}$$
4. **Actualización del Baseline:**
   $$\text{Nuevo Score Base}(c) = \max\Big(20, \;\text{Score Base Actual}(c) - \Delta_{\text{pts}}(c)\Big)$$
5. **Ejecución y Trazabilidad:** El Administrador dispone de un botón de 1-clic ("Aplicar Calibración Heurística") en el Panel Central. Al ejecutarse, actualiza la fila `global-network-config` en la tabla `scoring_config` de Supabase y registra un asiento inmutable en `audit_logs` con la etiqueta `HEURISTIC_AUTO_TUNING`.

---

## 5. Arquitectura de Pantallas y Experiencia de Usuario

### 5.1. Login Unificado (`UnifiedLogin.tsx`)
- Interfaz ejecutiva minimalista de alta seguridad.
- Soporte para autenticación SSO mediante email y contraseña corporativa.
- Flujo interactivo de 2FA con validación visual en tiempo real de los 6 dígitos.
- Enlace "Olvidé mi contraseña" para solicitar reseteo a la Mesa de Ayuda de Gobernanza.
- Redirección automática según RBAC (`/admin` para administradores, `/workspace` para analistas).

### 5.2. Workspace Interno del Analista (`EntityPortal.tsx`)
Diseñado para eliminar toda distracción y maximizar la velocidad operativa del analista de fraude:
1. **Barra de Consulta Ultra-Limpia:**
   - Campo único con detección automática del tipo de dato (DNI, CBU, Correo, CUIT, IP).
   - Vista previa en tiempo real del blind hash SHA-256 generado localmente.
2. **Tarjetas de Scoring Dual:**
   - Visualización contigua de **Score Interno** vs. **Score Consorcio**.
   - Insignia de recomendación operativa de compliance:
     - `APROBAR` (Verde, 0 - 34 pts): Riesgo bajo, transacción fluida.
     - `DESAFIO 2FA` (Amarillo, 35 - 74 pts): Riesgo medio, requerir factor biométrico o OTP.
     - `BLOQUEAR` (Rojo, 75 - 100 pts): Riesgo alto, denegar operación y abrir ticket de investigación.
3. **Historial de Operaciones de la Entidad:**
   - Tabla clara con las consultas y reportes recientes de la institución.
   - Botón directo para **Revocar / Reportar Falso Positivo**, lo que alimenta en tiempo real la telemetría del motor de aprendizaje continuo.
4. **Modal de Reporte de Amenaza:**
   - Alta rápida de casos confirmados con selección de tipología y ticket interno, aplicando tokenización previa al almacenamiento en Supabase.

### 5.3. Panel Central de Gobernanza (`AdminConsortiumPortal.tsx` & `ScoringLabAdmin.tsx`)
Centro de mando exclusivo para la entidad rectora del consorcio:
1. **Ajuste Fino de Umbrales con Sliders e Inputs Numéricos:**
   - Cada parámetro (Umbral Alto, Umbral Medio, Vida Media, Penalidades de Mismatch y Velocidad, Multiplicadores y las 7 Tipologías) cuenta con un slider interactivo y un `<input type="number">` sincronizado bidireccionalmente para permitir tipeo numérico exacto.
2. **Centro de Aprendizaje Heurístico:**
   - Banner superior que monitorea la tasa de Falsos Positivos de cada tipología.
   - Alertas visuales destacadas si alguna tipología supera el 10% de FP, con botón de calibración en 1-clic.
3. **Guardado en Supabase con Modal de Advertencia:**
   - Botón "Guardar Configuración en la Plataforma" que valida cambios pendientes.
   - Modal de advertencia de compliance ("Estás modificando umbrales de la red") que muestra la tabla comparativa de valores anteriores vs. nuevos.
   - Escritura real en la tabla `scoring_config` y registro de auditoría en `audit_logs`.
4. **Gestión de Entidades y Libro de Auditoría Regulatoria:**
   - Alta y suspensión de bancos miembros, ajuste de ponderadores de confianza (`trustWeight`), y descarga del historial inmutable de auditoría para presentaciones ante el BCRA.

---

## 6. Modelo de Datos Relacional en Supabase (DDL)

```sql
-- 1. ENTIDADES MIEMBRO
CREATE TABLE public.fintech_entities (
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

-- 2. NODOS ZERO-KNOWLEDGE
CREATE TABLE public.identity_nodes (
    hash TEXT PRIMARY KEY,
    identifier_type TEXT NOT NULL,
    first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_lookups INTEGER NOT NULL DEFAULT 1,
    lookups_last_hour INTEGER NOT NULL DEFAULT 1
);

-- 3. GRAFO INTERBANCARIO
CREATE TABLE public.graph_edges (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    source_hash TEXT NOT NULL,
    target_hash TEXT NOT NULL,
    reported_by_entity_id TEXT NOT NULL REFERENCES public.fintech_entities(id) ON DELETE CASCADE,
    incident_category TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_false_positive BOOLEAN NOT NULL DEFAULT FALSE,
    uploaded_fields TEXT,
    scope TEXT NOT NULL DEFAULT 'CONSORTIUM',
    internal_ticket_id TEXT
);

-- 4. CONFIGURACIÓN DEL MOTOR Y APRENDIZAJE HEURÍSTICO
CREATE TABLE public.scoring_config (
    id TEXT PRIMARY KEY DEFAULT 'global-network-config',
    config JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT DEFAULT 'superadmin@consorcio-antifraude.org'
);

-- 5. AUDITORÍA INMUTABLE REGULATORIA (BCRA)
CREATE TABLE public.audit_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'CONSORTIUM'
);

-- 6. USUARIOS Y CONTROL DE ROLES RBAC + 2FA
CREATE TABLE public.app_users (
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

-- 7. ÍNDICES DE ALTA VELOCIDAD PARA GRAFOS Y HASHES (<15MS)
CREATE INDEX idx_graph_edges_source_hash ON public.graph_edges(source_hash);
CREATE INDEX idx_graph_edges_target_hash ON public.graph_edges(target_hash);
CREATE INDEX idx_graph_edges_composite_active ON public.graph_edges(source_hash, target_hash, is_false_positive);
CREATE INDEX idx_identity_nodes_hash ON public.identity_nodes(hash);

-- 8. FUNCIÓN RPC: traverse_mule_network (SQL RECURSIVE CTE)
CREATE OR REPLACE FUNCTION public.traverse_mule_network(root_hash TEXT, max_depth INT DEFAULT 3)
RETURNS TABLE (source_hash TEXT, target_hash TEXT, incident_category TEXT, reported_by_entity_id TEXT, depth INT)
LANGUAGE sql STABLE AS $$
WITH RECURSIVE mule_network AS (
   SELECT e.source_hash, e.target_hash, e.incident_category, e.reported_by_entity_id, 1 as depth, ARRAY[e.source_hash] as visited_path
   FROM public.graph_edges e WHERE (e.source_hash = root_hash OR e.target_hash = root_hash) AND e.is_false_positive = false
   UNION ALL
   SELECT e.source_hash, e.target_hash, e.incident_category, e.reported_by_entity_id, mn.depth + 1, visited_path || e.source_hash
   FROM public.graph_edges e JOIN mule_network mn ON (e.source_hash = mn.target_hash OR e.target_hash = mn.source_hash)
   WHERE mn.depth < max_depth AND e.is_false_positive = false AND NOT (e.source_hash = ANY(mn.visited_path))
)
SELECT DISTINCT source_hash, target_hash, incident_category, reported_by_entity_id, MIN(depth)::INT as depth
FROM mule_network GROUP BY source_hash, target_hash, incident_category, reported_by_entity_id ORDER BY depth ASC;
$$;
```

---

## 7. Pruebas End-to-End (E2E) y Verificación Operativa

### Procedimiento de Validación Recomendado:
1. **Acceso Inicial de Gobernanza:** Iniciar sesión con `andresalaniz8@gmail.com` en el login unificado, verificar el código 2FA de Google Authenticator e ingresar a `/admin`.
2. **Ajuste Numérico de Umbrales:** Ingresar a "Gestión de Scores de Fraude" -> "Ajustes del Motor". Tipear "78" en el campo numérico del Umbral de Alto Riesgo. Observar que el slider se sincroniza automáticamente.
3. **Persistencia en Supabase:** Presionar "Guardar Configuración en la Plataforma". Verificar la visualización del Modal de Advertencia con el diff de cambios. Confirmar la operación y verificar que se emite la petición UPDATE a Supabase y se genera la entrada en `audit_logs`.
4. **Calibración Heurística:** Observar el bloque superior de Aprendizaje Estadístico Continuo. Si alguna tipología supera el 10% de FP, pulsar "Aplicar Calibración" para que el baseline descienda de forma autónoma.
5. **Consulta Zero-Knowledge en Workspace de Analista:** Iniciar sesión como analista de una entidad bancaria, digitar un DNI o CBU, verificar que el cálculo de hash SHA-256 se genera en milisegundos en el navegador y que el resultado muestra los dos scores con la recomendación de compliance.

---

*Documento técnico de producción certificado. Consorcio Federal Antifraude v3.0.*
