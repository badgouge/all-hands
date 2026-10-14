import { cn } from '../../lib/cn';

export function RadioGroup({
  name,
  value,
  onChange,
  options,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  'aria-invalid': ariaInvalid,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; description?: string }[];
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-invalid={ariaInvalid || undefined}
      className="grid gap-2"
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <label
            key={opt.value}
            className={cn(
              'flex min-h-11 cursor-pointer gap-3 rounded-md border p-3',
              selected ? 'border-primary bg-muted' : 'border-border bg-card',
            )}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={selected}
              onChange={() => onChange(opt.value)}
              className="mt-1 size-4"
            />
            <span>
              <span className="block text-base font-semibold">
                {opt.label}
                {selected ? <span className="sr-only"> (selected)</span> : null}
              </span>
              {opt.description ? (
                <span className="mt-1 block text-base font-normal text-muted-foreground">{opt.description}</span>
              ) : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}
