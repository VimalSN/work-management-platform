import { performance } from 'node:perf_hooks';
import { hasCycle } from '../src/lib/graph';
import type { Edge } from '../src/lib/graph';

// Builds a random DAG (edges only ever point from a lower index to a higher
// one, so no cycle can exist by construction) with roughly
// `edgesPerNode` outgoing edges per node - the "no dependency loops yet"
// starting state before someone tries to add one.
function generateAcyclicGraph(numNodes: number, edgesPerNode = 2): Edge[] {
  const nodes = Array.from({ length: numNodes }, (_, i) => `task-${i}`);
  const edges: Edge[] = [];
  for (let i = 0; i < numNodes; i++) {
    for (let k = 0; k < edgesPerNode; k++) {
      if (i >= numNodes - 1) continue;
      const target = i + 1 + Math.floor(Math.random() * (numNodes - i - 1));
      edges.push({ from: nodes[i], to: nodes[target] });
    }
  }
  return edges;
}

// Takes an acyclic graph and adds exactly one "back edge" from the very last
// node to the very first one - simulating someone linking a dependency that
// closes a loop back to the start of the chain. Because DFS visits node 0
// first and recurses forward through the whole chain before it ever reaches
// the last node, this forces the algorithm to traverse nearly the entire
// graph before it can detect the cycle - a realistic worst case, not a
// trivial one.
function withCycleAtTheEnd(edges: Edge[], numNodes: number): Edge[] {
  return [...edges, { from: `task-${numNodes - 1}`, to: 'task-0' }];
}

function timeRuns(edges: Edge[], iterations: number): { minMs: number; avgMs: number } {
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    hasCycle(edges);
    times.push(performance.now() - start);
  }
  return {
    minMs: Math.min(...times),
    avgMs: times.reduce((a, b) => a + b, 0) / times.length,
  };
}

const sizes = [100, 500, 1000, 5000, 10000, 50000];
const ITERATIONS = 50;

console.log(`hasCycle() benchmark - ${ITERATIONS} iterations per graph size, min/avg wall time\n`);
console.log(
  'Nodes'.padEnd(8) +
    'Edges'.padEnd(9) +
    'V+E'.padEnd(9) +
    'Has cycle?'.padEnd(12) +
    'min ms'.padEnd(10) +
    'avg ms'.padEnd(10) +
    'avg / (V+E) us',
);

for (const numNodes of sizes) {
  const acyclic = generateAcyclicGraph(numNodes, 2);
  const cyclic = withCycleAtTheEnd(acyclic, numNodes);

  for (const [label, edges] of [
    ['acyclic (worst case)', acyclic],
    ['1 cycle added', cyclic],
  ] as const) {
    const V = numNodes;
    const E = edges.length;
    const detected = hasCycle(edges);
    const { minMs, avgMs } = timeRuns(edges, ITERATIONS);
    const perEdgeUs = (avgMs * 1000) / (V + E);
    console.log(
      `${V}`.padEnd(8) +
        `${E}`.padEnd(9) +
        `${V + E}`.padEnd(9) +
        `${detected}`.padEnd(12) +
        `${minMs.toFixed(4)}`.padEnd(10) +
        `${avgMs.toFixed(4)}`.padEnd(10) +
        `${perEdgeUs.toFixed(5)}  (${label})`,
    );
  }
}
