import { Copy, Download } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useToast } from '@/shared/hooks/useToast';

export function RecoveryCodes({ codes }: { codes: string[] }) {
  const toast = useToast();
  const text = codes.join('\n');

  const download = () => {
    const url = URL.createObjectURL(
      new Blob([`IAM Platform recovery codes\n\n${text}\n`], { type: 'text/plain' }),
    );
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: 'iam-recovery-codes.txt',
    });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <ul
        className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/50 p-4 font-mono text-sm"
        aria-label="Recovery codes"
      >
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            void navigator.clipboard
              .writeText(text)
              .then(() => toast.success('Copied to clipboard'))
          }
        >
          <Copy /> Copy
        </Button>
        <Button variant="outline" size="sm" onClick={download}>
          <Download /> Download
        </Button>
      </div>
    </div>
  );
}
