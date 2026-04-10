import {
    _decorator, Component, RigidBody2D, BoxCollider2D, Collider2D,
    ERigidBody2DType, Vec2, Node, Animation, Color, Graphics,
    Contact2DType, IPhysics2DContact, Vec3, Prefab, KeyCode, input, Input
} from 'cc';
import { GameManager } from '../Core/GameManager';
import { ObjectPool } from '../Core/ObjectPool';
import { PhysicsGroups } from '../Core/PhysicsGroups';
import { BulletController } from '../Combat/BulletController';

const { ccclass, property } = _decorator;

const enum STATE {
    idle, run, jumpUp, jumpDown, climb, climbIdle, hurt, crouch
}

const CLIP_NAMES = ['idle', 'run', 'jumpUp', 'jumpDown', 'climb', 'climbIdle', 'hurt', 'crouch'];

const GRAVITY_NORMAL = 1;
const GRAVITY_LADDER = 0;

@ccclass('PlayerController')
export class PlayerController extends Component {

    @property({ tooltip: '移动速度' })
    moveSpeed: number = 200;

    @property({ tooltip: '跳跃力度' })
    jumpForce: number = 500;

    @property({ tooltip: '爬梯子速度' })
    climbSpeed: number = 150;

    @property({ tooltip: '蹲下移动速度' })
    crouchSpeed: number = 80;

    @property({ tooltip: '受伤无敌时间（秒）' })
    invincibleDuration: number = 0.5;

    @property({ tooltip: '受伤击退力度' })
    hurtKnockback: number = 200;

    @property({ tooltip: '射击冷却（秒）' })
    shootCooldown: number = 0.25;

    @property({ tooltip: '踩踏弹跳力度' })
    stompBounce: number = 300;

    @property({ tooltip: '子弹预制体' })
    bulletPrefab: Prefab | null = null;

    @property({ tooltip: '子弹生成点' })
    bulletSpawn: Node | null = null;

    @property({ tooltip: '世界X范围 最小值' })
    minWorldX: number = 0;

    @property({ tooltip: '世界X范围 最大值' })
    maxWorldX: number = 1456;

    @property({ tooltip: '显示调试碰撞盒' })
    showDebug: boolean = true;

    @property({ tooltip: '调试区域颜色' })
    debugColor: Color = new Color(0, 255, 0, 200);

    @property(Animation)
    aniNode: Animation = null;

    private rigidBody: RigidBody2D | null = null;
    private curState: STATE = STATE.idle;
    private horizontalInput: number = 0;
    private verticalInput: number = 0;
    private isGrounded: boolean = false;
    private groundContactCount: number = 0;
    private canReGround: boolean = true;
    private nearLadder: boolean = false;
    private onLadder: boolean = false;
    private isCrouching: boolean = false;

    // 受伤无敌
    private isInvincible: boolean = false;
    private invincibleTimer: number = 0;

    // 射击
    private shootTimer: number = 0;
    private bulletPool: ObjectPool | null = null;
    private isFacingRight: boolean = true;

    // 缓存原始碰撞体尺寸
    private originalColliderHeight: number = 0;
    private originalColliderOffsetY: number = 0;

    private readonly _vel = new Vec2();
    private readonly _worldPos = new Vec3();
    private startPosition = new Vec3();

    onLoad() {
        this.rigidBody = this.getComponent(RigidBody2D);
        this.startPosition.set(this.node.position);

        if (!this.rigidBody) {
            console.warn('[Player] 未找到 RigidBody2D');
            this.enabled = false;
            return;
        }

        this.rigidBody.group = PhysicsGroups.HERO;
        this.cacheColliderSize();
        this.initCollider();
        this.initInput();
        this.initBulletPool();
        this.initGameManagerEvents();

        if (this.showDebug) this.addDebugGraphic();
    }

    onDestroy() {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);

        const collider = this.getComponent(BoxCollider2D);
        if (collider) {
            collider.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
            collider.off(Contact2DType.END_CONTACT, this.onEndContact, this);
        }

