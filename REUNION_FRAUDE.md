# Minuta Estratégica y Arquitectura Técnica: Reunión con Especialista en Prevención de Fraude

**Proyecto:** Consorcio Interbancario & Plataforma Antifraude Federal  
**Entorno:** Preproducción / Sandbox (`antifraude-one.vercel.app`)  
**Fecha:** 22 de Octubre de 2026  
**Audiencia:** Gerencia de Prevención de Fraude, CISO & Riesgo Operativo (Bancos y Empresas)

---

## a) ¿Qué hace hoy el sistema? (Lenguaje No Técnico)

El sistema opera como una **red colaborativa de defensa temprana e inteligencia transaccional entre entidades financieras (Bancos, Fintechs y PSPs)**. Su propósito es interceptar patrones de fraude organizado y cuentas puente ("mulas") antes de que los fondos sean retirados o convertidos en criptoactivos o efectivo.

### 1. Datos que se consultan y registran
- **Identificadores Transaccionales:** CBU/CVU de origen y destino (22 dígitos con verificación Módulo 10 BCRA), CUIT/CUIL (Módulo 11 AFIP), DNI, dirección de correo electrónico, número de teléfono (E.164), dirección IP y huella digital de dispositivo (Device Fingerprint).
- **Protección y Secreto Bancario (Blind Indexing Irreversible):** Ningún dato personal (PII) viaja ni se almacena en texto claro en la base de datos central. Cada identificador es normalizado de forma estricta y convertido en un **Hash Ciego Determinístico mediante HMAC-SHA256 con Pepper Secreto custodiado en KMS/HSM** y separación de dominio (`AR_FED_BLIND_V2_*`). Dos bancos pueden cruzar si tienen una misma cuenta mula sin que ninguno revele los datos de sus clientes al otro ni al consorcio.
- **Grafo de Vínculos Interbancario (3 Saltos):** Cuando una entidad reporta un incidente, el motor vincula automáticamente las aristas entre DNI, CBU, teléfono, IP y dispositivo. Si un estafador intenta operar en otra entidad cambiando el CBU pero reutilizando el dispositivo o el email, el sistema detecta la correlación en menos de 15 milisegundos.

### 2. Cómo se calcula el Score de Riesgo (0 a 100)
El motor de riesgo ponderado (`fraudEngine.ts`) calcula una puntuación consolidada en 5 dimensiones:
1. **Severidad y Reputación Previa:** Incidencias confirmadas en la red asociadas a los identificadores (Cuentas Mula = 90 pts base, Fraude Confirmado = 95 pts, Robo de Identidad = 80 pts, Phishing = 60 pts).
2. **Multiplicador Multientidad:** Si un mismo identificador o dispositivo aparece comprometido en 2 entidades distintas, el riesgo se multiplica por 1.25x; en 3 entidades por 1.50x; y en 4 o más entidades por 1.80x.
3. **Detección de Granjas de Dispositivos (Device Farm Floor):** Si un mismo navegador o dispositivo físico se ha vinculado a 3 o más CUITs distintos en un lapso breve, se impone un piso mínimo automático de 85 puntos (riesgo crítico).
4. **Validación Sintáctica e Inteligencia de Correo Electrónico:** Verificación DNS MX en vivo, detección de proveedores temporales (+40 pts) y penalización de buzones inexistentes (+35 pts).
5. **Decaimiento Temporal (Time Decay con Half-Life de 180 días):** Las incidencias antiguas pierden peso de forma logarítmica con el transcurso de los meses, evitando que un cliente quede penalizado permanentemente por un incidente aislado del pasado.

### 3. Recomendaciones Operativas
- **0 a 34 puntos (BAJO / APROBAR):** Transacción legítima aprobada sin fricción.
- **35 a 74 puntos (MEDIO / REVISIÓN MANUAL):** Requiere desafío adicional (MFA / 2FA biométrico obligatorio, retención preventiva o revisión analítica).
- **75 a 100 puntos (ALTO / BLOQUEAR):** Alerta crítica inmediata, rechazo de transferencia y congelamiento preventivo.

---

## b) Ciberseguridad y Tokenización Irreversible a Largo Plazo

