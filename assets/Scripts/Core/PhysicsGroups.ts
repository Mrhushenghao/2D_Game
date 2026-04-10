/**
 * 物理碰撞分组定义
 * 使用位掩码（bitmask），分组索引 0-31
 * 使用时: group = PhysicsGroups.HERO
 */
export const PhysicsGroups = {
    DEFAULT: 1 << 0,   // 1   - 默认分组
    HERO: 1 << 1,      // 2   - 玩家
    WALL: 1 << 2,      // 4   - 墙壁/地面
    LADDER: 1 << 3,    // 8   - 梯子
    MONSTER: 1 << 4,  // 16  - 怪物
    BULLET: 1 << 5,    // 32  - 子弹
    ITEM: 1 << 6,      // 64  - 道具
} as const;

/** 反向查找：用于调试 */
export const PhysicsGroupNames: Record<number, string> = {
    [PhysicsGroups.DEFAULT]: 'DEFAULT',
    [PhysicsGroups.HERO]: 'HERO',
    [PhysicsGroups.WALL]: 'WALL',
    [PhysicsGroups.LADDER]: 'LADDER',
    [PhysicsGroups.MONSTER]: 'MONSTER',
    [PhysicsGroups.BULLET]: 'BULLET',
    [PhysicsGroups.ITEM]: 'ITEM',
};
