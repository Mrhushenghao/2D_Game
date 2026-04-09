# 2DGame

一个基于 Cocos Creator 3.8.8 开发的 2D 平台动作游戏。

## 技术栈

- **引擎**: Cocos Creator 3.8.8
- **语言**: TypeScript

## 项目结构

```
assets/scripts/
├── Camera/          # 摄像机
│   └── CameraFollow.ts
├── Combat/          # 战斗
│   └── BulletController.ts
├── Core/            # 核心
│   ├── GameManager.ts
│   ├── ObjectPool.ts
│   └── PhysicsGroups.ts
├── Enemy/           # 敌人
│   ├── EnemyBase.ts
│   ├── PatrolEnemy.ts
│   └── ShootEnemy.ts
├── Item/            # 物品
│   └── CollectibleItem.ts
├── Level/           # 关卡
│   ├── LevelGoal.ts
│   ├── TiledMapCollider.ts
│   ├── TiledMapFix.ts
│   └── TiledMapObjectCollider.ts
├── Player/          # 玩家
│   └── PlayerController.ts
└── UI/              # 界面
    └── HUD.ts
```

## 运行

使用 Cocos Dashboard 打开本项目，选择 Cocos Creator 3.8.8 编辑器运行。
