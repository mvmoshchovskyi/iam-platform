import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { applyFieldErrors } from '@/shared/api/problem';
import { FormField } from '@/shared/components/FormField';
import { fieldA11y } from '@/shared/lib/a11y';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { useCreateRole, usePermissionList } from '../hooks';

const schema = z.object({
  name: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9_]{2,49}$/, 'Use UPPER_SNAKE_CASE, 3–50 characters'),
  description: z.string().trim().max(200),
  permissions: z.array(z.string()),
});
type Values = z.infer<typeof schema>;

export function CreateRoleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const permissions = usePermissionList();
  const create = useCreateRole();
  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '', permissions: [] },
  });
  const selected = useWatch({ control, name: 'permissions' });

  const close = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <form
          noValidate
          onSubmit={handleSubmit((values) =>
            create.mutate(
              { ...values, description: values.description || undefined },
              { onSuccess: () => close(false), onError: (e) => applyFieldErrors(e, setError) },
            ),
          )}
          className="grid gap-4"
        >
          <DialogHeader>
            <DialogTitle>Create role</DialogTitle>
            <DialogDescription>
              Custom roles group permissions you can assign to users.
            </DialogDescription>
          </DialogHeader>
          <FormField id="role-name" label="Name" error={errors.name?.message}>
            <Input
              {...fieldA11y('role-name', errors.name?.message)}
              placeholder="AUDITOR"
              autoFocus
              {...register('name')}
            />
          </FormField>
          <FormField id="role-description" label="Description" error={errors.description?.message}>
            <Input
              {...fieldA11y('role-description', errors.description?.message)}
              placeholder="Read-only access to audit logs"
              {...register('description')}
            />
          </FormField>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">Permissions</legend>
            {permissions.data?.map((p) => (
              <div key={p.key} className="flex items-start gap-2">
                <Checkbox
                  id={`perm-${p.key}`}
                  checked={selected.includes(p.key)}
                  onCheckedChange={(checked) =>
                    setValue(
                      'permissions',
                      checked ? [...selected, p.key] : selected.filter((k) => k !== p.key),
                    )
                  }
                />
                <Label htmlFor={`perm-${p.key}`} className="grid gap-0.5 font-normal">
                  <span className="font-mono text-xs">{p.key}</span>
                  <span className="text-xs text-muted-foreground">{p.description}</span>
                </Label>
              </div>
            ))}
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <LoadingSpinner className="size-4 text-current" />}
              Create role
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
