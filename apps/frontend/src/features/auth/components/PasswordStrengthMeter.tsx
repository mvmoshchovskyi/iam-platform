import { useEffect, useState } from 'react';
import { cn } from '@/shared/lib/utils';

type Checker = (password: string, inputs: string[]) => { score: number; warning: string | null };

let checkerPromise: Promise<Checker> | null = null;

/** zxcvbn dictionaries are ~1 MB, so they are loaded on demand in a separate chunk. */
const loadChecker = (): Promise<Checker> =>
  (checkerPromise ??= Promise.all([
    import('@zxcvbn-ts/core'),
    import('@zxcvbn-ts/language-common'),
    import('@zxcvbn-ts/language-en'),
  ]).then(([core, common, en]) => {
    const zxcvbn = new core.ZxcvbnFactory({
      dictionary: { ...common.dictionary, ...en.dictionary },
      graphs: common.adjacencyGraphs,
      translations: en.translations,
    });
    return (password, inputs) => {
      const result = zxcvbn.check(password, inputs);
      return { score: result.score, warning: result.feedback.warning };
    };
  }));

const LABELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
const COLORS = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-600'];

interface Props {
  password: string;
  userInputs?: (string | undefined)[];
}

/** Live strength estimate; the API requires a score of at least 3 ("Strong"). */
export function PasswordStrengthMeter({ password, userInputs = [] }: Props) {
  const [result, setResult] = useState<{ score: number; warning: string | null } | null>(null);
  const inputsKey = userInputs.filter(Boolean).join('|');

  useEffect(() => {
    if (!password) return;
    let cancelled = false;
    void loadChecker().then((check) => {
      if (!cancelled) setResult(check(password, inputsKey ? inputsKey.split('|') : []));
    });
    return () => {
      cancelled = true;
    };
  }, [password, inputsKey]);

  if (!password) return null;
  const score = result?.score ?? 0;

  return (
    <div className="space-y-1" aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full bg-muted',
              result && score > i && COLORS[score],
            )}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Strength:{' '}
        <span className="font-medium text-foreground">{result ? LABELS[score] : 'Checking…'}</span>
        {result?.warning && ` — ${result.warning}`}
        {result && score < 3 && !result.warning && ' — add more words or characters'}
      </p>
    </div>
  );
}
