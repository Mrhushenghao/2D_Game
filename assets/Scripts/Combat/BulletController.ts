import {
    _decorator, Component, RigidBody2D, Collider2D, BoxCollider2D,
    ERigidBody2DType, Vec2, Contact2DType, IPhysics2DContact, Node
} from 'cc';
import { PhysicsGroups } from '../Core/PhysicsGroups';

const { ccclass, property } = _decorator;

@ccclass('BulletController')
export class BulletController extends Component {

    @property({ tooltip: '子弹飞行速度' })
    speed: number = 400;

    @property({ tooltip: '最大存活时间（秒）' })
    lifetime: number = 3;

    private rigidBody: RigidBody2D | null = null;
    private direction: number = 1;
    private elapsed: number = 0;
    private onReturn: ((node: Node) => void) | null = null;
    private isActive: boolean = false;
    private readonly _vel = new Vec2();

    onLoad() {
        this.rigidBody = this.getComponent(RigidBody2D);
        const collider = this.getComponent(BoxCollider2D);
        if (collider) {
            collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        }
    }

    onDestroy() {
        const collider = this.getComponent(BoxCollider2D);
        if (collider) {
            collider.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        }
    }

    init(direction: number, onReturn: (node: Node) => void) {
        this.direction = direction;
        this.onReturn = onReturn;
        this.elapsed = 0;
        this.isActive = true;
        this.node.setScale(direction, 1, 1);
    }

    update(dt: number) {
        if (!this.rigidBody) return;
        this._vel.set(this.direction * this.speed, 0);
        this.rigidBody.linearVelocity = this._vel;

        this.elapsed += dt;
        if (this.elapsed >= this.lifetime) {
            this.returnToPool();
        }
    }

    private onBeginContact(_self: Collider2D, other: Collider2D, contact: IPhysics2DContact | null) {
        if (!contact) return;

        const otherGroup = other.group;
        const isWall = otherGroup === PhysicsGroups.WALL;
        const isMonster = otherGroup === PhysicsGroups.MONSTER;

        if (isWall || isMonster) {
            this.returnToPool();
        }
    }

    private returnToPool() {
        if (!this.isActive) return;
        this.isActive = false;
        if (this.onReturn) {
            this.onReturn(this.node);
        } else {
            this.node.destroy();
        }
    }
}
