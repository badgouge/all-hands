import { useMemo, useState } from 'react';
import { RadioGroup } from '../../components/ui/radio-group';
import { Input, TextArea } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Button } from '../../components/ui/button';
import { Alert } from '../../components/ui/alert';
import { planAbsence } from '../../domain/accountability';
import { SNIV_CATEGORY_LABEL } from '../../domain/labels';
import { formatDateLong, formatDuration, formatMilitary } from '../../domain/time';
import type { PrototypeState, SnivCategory, SnivInput } from '../../domain/types';

export function SnivRequestForm({
  state,
  supervisorName,
  initial,
  onSubmit,
  onSaveDraft,
}: {
  state: PrototypeState;
  supervisorName: string | null;
  initial: SnivInput;
  onSubmit: (input: SnivInput) => void;
  onSaveDraft: (input: SnivInput) => void;
}) {
  const [form, setForm] = useState(initial);
  const plan = useMemo(() => planAbsence(state, form), [state, form]);
  const categoryId = 'sniv-category';

  function patch(partial: Partial<SnivInput>) {
    setForm((current) => {
      const next = { ...current, ...partial };
      if (partial.date && next.endDate < next.date) next.endDate = next.date;
      return next;
    });
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if ('error' in plan) return;
        onSubmit(form);
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="sniv-date">Date of requested absence</Label>
        <Input id="sniv-date" type="date" required value={form.date} onChange={(event) => patch({ date: event.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="sniv-start">Start time</Label>
          <Input id="sniv-start" type="time" required step={900} value={form.startTime} onChange={(event) => patch({ startTime: event.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sniv-end">Expected return time</Label>
          <Input id="sniv-end" type="time" required step={900} value={form.endTime} onChange={(event) => patch({ endTime: event.target.value })} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="sniv-return">Return date</Label>
        <Input id="sniv-return" type="date" required value={form.endDate} min={form.date} onChange={(event) => patch({ endDate: event.target.value })} />
        <p className="text-muted-foreground">Use the next day only if the absence continues past midnight.</p>
      </div>
      <div>
        <p id={categoryId} className="mb-2 font-semibold">Request category</p>
        <RadioGroup
          name="category"
          aria-labelledby={categoryId}
          value={form.category}
          onChange={(value) => patch({ category: value as SnivCategory })}
          options={state.command.snivCategories.map((category) => ({ value: category, label: SNIV_CATEGORY_LABEL[category] }))}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="sniv-remarks">Remarks, optional</Label>
        <TextArea
          id="sniv-remarks"
          maxLength={240}
          value={form.remarks}
          placeholder="Short reason. Do not include medical details."
          onChange={(event) => patch({ remarks: event.target.value })}
        />
      </div>
      <p>
        <span className="font-semibold">Supervisor</span>
        <span className="mt-1 block text-muted-foreground">{supervisorName ?? 'No supervisor is on file.'}</span>
      </p>
      {'error' in plan ? (
        <Alert variant="error" title="Check the times">{plan.error}</Alert>
      ) : (
        <div className="rounded-md bg-muted p-4">
          <p className="font-semibold">{formatDateLong(form.date, state.command.timezone)}</p>
          <p>{formatMilitary(form.startTime)}–{formatMilitary(form.endTime)}</p>
          <p>Total requested time: {formatDuration(plan.minutes)}</p>
        </div>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={'error' in plan || !supervisorName}>
        Submit Request
      </Button>
      <Button type="button" size="lg" variant="outline" className="w-full" disabled={!supervisorName} onClick={() => onSaveDraft(form)}>
        Save draft
      </Button>
    </form>
  );
}
