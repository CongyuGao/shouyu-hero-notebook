import { blankGuide, heroes, type GuideRecord, type Access } from './guide';
type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
type Context = {
  registerTool: (
    tool: Tool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
export function registerTools(tools: Tool[]) {
  const c = (document as Document & { modelContext?: Context }).modelContext;
  if (!c?.registerTool) return () => {};
  const life = new AbortController();
  for (const tool of tools) {
    try {
      Promise.resolve(c.registerTool(tool, { signal: life.signal })).catch(
        (e) => console.warn('Optional WebMCP unavailable', e),
      );
    } catch (e) {
      console.warn('Optional WebMCP unavailable', e);
    }
  }
  return () => life.abort();
}
type State = {
  records: GuideRecord[];
  access: Access;
  openGuide: (id: string) => void;
  start: (record: GuideRecord | null) => void;
};
export function registerNotebookTools(state: () => State) {
  const schema = {
    type: 'object',
    properties: { heroId: { type: 'string' } },
    required: ['heroId'],
    additionalProperties: false,
  };
  const id = (v: unknown) => {
    if (
      !v ||
      typeof v !== 'object' ||
      typeof (v as { heroId?: unknown }).heroId !== 'string'
    )
      throw new Error('heroId required');
    return (v as { heroId: string }).heroId;
  };
  return registerTools([
    {
      name: 'list_published_hero_guides',
      title: '查询已发布英雄攻略',
      description:
        'Read the published mode hero guide list; does not return drafts.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: () =>
        state()
          .records.filter((r) => r.published)
          .map((r) => ({
            heroId: r.heroId,
            title: r.published!.title,
            builds: r.published!.builds.map((b) => b.name),
          })),
    },
    {
      name: 'open_hero_guide',
      title: '打开英雄攻略',
      description:
        'Navigate to one published hero guide and update the visible page.',
      inputSchema: schema,
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: (v) => {
        const heroId = id(v);
        if (!state().records.some((r) => r.heroId === heroId && r.published))
          throw new Error('Published guide not found');
        state().openGuide(heroId);
        return { heroId, view: 'guide' };
      },
    },
    {
      name: 'start_hero_guide_draft',
      title: '开始编辑英雄攻略',
      description:
        'Open a guide editor for an authorized editor. Does not save or publish. The hero must be confirmed by the user as available in this mode.',
      inputSchema: schema,
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: (v) => {
        const heroId = id(v),
          s = state();
        if (!s.access.canEdit) throw new Error('Editor access required');
        if (!heroes.some((h) => h.id === heroId))
          throw new Error('Unknown hero');
        s.start(
          s.records.find((r) => r.heroId === heroId) || {
            heroId,
            revision: 0,
            updatedAt: '',
            publishedAt: null,
            published: null,
            draft: blankGuide(heroId),
          },
        );
        return { heroId, state: 'unsaved editor' };
      },
    },
  ]);
}
