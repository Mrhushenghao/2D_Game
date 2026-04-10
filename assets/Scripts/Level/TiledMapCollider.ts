import { _decorator, Component, TiledMap, TiledLayer, RigidBody2D, BoxCollider2D, ERigidBody2DType, Vec2, Node, Size, Color, Graphics } from 'cc';
import { PhysicsGroups } from '../Core/PhysicsGroups';

const { ccclass, property } = _decorator;

interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

@ccclass('TiledMapCollider')
export class TiledMapCollider extends Component {

    @property({ tooltip: '要生成碰撞的图层名称' })
    layerName: string = 'main';

    @property({ tooltip: '是否自动生成碰撞体' })
    autoGenerate: boolean = true;

    @property({ tooltip: '碰撞体偏移（像素）' })
    colliderOffset: Vec2 = new Vec2(0, 0);

    @property({ tooltip: '是否显示调试区域' })
    showDebug: boolean = false;

    @property({ tooltip: '调试区域颜色' })
    debugColor: Color = new Color(255, 0, 0, 128);

    @property({ tooltip: '碰撞体物理分组' })
    collisionGroup: number = PhysicsGroups.WALL;

    onLoad() {
        if (this.autoGenerate) {
            this.scheduleOnce(() => this.generateColliders(), 0.1);
        }
    }

    generateColliders(): void {
        const tiledMap = this.getComponent(TiledMap);
        if (!tiledMap) {
            console.warn('[TiledMapCollider] 未找到 TiledMap 组件');
            return;
        }

        const layer = tiledMap.getLayer(this.layerName);
        if (!layer) {
            console.warn(`[TiledMapCollider] 未找到图层: ${this.layerName}`);
            return;
        }

        const colliderCount = this.createMergedColliders(layer, tiledMap);
        console.log(`[TiledMapCollider] 已为 ${this.layerName} 层生成 ${colliderCount} 个合并碰撞体`);
    }

    private createMergedColliders(layer: TiledLayer, tiledMap: TiledMap): number {
        const layerSize = layer.getLayerSize();
        const tileSize = tiledMap.getTileSize();
        const mapW = layerSize.width;
        const mapH = layerSize.height;

        // 构建地图标记矩阵
        const occupied: boolean[][] = [];
        for (let y = 0; y < mapH; y++) {
            occupied[y] = new Array(mapW);
            for (let x = 0; x < mapW; x++) {
                occupied[y][x] = layer.getTileGIDAt(x, y) !== 0;
            }
        }

        // 行扫描合并：逐行将连续图块合并为水平条带，再纵向合并相邻同宽条带
        const rects: Rect[] = [];
        for (let y = 0; y < mapH; y++) {
            let x = 0;
            while (x < mapW) {
                if (!occupied[y][x]) { x++; continue; }
                // 向右扩展
                let w = 1;
                while (x + w < mapW && occupied[y][x + w]) w++;
                // 尝试向下合并同宽条带
                let h = 1;
                while (y + h < mapH) {
                    let canMerge = true;
                    for (let cx = x; cx < x + w; cx++) {
                        if (!occupied[y + h][cx]) { canMerge = false; break; }
                    }
                    if (!canMerge) break;
                    h++;
                }
                rects.push({ x, y, width: w, height: h });
                x += w;
            }
        }

        // 为所有碰撞体创建在一个父节点下，减少场景树层级
        const colliderParent = new Node('MapColliders');
        colliderParent.parent = this.node;

        for (const rect of rects) {
            this.createRectCollider(colliderParent, layer, rect, tileSize);
        }

        return rects.length;
    }

    private createRectCollider(
        parent: Node,
        layer: TiledLayer,
        rect: Rect,
        tileSize: { width: number; height: number }
    ): void {
        const colliderNode = new Node(`C_${rect.x}_${rect.y}`);
        colliderNode.parent = parent;

        const topLeft = layer.getPositionAt(rect.x, rect.y);
        const bottomRight = layer.getPositionAt(
            rect.x + rect.width - 1,
            rect.y + rect.height - 1
        );

        const centerX = (topLeft.x + bottomRight.x) / 2 + tileSize.width / 2 + this.colliderOffset.x;
        const centerY = Math.round(
            (topLeft.y + bottomRight.y) / 2 + tileSize.height / 2 + this.colliderOffset.y
        );
        colliderNode.setPosition(centerX, centerY, 0);

        const rigidBody = colliderNode.addComponent(RigidBody2D);
        rigidBody.type = ERigidBody2DType.Static;
        rigidBody.allowSleep = true;
        rigidBody.group = this.collisionGroup;

        const collider = colliderNode.addComponent(BoxCollider2D);
        collider.size = new Size(
            rect.width * tileSize.width - 0.5,
            rect.height * tileSize.height - 0.5
        );
        collider.offset = new Vec2(0, 0);
        collider.group = this.collisionGroup;
        collider.apply();

        if (this.showDebug) {
            this.addDebugGraphic(colliderNode, collider.size);
        }
    }

    private addDebugGraphic(node: Node, size: Size): void {
        const debugNode = new Node('DebugGraphic');
        debugNode.parent = node;
        debugNode.setPosition(0, 0, 0);
        debugNode.layer = node.layer;

        const g = debugNode.addComponent(Graphics);
        this.scheduleOnce(() => {
            g.clear();
            g.fillColor = this.debugColor.clone();
            g.strokeColor = new Color(255, 255, 255, 255);
            g.lineWidth = 2;

            const hx = -size.width / 2;
            const hy = -size.height / 2;
            g.moveTo(hx, hy);
            g.lineTo(hx + size.width, hy);
            g.lineTo(hx + size.width, hy + size.height);
            g.lineTo(hx, hy + size.height);
            g.close();
            g.fill();
            g.stroke();
        }, 0);
    }
}
