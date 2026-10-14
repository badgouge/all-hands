import { useAccountability } from '../../src/app/state/AccountabilityProvider';
import { listDependents } from '../../src/domain/accountability';
import { RELATIONSHIP_LABEL } from '../../src/domain/labels';
import { PREPAREDNESS_ITEMS } from '../../src/domain/types';
import { Choice, Row, Screen, Section } from '../../src/ui/ios';

export default function FamilyScreen() {
  const api = useAccountability();
  if (!api.sailor) return null;
  const listed = listDependents(api.state, api.sailor, api.sailor.id);
  const checks = api.state.preparednessChecks[api.sailor.id] ?? [];

  return (
    <Screen>
      <Section title="Dependents">
        {!listed.ok ? <Row title="Unavailable" detail={listed.error} last /> : listed.value.length === 0 ? (
          <Row title="No dependents are registered." last />
        ) : listed.value.map((person, index) => (
          <Row
            key={person.id}
            title={`${person.firstName} ${person.lastName}`}
            detail={`${RELATIONSHIP_LABEL[person.relationship]} · ${person.contactSummary}`}
            last={index === listed.value.length - 1}
          />
        ))}
      </Section>
      <Section title="Preparedness">
        {PREPAREDNESS_ITEMS.map((item) => (
          <Choice
            key={item.id}
            label={item.label}
            selected={checks.includes(item.id)}
            onPress={() => api.setPreparedness(item.id, !checks.includes(item.id))}
          />
        ))}
      </Section>
    </Screen>
  );
}
