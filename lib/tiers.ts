export const heroTiers = ['T0', 'T0.5', 'T1', 'T1.5', 'T2', 'T3'] as const;
export type TierSettings = {
  revision: number;
  context: string;
  items: { tier: string; description: string }[];
};
export const defaultTierSettings: TierSettings = {
  revision: 0,
  context:
    '初始参考标准，待团队校准。请在相同版本、难度和养成条件下，综合清怪效率、首领伤害、生存容错、成型成本与操作要求评价；具体测试条件由编辑补充。',
  items: [
    {
      tier: 'T0',
      description: '综合表现领先，清怪、攻坚和生存均有突出优势，适用范围广。',
    },
    {
      tier: 'T0.5',
      description: '接近顶尖水平，有少量条件或短板，但整体效率和稳定性突出。',
    },
    {
      tier: 'T1',
      description: '整体强势，在主要场景表现稳定；成型条件与短板可控。',
    },
    {
      tier: 'T1.5',
      description: '强度中上，某些场景优势明显，但更依赖特定核心、雕文或操作。',
    },
    {
      tier: 'T2',
      description:
        '具备可用打法，对配置或场景要求较高，综合效率或容错存在短板。',
    },
    {
      tier: 'T3',
      description:
        '适用场景较窄，在统一测试条件下有明显短板，需要更高投入或操作弥补。',
    },
  ],
};
export function validateTierSettings(
  input: unknown,
): Omit<TierSettings, 'revision'> {
  const value = input as Partial<TierSettings>;
  if (
    !value ||
    typeof value.context !== 'string' ||
    !value.context.trim() ||
    value.context.length > 2000 ||
    !Array.isArray(value.items) ||
    value.items.length !== heroTiers.length
  )
    throw new Error('请填写评级条件，并保留全部梯度');
  const items = heroTiers.map((tier) => {
    const item = value.items!.find((i) => i?.tier === tier);
    if (
      !item ||
      typeof item.description !== 'string' ||
      !item.description.trim() ||
      item.description.length > 1600
    )
      throw new Error(`请填写 ${tier} 的判断标准（1600字以内）`);
    return { tier, description: item.description.trim() };
  });
  return { context: value.context.trim(), items };
}
