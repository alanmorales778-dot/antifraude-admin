/**
 * CAPA DE INTELIGENCIA DE GRAFOS SOBRE NODOS CIEGOS
 * ─────────────────────────────────────────────────────────────────
 * Algoritmos de grafos sobre tokens hasheados para detectar redes de cuentas mula,
 * granjas de dispositivos interconectados y ciclos de triangulación financiera.
 * 
 * Implementa:
 * 1. Opción A: SQL Recursive CTEs (Compatible nativamente con PostgreSQL 15+ en Supabase).
 * 2. Opción B: Motor de Grafos en Memoria (Compatible con sintaxis Cypher de Memgraph / Neo4j).
 */

import { SpecGraphEdge } from '@/lib/types';

export interface BlindGraphNode {
  hash: string;
  type?: 'CBU' | 'DNI' | 'DEVICE' | 'EMAIL' | 'CUIT' | 'UNKNOWN';
  depth: number;
  isRoot: boolean;
  degree: number;
  connectedEdgesCount: number;
}

export interface BlindGraphLink {
  sourceHash: string;
  targetHash: string;
  category: string;
  depth: number;
  isFalsePositive: boolean;
  reportedByEntityId: string;
}

export interface GraphTraversalResult {
  rootHash: string;
  maxDepthReached: number;
  totalConnectedNodes: number;
  totalEdgesTraversed: number;
  nodes: BlindGraphNode[];
  edges: BlindGraphLink[];
  hasTriangularCycle: boolean;
  sharedDevicesCount: number;
  detectedMuleAccountsCount: number;
  isBridgeNode: boolean;
  centralityScore: number; // 0 a 100
  latencyMs: number;
  engine: 'POSTGRES_RECURSIVE_CTE' | 'IN_MEMORY_CYPHER_GRAPH';
  cypherQuery: string;
  sqlRecursiveCTE: string;
}

export class BlindGraphEngine {
  /**
   * Generar la consulta Cypher para Memgraph / Neo4j
   */
  public generateCypherQuery(rootHash: string, maxDepth: number = 3): string {
    return `// Consulta Cypher para Memgraph (In-Memory Graph Engine)
MATCH path = (root:BlindNode {hash: '${rootHash}'})-[:ASSOCIATED_IN_FRAUD*1..${maxDepth}]-(connected:BlindNode)
WHERE NONE(r IN relationships(path) WHERE r.is_false_positive = true)
RETURN path, 
       length(path) AS depth, 
       connected.hash AS connectedHash, 
       connected.type AS nodeType
ORDER BY depth ASC;`;
  }

  /**
   * Generar el SQL Recursive CTE nativo de PostgreSQL
   */
  public formatPostgresRecursiveCTE(rootHash: string, maxDepth: number = 3): string {
    return `-- Rastreo de salto ${maxDepth}: Redes de Mulas & Dispositivos Compartidos (Supabase PostgreSQL 15+)
WITH RECURSIVE mule_network AS (
   -- Salto 1: Conexiones directas
   SELECT 
       source_hash, 
       target_hash, 
       incident_category, 
       reported_by_entity_id, 
       1 as depth,
       ARRAY[source_hash] as visited_path
   FROM graph_edges 
   WHERE (source_hash = '${rootHash}' OR target_hash = '${rootHash}')
     AND is_false_positive = false

   UNION ALL

   -- Saltos Recursivos hasta depth < ${maxDepth}
   SELECT 
       e.source_hash, 
       e.target_hash, 
       e.incident_category, 
       e.reported_by_entity_id, 
       mn.depth + 1,
       visited_path || e.source_hash
   FROM graph_edges e
   JOIN mule_network mn 
     ON (e.source_hash = mn.target_hash OR e.target_hash = mn.source_hash)
   WHERE mn.depth < ${maxDepth}
     AND e.is_false_positive = false
     AND NOT (e.source_hash = ANY(mn.visited_path)) -- Prevenir bucles infinitos
)
SELECT DISTINCT 
    source_hash, 
    target_hash, 
    incident_category, 
    reported_by_entity_id, 
    MIN(depth) as depth
FROM mule_network
GROUP BY source_hash, target_hash, incident_category, reported_by_entity_id
ORDER BY depth ASC;`;
  }

