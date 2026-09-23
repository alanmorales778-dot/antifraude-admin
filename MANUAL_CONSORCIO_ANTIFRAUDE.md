# Documento Técnico Exhaustivo: Consorcio Antifraude B2B en Tiempo Real
## Threat Intelligence Network para Bancos y Fintechs de Argentina

---

### 1. Resumen Ejecutivo
El **Consorcio Antifraude en Tiempo Real** es una plataforma B2B de inteligencia de amenazas e intercambio colaborativo de riesgos diseñada para interconectar a las principales billeteras virtuales, fintechs y bancos de la República Argentina (Mercado Pago, Ualá, Banco Galicia, Santander, Lemon Cash, Belo, Naranja X, Personal Pay, Brubank, MODO, entre otras).

El principio rector del sistema es la **Privacidad Absoluta (Zero-Knowledge)**: ninguna entidad financiera comparte datos personales identificables (PII) en texto plano. Todo dato ingresado es normalizado y convertido en un **Hash Ciego irreversible (SHA-256 + Salt secreta)** antes de cruzar los límites del sistema.

---

### 2. Acceso a la Plataforma en Local
El servidor se encuentra compilado y corriendo activamente:
- **URL de Acceso Web:** [http://localhost:3000](http://localhost:3000)
- **Red Local:** http://192.168.0.7:3000
- **Especificación OpenAPI 3.0.3 (Swagger):** [http://localhost:3000/api/v1/openapi.json](http://localhost:3000/api/v1/openapi.json)

---

### 3. Arquitectura y Tecnologías Implementadas

| Capa | Tecnología | Características Principales |
| :--- | :--- | :--- |
| **Frontend & UI** | Next.js 16 + React 19 + Tailwind CSS + Lucide Icons | Selector interactivo de 4 paletas Silicon Valley (Cyber Emerald, Luxury Gold, Crimson Protocol, Deep Indigo), glassmorphism, micro-animaciones y badges en tiempo real. |
| **Backend API** | Next.js Edge/Serverless Route Handlers en TypeScript | Respuestas ultrarrápidas con SLA P99 < 50 milisegundos. |
| **Caché & Velocidad** | Motor de Caché en Memoria / Clúster Redis Simulado | Latencias de respuesta en caché de 1ms a 14ms con TTL y rate-limiting por clave de API. |
| **Seguridad Criptográfica** | Web Crypto API / Node.js Crypto (`crypto.subtle`) | Algoritmo de Hashing Ciego SHA-256 con Salt global y firmas de atestación Ed25519. |
| **Persistencia** | Repositorio Reactivo en Memoria + Schema Supabase SQL | Archivo `supabase/schema.sql` con Row Level Security (RLS) e índices de alta velocidad. |
| **Documentación** | OpenAPI 3.0.3 / Swagger UI integrado | Sandbox interactivo para probar peticiones directamente en el dashboard. |

---

### 3.1. Sistema Dinámico de Paletas de Colores (Silicon Valley Palettes)
El sistema incluye un **Selector en Vivo de Paletas** en la barra superior (Navbar) que transforma el esquema cromático de toda la plataforma en tiempo real con un solo clic:
1. 🟢 **Cyber Emerald (Neón Ciberseguridad / Stripe Radar) [Predeterminado]:** Fondo obsidiana profundo (`#04070d`) con acentos verde menta neón (`#00f59b`) y cian láser. Máximo contraste y vibra ciberseguridad.
2. 🟡 **Luxury Gold & Titanium (Mercury / Brex Private Wealth):** Fondo grafito titanio (`#08080a`) con acentos oro champán (`#f59e0b`, `#fbbf24`) y resplandor ámbar. Estética fintech VIP / banca privada.
3. 🔴 **Crimson Defense Protocol (CrowdStrike / War Room Ciberdefensa):** Fondo titanio carmesí (`#090609`) con acentos rojo eléctrico / coral (`#f43f5e`, `#fb923c`).
4. 🔵 **Electric Indigo / Deep Tech (Linear / Palantir Deep Navy):** Fondo azul noche espacial (`#070a14`) con gradientes violeta e índigo (`#6366f1`).

---

### 4. Seguridad de Datos y Protocolo de Hashing Ciego (Zero-Knowledge)

```
[Dato en Crudo: "estafador.red@gmail.com"]
                     │
                     ▼
[1. Normalización Canónica: trim() + toLowerCase()]
                     │
                     ▼
[2. Inyección de Salt Secreta Consorcio: "EMAIL:estafador.red@gmail.com:ARG_SALT_..."]
                     │
                     ▼
[3. Función Resumen Criptográfica SHA-256]
                     │
                     ▼
[4. Blind Hash Irreversible de 64 Caracteres Hexadecimales]
"a8f5c382910fae749281c7e18928374651928374651928374651928374651928"
```

1. **Normalización Canónica de Datos:**
   - **EMAIL:** Conversión a minúsculas y eliminación estricta de espacios en blanco.
   - **DNI / CUIT / CUIL:** Supresión de puntos, guiones y espacios (ej. `20-41882991-3` → `20418829913`).
   - **TELÉFONO:** Supresión de caracteres no numéricos y unificación de prefijo internacional.
   - **TARJETA (CARD_BIN):** Almacenamiento seguro del BIN (primeros 6) y últimos 4 dígitos.
2. **Mitigación de Tablas Arcoíris (Rainbow Tables):** La concatenación con una salt secreta de alta entropía (`CONSORTIUM_SALT`) impide que atacantes externos utilicen diccionarios precomputados para revertir los hashes.
3. **Firma Criptográfica de Atestación (Proof of Attestation):** Cada diagnóstico emitido contiene una firma HMAC-SHA256 inalterable que prueba ante auditorías que la consulta fue validada por el consorcio en ese instante exacto.

---

### 5. Catálogo de Módulos y Funcionalidades del Dashboard

#### Módulo 1: Acceso y Autenticación con Simulación de 2FA
- **Selector de Entidad Financiera:** Permite alternar la perspectiva operativa entre 10 bancos y billeteras (Mercado Pago, Ualá, Banco Galicia, Santander, Lemon Cash, etc.).
- **Paso 2 de Verificación en Dos Pasos (2FA):** 
  - Simula una aplicación autenticadora TOTP (Google Authenticator / Authy / Llave física).
  - Cuenta regresiva de renovación de token de 30 segundos.
  - Botón de 1-clic: *"Copiar código demo: 123456"*.
  - Indicador de canal mTLS seguro en la barra superior del dashboard.

#### Módulo 2: Panel Ejecutivo (Métricas y KPIs en Tiempo Real)
- **4 Tarjetas de Indicadores Clave:**
  - *Fraudes Evitados en el Mes:* Contador con evolución porcentual (+18.4%).
  - *Consultas Procesadas Hoy:* Monitoreo de tráfico en vivo (98.6 consultas/segundo).
  - *Tasa de Alertas Críticas:* Porcentaje de incidentes con recomendación de bloqueo automático.
  - *Dinero Estimado Ahorrado:* Cálculo de impacto económico en Pesos Argentinos (+$842.500.000 ARS) y Dólares Estadounidenses (+$720.000 USD).
- **Gráfico de Evolución Diaria (SVG Interactivo):** Comparativa de los últimos 7 días entre Consultas Totales y Alertas de Fraude Confirmado con tooltips al pasar el cursor.
- **Medidor de Latencia en el Borde (Edge SLA < 50ms):**
  - P50 (Mediana): 6 ms
  - P90: 11 ms
  - P99 (Peor caso): 14 ms
- **Red de Nodos Activos en Argentina:** Cuadrícula con el estado de conectividad, ping y Trust Score de las 10 entidades participantes.

#### Módulo 3: Buscador Manual de Riesgo (Consulta Individual Ciega)
- **Pestañas por Tipo:** Email, DNI/CUIT, Teléfono Móvil y Tarjeta BIN.
- **Visualizador de Hashing Ciego en Vivo:** Muestra de forma didáctica e interactiva el dato normalizado, la salt del consorcio y el hash SHA-256 de 64 caracteres.
- **Velocímetro / Medidor de Riesgo (0 a 100):**
  - *BAJO (0-34):* Recomendación de **APROBAR OPERACIÓN**.
  - *MEDIO (35-74):* Recomendación de **EXIGIR DESAFÍO 2FA / BIOMETRÍA**.
  - *ALTO (75-100):* Recomendación de **BLOQUEO INMEDIATO**.
- **Coincidencia Multientidad:** Indica en cuántas entidades financieras independientes apareció el identificador (ej. *"Detectado en 5 entidades independientes"*).
- **Acciones Directas:**
  - Botón *"Reportar Fraude Confirmado"* (abre modal para registrar nuevo incidente).
  - Botón *"Marcar Falso Positivo"* (dispara rehabilitación inmediata reduciendo el score).
  - Botón *"Descargar Certificado Criptográfico"* (descarga JSON oficial con la firma de red).
- **Botones de Prueba Rápida (Presets):** Acceso con 1 solo clic a casos reales precargados.

#### Módulo 4: Centro de Carga y Consulta Masiva (Batch Processing Engine)
- **Doble Modalidad Operativa:**
  - *Modo A: Evaluación Masiva de Riesgo:* Permite subir una lista de hasta 500 clientes/transacciones para obtener su matriz de scores comunitarios.
  - *Modo B: Ingesta Masiva de Fraudes Confirmados:* Permite cargar un lote masivo de incidentes validados.
- **Soporte Drag & Drop:** Carga de archivos CSV o JSON.
- **Plantillas CSV Descargables:** Botón directo para descargar `plantilla_evaluacion_riesgo_consorcio.csv` y `plantilla_carga_fraudes_consorcio.csv`.
- **Botón Demo:** *"Cargar Lote Demo (7 Registros)"* para probar el flujo sin necesidad de crear archivos manualmente.
- **Barra de Progreso y Timer:** Visualización del tiempo total de procesamiento y latencia promedio por ítem (ej. 1.2 ms/ítem).
- **Tabla de Resultados Interactiva:** Con filtros de nivel de riesgo (Todos, Alto, Medio, Bajo) y botón de *"Exportar Resultados CSV"*.

#### Módulo 5: API & Developer Hub (Swagger / OpenAPI Integrado)
- **Administrador de Claves de API B2B:**
  - Generación de nuevas claves de API únicas por entidad.
  - Copiado rápido al portapapeles con 1 clic.
  - Revocación instantánea de claves comprometidas.
- **Consola Swagger / Sandbox de Prueba Interactiva:**
  - Selector de endpoints (`/risk/evaluate`, `/fraud/report`, `/fraud/rehabilitate`).
  - Editor del cuerpo de la petición (JSON Request Body).
  - Botón de ejecución en vivo con medición exacta del tiempo de respuesta y visualización de headers y JSON retornado.
- **Generador de Código Multilenguaje:** Ejemplos listos para copiar en:
  - `cURL` (terminal / bash)
  - `TypeScript / Node.js` (con Axios y tipado)
  - `Python` (con la librería `requests`)

#### Módulo 6: Inteligencia de Amenazas y Métricas Colaborativas
- **Desglose de Tipologías de Fraude en Argentina:**
  - Cuentas Mula & Triangulación de Fondos (38%)
  - Robo de Cuenta / Account Takeover por SIM Swapping o Malware (25%)
  - Identidades Sintéticas & DNI Apócrifos (16%)
  - Contracargos Reincidentes Fraudulentos (12%)
  - Phishing Bancario & Smishing (9%)
- **Métricas de Resolución y Falsos Positivos:**
  - Tasa de Falsos Positivos: 2.8% (muy por debajo del promedio de la industria).
  - Tiempo medio de rehabilitación: 3.4 horas.
  - Bandas sindicadas neutralizadas: 41 agrupaciones delictivas detectadas.

#### Módulo 7: Registro Inviolable de Auditoría (Audit Trail)
- Transmisión en streaming de las peticiones procesadas por el consorcio.
- Datos auditables: Timestamp, Nombre del Banco emisor, Endpoint, Tipo de dato, Hash preview, Latencia y Código HTTP.
- Interruptor de auto-actualización cada 5 segundos.

#### Módulo 8: Consorcio & Marco Legal Argentino
- Análisis del encuadre legal bajo la **Ley Nacional 25.326 de Protección de Datos Personales**.
- Cumplimiento del **Secreto Bancario (Ley 21.526)** y normativas del Banco Central de la República Argentina (BCRA).
- Procedimiento garantizado de **Habeas Data** y derecho a la rectificación inmediata de información errónea.

---

### 6. Casos de Prueba Precargados para Demostración

| Etiqueta Demo | Tipo | Valor de Prueba | Coincidencias | Score Esperado | Nivel & Recomendación |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **🚨 Alerta Crítica (Mula)** | EMAIL | `estafador.red@gmail.com` | 5 Bancos | 96 - 100 | **ALTO (BLOQUEO INMEDIATO)** |
| **⚠️ DNI Sintético** | DNI | `20-41882991-3` | 3 Entidades | 88 | **ALTO (BLOQUEO INMEDIATO)** |
| **📱 Teléfono Phishing** | PHONE | `+54 9 11 4055-8891` | 2 Entidades | 68 | **MEDIO (DESAFÍO 2FA)** |
| **💳 Contracargos Frecuentes** | EMAIL | `compras.sospechosas@hotmail.com` | 2 Entidades | 58 | **MEDIO (DESAFÍO 2FA)** |
| **✅ Falso Positivo Resuelto** | EMAIL | `juan.perez.reclamado@gmail.com` | 1 Entidad | 12 | **BAJO (APROBAR - REHABILITADO)** |
| **🟢 Usuario Limpio** | EMAIL | `usuario.verificado@empresa.com.ar` | 0 Entidades | 0 | **BAJO (APROBAR)** |

---

### 7. Endpoints de la API REST

#### `POST /api/v1/risk/evaluate`
Evalúa el riesgo de un identificador en menos de 50ms.
- **Headers:** `Authorization: Bearer <API_KEY>`, `Content-Type: application/json`
- **Body:**
```json
{
  "identifier_type": "EMAIL",
  "identifier_value": "estafador.red@gmail.com"
}
```
- **Respuesta:**
```json
{
  "status": "success",
  "data": {
    "blind_hash": "a8f5c382910fae749281c7e18928374651928374651928374651928374651928",
    "identifier_type": "EMAIL",
    "risk_score": 100,
    "risk_level": "ALTO",
    "recommendation": "BLOQUEAR",
    "network_matches": 7,
    "distinct_institutions_count": 5,
    "primary_reason": "MULA_DE_DINERO",
    "cryptographic_proof": "a98df23...b71",
    "latency_ms": 1,
    "cached": true
  }
}
```

#### `POST /api/v1/fraud/report`
Registra un incidente confirmado e incrementa el contador de entidades independientes.
- **Body:**
```json
{
  "identifier_type": "DNI",
  "identifier_value": "20-41882991-3",
  "reason": "IDENTIDAD_SINTETICA",
  "severity": 4,
  "non_pii_notes": "Validación biométrica no superada"
}
```

#### `POST /api/v1/fraud/rehabilitate`
Restaura el puntaje a nivel seguro tras acreditar la identidad legítima.
- **Body:**
```json
{
  "identifier_type": "EMAIL",
  "identifier_value": "usuario.reclamado@gmail.com",
  "reason": "Validación de identidad aprobada mediante biometría RENAPER"
}
```

#### `POST /api/v1/batch/evaluate` & `POST /api/v1/batch/report`
Procesamiento paralelo de lotes de hasta 500 registros con rendimiento submilisegundo por ítem.

---

### 8. Esquema de Base de Datos Supabase (PostgreSQL)
Ubicación del archivo DDL: [`supabase/schema.sql`](file:///c:/Users/andre/Documents/antifraude/supabase/schema.sql)
Incluye:
- Tablas: `tenants`, `fraud_entities`, `fraud_events`, `api_audit_logs`.
- Políticas de Row Level Security (RLS) que garantizan que ningún banco pueda ver el detalle de los clientes o reportes individuales de otro banco.
- Índices B-Tree compuestos en `blind_hash`, `tenant_id` y `risk_score` para garantizar respuestas en <50ms.
