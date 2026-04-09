import { _decorator, Component, Camera, Vec3, Node, director, find } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('CameraFollow')
export class CameraFollow extends Component {

    @property({ tooltip: '要跟随的目标节点' })
    target: Node | null = null;

    @property({ tooltip: '目标节点名称' })
    targetName: string = 'Player';

    @property({ tooltip: '相机X轴最小值' })
    minX: number = 0;

    @property({ tooltip: '相机X轴最大值' })
    maxX: number = 1000;

    @property({ tooltip: '平滑跟随系数（0-1）' })
    smoothFactor: number = 0.1;

    @property({ tooltip: 'Y轴偏移量' })
    offsetY: number = 0;

    @property({ tooltip: 'Z轴偏移量' })
    offsetZ: number = 0;

    @property({ tooltip: '是否固定Y轴' })
    fixedY: boolean = true;

    @property({ tooltip: 'X轴偏移量' })
    offsetX: number = 0;

    // 屏幕震动
    @property({ tooltip: '震动衰减速度' })
    shakeDecay: number = 5;

    private camera: Camera | null = null;
    private initialY: number = 0;
    private shakeIntensity: number = 0;
    private shakeTimer: number = 0;
    private readonly _targetPos = new Vec3();
    private readonly _currentPos = new Vec3();
    private readonly _shakeOffset = new Vec3();
    private readonly _finalPos = new Vec3();

    onLoad() {
        this.camera = this.getComponent(Camera);
        if (!this.camera) {
            console.warn('[CameraFollow] 未找到 Camera 组件');
        }

        this.initialY = this.node.position.y;

        if (!this.target && this.targetName) {
            this.target = find(this.targetName) ?? this.findNodeByName(this.targetName);
            if (!this.target) {
                console.warn('[CameraFollow] 未找到目标节点:', this.targetName);
            }
        }
    }

    private findNodeByName(name: string): Node | null {
        const scene = director.getScene();
        if (!scene) return null;
        return scene.getChildByName(name) ?? this.findInChildren(scene, name);
    }

    private findInChildren(root: Node, name: string): Node | null {
        for (const child of root.children) {
            if (child.name === name) return child;
            const found = this.findInChildren(child, name);
            if (found) return found;
        }
        return null;
    }

    update(deltaTime: number) {
        if (!this.target) return;

        this.target.getPosition(this._targetPos);
        this.node.getPosition(this._currentPos);

        const t = 1 - Math.pow(1 - this.smoothFactor, deltaTime * 60);

        const targetX = Math.max(this.minX, Math.min(this.maxX, this._targetPos.x + this.offsetX));
        const newX = this._currentPos.x + (targetX - this._currentPos.x) * t;

        const targetY = this.fixedY
            ? this.initialY
            : this._currentPos.y + (this._targetPos.y + this.offsetY - this._currentPos.y) * t;

        this.updateShake(deltaTime);

        this._finalPos.set(
            newX + this._shakeOffset.x,
            targetY + this._shakeOffset.y,
            this.offsetZ
        );

        // 位置变化较小时跳过设置，减少渲染开销
        if (Math.abs(this._finalPos.x - this._currentPos.x) > 0.01 ||
            Math.abs(this._finalPos.y - this._currentPos.y) > 0.01 ||
            Math.abs(this._finalPos.z - this._currentPos.z) > 0.01) {
            this.node.setPosition(this._finalPos);
        }
    }

    shake(intensity: number, duration: number = 0.3) {
        this.shakeIntensity = intensity;
        this.shakeTimer = duration;
    }

    private updateShake(dt: number) {
        if (this.shakeTimer <= 0) {
            this._shakeOffset.set(0, 0, 0);
            return;
        }

        this.shakeTimer -= dt;
        const range = this.shakeIntensity * (this.shakeTimer / 0.3);
        this._shakeOffset.x = (Math.random() * 2 - 1) * range;
        this._shakeOffset.y = (Math.random() * 2 - 1) * range;

        if (this.shakeTimer <= 0) {
            this.shakeIntensity = 0;
            this._shakeOffset.set(0, 0, 0);
        }
    }
}
