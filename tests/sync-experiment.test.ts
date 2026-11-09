import { expect, it } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { generatePageCode, parsePageCode } from '../src/features/editor/code/pageCode';
import type { ComponentNode } from '../src/models/contracts';
it('experimento reproducible por via de edicion con preservacion de contratos HTTP', async () => {
  const samples: {
    direction: string;
    scenario: string;
    success: boolean;
    durationMs: number;
    error?: string;
  }[] = [];
  const base: ComponentNode[] = [
    {
      id: 'root',
      type: 'Container',
      props: { padding: '16px' },
      children: [
        { id: 'title', type: 'Heading', props: { text: 'Inicial' } },
        {
          id: 'table',
          type: 'RestTable',
          props: {
            listEndpointId: 'get',
            createEndpointId: 'post',
            updateEndpointId: 'put',
            deleteEndpointId: 'delete',
          },
        },
      ],
    },
  ];
  for (let iteration = 0; iteration < 50; iteration++) {
    const visual = structuredClone(base);
    visual[0].props.padding = iteration + 'px';
    visual[0].children![0].props.text = 'Visual ' + iteration;
    let start = performance.now();
    const code = generatePageCode(visual);
    const result = parsePageCode(code);
    const ok = JSON.stringify(result) === JSON.stringify(visual);
    samples.push({
      direction: 'visual-to-code',
      scenario: 'text-style-nested-bindings',
      success: ok,
      durationMs: performance.now() - start,
    });
    expect(result).toEqual(visual);
    start = performance.now();
    const edited = code.replace('Visual ' + iteration, 'Codigo ' + iteration);
    const parsed = parsePageCode(edited);
    const correct =
      parsed[0].children![0].props.text === 'Codigo ' + iteration &&
      JSON.stringify(parsed[0].children![1].props) === JSON.stringify(base[0].children![1].props);
    samples.push({
      direction: 'code-to-visual',
      scenario: 'text-with-http-bindings',
      success: correct,
      durationMs: performance.now() - start,
    });
    expect(correct).toBe(true);
    start = performance.now();
    let rejected = false;
    try {
      parsePageCode(code.replace('"Visual ' + iteration + '"', 'fetch("/unsafe")'));
    } catch {
      rejected = true;
    }
    samples.push({
      direction: 'code-to-visual',
      scenario: 'unsupported-expression',
      success: rejected,
      durationMs: performance.now() - start,
    });
    expect(rejected).toBe(true);
  }
  const report = {
    contractVersion: 1,
    measuredAt: new Date().toISOString(),
    scope: 'Subconjunto TSX v1; latencia local de conversion, no productividad humana',
    samples: samples.length,
    correct: samples.filter((s) => s.success).length,
    results: samples,
  };
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/sync-experiment.json', JSON.stringify(report, null, 2));
});
