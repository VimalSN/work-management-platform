import { hasCycle } from '../graph';
import type { Edge } from '../graph';

describe('hasCycle', () => {
  it('reports no cycle for an empty graph', () => {
    expect(hasCycle([])).toBe(false);
  });

  it('reports no cycle for a simple chain', () => {
    const edges: Edge[] = [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' },
      { from: 'C', to: 'D' },
    ];
    expect(hasCycle(edges)).toBe(false);
  });

  it('detects a direct cycle (A -> B -> A)', () => {
    const edges: Edge[] = [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'A' },
    ];
    expect(hasCycle(edges)).toBe(true);
  });

  it('detects a self-loop (A -> A)', () => {
    expect(hasCycle([{ from: 'A', to: 'A' }])).toBe(true);
  });

  it('detects a cycle several hops away from where traversal starts', () => {
    // A -> B -> C -> D -> B (the cycle is B->C->D->B, not involving A)
    const edges: Edge[] = [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' },
      { from: 'C', to: 'D' },
      { from: 'D', to: 'B' },
    ];
    expect(hasCycle(edges)).toBe(true);
  });

  it('does not confuse "visited via another path" (black) with "on the current path" (gray)', () => {
    // A -> B, A -> C, B -> D, C -> D: D is reached twice via different
    // paths, but neither path revisits an ancestor - not a cycle.
    const edges: Edge[] = [
      { from: 'A', to: 'B' },
      { from: 'A', to: 'C' },
      { from: 'B', to: 'D' },
      { from: 'C', to: 'D' },
    ];
    expect(hasCycle(edges)).toBe(false);
  });

  it('checks every disconnected component, not just the one reachable from the first node', () => {
    // A -> B is fine; separately, X -> Y -> X is a cycle. The outer loop in
    // hasCycle must still visit X even though it's unreachable from A.
    const edges: Edge[] = [
      { from: 'A', to: 'B' },
      { from: 'X', to: 'Y' },
      { from: 'Y', to: 'X' },
    ];
    expect(hasCycle(edges)).toBe(true);
  });

  it('handles a larger acyclic graph without false positives', () => {
    const edges: Edge[] = [];
    for (let i = 0; i < 200; i++) {
      // Every edge points from a lower index to a higher one, so no cycle
      // can exist by construction.
      edges.push({ from: `task-${i}`, to: `task-${i + 1}` });
      if (i % 3 === 0) edges.push({ from: `task-${i}`, to: `task-${i + 2}` });
    }
    expect(hasCycle(edges)).toBe(false);
  });
});
