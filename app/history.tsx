import { useAccountability } from '../src/app/state/AccountabilityProvider';
import { MUSTER_STATUS_SHORT, SYNC_LABEL } from '../src/domain/labels';
import { formatDateShort, formatTimestamp } from '../src/domain/time';
import { Row, Screen, Section } from '../src/ui/ios';

export default function HistoryScreen() {
  const api = useAccountability();
  if (!api.sailor) return null;
  const records = api.state.musters
    .filter((record) => record.sailorId === api.sailor?.id)
    .sort((a, b) => b.reportingDate.localeCompare(a.reportingDate));

  return (
    <Screen>
      <Section title="Your muster">
        {records.length === 0 ? <Row title="No muster history." last /> : records.map((record, index) => (
          <Row
            key={record.id}
            title={`${formatDateShort(record.reportingDate, api.state.command.timezone)} · ${MUSTER_STATUS_SHORT[record.status]}`}
            detail={`${SYNC_LABEL[record.syncState]}${record.submittedAt ? ` · ${formatTimestamp(record.submittedAt, api.state.command.timezone)}` : ''}`}
            last={index === records.length - 1}
          />
        ))}
      </Section>
    </Screen>
  );
}
