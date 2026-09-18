export type Edge = { from: string; to: string };

const WHITE = 0; // not yet visited
const GRAY = 1; // currently on the recursion stack (an ancestor of the node being visited)
const BLACK = 2; // fully explored - this node and everything reachable from it is cycle-free

/**
 * Detects a cycle in a directed graph given as a list of edges.
 *
 * DFS colors each node white -> gray -> black. A cycle exists exactly when
 * DFS reaches a node that is already gray - i.e. a "back edge" to a node
 * that is still an ancestor of the current call stack, not merely one that
 * was visited earlier via some other unrelated path (that case would be
 * black, not gray, and is perfectly fine).
 *
 * Time: O(V+E) - every node is colored exactly once (white -> gray -> black),
 * and every edge is examined exactly once, from whichever node it starts at.
 */
export function hasCycle(edges: Edge[]): boolean {
  const adjacency = new Map<string, string[]>();
  for (const { from, to } of edges) {
    if (!adjacency.has(from)) adjacency.set(from, []);
    adjacency.get(from)!.push(to);
    if (!adjacency.has(to)) adjacency.set(to, []);
  }

  const color = new Map<string, number>();

  function visit(node: string): boolean {
    color.set(node, GRAY);
    for (const neighbor of adjacency.get(node) ?? []) {
      const neighborColor = color.get(neighbor) ?? WHITE;
      if (neighborColor === GRAY) return true;
      if (neighborColor === WHITE && visit(neighbor)) return true;
    }
    color.set(node, BLACK);
    return false;
  }

  for (const node of adjacency.keys()) {
    if ((color.get(node) ?? WHITE) === WHITE) {
      if (visit(node)) return true;
    }
  }
  return false;
}