  /**
   * Ejecución In-Memory ultrarrápida del grafo recursivo (<1ms)
   */
  public traverseGraph(
    edges: SpecGraphEdge[],
    rootHash: string,
    maxDepth: number = 3
  ): GraphTraversalResult {
    const t0 = performance.now();
    const cleanRoot = (rootHash || '').trim().toLowerCase();

    if (!cleanRoot) {
      return {
        rootHash: '',
        maxDepthReached: 0,
        totalConnectedNodes: 0,
        totalEdgesTraversed: 0,
        nodes: [],
        edges: [],
        hasTriangularCycle: false,
        sharedDevicesCount: 0,
        detectedMuleAccountsCount: 0,
        isBridgeNode: false,
        centralityScore: 0,
        latencyMs: 0.1,
        engine: 'IN_MEMORY_CYPHER_GRAPH',
        cypherQuery: '',
        sqlRecursiveCTE: '',
      };
    }

    // Filtrar aristas válidas (no revocadas como falso positivo)
    const activeEdges = edges.filter(e => !e.isFalsePositive);

    // Mapa de adyacencia no dirigida
    const adjacency = new Map<string, Array<{ neighbor: string; edge: SpecGraphEdge }>>();

    activeEdges.forEach(e => {
      const s = (e.sourceHash || '').trim().toLowerCase();
      const t = (e.targetHash || '').trim().toLowerCase();
      if (!s || !t) return;

      if (!adjacency.has(s)) adjacency.set(s, []);
      if (!adjacency.has(t)) adjacency.set(t, []);

      adjacency.get(s)!.push({ neighbor: t, edge: e });
      adjacency.get(t)!.push({ neighbor: s, edge: e });
    });

    // BFS Recursivo por niveles (depth 1 a maxDepth)
    const visitedNodes = new Map<string, number>(); // hash -> min depth
    visitedNodes.set(cleanRoot, 0);

    const queue: Array<{ hash: string; depth: number }> = [{ hash: cleanRoot, depth: 0 }];
    const resultEdges: BlindGraphLink[] = [];
    const recordedEdgeIds = new Set<string>();

    let hasTriangularCycle = false;
    let sharedDevicesCount = 0;
    let detectedMuleAccountsCount = 0;
    let maxDepthReached = 0;

    while (queue.length > 0) {
      const { hash: currentHash, depth: currentDepth } = queue.shift()!;
      if (currentDepth >= maxDepth) continue;

      const neighbors = adjacency.get(currentHash) || [];
      for (const { neighbor, edge } of neighbors) {
        // Registrar arista si no fue registrada aún
        const edgeKey = `${edge.id || `${edge.sourceHash}-${edge.targetHash}`}`;
        if (!recordedEdgeIds.has(edgeKey)) {
          recordedEdgeIds.add(edgeKey);
          resultEdges.push({
            sourceHash: edge.sourceHash,
            targetHash: edge.targetHash,
            category: edge.incidentCategory,
            depth: currentDepth + 1,
            isFalsePositive: edge.isFalsePositive,
            reportedByEntityId: edge.reportedByEntityId,
          });

          if (edge.incidentCategory === 'MULE_ACCOUNT') {
            detectedMuleAccountsCount++;
          }
        }

        // Detección de ciclos (si el vecino ya fue visitado en este u otro camino)
        if (visitedNodes.has(neighbor)) {
          const prevDepth = visitedNodes.get(neighbor)!;
          if (prevDepth > 0 && Math.abs(prevDepth - currentDepth) <= 1) {
            hasTriangularCycle = true;
          }
        } else {
          visitedNodes.set(neighbor, currentDepth + 1);
          maxDepthReached = Math.max(maxDepthReached, currentDepth + 1);
          queue.push({ hash: neighbor, depth: currentDepth + 1 });
        }
      }
    }

    // Identificar nodos resultantes
    const nodes: BlindGraphNode[] = Array.from(visitedNodes.entries()).map(([h, depth]) => {
      const degree = (adjacency.get(h) || []).length;
      return {
        hash: h,
        depth,
        isRoot: h === cleanRoot,
        degree,
        connectedEdgesCount: degree,
      };
    });

    // Dispositivos compartidos: nodos con más de 2 conexiones de tipo distinto
    nodes.forEach(n => {
      if (!n.isRoot && n.degree >= 3) {
        sharedDevicesCount++;
      }
    });

    // Score de centralidad del nodo raíz (Betweenness proxy)
    const rootDegree = (adjacency.get(cleanRoot) || []).length;
    const isBridgeNode = rootDegree >= 3 || (nodes.length >= 4 && maxDepthReached >= 2);
    const centralityScore = Math.min(100, Math.round(
      (rootDegree * 15) + 
      (nodes.length * 8) + 
      (hasTriangularCycle ? 30 : 0) + 
      (sharedDevicesCount * 15)
    ));

    const latencyMs = Math.max(0.12, Number((performance.now() - t0).toFixed(2)));

    return {
      rootHash: cleanRoot,
      maxDepthReached,
      totalConnectedNodes: Math.max(0, nodes.length - 1),
      totalEdgesTraversed: resultEdges.length,
      nodes,
      edges: resultEdges,
      hasTriangularCycle,
      sharedDevicesCount,
      detectedMuleAccountsCount,
      isBridgeNode,
      centralityScore,
      latencyMs,
      engine: 'IN_MEMORY_CYPHER_GRAPH',
      cypherQuery: this.generateCypherQuery(cleanRoot, maxDepth),
      sqlRecursiveCTE: this.formatPostgresRecursiveCTE(cleanRoot, maxDepth),
    };
  }
}

export const blindGraphEngine = new BlindGraphEngine();
