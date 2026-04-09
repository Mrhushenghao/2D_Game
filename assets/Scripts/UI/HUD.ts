import { _decorator, Component, Label, Node, find } from 'cc';
import { GameManager } from '../Core/GameManager';

const { ccclass, property } = _decorator;

@ccclass('HUD')
export class HUD extends Component {

    @property(Label)
    scoreLabel: Label | null = null;

    @property(Label)
    coinLabel: Label | null = null;

    @property(Label)
    hpLabel: Label | null = null;

    @property(Label)
    livesLabel: Label | null = null;

    private gm: GameManager | null = null;

    onLoad() {
        this.gm = GameManager.instance;
        if (this.gm) {
            this.gm.node.on('data-change', this.onDataChange, this);
            this.gm.node.on('player-die', this.onPlayerDie, this);
            this.gm.node.on('game-over', this.onGameOver, this);
        }
        this.refreshAll();
    }

    onDestroy() {
        if (this.gm) {
            this.gm.node.off('data-change', this.onDataChange, this);
            this.gm.node.off('player-die', this.onPlayerDie, this);
            this.gm.node.off('game-over', this.onGameOver, this);
        }
    }

    private onDataChange(type: 'hp' | 'score' | 'coins' | 'lives') {
        if (!this.gm) return;
        switch (type) {
            case 'score':
                this.setText(this.scoreLabel, `${this.gm.score}`);
                break;
            case 'coins':
                this.setText(this.coinLabel, `${this.gm.coins}`);
                break;
            case 'hp':
                this.setText(this.hpLabel, `${this.gm.hp}/${this.gm.maxHp}`);
                break;
            case 'lives':
                this.setText(this.livesLabel, `x${this.gm.lives}`);
                break;
        }
    }

    private refreshAll() {
        if (!this.gm) return;
        this.setText(this.scoreLabel, `${this.gm.score}`);
        this.setText(this.coinLabel, `${this.gm.coins}`);
        this.setText(this.hpLabel, `${this.gm.hp}/${this.gm.maxHp}`);
        this.setText(this.livesLabel, `x${this.gm.lives}`);
    }

    private setText(label: Label | null, text: string) {
        if (label && label.string !== text) {
            label.string = text;
        }
    }

    private onPlayerDie(canRespawn: boolean) {
        // 可扩展：显示死亡动画提示
    }

    private onGameOver() {
        // 可扩展：显示 Game Over 界面
    }
}
