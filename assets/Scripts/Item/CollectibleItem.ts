import {
    _decorator, Component, BoxCollider2D, Collider2D, RigidBody2D, ERigidBody2DType,
    Contact2DType, IPhysics2DContact, Node, tween, Vec3, Animation, CCInteger, Color, Graphics
} from 'cc';
import { GameManager } from '../Core/GameManager';
import { PhysicsGroups } from '../Core/PhysicsGroups';

const { ccclass, property } = _decorator;

export enum ItemType {
    coin,
    gem,
    health,
}

@ccclass('CollectibleItem')
export class CollectibleItem extends Component {

    @property({ tooltip: '道具类型', type: CCInteger })
    itemType: ItemType = ItemType.coin;

    @property({ tooltip: '恢复血量' })
    healAmount: number = 1;

    @property({ tooltip: '拾取后浮动动画时长' })
    collectAnimDuration: number = 0.4;

    private isCollected: boolean = false;
    private animation: Animation | null = null;

    @property({ tooltip: '显示调试碰撞盒' })
    showDebug: boolean = false;

    @property({ tooltip: '调试区域颜色' })
    debugColor: Color = new Color(255, 255, 0, 200);

    onLoad() {
        let body = this.getComponent(RigidBody2D);
        if (!body) {
            body = this.node.addComponent(RigidBody2D);
        }
        body.type = ERigidBody2DType.Static;
        body.group = PhysicsGroups.ITEM;
        body.enabledContactListener = true;
        body.awakeOnLoad = true;

        const collider = this.getComponent(BoxCollider2D);
        if (collider) {
            collider.sensor = true;
            collider.group = PhysicsGroups.ITEM;
            collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
            this.scheduleOnce(() => collider.apply(), 0);
        }

        this.animation = this.getComponent(Animation);
        this.node.on('collected', this.collect, this);

        if (this.showDebug) this.addDebugGraphic();
    }

    onDestroy() {
        const collider = this.getComponent(BoxCollider2D);
        if (collider) {
            collider.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        }
        this.node.off('collected', this.collect, this);
    }

    private onBeginContact(_self: Collider2D, other: Collider2D, contact: IPhysics2DContact | null) {
        if (!contact) return;
        if (other.group === PhysicsGroups.HERO) {
            this.collect();
        }
    }

    private collect() {
        if (this.isCollected) return;
        this.isCollected = true;

        const hasFeedback = this.animation && this.animation.clips.some(c => c.name === 'feedback');
        if (hasFeedback) {
            this.animation!.play('feedback');
            this.animation!.once(Animation.EventType.FINISHED, this.onFeedbackEnd, this);
            return;
        }

        this.applyEffect();
        this.playCollectAnim();
    }

    private onFeedbackEnd() {
        this.applyEffect();
        this.node.destroy();
    }

    private applyEffect() {
        const gm = GameManager.instance;
        if (!gm) return;

        switch (this.itemType) {
            case ItemType.coin:
                gm.addCoin();
                break;
            case ItemType.gem:
                gm.addScore(100);
                break;
            case ItemType.health:
                gm.heal(this.healAmount);
                break;
        }
    }

    private playCollectAnim() {
        const pos = this.node.position;
        tween(this.node)
            .to(this.collectAnimDuration, {
                position: new Vec3(pos.x, pos.y + 30, pos.z),
                scale: new Vec3(1.5, 1.5, 1),
            })
            .call(() => this.node.destroy())
            .start();
    }

    private addDebugGraphic() {
        const collider = this.getComponent(BoxCollider2D);
        if (!collider) return;

        const debugNode = new Node('DebugGraphic');
        debugNode.parent = this.node;
        debugNode.setPosition(collider.offset.x, collider.offset.y, 0);
        debugNode.layer = this.node.layer;

        const g = debugNode.addComponent(Graphics);
        this.scheduleOnce(() => {
            g.clear();
            g.fillColor = this.debugColor.clone();
            g.strokeColor = new Color(255, 255, 255, 255);
            g.lineWidth = 2;
            const hx = -collider.size.width / 2;
            const hy = -collider.size.height / 2;
            g.moveTo(hx, hy);
            g.lineTo(hx + collider.size.width, hy);
            g.lineTo(hx + collider.size.width, hy + collider.size.height);
            g.lineTo(hx, hy + collider.size.height);
            g.close();
            g.fill();
            g.stroke();
        }, 0);
    }
}