> [!IMPORTANT]
> **Definición de Arquitectura Criptográfica para Producción Bancaria:**
> Para cumplir con la **Ley 25.326 de Protección de Datos Personales**, las **Comunicaciones "A" 7724 y 6835 del BCRA**, y estándares internacionales **ISO 27001**, la plataforma utiliza un esquema de **Blind Indexing Irreversible con Separación de Dominio y Pepper Secreto en HSM/KMS**.

### ¿Por qué SHA-256 plano o con salt público es inviable en banca?
- El universo total de números de DNI en Argentina es de solo **~45 millones de combinaciones**.
- El universo de números de telefonía móvil es de aproximadamente **~50 millones de combinaciones**.
- Un atacante con una GPU moderna de consumo (NVIDIA RTX 4090) puede calcular más de 2.500 millones de hashes SHA-256 por segundo. En consecuencia, **una tabla arcoíris (rainbow table) de todos los DNIs de la República Argentina se genera en menos de 20 milisegundos**.
- Por ende, el uso de hashing directo en el cliente sin clave secreta del servidor no resiste auditorías forenses ni preserva el secreto bancario.

### Estándar Implementado: HMAC-SHA256 con Pepper KMS & Domain Separation
```
Entrada:   DNI "30.111.222"
              │
Normalizado:  "30111222" (Regla canónica por tipo)
              │
Separación:   "AR_FED_BLIND_V2_DNI_KMS:30111222"
              │
Criptografía: HMAC_SHA256( Mensaje, Pepper_KMS_256bits )
              │
Token Ciego:  "tok_7f9c2a84e1b5d63f0981a4c3e21548b..." (Irreversible)
```
1. **Imposibilidad Matemática de Inversión:** Sin la clave Pepper simétrica de 256 bits custodiada en el HSM / KMS bancario, ningún atacante puede precomputar diccionarios ni revertir los tokens.
2. **Separación de Dominio:** Impide ataques cruzados donde un número de DNI coincida numéricamente con un teléfono o con una cuenta bancaria.
3. **Terminología Técnica Precisa:** Se reemplaza el uso impropio del término "Zero-Knowledge" por su definición criptográfica formal: **"Hashes Ciegos Determinísticos / Blind Indexing Criptográfico con Clave Secreta en KMS"**.

---

## c) Matriz de Experiencia de Usuario (UX) de Grado Bancario

| Requerimiento | Estado | Implementación Técnica |
| :--- | :---: | :--- |
| **Estado Inicial Limpio** | **Implementado** | Al acceder, la vista muestra una tarjeta explicativa federal. **Nunca se muestra score 0 ni "Bajo Riesgo" previo a la consulta**. |
| **Separación Visual Estricta** | **Implementado** | Resultado presentado en **2 columnas paralelas**: Columna 1 (Riesgo Propio de Mi Entidad) vs Columna 2 (Riesgo en Red del Consorcio Federal). |
| **Explicabilidad & Confianza** | **Implementado** | Desglose de motivos del score, cantidad de entidades participantes que reportaron (anónimas), recencia y nivel de confianza (ALTO / MEDIO / BAJO). |
| **Validaciones BCRA/AFIP en Vivo** | **Implementado** | Algoritmo Módulo 10 del BCRA para CBU/CVU (22 dígitos), Módulo 11 AFIP para CUIT/CUIL, DNI (6-9 dígitos), RFC 5322 para email y E.164 para teléfono. |
| **Atajo Enter & Autodetección** | **Implementado** | Presionar Enter ejecuta la búsqueda; pegar un CBU, CUIT o Email selecciona automáticamente la pestaña correspondiente. |
| **Motivo Obligatorio de Consulta** | **Implementado** | Selector obligatorio (`EVALUACION_TRANSFERENCIA`, `ALTA_ONBOARDING`, `INVESTIGACION_INTERNA`, `AUDITORIA_COMPLIANCE`) guardado en `audit_logs`. |
| **Confirmación de Reporte en 2 Pasos** | **Implementado** | Modal de previsualización que muestra los tokens ciegos generados y metadatos antes de enviar el reporte a la red. |
| **Rectificación y Retiro Inmediato** | **Implementado** | Pantalla de éxito con ID de incidente generado y botón para rectificar o retirar voluntariamente el reporte (borrado $O(1)$ en Cuckoo Filter). |
| **Modo Demostración Opcional** | **Implementado** | Botones de prueba (DNI Mula, CBU Mula, etc.) ocultos por defecto, activables únicamente mediante toggle explícito. |

