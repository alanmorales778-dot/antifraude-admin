import { NextResponse } from 'next/server';

export async function GET() {
  const openApiSpec = {
    openapi: '3.0.3',
    info: {
      title: 'Consorcio Antifraude B2B - High Speed Threat Intelligence API',
      version: '1.0.0',
      description:
        'API de Inteligencia de Amenazas y Verificación de Riesgo en Tiempo Real (<50ms) para Fintechs y Bancos de Argentina. Todo intercambio de datos se realiza bajo el protocolo de Hashing Ciego irreversible (SHA-256 + Salt Secreta), cumpliendo con la Ley 25.326 de Protección de Datos Personales sin transferir datos personales en texto plano.',
      contact: {
        name: 'Soporte Técnico Consorcio Antifraude',
        email: 'api-security@consorcio-antifraude.ar',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000/api/v1',
        description: 'Servidor Local de Pruebas / Nodo Buenos Aires',
      },
      {
        url: 'https://api.consorcioantifraude.ar/v1',
        description: 'Edge Cluster Producción (baja latencia)',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'API Key (antf_live_...)',
          description: 'Clave API única asignada a cada banco o fintech participante del consorcio.',
        },
      },
      schemas: {
        RiskEvaluationRequest: {
          type: 'object',
          required: ['identifier_type', 'identifier_value'],
          properties: {
            identifier_type: {
              type: 'string',
              enum: ['EMAIL', 'DNI', 'PHONE', 'TAX_ID', 'CARD_BIN'],
              example: 'EMAIL',
              description: 'Tipo de identificador a verificar.',
            },
            identifier_value: {
              type: 'string',
              example: 'estafador.red@gmail.com',
              description: 'Identificador en crudo. El sistema lo normaliza y aplica Hashing Ciego antes de la búsqueda.',
            },
          },
        },
        RiskEvaluationResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'success' },
            data: {
              type: 'object',
              properties: {
                blind_hash: {
                  type: 'string',
                  example: 'a8f5c382910fae749281c7e18928374651928374651928374651928374651928',
                },
                identifier_type: { type: 'string', example: 'EMAIL' },
                risk_score: { type: 'integer', minimum: 0, maximum: 100, example: 96 },
                risk_level: { type: 'string', enum: ['BAJO', 'MEDIO', 'ALTO'], example: 'ALTO' },
                recommendation: {
                  type: 'string',
                  enum: ['APROBAR', 'DESAFIO_2FA', 'BLOQUEAR'],
                  example: 'BLOQUEAR',
                },
                network_matches: { type: 'integer', example: 5 },
                distinct_institutions_count: { type: 'integer', example: 5 },
                primary_reason: { type: 'string', example: 'MULA_DE_DINERO' },
                cryptographic_proof: { type: 'string', example: 'ed25519-proof-token-...' },
                latency_ms: { type: 'integer', example: 12 },
                cached: { type: 'boolean', example: true },
              },
            },
          },
        },
        FraudReportRequest: {
          type: 'object',
          required: ['identifier_type', 'identifier_value', 'reason'],
          properties: {
            identifier_type: {
              type: 'string',
              enum: ['EMAIL', 'DNI', 'PHONE', 'TAX_ID'],
              example: 'DNI',
            },
            identifier_value: {
              type: 'string',
              example: '20-41882991-3',
            },
            reason: {
              type: 'string',
              enum: [
                'ROBO_DE_CUENTA',
                'IDENTIDAD_SINTETICA',
                'CONTRACARGO_REITERADO',
                'MULA_DE_DINERO',
                'PHISHING',
                'TRIANGULACION_FONDOS',
              ],
              example: 'IDENTIDAD_SINTETICA',
            },
            severity: {
              type: 'integer',
              minimum: 1,
              maximum: 5,
              default: 3,
              example: 4,
            },
            non_pii_notes: {
              type: 'string',
              example: 'Validación de titularidad fallida en onboarding biométrico.',
            },
          },
        },
        RehabilitateRequest: {
          type: 'object',
          required: ['identifier_type', 'identifier_value', 'reason'],
          properties: {
            identifier_type: { type: 'string', example: 'EMAIL' },
            identifier_value: { type: 'string', example: 'juan.perez.reclamado@gmail.com' },
            reason: {
              type: 'string',
              example: 'Cliente demostró titularidad legítima con validación biométrica RENAPER',
            },
          },
        },
      },
    },
    security: [{ BearerAuth: [] }],
    paths: {
      '/risk/evaluate': {
        post: {
          summary: 'Evaluación de Riesgo en Tiempo Real (<50ms)',
          description:
            'Normaliza el identificador, aplica el Hash Ciego (SHA-256 + Salt) y consulta la red de fraude en Redis o Postgres. Devuelve el puntaje (0-100), nivel de riesgo y recomendación sin revelar la identidad de las entidades que reportaron.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RiskEvaluationRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Evaluación completada exitosamente en tiempo récord.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/RiskEvaluationResponse' },
                },
              },
            },
            '400': { description: 'Parámetros inválidos o faltantes.' },
          },
        },
      },
      '/fraud/report': {
        post: {
          summary: 'Reportar Fraude Confirmado',
          description:
            'Permite a una entidad participante registrar un incidente confirmado. Actualiza el puntaje global e incrementa el contador de entidades independientes.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/FraudReportRequest' },
              },
            },
          },
          responses: {
            '201': { description: 'Fraude registrado exitosamente en el consorcio.' },
            '400': { description: 'Datos insuficientes.' },
          },
        },
      },
      '/fraud/rehabilitate': {
        post: {
          summary: 'Rehabilitar / Marcar Falso Positivo',
          description:
            'Permite a una entidad restablecer el puntaje de un usuario a nivel seguro tras acreditarse su identidad legítima o resolver un error de reporte.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RehabilitateRequest' },
              },
            },
          },
          responses: {
            '200': { description: 'Falso positivo corregido y entidad rehabilitada.' },
            '404': { description: 'Identificador no encontrado en la base.' },
          },
        },
      },
      '/batch/evaluate': {
        post: {
          summary: 'Evaluación Masiva de Riesgo por Lote',
          description: 'Recibe hasta 500 identificadores y responde con la matriz completa de scores y recomendaciones.',
          responses: {
            '200': { description: 'Lote evaluado.' },
          },
        },
      },
      '/batch/report': {
        post: {
          summary: 'Ingesta Masiva de Fraudes por Lote',
          description: 'Carga comunitaria de múltiples fraudes confirmados simultáneamente.',
          responses: {
            '200': { description: 'Lote ingestor procesado.' },
          },
        },
      },
      '/tenants/keys': {
        get: {
          summary: 'Listar Claves de API del Tenant',
          responses: { '200': { description: 'Lista de claves.' } },
        },
        post: {
          summary: 'Crear Nueva Clave de API',
          responses: { '200': { description: 'Clave generada.' } },
        },
      },
      '/audit/logs': {
        get: {
          summary: 'Consultar Registro Inviolable de Auditoría',
          responses: { '200': { description: 'Últimos registros de auditoría.' } },
        },
      },
      '/analytics/stats': {
        get: {
          summary: 'Métricas de Red y KPIs del Consorcio',
          responses: { '200': { description: 'Estadísticas globales.' } },
        },
      },
    },
  };

  return NextResponse.json(openApiSpec, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
  });
}
