import {
    _decorator, Component, BoxCollider2D, Collider2D,
    Contact2DType, IPhysics2DContact, Node, tween, Vec3
} from 'cc';
import { GameManager } from '../Core/GameManager';
import { PhysicsGroups } from '../Core/PhysicsGroups';

const { ccclass, property } = _decorator;

const enum ItemType {
    coin,
    hp,
}

@ccclass('CollectibleItem')
export class CollectibleItem extends Component {

    @property({ tooltip: '道具类型' })
    itemType: ItemType = ItemType.coin;

    @property({ tooltip: '恢复血量' })
    healAmount: number = 1;

    @property({ tooltip: '拾取后浮动动画时长' })
    collectAnimDuration: number = 0.4;

    private isCollected: boolean = false;

    onLoad() {
        const collider = this.getComponent(BoxCollider2D);
        if (collider) {
            collider.sensor = true;
            collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        }

        this.node.on('collected', this.collect, this);
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
        // 只响应玩家碰撞
        if (other.group === PhysicsGroups.HERO) {
            this.collect();
        }
    }

    private collect() {
        if (this.isCollected) return;
        this.isCollected = true;

        const gm = GameManager.instance;
        if (gm) {
            switch (this.itemType) {
                case ItemType.coin:
                    gm.addCoin();
                    break;
                case ItemType.hp:
                    gm.heal(this.healAmount);
                    break;
            }
        }

        this.playCollectAnim();
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
}
