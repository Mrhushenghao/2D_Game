import { _decorator, Component, TiledMap, Prefab, instantiate, Node } from 'cc';

const { ccclass, property } = _decorator;

interface TiledMapObject {
    x: number;
    y: number;
    width: number;
    height: number;
    name?: string;
    visible?: boolean;
    properties?: Record<string, string>;
}

@ccclass('MonsterSpawner')
export class MonsterSpawner extends Component {

    @property({ tooltip: '怪物对象层名称' })
    objectLayerName: string = 'monster';

    @property(Prefab)
    eaglePrefab: Prefab | null = null;

    @property(Prefab)
    opossumPrefab: Prefab | null = null;

    @property(Prefab)
    frogPrefab: Prefab | null = null;

    @property({ tooltip: '是否自动生成' })
    autoSpawn: boolean = true;

    onLoad() {
        if (this.autoSpawn) {
            this.scheduleOnce(() => this.spawnMonsters(), 0.1);
        }
    }

    spawnMonsters(): void {
        const tiledMap = this.getComponent(TiledMap);
        if (!tiledMap) return;

        const objectGroup = tiledMap.getObjectGroup(this.objectLayerName);
        if (!objectGroup) return;

        const objects = objectGroup.getObjects() as unknown as TiledMapObject[];
        if (!objects || objects.length === 0) return;

        const parent = new Node('Monsters');
        parent.parent = this.node;

        let count = 0;
        for (const obj of objects) {
            if (obj.visible === false) continue;
            const prefab = this.resolvePrefab(obj);
            if (!prefab) continue;

            const monster = instantiate(prefab);
            const px = (obj as any).offsetX ?? obj.x ?? 0;
            const py = ((obj as any).offsetY ?? obj.y ?? 0) - (obj.height ?? 0) / 2;
            monster.setPosition(px, py, 0);
            monster.parent = parent;
            count++;
        }

        console.log(`[MonsterSpawner] 生成 ${count} 个怪物`);
    }

    private resolvePrefab(obj: TiledMapObject): Prefab | null {
        const props = obj.properties;
        if (!props) return null;

        if ('eagle' in props && this.eaglePrefab) return this.eaglePrefab;
        if ('opossum' in props && this.opossumPrefab) return this.opossumPrefab;
        if ('frog' in props && this.frogPrefab) return this.frogPrefab;

        console.warn(`[MonsterSpawner] 未识别的怪物属性:`, props);
        return null;
    }
}