        const gm = GameManager.instance;
        if (gm) {
            gm.node.off('player-die', this.onPlayerDie, this);
        }
    }

    update(dt: number) {
        this.updateInvincible(dt);
        this.updateShootCooldown(dt);

        if (this.onLadder) {
            this.handleClimbMovement();
        } else if (this.isCrouching) {
            this.handleCrouchMovement();
        } else {
            this.handleMovement();
        }
        this.updateState();
        this.updateFacing();
        this.clampWorldPosition();
    }

    // ==================== 输入处理 ====================

    private initInput() {
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
    }

    private onKeyDown(event: any) {
        switch (event.keyCode) {
            case KeyCode.KEY_A:
            case KeyCode.ARROW_LEFT:
                this.horizontalInput = -1;
                break;
            case KeyCode.KEY_D:
            case KeyCode.ARROW_RIGHT:
                this.horizontalInput = 1;
                break;
            case KeyCode.KEY_W:
            case KeyCode.ARROW_UP:
                this.handleVerticalPress(1);
                break;
            case KeyCode.KEY_S:
            case KeyCode.ARROW_DOWN:
                this.handleDownPress();
                break;
            case KeyCode.SPACE:
                if (this.onLadder) this.exitLadder();
                break;
            case KeyCode.KEY_J:
                this.shoot();
                break;
        }
    }

    private onKeyUp(event: any) {
        switch (event.keyCode) {
            case KeyCode.KEY_A:
            case KeyCode.ARROW_LEFT:
                if (this.horizontalInput === -1) this.horizontalInput = 0;
                break;
            case KeyCode.KEY_D:
            case KeyCode.ARROW_RIGHT:
                if (this.horizontalInput === 1) this.horizontalInput = 0;
                break;
            case KeyCode.KEY_W:
            case KeyCode.ARROW_UP:
                if (this.verticalInput === 1) this.verticalInput = 0;
                break;
            case KeyCode.KEY_S:
            case KeyCode.ARROW_DOWN:
                if (this.verticalInput === -1) this.verticalInput = 0;
                if (this.isCrouching) this.standUp();
                break;
        }
    }

    private handleVerticalPress(direction: number) {
        if (this.isInvincible) return;
        if (this.onLadder) {
            this.verticalInput = direction;
            return;
        }
        if (this.nearLadder) {
            this.enterLadder();
            this.verticalInput = direction;
            return;
        }
        if (direction === 1) this.jump();
    }

    private handleDownPress() {
        if (this.isInvincible) return;
        if (this.onLadder) {
            this.verticalInput = -1;
            return;
        }
        if (this.isGrounded && !this.isCrouching) {
            this.crouch();
        }
    }

    // ==================== 移动处理 ====================

    private handleMovement() {
        if (!this.rigidBody || this.isInvincible) return;
        this._vel.set(this.rigidBody.linearVelocity);
        this._vel.x = this.horizontalInput * this.moveSpeed;
        this.rigidBody.linearVelocity = this._vel;
    }

    private handleCrouchMovement() {
        if (!this.rigidBody || this.isInvincible) return;
        this._vel.set(this.rigidBody.linearVelocity);
        this._vel.x = this.horizontalInput * this.crouchSpeed;
        this.rigidBody.linearVelocity = this._vel;
    }

    private handleClimbMovement() {
        if (!this.rigidBody || this.isInvincible) return;
        this._vel.set(
            this.horizontalInput * this.moveSpeed * 0.5,
            this.verticalInput * this.climbSpeed
        );
        this.rigidBody.linearVelocity = this._vel;
    }

    private jump() {
        if (!this.rigidBody || !this.isGrounded || this.isInvincible) return;
        this._vel.set(this.rigidBody.linearVelocity);
        this._vel.y = this.jumpForce;
        this.rigidBody.linearVelocity = this._vel;
        this.isGrounded = false;
        this.canReGround = false;
        if (this.isCrouching) this.standUp();
    }

    // ==================== 蹲下 ====================

    private cacheColliderSize() {
        const collider = this.getComponent(BoxCollider2D);
        if (collider) {
            this.originalColliderHeight = collider.size.height;
            this.originalColliderOffsetY = collider.offset.y;
        }
    }

    private crouch() {
        this.isCrouching = true;
        const collider = this.getComponent(BoxCollider2D);
        if (collider) {
            collider.size.height = this.originalColliderHeight * 0.6;
            collider.offset.y = this.originalColliderOffsetY - this.originalColliderHeight * 0.2;
            collider.apply();
        }
    }

    private standUp() {
        this.isCrouching = false;
        const collider = this.getComponent(BoxCollider2D);
        if (collider) {
            collider.size.height = this.originalColliderHeight;
            collider.offset.y = this.originalColliderOffsetY;
            collider.apply();
        }
    }

    // ==================== 射击 ====================

    private initGameManagerEvents() {
        const gm = GameManager.instance;
        if (gm) {
            gm.node.on('player-die', this.onPlayerDie, this);
        }
    }

    private onPlayerDie(hasLives: boolean) {
        if (!hasLives) return;

        this.isInvincible = false;
        this.isCrouching = false;
        this.onLadder = false;
        this.nearLadder = false;

        if (this.rigidBody) {
            this.rigidBody.linearVelocity = Vec2.ZERO;
            this.rigidBody.gravityScale = GRAVITY_NORMAL;
            (this.rigidBody as any).wakeUp?.();
        }

        this.scheduleOnce(() => {
            this.node.setPosition(this.startPosition);
            this.curState = STATE.idle;
            this.aniNode?.play(CLIP_NAMES[STATE.idle]);
        }, 0);
    }

    private initBulletPool() {
        if (!this.bulletPrefab) return;
        this.bulletPool = new ObjectPool(this.bulletPrefab, this.node.parent!, 8);
    }

    private shoot() {
        if (!this.bulletPool || this.shootTimer > 0) return;

        const bulletNode = this.bulletPool.get();
        const spawnPos = this.bulletSpawn?.worldPosition ?? this.node.worldPosition;
        const dir = this.isFacingRight ? 1 : -1;
        const offsetX = dir * 15;
        bulletNode.setWorldPosition(spawnPos.x + offsetX, spawnPos.y, spawnPos.z);

        const bulletCtrl = bulletNode.getComponent(BulletController);
        if (bulletCtrl) {
            bulletCtrl.init(dir, (n: Node) => this.bulletPool!.put(n));
        }

        this.shootTimer = this.shootCooldown;
    }

    private updateShootCooldown(dt: number) {
        if (this.shootTimer > 0) this.shootTimer -= dt;
    }

    // ==================== 梯子控制 ====================

    enterLadder() {
        if (this.onLadder) return;
        this.onLadder = true;
        if (this.verticalInput !== 0) {
            this.rigidBody!.gravityScale = GRAVITY_LADDER;
            this._vel.set(this.rigidBody!.linearVelocity);
            this._vel.y = 0;
            this.rigidBody!.linearVelocity = this._vel;
        }
    }

    exitLadder() {
        if (!this.onLadder) return;
        this.onLadder = false;
        this.verticalInput = 0;
        if (this.rigidBody) this.rigidBody.gravityScale = GRAVITY_NORMAL;
    }

    // ==================== 受伤 & 无敌 ====================

    takeDamage(fromX: number) {
        if (this.isInvincible) return;

        const gm = GameManager.instance;
        if (!gm || !gm.takeDamage(1)) return;

        this.isInvincible = true;
        this.invincibleTimer = this.invincibleDuration;

        // 击退
        const knockDir = this.node.worldPosition.x < fromX ? -1 : 1;
        this._vel.set(knockDir * this.hurtKnockback, this.hurtKnockback * 0.5);
        this.rigidBody!.linearVelocity = this._vel;

        this.curState = STATE.hurt;
        this.aniNode?.play(CLIP_NAMES[STATE.hurt]);
    }

    private updateInvincible(dt: number) {
        if (!this.isInvincible) return;
        this.invincibleTimer -= dt;

        if (this.invincibleTimer <= 0) {
            this.isInvincible = false;
        }
    }

    // ==================== 碰撞检测 ====================

    private initCollider() {
        const collider = this.getComponent(BoxCollider2D);
        if (!collider) {
            console.warn('[Player] 未找到 BoxCollider2D');
            return;
        }
        collider.group = PhysicsGroups.HERO;
        collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        collider.on(Contact2DType.END_CONTACT, this.onEndContact, this);
        collider.apply();
    }

    onBeginContact(_self: Collider2D, other: Collider2D, contact: IPhysics2DContact | null) {
        if (!contact) return;

        if (other.group === PhysicsGroups.LADDER) {
            this.onLadderEnter();
            return;
        }

        const otherGroup = other.group;

        // 道具拾取
        if (otherGroup === PhysicsGroups.ITEM) {
            other.node.emit('collected');
            return;
        }

        // 敌人碰撞
        if (otherGroup === PhysicsGroups.MONSTER) {
            this.handleEnemyContact(other, contact);
            return;
        }

        // 地面/墙壁
        if (otherGroup === PhysicsGroups.WALL) {
            this.groundContactCount++;
            if (this.canReGround) this.isGrounded = true;
        }
    }

    onEndContact(_self: Collider2D, other: Collider2D, contact: IPhysics2DContact | null) {
        if (!contact) return;

        if (other.group === PhysicsGroups.LADDER) {
            this.onLadderExit();
            return;
        }

        if (other.group !== PhysicsGroups.WALL) return;

        this.groundContactCount--;
        if (this.groundContactCount <= 0) {
            this.groundContactCount = 0;
            this.isGrounded = false;
            this.canReGround = true;
        }
    }

    private handleEnemyContact(other: Collider2D, _contact: IPhysics2DContact) {
        const playerY = this.node.worldPosition.y;
        const enemyY = other.node.worldPosition.y;
        const velY = this.rigidBody!.linearVelocity.y;

        const isAbove = playerY > enemyY + 14;
        const isFalling = velY < 0;

        if (isAbove && isFalling) {
            other.node.emit('stomped');
            this._vel.set(this.rigidBody!.linearVelocity);
            this._vel.y = this.stompBounce;
            this.rigidBody!.linearVelocity = this._vel;
        } else {
            const enemyX = other.node.worldPosition.x;
            this.takeDamage(enemyX);
        }
    }

    // ==================== 梯子碰撞 ====================

    private onLadderEnter() {
        this.nearLadder = true;
        if (this.onLadder && this.rigidBody) {
            this.rigidBody.gravityScale = GRAVITY_LADDER;
            this._vel.set(this.rigidBody.linearVelocity);
            this._vel.y = 0;
            this.rigidBody.linearVelocity = this._vel;
        }
    }

    private onLadderExit() {
        this.nearLadder = false;
        this.exitLadder();
    }

    // ==================== 状态与表现 ====================

    private updateState() {
        if (!this.rigidBody) return;

        if (this.isInvincible && this.curState === STATE.hurt) return;

        let newState: STATE;
        if (this.onLadder || this.nearLadder) {
            newState = (this.verticalInput !== 0 || this.horizontalInput !== 0) ? STATE.climb : STATE.climbIdle;
        } else if (!this.isGrounded) {
            newState = this.rigidBody.linearVelocity.y > 0 ? STATE.jumpUp : STATE.jumpDown;
        } else if (this.isCrouching) {
            newState = STATE.crouch;
        } else if (this.horizontalInput !== 0) {
            newState = STATE.run;
        } else {
            newState = STATE.idle;
        }

        if (this.curState === newState) return;
        this.curState = newState;
        this.aniNode?.play(CLIP_NAMES[newState]);
    }

    private updateFacing() {
        if (this.horizontalInput > 0) {
            this.isFacingRight = true;
            if (!this.isInvincible) this.node.setScale(1, 1, 1);
        } else if (this.horizontalInput < 0) {
            this.isFacingRight = false;
            if (!this.isInvincible) this.node.setScale(-1, 1, 1);
        }
    }

    private clampWorldPosition() {
        this.node.getWorldPosition(this._worldPos);
        const clampedX = Math.max(this.minWorldX, Math.min(this.maxWorldX, this._worldPos.x));
        if (this._worldPos.x !== clampedX) {
            this._worldPos.x = clampedX;
            this.node.setWorldPosition(this._worldPos);
        }
    }

    // ==================== 调试 ====================

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
