import { FAMILY_STATUS_LABEL } from '../../domain/labels';
import type { Dependent, FamilyMemberReport, FamilyStatus, NeedType } from '../../domain/types';

export interface DraftReport {
  dependentId: string;
  status?: FamilyMemberReport['status'];
  generalLocation: string | null;
  safeContact: string | null;
  needs: NeedType[];
  context: string;
}
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { NeedsAssessmentForm } from './NeedsAssessmentForm';

const choices = Object.entries(FAMILY_STATUS_LABEL) as Array<[Exclude<FamilyStatus, 'NOT_REPORTED'>, string]>;

export function DependentAccountabilityList({
  dependents,
  reports,
  onChange,
}: {
  dependents: Dependent[];
  reports: Partial<Record<string, DraftReport>>;
  onChange: (dependentId: string, patch: Partial<DraftReport>) => void;
}) {
  return (
    <div className="space-y-4">
      {dependents.map((person) => {
        const report = reports[person.id];
        return (
          <fieldset key={person.id} className="space-y-3 rounded-lg border border-border p-4">
            <legend className="px-1 text-base font-semibold">
              {person.firstName} {person.lastName}
              <span className="ml-2 font-normal text-muted-foreground">{person.relationship.toLowerCase()}</span>
            </legend>
            <div className="grid gap-2">
              {choices.map(([status, label]) => (
                <label key={status} className="flex min-h-11 items-center gap-3 rounded-md border border-border px-3">
                  <input
                    type="radio"
                    name={`status-${person.id}`}
                    checked={report?.status === status}
                    onChange={() =>
                      onChange(person.id, {
                        status,
                        needs: status === 'NEEDS_ASSISTANCE' ? report?.needs ?? [] : [],
                      })
                    }
                  />
                  <span className="font-semibold">{label}</span>
                </label>
              ))}
            </div>
            {report?.status === 'DISPLACED' || report?.status === 'NEEDS_ASSISTANCE' ? (
              <div className="space-y-1">
                <Label htmlFor={`area-${person.id}`}>General area</Label>
                <Input
                  id={`area-${person.id}`}
                  value={report.generalLocation ?? ''}
                  placeholder="City or neighborhood"
                  onChange={(event) => onChange(person.id, { generalLocation: event.target.value })}
                />
                <p className="text-muted-foreground">Do not enter a street address.</p>
              </div>
            ) : null}
            {report?.status === 'NEEDS_ASSISTANCE' ? (
              <NeedsAssessmentForm
                idPrefix={person.id}
                needs={report.needs}
                context={report.context}
                onNeeds={(needs) => onChange(person.id, { needs })}
                onContext={(context) => onChange(person.id, { context })}
              />
            ) : null}
            <div className="space-y-1">
              <Label htmlFor={`contact-${person.id}`}>Safe contact, if you have one</Label>
              <Input
                id={`contact-${person.id}`}
                value={report?.safeContact ?? ''}
                placeholder="Optional phone or other contact"
                onChange={(event) => onChange(person.id, { safeContact: event.target.value })}
              />
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
