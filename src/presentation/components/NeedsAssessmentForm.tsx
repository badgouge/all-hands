import { NEED_LABEL } from '../../domain/labels';
import { needsCatalog } from '../../domain/accountability';
import type { NeedType } from '../../domain/types';
import { TextArea } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

export function NeedsAssessmentForm({
  idPrefix,
  needs,
  context,
  onNeeds,
  onContext,
}: {
  idPrefix: string;
  needs: NeedType[];
  context: string;
  onNeeds: (needs: NeedType[]) => void;
  onContext: (context: string) => void;
}) {
  return (
    <fieldset className="space-y-3 rounded-md bg-muted p-3">
      <legend className="px-1 font-semibold">What kind of help is needed?</legend>
      <p className="text-muted-foreground">Choose the support needed. Do not include a diagnosis or clinical details.</p>
      {needsCatalog().map((need) => (
        <label key={need} className="flex min-h-11 items-center gap-3 font-semibold">
          <input
            type="checkbox"
            className="size-5"
            checked={needs.includes(need)}
            onChange={(event) => {
              onNeeds(event.target.checked ? [...needs, need] : needs.filter((item) => item !== need));
            }}
          />
          {NEED_LABEL[need]}
        </label>
      ))}
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-context`}>Context</Label>
        <TextArea
          id={`${idPrefix}-context`}
          value={context}
          maxLength={280}
          placeholder="Example: needs a ride to a shelter. No medical details."
          onChange={(event) => onContext(event.target.value)}
        />
      </div>
    </fieldset>
  );
}
