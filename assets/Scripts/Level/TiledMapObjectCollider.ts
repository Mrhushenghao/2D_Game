import {
    _decorator, Component, TiledMap, TiledObjectGroup, RigidBody2D,
    BoxCollider2D, PolygonCollider2D, ERigidBody2DType, Vec2, Node, Size, Color, Graphics
} from 'cc';
import { PhysicsGroups } from '../Core/PhysicsGroups';

const { ccclass, property } = _decorator;

const enum ObjectType {
    RECT = 0,
    ELLIPSE = 1,
    POLYGON = 2,
    POLYLINE = 3,
    IMAGE = 4,
    TEXT = 5,
}

interface TiledObj {
    x: number;
    y: number;
    width: number;
    height: number;
    type: ObjectType;
    points?: { x: number; y: number }[];
    polylinePoints?: { x: number; y: number }[] | null;
    rotation?: number;
    name?: string;
    visible?: boolean;
}

@ccclass('TiledMapObjectCollider')
export class TiledMapObjectCollider extends Component {

    @property({ tooltip: '要读取的对象层名称' })
    objectLayerName: string = 'collision';

    @property({ tooltip: '是否自动生成' })
    autoGenerate: boolean = true;

    @property({ tooltip: '碰撞体物理分组' })
    collisionGroup: number = PhysicsGroups.WALL;

    @property({ tooltip: '是否显示调试区域' })
    showDebug: boolean = true;

    @property({ tooltip: '调试区域颜色' })
    debugColor: Color = new Color(255, 0, 0, 100);

    onLoad() {
        if (this.autoGenerate) {
            this.scheduleOnce(() => this.generateColliders(), 0.1);
        }
    }

    generateColliders(): void {
        const tiledMap = this.getComponent(TiledMap);
        if (!tiledMap) {
            console.warn('[TiledMapObjectCollider] 未找到 TiledMap 组件');
            return;
        }

        const objectGroup = tiledMap.getObjectGroup(this.objectLayerName);
        if (!objectGroup) {
            console.warn(`[TiledMapObjectCollider] 未找到对象层: ${this.objectLayerName}`);
            return;
        }

        const objects = objectGroup.getObjects() as unknown as TiledObj[];
        if (!objects || objects.length === 0) {
            console.warn(`[TiledMapObjectCollider] 对象层 ${this.objectLayerName} 为空`);
            return;
        }

        const parent = new Node('ObjectColliders');
        parent.parent = this.node;

        let count = 0;
        for (const obj of objects) {
            if (obj.visible === false) continue;
            if (this.createObjectCollider(parent, obj)) {
                count++;
            }
        }

        console.log(`[TiledMapObjectCollider] 从对象层 "${this.objectLayerName}" 生成 ${count} 个碰撞体`);
    }

    private createObjectCollider(parent: Node, obj: TiledObj): boolean {
        if (obj.type === ObjectType.POLYGON && obj.points && obj.points.length >= 3) {
            return this.createPolygonCollider(parent, obj);
        }

        if (obj.type === ObjectType.POLYLINE && obj.polylinePoints && obj.polylinePoints.length >= 2) {
            return this.createPolylineCollider(parent, obj);
        }

        // RECT 和 ELLIPSE 统一按矩形处理
        if (obj.width > 0 && obj.height > 0) {
            return this.createRectCollider(parent, obj);
        }

        console.warn('[TiledMapObjectCollider] 跳过无效对象:', obj.name);
        return false;
    }

    private createRectCollider(parent: Node, obj: TiledObj): boolean {
        const node = new Node(obj.name || `Rect_${obj.x}_${obj.y}`);
        node.parent = parent;

        // getObjects() 返回的坐标已经是 Cocos 坐标系（Y 向上）
        // obj.y 是对象顶部，矩形中心需要向下偏移半个高度
        node.setPosition(obj.x, obj.y - obj.height / 2, 0);

        const rb = node.addComponent(RigidBody2D);
        rb.type = ERigidBody2DType.Static;
        rb.allowSleep = true;
        rb.group = this.collisionGroup;

        const collider = node.addComponent(BoxCollider2D);
        collider.size = new Size(obj.width, obj.height);
        collider.offset = new Vec2(obj.width / 2, 0);
        collider.group = this.collisionGroup;
        collider.apply();

        if (this.showDebug) this.drawDebugRect(node, obj.width, obj.height);
        return true;
    }

    private createPolygonCollider(parent: Node, obj: TiledObj): boolean {
        const node = new Node(obj.name || `Poly_${obj.x}_${obj.y}`);
        node.parent = parent;

        // getObjects() 的 obj.y 已经被引擎翻转，points 的 y 也已经被 * -1 翻转
        node.setPosition(obj.x, obj.y, 0);

        const rb = node.addComponent(RigidBody2D);
        rb.type = ERigidBody2DType.Static;
        rb.allowSleep = true;
        rb.group = this.collisionGroup;

        const collider = node.addComponent(PolygonCollider2D);
        collider.points = obj.points!.map(p => new Vec2(p.x, p.y));
        collider.group = this.collisionGroup;
        collider.apply();

        if (this.showDebug) this.drawDebugPolygon(node, collider.points);
        return true;
    }

    private createPolylineCollider(parent: Node, obj: TiledObj): boolean {
        const node = new Node(obj.name || `Line_${obj.x}_${obj.y}`);
        node.parent = parent;

        node.setPosition(obj.x, obj.y, 0);

        const rb = node.addComponent(RigidBody2D);
        rb.type = ERigidBody2DType.Static;
        rb.allowSleep = true;
        rb.group = this.collisionGroup;

        const thickness = 2;
        const pts = obj.polylinePoints!;
        const polygonPoints: Vec2[] = [];

        for (const p of pts) {
            polygonPoints.push(new Vec2(p.x, p.y - thickness / 2));
        }
        for (let i = pts.length - 1; i >= 0; i--) {
            polygonPoints.push(new Vec2(pts[i].x, pts[i].y + thickness / 2));
        }

        const collider = node.addComponent(PolygonCollider2D);
        collider.points = polygonPoints;
        collider.group = this.collisionGroup;
        collider.apply();

        if (this.showDebug) this.drawDebugPolygon(node, polygonPoints);
        return true;
    }

    // ==================== 调试绘制 ====================

    private drawDebugRect(node: Node, w: number, h: number): void {
        const debugNode = new Node('DebugGraphic');
        debugNode.parent = node;
        debugNode.layer = node.layer;

        const g = debugNode.addComponent(Graphics);
        this.scheduleOnce(() => {
            g.clear();
            g.fillColor = this.debugColor.clone();
            g.strokeColor = new Color(255, 255, 255, 255);
            g.lineWidth = 2;

            const hx = 0;
            const hy = -h / 2;
            g.moveTo(hx, hy);
            g.lineTo(hx + w, hy);
            g.lineTo(hx + w, hy + h);
            g.lineTo(hx, hy + h);
            g.close();
            g.fill();
            g.stroke();
        }, 0);
    }

    private drawDebugPolygon(node: Node, points: Vec2[]): void {
        const debugNode = new Node('DebugGraphic');
        debugNode.parent = node;
        debugNode.layer = node.layer;

        const g = debugNode.addComponent(Graphics);
        this.scheduleOnce(() => {
            g.clear();
            g.fillColor = this.debugColor.clone();
            g.strokeColor = new Color(255, 255, 255, 255);
            g.lineWidth = 2;

            if (points.length < 2) return;

            g.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                g.lineTo(points[i].x, points[i].y);
            }
            g.close();
            g.fill();
            g.stroke();
        }, 0);
    }
}
