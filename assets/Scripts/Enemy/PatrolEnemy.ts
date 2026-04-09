import {
    _decorator, RigidBody2D, BoxCollider2D, Collider2D,
    ERigidBody2DType, Vec2, Contact2DType, IPhysics2DContact, physics
} from 'cc';
import { EnemyBase } from './EnemyBase';
import { PhysicsGroups } from '../Core/PhysicsGroups';

const { ccclass, property } = _decorator;

@ccclass('PatrolEnemy')
export class PatrolEnemy extends EnemyBase {

    @property({ tooltip: '巡逻速度' })
    patrolSpeed: number = 80;

    @property({ tooltip: '巡逻方向（1=右，-1=左）' })
    startDirection: number = -1;

    @property({ tooltip: '检测前方地面边缘的距离' })
    edgeCheckDistance: number = 8;

    private moveDir: number = -1;
    private readonly _vel = new Vec2();
    private readonly _rayEnd = new Vec2();
    private readonly _rayStart = new Vec2();

    @property({ tooltip: '边缘检测间隔（秒）' })
    edgeCheckInterval: number = 0.1;

    private edgeCheckTimer: number = 0;
    private isEdgeAheadCache: boolean = false;

    onLoad() {
        super.onLoad();
        this.moveDir = this.startDirection;

        const collider = this.getComponent(BoxCollider2D);
        if (collider) {
            collider.on(Contact2DType.BEGIN_CONTACT, this.onPatrolContact, this);
        }
    }

    onDestroy() {
        super.onDestroy();
        const collider = this.getComponent(BoxCollider2D);
        if (collider) {
            collider.off(Contact2DType.BEGIN_CONTACT, this.onPatrolContact, this);
        }
    }

    protected patrol(dt: number) {
        if (this.isDead || !this.rigidBody) return;

        this.edgeCheckTimer -= dt;
        if (this.edgeCheckTimer <= 0) {
            this.edgeCheckTimer = this.edgeCheckInterval;
            this.isEdgeAheadCache = this.isEdgeAhead();
        }

        if (this.isEdgeAheadCache) {
            this.reverse();
        }

        this._vel.set(this.rigidBody.linearVelocity);
        this._vel.x = this.moveDir * this.patrolSpeed;
        this.rigidBody.linearVelocity = this._vel;

        this.node.setScale(this.moveDir, 1, 1);
    }

    private onPatrolContact(_self: Collider2D, other: Collider2D, contact: IPhysics2DContact | null) {
        if (this.isDead || !contact) return;

        // 碰到墙壁掉头
        if (other.group === PhysicsGroups.WALL) {
            const manifold = contact.getWorldManifold(null);
            const normalX = manifold?.normal.x ?? 0;
            // 侧面碰撞（法线水平方向较大）
            if (Math.abs(normalX) > 0.5) {
                this.reverse();
            }
        }
    }

    private isEdgeAhead(): boolean {
        if (!this.rigidBody) return false;

        const pos = this.node.worldPosition;
        const checkX = pos.x + this.moveDir * this.edgeCheckDistance;
        const checkY = pos.y - 20;

        this._rayStart.set(checkX, pos.y);
        this._rayEnd.set(checkX, checkY);

        const results = physics.PhysicsSystem2D.instance.raycast(
            this._rayStart,
            this._rayEnd,
            0
        );

        return !results || results.length === 0;
    }

    private reverse() {
        this.moveDir *= -1;
        this.isEdgeAheadCache = false;
        this.edgeCheckTimer = this.edgeCheckInterval;
    }
}
