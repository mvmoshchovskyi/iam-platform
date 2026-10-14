/** Props to spread on a form control rendered inside <FormField> (label/error wiring). */
export const fieldA11y = (id: string, error?: string) => ({
  id,
  'aria-invalid': error ? true : undefined,
  'aria-describedby': error ? `${id}-error` : `${id}-description`,
});
