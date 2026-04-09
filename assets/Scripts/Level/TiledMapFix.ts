import { _decorator, Component, TiledMap, TiledLayer, Texture2D, Material } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('TiledMapFix')
export class TiledMapFix extends Component {

    @property({ tooltip: '是否修复透明黑边' })
    fixBlackEdge: boolean = true;

    @property({ tooltip: '需要关闭剔除的图层名称（仅对这些图层禁用剔除）' })
    noCullingLayers: string[] = [];

    @property({ tooltip: '是否修正图层坐标取整' })
    fixPositionSnap: boolean = true;

    onLoad() {
        this.scheduleOnce(() => this.apply(), 0);
    }

    private apply(): void {
        const tiledMap = this.getComponent(TiledMap);
        if (!tiledMap) {
            console.warn('[TiledMapFix] 未找到 TiledMap 组件');
            return;
        }

        const layers = tiledMap.getLayers();
        const noCullingSet = new Set(this.noCullingLayers);
        const processedTextures = new Set<Texture2D>();

        for (const layer of layers) {
            this.fixLayerTextures(layer, processedTextures);
            this.fixLayer(layer, noCullingSet);
        }

        console.log('[TiledMapFix] 修复完成');
    }

    private fixLayerTextures(layer: TiledLayer, processed: Set<Texture2D>): void {
        let idx = 0;
        while (true) {
            const mat = layer.getMaterial(idx);
            if (!mat) break;
            const tex = this.extractTexture(mat);
            if (tex && !processed.has(tex)) {
                this.fixTexture(tex);
                processed.add(tex);
            }
            idx++;
        }
    }

    private extractTexture(mat: Material): Texture2D | null {
        const val = mat.getProperty('mainTexture') || mat.getProperty('texture');
        return val instanceof Texture2D ? val : null;
    }

    private fixTexture(texture: Texture2D): void {
        texture.setWrapMode(Texture2D.WrapMode.CLAMP_TO_EDGE, Texture2D.WrapMode.CLAMP_TO_EDGE);
        texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
    }

    private fixLayer(layer: TiledLayer, noCullingSet: Set<string>): void {
        const layerName = layer.node.name;

        // 仅对指定图层禁用剔除，其余保持默认开启
        layer.enableCulling = !noCullingSet.has(layerName);

        // 坐标取整，避免亚像素间隙
        if (this.fixPositionSnap) {
            const pos = layer.node.position;
            layer.node.setPosition(Math.round(pos.x), Math.round(pos.y), pos.z);
        }
    }
}
