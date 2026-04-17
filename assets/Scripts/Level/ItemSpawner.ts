import { _decorator, Component, TiledMap, Prefab, instantiate, Node } from 'cc';
import { CollectibleItem, ItemType } from '../Item/CollectibleItem';

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

@ccclass('ItemSpawner')
export class ItemSpawner extends Component {

    @property({ tooltip: '道具对象层名称' })
    objectLayerName: string = 'monster';

    @property(Prefab)
    gemPrefab: Prefab | null = null;

    @property(Prefab)
    cherryPrefab: Prefab | null = null;

    @property({ tooltip: '是否自动生成' })
    autoSpawn: boolean = true;

    onLoad() {
        if (this.autoSpawn) {
            this.scheduleOnce(() => this.spawnItems(), 0.1);
        }
    }

    spawnItems(): void {
        const tiledMap = this.getComponent(TiledMap);
        if (!tiledMap) return;

        const objectGroup = tiledMap.getObjectGroup(this.objectLayerName);
        if (!objectGroup) return;

        const objects = objectGroup.getObjects() as unknown as TiledMapObject[];
        if (!objects || objects.length === 0) return;

        const parent = new Node('Items');
        parent.parent = this.node;

        for (const obj of objects) {
            if (obj.visible === false) continue;

            const result = this.resolvePrefabAndType(obj);
            if (!result) continue;

            const item = instantiate(result.prefab);
            const px = ((obj as any).offsetX ?? obj.x ?? 0) + (obj.width ?? 0) / 2;
            const py = ((obj as any).offsetY ?? obj.y ?? 0) + (obj.height ?? 0) / 2;
            item.setPosition(px, py, 0);
            item.parent = parent;

            this.attachCollectible(item, result.type);
        }
    }

    private resolvePrefabAndType(obj: TiledMapObject): { prefab: Prefab; type: ItemType } | null {
        const props = obj.properties;
        if (!props) return null;

        if ('diamond' in props && this.gemPrefab) {
            return { prefab: this.gemPrefab, type: ItemType.gem };
        }
        if ('health' in props && this.cherryPrefab) {
            return { prefab: this.cherryPrefab, type: ItemType.health };
        }

        return null;
    }

    private attachCollectible(item: Node, type: ItemType): void {
        let comp = item.getComponent(CollectibleItem);
        if (!comp) {
            comp = item.addComponent(CollectibleItem);
        }
        comp.itemType = type;
    }
}