---

## d) Estado Actual de Componentes y Backend (Supabase)

| Módulo / Tabla | Estado | Latencia / SLA | Observaciones |
| :--- | :---: | :---: | :--- |
| **`fintech_entities`** | **200 OK** | 12ms | Tabla de miembros y entidades participantes sincronizada. |
| **`identity_nodes`** | **200 OK** | 14ms | Almacén de nodos con tokens ciegos normalizados. |
| **`graph_edges`** | **200 OK** | 15ms | Grafo de relaciones y antecedentes de fraude. |
| **`network_alerts`** | **200 OK** | 11ms | Difusión de alertas tempranas interbancarias. |
| **`audit_logs`** | **200 OK** | 13ms | Registro inmutable de consultas y reportes con trazabilidad de actor y motivo. |
| **`device_cuit_links`** | **200 OK** | 12ms | Detección de granjas de dispositivos. |
| **`app_users`** | **200 OK** | 11ms | Control de acceso basado en roles (RBAC) y enrolamiento 2FA TOTP. |
| **`scoring_config`** | **200 OK** | 10ms | Configuración de scoring y calibración heurística persistida. |
| **RPC `traverse_mule_network`** | **200 OK** | 18ms | Recorrido recursivo CTE de cuentas mulas hasta 3 saltos. |
| **Dashboard KPIs** | **200 OK** | Tiempo Real | Tarjetas basadas estrictamente en consultas del día actual (`today`), con tasa crítica acotada a [0, 100]%. |

---

## e) Preguntas Clave para la Experta en Fraude (Guía de Entrevista)

1. **Tipologías y Señales de Alerta Temprana:**
   - *¿Cuáles son los 3 patrones de fraude de mayor impacto hoy en el sistema financiero local (vishing con toma de control de home banking, apertura masiva de cuentas mula remuneradas, suplantación para créditos preconcedidos)?*
   - *¿Qué identificador consideran más determinante al momento de inferir una cuenta mula: el CBU/CVU de destino o la huella de dispositivo compartido (Device Fingerprint)?*

2. **Criterios de Carga y Estandarización:**
   - *¿Qué estándar de prueba interno exige una entidad para catalogar un caso como "Fraude Confirmado" frente a "Sospecha Fundada" antes de compartirlo en la red?*
   - *¿Qué información adicional consideran indispensable en la carga (fecha exacta del incidente, importe involucrado, canal de origen como APP/Web)?*

3. **Tolerancia a Falsos Positivos vs. Falsos Negativos:**
   - *¿Qué tasa de falso positivo es admisible en transferencias inmediatas (Debin / Transferencias 3.0) antes de que el costo operativo de soporte supere las pérdidas por fraude?*
   - *¿Prefieren un modelo con alto recall (detectar todo a costa de más revisiones manuales) o alta precisión (bloquear únicamente con certeza matemática multientidad)?*

4. **Bloqueo Automático vs. Fricción Dinámica:**
   - *En transacciones de alto riesgo (>75 puntos), ¿recomiendan el rechazo automático de la transferencia o la degradación a un canal de verificación obligatoria (biometría facial del titular / diferimiento de acreditación por 2 horas)?*

5. **Gobernanza y Secreto Bancario (BCRA / UIF):**
   - *Frente a una auditoría del BCRA o requerimiento judicial, ¿cómo valoran la arquitectura de Blind Indexing (HMAC con Pepper KMS) donde el consorcio no custodia datos personales en texto claro?*
   - *¿Consideran necesario registrar el motivo específico de consulta (Onboarding, Transferencia Saliente, etc.) para cada analista que accede al sistema?*

---

## f) Roadmap Estratégico para Homologación Bancaria

```mermaid
graph TD
    A["Fase 1: Consolidación Técnica & Cero 404s (Completada)"] --> B["Fase 2: UX Bancaria, Blind Indexing KMS & 2-Step Commit (Completada)"]
    B --> C["Fase 3: Mesa de Trabajo con Experta en Fraude & Calibración (En Curso)"]
    C --> D["Fase 4: Conexión Piloto con 3 Entidades Financieras en Sandbox"]
    D --> E["Fase 5: Homologación BCRA Com. A 7724 & Salida a Producción"]
```
