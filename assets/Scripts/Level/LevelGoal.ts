import {
    _decorator, Component, BoxCollider2D, Collider2D,
    Contact2DType, IPhysics2DContact, Node, tween, Vec3
} from 'cc';
import { GameManager } from '../Core/GameManager';
import { PhysicsGroups } from '../Core/PhysicsGroups';

const { ccclass, property } = _decorator;

@ccclass('LevelGoal')
export class LevelGoal extends Component {

    @property({ tooltip: '下一关卡场景名称（留空则触发通关）' })
    nextScene: string = '';

    @property({ tooltip: '是否播放胜利动画' })
    playVictoryAnim: boolean = true;

    private isTriggered: boolean = false;

    onLoad() {
        const collider = this.getComponent(BoxCollider2D);
        if (collider) {
            collider.sensor = true;
            collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        }
    }

    onDestroy() {
        const collider = this.getComponent(BoxCollider2D);
        if (collider) {
            collider.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        }
    }

    private onBeginContact(_self: Collider2D, other: Collider2D, contact: IPhysics2DContact | null) {
        if (!contact || this.isTriggered) return;

        // 只响应玩家
        if (other.group === PhysicsGroups.HERO) {
            this.onReachGoal(other.node);
        }
    }

    private onReachGoal(playerNode: Node) {
        this.isTriggered = true;

        // 停止玩家控制
        const playerCtrl = playerNode.getComponent('PlayerController');
        if (playerCtrl) {
            (playerCtrl as any).enabled = false;
        }

        // 胜利动画
        if (this.playVictoryAnim) {
            tween(playerNode)
                .to(0.3, { scale: new Vec3(1, 1, 1) })
                .delay(0.5)
                .call(() => this.finishLevel())
                .start();
        } else {
            this.finishLevel();
        }
    }

    private finishLevel() {
        const gm = GameManager.instance;
        if (gm) gm.node.emit('level-complete', this.nextScene);
    }
}
