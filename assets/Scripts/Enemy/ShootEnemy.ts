import {
    _decorator, RigidBody2D, Prefab, instantiate, Node, Vec3, Vec2
} from 'cc';
import { EnemyBase } from './EnemyBase';
import { ObjectPool } from '../Core/ObjectPool';
import { BulletController } from '../Combat/BulletController';

const { ccclass, property } = _decorator;

@ccclass('ShootEnemy')
export class ShootEnemy extends EnemyBase {

    @property({ tooltip: '射击间隔（秒）' })
    shootInterval: number = 2;

    @property({ tooltip: '子弹速度' })
    bulletSpeed: number = 200;

    @property({ tooltip: '射击范围（像素）' })
    shootRange: number = 300;

    @property({ tooltip: '子弹预制体' })
    bulletPrefab: Prefab | null = null;

    private shootTimer: number = 0;
    private facingDir: number = -1;
    private bulletPool: ObjectPool | null = null;
    private playerNode: Node | null = null;

    @property({ tooltip: '玩家查找间隔（秒）' })
    playerFindInterval: number = 0.5;

    private playerFindTimer: number = 0;

    onLoad() {
        super.onLoad();
        if (this.bulletPrefab) {
            this.bulletPool = new ObjectPool(this.bulletPrefab, this.node.parent!, 3);
        }
    }

    protected patrol(dt: number) {
        if (this.isDead) return;
        this.playerFindTimer -= dt;
        if (this.playerFindTimer <= 0) {
            this.playerFindTimer = this.playerFindInterval;
            this.updatePlayerRef();
        }
        this.updateFacing();
        this.updateShoot(dt);
    }

    private updatePlayerRef() {
        if (!this.playerNode || !this.playerNode.isValid) {
            this.playerNode = this.findPlayer();
        }
    }

    private updateFacing() {
        if (!this.playerNode || !this.playerNode.isValid) return;

        const dx = this.playerNode.worldPosition.x - this.node.worldPosition.x;
        if (Math.abs(dx) < 1) return;
        this.facingDir = dx > 0 ? 1 : -1;
        this.node.setScale(this.facingDir, 1, 1);
    }

    private updateShoot(dt: number) {
        this.shootTimer -= dt;
        if (this.shootTimer > 0) return;

        if (!this.isPlayerInRange()) return;
        this.fireBullet();
        this.shootTimer = this.shootInterval;
    }

    private isPlayerInRange(): boolean {
        if (!this.playerNode) return false;
        const dx = this.playerNode.worldPosition.x - this.node.worldPosition.x;
        return Math.abs(dx) <= this.shootRange;
    }

    private fireBullet() {
        if (!this.bulletPool) return;

        const bulletNode = this.bulletPool.get();
        const pos = this.node.worldPosition;
        const offsetX = this.facingDir * 15;
        bulletNode.setWorldPosition(pos.x + offsetX, pos.y, pos.z);

        const bulletCtrl = bulletNode.getComponent(BulletController);
        if (bulletCtrl) {
            bulletCtrl.init(this.facingDir, (n: Node) => this.bulletPool!.put(n));
        }
    }

    private findPlayer(): Node | null {
        // 简单通过名称查找玩家节点
        const player = this.node.parent?.getChildByName('player');
        if (player) return player;

        // 向上查找
        let parent = this.node.parent;
        while (parent) {
            const found = parent.getChildByName('player');
            if (found) return found;
            parent = parent.parent;
        }
        return null;
    }

    protected onBulletDeath() {
        this.bulletPool?.putAll();
    }
}
