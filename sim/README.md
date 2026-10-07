# 无尽守御组合模拟器

用资源包和仓库资料里的数值，计算核心、小天赋、雕文、铭文组合起来的伤害效果。和网站代码分开，不参与网站构建。

## 数值来源规则

模拟器里的每个数字都是 `Param`，带着来源（`sim/core/types.ts`）。规则：

1. **不猜数字。** 找不到的数值记为 `MissingParam`，用到它的结果标记为不完整（`complete: false`），报告里列出缺了哪些数。
2. **可信度从高到低：** 资源包（pack）＞ 实测（measured）＞ 雕文原始卡片（card）＞ 阅读前瞻（primer）＞ 其他仓库资料（repo）＞ 排位公开公式（public）＞ 天赋描述（description）。只有 pack 和 measured 算已核实。
3. **天赋描述只当索引。** 9月实测已发现马可波罗、虞姬有多处描述和实际不符，描述里的数字只能作为“描述值”，等资源包数值覆盖。
4. **测试用的假数据只能标 `fixture`，** 不能出现在正式数据里。
5. 每个来源的 `ref` 要写到能手工复查的程度，例如 `data/initial-library.json#doc-glyph-030`。

## 目录

| 路径 | 内容 |
|---|---|
| `core/types.ts` | 共享类型：参数、属性、伤害、动作、效果、目标、结果 |
| `core/param.ts` | 创建参数、记录缺失参数 |
| `data/` | 读取仓库现有资料：英雄天赋、轮换批次、阅读前瞻里的模式规则和挑战怪、铭文；资源包数据接口 |
| `rules/` | 合法组合：每技能核心二选一、小天赋8选6、按关卡的天赋点预算、雕文最多6个、铭文每色最多10枚 |
| `effects/` | 雕文效果（来自原始卡片）；以后加天赋效果（来自资源包） |
| `engine/` | 伤害公式和按帧推进的时间轴 |
| `cli.ts` | 命令行：运行一个组合、全组合搜索、列出缺失参数 |
| `test/` | `node --test` 测试 |

## 运行

需要 Node 22.18 以上（直接运行 TypeScript）。

```sh
node --test sim/test/
pnpm exec tsc --noEmit -p sim/tsconfig.json
pnpm exec oxlint sim
```

## 代码约定

- 只用可擦除的 TypeScript 语法（不用 enum、namespace、构造函数参数属性），相对导入写 `.ts` 扩展名，JSON 用 `import x from '...json' with { type: 'json' }`。
- 资源包导入之前，英雄技能、动作帧、天赋参数都没有真实数据；引擎用 `fixture` 英雄测试，不生成任何英雄的正式结论。
