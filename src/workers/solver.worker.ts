// src/workers/solver.worker.ts
import { solveTimetable } from '../domain/solver/index';
import { SolverInputData } from '../domain/solver/model';

self.onmessage = (e: MessageEvent) => {
  const { type, input, runId } = e.data;

  if (type === 'START') {
    try {
      const result = solveTimetable(input as SolverInputData, runId, (progress, cost) => {
        self.postMessage({ type: 'PROGRESS', progress, cost });
      });

      self.postMessage({ type: 'DONE', output: result });
    } catch (err) {
      self.postMessage({
        type: 'ERROR',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
};
