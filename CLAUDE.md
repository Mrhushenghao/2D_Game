# CLAUDE.md

此文件为 Claude Code 提供项目指导。

## 项目概述

这是一个 Cocos Creator 3.8.8 游戏项目，使用 TypeScript 开发。

## 技术栈

- **引擎**: Cocos Creator 3.8.8
- **语言**: TypeScript
- **项目类型**: 2D/3D 游戏项目

## 编码规范

### 个人偏好
- 回复使用中文
- 编写代码时无需用户确认

### 代码风格
- 不要添加过多注释，清晰的代码比注释更重要
- 函数长度控制在 50 行以内，超过则考虑拆分
- 避免在 `update` 中进行高开销操作

### Cocos Creator 特定规范
- 注意 2.x 和 3.x API 差异，本项目使用 3.x API
- 无需在场景中创建节点和预制体，只需生成代码并说明使用方法

## 项目结构

```
assets/
├── scripts/        # TypeScript 脚本
│   ├── PlayerController.ts   # 玩家控制器
│   ├── CameraFollow.ts       # 摄像机跟随
│   ├── TiledMapCollider.ts   # TiledMap 碰撞生成
│   └── TiledMapFix.ts        # TiledMap 修复
└── ...            # 其他资源目录
```

## 玩家控制器 (PlayerController)

### 依赖组件
- `RigidBody2D` (Dynamic)
- `BoxCollider2D`
- `Animation`

### 状态机

| 状态 | 动画名 | 说明 |
|------|--------|------|
| idle | idle | 待机 |
| run | run | 奔跑 |
| jumpUp | jumpUp | 向上跳跃 |
| jumpDown | jumpDown | 向下坠落 |
| climb | climb | 攀爬梯子 |
| climbIdle | climbIdle | 梯子上静止 |

### 操作按键

| 按键 | 功能 |
|------|------|
| A / ← | 向左移动 |
| D / → | 向右移动 |
| W / ↑ | 跳跃 / 梯子上向上爬 |
| S / ↓ | 梯子上向下爬 |
| Space | 梯子上跳跃脱离 |

### 碰撞检测
- 所有碰撞逻辑统一在 PlayerController 中，通过 `otherCollider.sensor` 区分：
  - **sensor = true** → 梯子碰撞体，触发梯子逻辑
  - **sensor = false** → 地面/墙壁碰撞体，触发接地逻辑
- 接地使用 `groundContactCount` 计数处理多平台边缘情况
- 跳跃后设置 `canReGround = false`，防止物理引擎重解碰撞时误接地
- 所有地面接触断开后 `canReGround` 恢复为 `true`

### 梯子系统
- 梯子节点只需挂载一个设为 Sensor 的 `BoxCollider2D`，无需额外脚本
- 接触梯子传感器时 `gravityScale = 0`，离开时恢复为 1
- 碰撞接触开始即进入梯子区域，碰撞分离即离开
- 按方向键 W/S 开始攀爬，Space 键主动跳跃脱离

## 常用 API 注意事项

### TiledMap
- 使用 `getLayers()` 获取图层数组，而非 `getLayerNames()`
- 使用 `getTileSize()` 获取瓦片大小
- 使用 `getLayer(name)` 获取指定名称的图层

### 物理引擎
- 使用 `RigidBody2D` 和 `BoxCollider2D` 进行 2D 物理碰撞
- 刚体类型使用 `ERigidBody2DType.Static` 等枚举值
- **关键**: 必须在代码中启用物理系统 `PhysicsSystem2D.instance.enable = true`
- **关键**: 碰撞矩阵需要在项目设置中配置，确保不同分组可以碰撞
- **关键**: 分组使用位掩码（bitmask），不是直接用索引值！`group = 1 << groupIndex`
  - 分组索引 1 → 位掩码 = `1 << 1` = 2
  - 分组索引 2 → 位掩码 = `1 << 2` = 4
- Collider 创建后需要调用 `apply()` 才能生效

## 资源处理

- 图集纹理建议设置 Filter Mode 为 `nearest` 避免黑边和间隙
- TiledMap 图块间隙问题可通过设置纹理 `WrapMode.CLAMP_TO_EDGE` 缓解
