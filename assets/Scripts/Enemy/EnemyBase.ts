import {
    _decorator, Component, RigidBody2D, BoxCollider2D, Collider2D,
    ERigidBody2DType, Vec2, Animation, Node, Contact2DType, IPhysics2DContact, tween, Vec3, Sprite, Color
} from 'cc';
import { GameManager } from '../Core/GameManager';
import { PhysicsGroups } from '../Core/PhysicsGroups';

const { ccclass, property } = _decorator;

@ccclass('EnemyBase')
export class EnemyBase extends Component {

    @property({ tooltip: '生命值' })
    hp: number = 1;

    @property({ tooltip: '碰撞伤害' })
    damage: number = 1;

    @property({ tooltip: '被踩踏给予的分数' })
    stompScore: number = 100;

    @property({ tooltip: '被击杀给予的分数' })
    killScore: number = 200;

    @property({ tooltip: '死亡后是否掉落道具' })
    dropItem: boolean = false;

    @property({ tooltip: '受伤无敌时间（秒）' })
    hurtInvincibleTime: number = 0.3;

    protected rigidBody: RigidBody2D | null = null;
    protected aniNode: Animation | null = null;
    protected isDead: boolean = false;
    protected isHurt: boolean = false;

    private invincibleTimer: number = 0;
    protected _vel = new Vec2();
    private readonly _whiteColor = new Color(255, 255, 255, 255);
    private readonly _transparentWhite = new Color(255, 255, 255, 80);

    onLoad() {
        this.rigidBody = this.getComponent(RigidBody2D);
        this.aniNode = this.getComponent(Animation);

        const collider = this.getComponent(BoxCollider2D);
        if (collider) {
            collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        }

        this.node.on('stomped', this.onStomped, this);
    }

    onDestroy() {
        const collider = this.getComponent(BoxCollider2D);
        if (collider) {
            collider.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        }
        this.node.off('stomped', this.onStomped, this);
        if (this.aniNode) {
            this.aniNode.off(Animation.EventType.FINISHED, this.onDeathAnimEnd, this);
        }
    }

    update(dt: number) {
        if (this.isDead) return;
        this.updateHurtTimer(dt);
        this.patrol(dt);
    }

    // ==================== 碰撞 ====================

    private onBeginContact(_self: Collider2D, other: Collider2D, contact: IPhysics2DContact | null) {
        if (this.isDead || !contact) return;

        // 被子弹击中
        if (other.group === PhysicsGroups.BULLET) {
            this.onHit();
        }
    }

    private onStomped() {
        if (this.isDead) return;
        this.die();
        this.onStompDeath();
    }

    // ==================== 受伤 & 死亡 ====================

    protected onHit() {
        if (this.isHurt) return;
        this.hp--;
        if (this.hp <= 0) {
            this.die();
            this.onBulletDeath();
        } else {
            this.startHurt();
        }
    }

    protected startHurt() {
        this.isHurt = true;
        this.invincibleTimer = this.hurtInvincibleTime;
    }

    private updateHurtTimer(dt: number) {
        if (!this.isHurt) return;
        this.invincibleTimer -= dt;
        const render = this.getComponent(Sprite);
        if (render) {
            const blink = Math.floor(this.invincibleTimer * 10) % 2 === 0;
            render.color = blink ? this._whiteColor : this._transparentWhite;
        }
        if (this.invincibleTimer <= 0) {
            this.isHurt = false;
            if (render) render.color = this._whiteColor;
        }
    }

    protected die() {
        this.isDead = true;

        if (this.rigidBody) {
            this.rigidBody.linearVelocity = Vec2.ZERO;
            this.rigidBody.gravityScale = 0;
        }

        const collider = this.getComponent(BoxCollider2D);
        if (collider) collider.sensor = true;

        if (this.aniNode && this.aniNode.getState('death')) {
            this.aniNode.play('death');
            this.aniNode.once(Animation.EventType.FINISHED, this.onDeathAnimEnd, this);
        } else {
            tween(this.node)
                .to(0.3, { scale: new Vec3(1.2, 0.1, 1) })
                .call(() => { if (this.node.isValid) this.node.destroy(); })
                .start();
        }
    }

    private onDeathAnimEnd() {
        if (this.node.isValid) this.node.destroy();
    }

    protected onStompDeath() {
        const gm = GameManager.instance;
        if (gm) gm.addScore(this.stompScore);
    }

    protected onBulletDeath() {
        const gm = GameManager.instance;
        if (gm) gm.addScore(this.killScore);
    }

    // ==================== 巡逻（子类覆写）====================

    protected patrol(_dt: number) {
        // 由子类实现具体巡逻逻辑
    }
}
