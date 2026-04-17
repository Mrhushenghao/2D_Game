import { _decorator, Component, TiledMap, TiledMapAsset, TiledLayer, RigidBody2D, BoxCollider2D, PolygonCollider2D, ERigidBody2DType, Vec2, Node, Size, Color, Graphics } from 'cc';
import { PhysicsGroups } from '../Core/PhysicsGroups';

const { ccclass, property } = _decorator;

interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface TileCollisionShape {
    x: number;
    y: number;
    points: Vec2[];
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

    private customCollisionMap: Map<number, TileCollisionShape[]> = new Map();

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

        this.customCollisionMap.clear();
        this.parseCustomTileColliders(tiledMap);

        const colliderCount = this.createMergedColliders(layer, tiledMap);
        console.log(`[TiledMapCollider] 已为 ${this.layerName} 层生成 ${colliderCount} 个碰撞体`);
    }

    private createMergedColliders(layer: TiledLayer, tiledMap: TiledMap): number {
        const layerSize = layer.getLayerSize();
        const tileSize = tiledMap.getTileSize();
        const mapW = layerSize.width;
        const mapH = layerSize.height;

        const occupied: boolean[][] = [];
        const customGids: (number | null)[][] = [];

        for (let y = 0; y < mapH; y++) {
            occupied[y] = new Array(mapW);
            customGids[y] = new Array(mapW);
            for (let x = 0; x < mapW; x++) {
                const gid = layer.getTileGIDAt(x, y);
                const isCustom = this.customCollisionMap.has(gid);
                occupied[y][x] = gid !== 0 && !isCustom;
                customGids[y][x] = isCustom ? gid : null;
            }
        }

        const rects: Rect[] = [];
        for (let y = 0; y < mapH; y++) {
            let x = 0;
            while (x < mapW) {
                if (!occupied[y][x]) { x++; continue; }
                let w = 1;
                while (x + w < mapW && occupied[y][x + w]) w++;
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

        const colliderParent = new Node('MapColliders');
        colliderParent.parent = this.node;

        for (const rect of rects) {
            this.createRectCollider(colliderParent, layer, rect, tileSize);
        }

        let customCount = 0;
        for (let y = 0; y < mapH; y++) {
            for (let x = 0; x < mapW; x++) {
                const gid = customGids[y][x];
                if (!gid) continue;
                this.createCustomCollider(colliderParent, layer, x, y, gid, tileSize);
                customCount++;
            }
        }

        return rects.length + customCount;
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

    private createCustomCollider(
        parent: Node,
        layer: TiledLayer,
        x: number,
        y: number,
        gid: number,
        tileSize: { width: number; height: number }
    ): void {
        const tilePos = layer.getPositionAt(x, y);
        const centerX = tilePos.x + tileSize.width / 2 + this.colliderOffset.x;
        const centerY = tilePos.y + tileSize.height / 2 + this.colliderOffset.y;

        const node = new Node(`Custom_${x}_${y}`);
        node.parent = parent;
        node.setPosition(centerX, centerY, 0);

        const rb = node.addComponent(RigidBody2D);
        rb.type = ERigidBody2DType.Static;
        rb.allowSleep = true;
        rb.group = this.collisionGroup;

        const shapes = this.customCollisionMap.get(gid)!;
        for (const shape of shapes) {
            const collider = node.addComponent(PolygonCollider2D);
            collider.points = shape.points.map(p => new Vec2(p.x, p.y));
            collider.group = this.collisionGroup;
            collider.apply();
        }

        if (this.showDebug) {
            this.drawDebugPolygons(node, shapes);
        }
    }

    private parseCustomTileColliders(tiledMap: TiledMap): void {
        const asset = (tiledMap as any)._tmxFile as TiledMapAsset | null;
        if (!asset || !asset.tsxFiles || asset.tsxFiles.length === 0) return;

        const firstGidMap = this.getTilesetFirstGids(asset.tmxXmlStr);

        for (let i = 0; i < asset.tsxFiles.length; i++) {
            const tsxName = asset.tsxFileNames[i];
            const firstGid = firstGidMap.get(tsxName);
            if (firstGid === undefined) continue;
            this.parseTsxColliders(asset.tsxFiles[i].text, firstGid);
        }
    }

    private getTilesetFirstGids(tmxXml: string): Map<string, number> {
        const map = new Map<string, number>();
        const parser = new DOMParser();
        const doc = parser.parseFromString(tmxXml, 'text/xml');
        const tilesets = doc.getElementsByTagName('tileset');
        for (let i = 0; i < tilesets.length; i++) {
            const source = tilesets[i].getAttribute('source');
            const firstgid = parseInt(tilesets[i].getAttribute('firstgid') || '0');
            if (source) map.set(source, firstgid);
        }
        return map;
    }

    private parseTsxColliders(tsxXml: string, firstGid: number): void {
        const parser = new DOMParser();
        const doc = parser.parseFromString(tsxXml, 'text/xml');
        const tileset = doc.getElementsByTagName('tileset')[0];
        if (!tileset) return;

        const tileWidth = parseFloat(tileset.getAttribute('tilewidth') || '0');
        const tileHeight = parseFloat(tileset.getAttribute('tileheight') || '0');
        const tiles = tileset.getElementsByTagName('tile');

        for (let i = 0; i < tiles.length; i++) {
            const tile = tiles[i];
            const tileId = parseInt(tile.getAttribute('id') || '0');
            const gid = firstGid + tileId;

            const properties = tile.getElementsByTagName('properties')[0];
            let hasCustomize = false;
            if (properties) {
                const props = properties.getElementsByTagName('property');
                for (let j = 0; j < props.length; j++) {
                    if (props[j].getAttribute('name') === 'customize') {
                        hasCustomize = true;
                        break;
                    }
                }
            }
            if (!hasCustomize) continue;

            const objectgroups = tile.getElementsByTagName('objectgroup');
            if (objectgroups.length === 0) continue;

            const shapes: TileCollisionShape[] = [];
            const objects = objectgroups[0].getElementsByTagName('object');
            for (let j = 0; j < objects.length; j++) {
                const obj = objects[j];
                const objX = parseFloat(obj.getAttribute('x') || '0');
                const objY = parseFloat(obj.getAttribute('y') || '0');

                const polygons = obj.getElementsByTagName('polygon');
                if (polygons.length > 0) {
                    const pointsStr = polygons[0].getAttribute('points') || '';
                    const points = this.parsePointsString(pointsStr, objX, objY, tileWidth, tileHeight);
                    shapes.push({ x: objX, y: objY, points });
                    continue;
                }

                const polylines = obj.getElementsByTagName('polyline');
                if (polylines.length > 0) {
                    const pointsStr = polylines[0].getAttribute('points') || '';
                    const rawPoints = this.parsePointsString(pointsStr, objX, objY, tileWidth, tileHeight);
                    const points = this.expandPolyline(rawPoints, 2);
                    shapes.push({ x: objX, y: objY, points });
                    continue;
                }

                const width = parseFloat(obj.getAttribute('width') || '0');
                const height = parseFloat(obj.getAttribute('height') || '0');
                if (width > 0 && height > 0) {
                    const points = this.parseRectPoints(objX, objY, width, height, tileWidth, tileHeight);
                    shapes.push({ x: objX, y: objY, points });
                }
            }

            if (shapes.length > 0) {
                this.customCollisionMap.set(gid, shapes);
            }
        }
    }

    private parsePointsString(pointsStr: string, objX: number, objY: number, tileW: number, tileH: number): Vec2[] {
        const points: Vec2[] = [];
        const parts = pointsStr.split(' ');
        for (const part of parts) {
            const coords = part.split(',');
            if (coords.length < 2) continue;
            const px = parseFloat(coords[0]);
            const py = parseFloat(coords[1]);
            const localX = objX + px - tileW / 2;
            const localY = tileH / 2 - objY - py;
            points.push(new Vec2(localX, localY));
        }
        return points;
    }

    private parseRectPoints(objX: number, objY: number, w: number, h: number, tileW: number, tileH: number): Vec2[] {
        return [
            new Vec2(objX - tileW / 2, tileH / 2 - objY),
            new Vec2(objX + w - tileW / 2, tileH / 2 - objY),
            new Vec2(objX + w - tileW / 2, tileH / 2 - objY - h),
            new Vec2(objX - tileW / 2, tileH / 2 - objY - h),
        ];
    }

    private expandPolyline(points: Vec2[], thickness: number): Vec2[] {
        if (points.length < 2) return points;
        const result: Vec2[] = [];
        for (const p of points) {
            result.push(new Vec2(p.x, p.y - thickness / 2));
        }
        for (let i = points.length - 1; i >= 0; i--) {
            result.push(new Vec2(points[i].x, points[i].y + thickness / 2));
        }
        return result;
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

    private drawDebugPolygons(node: Node, shapes: TileCollisionShape[]): void {
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

            for (const shape of shapes) {
                if (shape.points.length < 2) continue;
                g.moveTo(shape.points[0].x, shape.points[0].y);
                for (let i = 1; i < shape.points.length; i++) {
                    g.lineTo(shape.points[i].x, shape.points[i].y);
                }
                g.close();
            }
            g.fill();
            g.stroke();
        }, 0);
    }
}
