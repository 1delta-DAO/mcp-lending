import React from 'react';
import { useSendTransaction } from 'wagmi';

export interface TxStep {
  description: string;
  to: string;
  data: string;
  value: string;
}

type StepStatus = 'idle' | 'pending' | 'success' | 'error';

function parseValue(v: string): bigint {
  try {
    if (!v || v === '0' || v === '0x0') return 0n;
    return BigInt(v);
  } catch { return 0n; }
}

function StatusDot({ status }: { status: StepStatus }) {
  if (status === 'pending') {
    return (
      <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin flex-shrink-0" />
    );
  }
  if (status === 'success') {
    return (
      <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    );
  }
  return <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600 flex-shrink-0" />;
}

export function TxExecutor({ steps }: { steps: TxStep[] }) {
  const [statuses, setStatuses] = React.useState<StepStatus[]>(steps.map(() => 'idle'));
  const [hashes, setHashes] = React.useState<(string | undefined)[]>(steps.map(() => undefined));
  const [errors, setErrors] = React.useState<(string | undefined)[]>(steps.map(() => undefined));
  const [running, setRunning] = React.useState(false);
  const { sendTransactionAsync } = useSendTransaction();

  const allDone = statuses.every(s => s === 'success');
  const hasFailed = statuses.some(s => s === 'error');

  async function executeAll() {
    setRunning(true);
    for (let i = 0; i < steps.length; i++) {
      if (statuses[i] === 'success') continue;
      setStatuses(prev => prev.map((s, idx) => idx === i ? 'pending' : s));
      try {
        const hash = await sendTransactionAsync({
          to: steps[i].to as `0x${string}`,
          data: steps[i].data as `0x${string}`,
          value: parseValue(steps[i].value),
        });
        setStatuses(prev => prev.map((s, idx) => idx === i ? 'success' : s));
        setHashes(prev => prev.map((h, idx) => idx === i ? hash : h));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Transaction failed';
        setStatuses(prev => prev.map((s, idx) => idx === i ? 'error' : s));
        setErrors(prev => prev.map((e, idx) => idx === i ? msg : e));
        setRunning(false);
        return;
      }
    }
    setRunning(false);
  }

  return (
    <div className="mt-3 rounded-lg border border-blue-200 dark:border-blue-800 overflow-hidden text-xs">
      <div className="bg-blue-50 dark:bg-blue-950 px-3 py-2 font-semibold text-blue-700 dark:text-blue-300">
        {steps.length} transaction{steps.length !== 1 ? 's' : ''} to execute
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-2 px-3 py-2 bg-white dark:bg-gray-800">
            <div className="mt-0.5">
              <StatusDot status={statuses[i]} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 dark:text-gray-100 capitalize">{step.description}</p>
              <p className="font-mono text-gray-400 truncate">{step.to}</p>
              {hashes[i] && (
                <p className="font-mono text-green-600 dark:text-green-400 truncate">tx: {hashes[i]}</p>
              )}
              {errors[i] && (
                <p className="text-red-500 break-words">{errors[i]}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900">
        {allDone ? (
          <p className="text-center font-medium text-green-600 dark:text-green-400">All transactions completed</p>
        ) : (
          <button
            onClick={executeAll}
            disabled={running}
            className="w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800 text-white font-medium rounded transition"
          >
            {running ? 'Executing…' : hasFailed ? 'Retry' : 'Execute Transactions'}
          </button>
        )}
      </div>
    </div>
  );
}
