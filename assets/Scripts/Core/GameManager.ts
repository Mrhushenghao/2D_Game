import { _decorator, Component } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('GameManager')
export class GameManager extends Component {

    static instance: GameManager | null = null;

    @property({ tooltip: '玩家初始生命值' })
    maxHp: number = 3;

    @property({ tooltip: '初始命数' })
    lives: number = 3;

    @property({ tooltip: '初始分数' })
    score: number = 0;

    @property({ tooltip: '初始金币' })
    coins: number = 0;

    hp: number = 0;
    private isGameOver: boolean = false;

    onLoad() {
        if (GameManager.instance) {
            this.node.destroy();
            return;
        }
        GameManager.instance = this;
        this.hp = this.maxHp;
    }

    onDestroy() {
        if (GameManager.instance === this) {
            GameManager.instance = null;
        }
    }

    takeDamage(amount: number): boolean {
        if (this.hp <= 0) return false;
        this.hp = Math.max(0, this.hp - amount);
        this.emitDataChange('hp');
        if (this.hp <= 0) this.onPlayerDie();
        return true;
    }

    heal(amount: number) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
        this.emitDataChange('hp');
    }

    addScore(value: number) {
        this.score += value;
        this.emitDataChange('score');
    }

    addCoin() {
        this.coins++;
        this.addScore(100);
        this.emitDataChange('coins');
    }

    private emitDataChange(type: 'hp' | 'score' | 'coins' | 'lives') {
        this.node.emit('data-change', type);
    }

    private onPlayerDie() {
        this.lives--;
        this.emitDataChange('lives');
        if (this.lives <= 0) {
            this.gameOver();
        }
        // 由外部监听处理重生逻辑
        this.node.emit('player-die', this.lives > 0);
    }

    private gameOver() {
        this.isGameOver = true;
        this.node.emit('game-over');
    }

    restart() {
        this.hp = this.maxHp;
        this.lives = 3;
        this.score = 0;
        this.coins = 0;
        this.isGameOver = false;
        this.emitDataChange('hp');
        this.emitDataChange('score');
        this.emitDataChange('coins');
        this.emitDataChange('lives');
    }
}
