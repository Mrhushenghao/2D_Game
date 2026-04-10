import { _decorator, BoxCollider2D, Vec2 } from 'cc';
import { EnemyBase } from './EnemyBase';

const { ccclass, property } = _decorator;

@ccclass('EagleEnemy')
export class EagleEnemy extends EnemyBase {

    @property({ tooltip: '移动速度' })
    moveSpeed: number = 60;

    @property({ tooltip: '巡逻范围（从起点单侧距离）' })
    patrolRange: number = 100;

    private moveDir = 1;
    private originX = 0;
    private startTimer = 0;

    @property({ tooltip: '生成后最大延迟时间（秒），实际延迟为 0~此值之间的随机数' })
    maxStartDelay: number = 2;

    onLoad() {
        super.onLoad();
        this.originX = this.node.position.x;
        this.startTimer = Math.random() * this.maxStartDelay;
        if (this.rigidBody) {
            this.rigidBody.gravityScale = 0;
            (this.rigidBody as any).wakeUp?.();
        }
        const collider = this.getComponent(BoxCollider2D);
        if (collider) {
            collider.sensor = true;
            collider.apply();
        }
    }

    protected patrol(dt: number) {
        if (this.isDead || !this.rigidBody) return;

        this.startTimer -= dt;
        if (this.startTimer > 0) {
            this.rigidBody.linearVelocity = Vec2.ZERO;
            return;
        }

        const x = this.node.position.x;
        if (x >= this.originX + this.patrolRange) this.moveDir = -1;
        else if (x <= this.originX - this.patrolRange) this.moveDir = 1;

        this._vel.set(this.moveDir * this.moveSpeed, 0);
        this.rigidBody.linearVelocity = this._vel;

        this.node.setScale(-this.moveDir, 1, 1);
    }
}
