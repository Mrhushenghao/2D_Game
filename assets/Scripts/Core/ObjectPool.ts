import { Node, NodePool, instantiate, Prefab } from 'cc';

export class ObjectPool {
    private pool: NodePool;
    private prefab: Prefab;
    private parent: Node;
    private activeNodes: Set<Node> = new Set();

    constructor(prefab: Prefab, parent: Node, initialSize: number = 5) {
        this.pool = new NodePool();
        this.prefab = prefab;
        this.parent = parent;

        for (let i = 0; i < initialSize; i++) {
            const node = instantiate(prefab);
            node.parent = parent;
            node.active = false;
            node.removeFromParent();
            this.pool.put(node);
        }
    }

    get(): Node {
        let node: Node;
        if (this.pool.size() > 0) {
            node = this.pool.get()!;
        } else {
            node = instantiate(this.prefab);
        }
        node.parent = this.parent;
        node.active = true;
        this.activeNodes.add(node);
        return node;
    }

    put(node: Node) {
        if (!this.activeNodes.has(node)) return;
        this.activeNodes.delete(node);
        node.active = false;
        node.removeFromParent();
        this.pool.put(node);
    }

    putAll() {
        const nodes = Array.from(this.activeNodes);
        for (const node of nodes) {
            this.put(node);
        }
    }

    get size(): number {
        return this.activeNodes.size;
    }
}
