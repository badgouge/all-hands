import { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { useAccountability } from '../../src/app/state/AccountabilityProvider';
import { activeEmergency, currentMuster, hasRole } from '../../src/domain/accountability';
import { displayName, MUSTER_STATUS_LABEL, MUSTER_STATUS_SHORT } from '../../src/domain/labels';
import { formatTimestamp, todayInZone } from '../../src/domain/time';
import type { MusterStatus } from '../../src/domain/types';
import { useTheme } from '../../src/ui/theme';
import { ConfirmModal, Dropdown, InfoTip, Note, PrimaryButton, Screen } from '../../src/ui/ios';

const statusOptions = (Object.keys(MUSTER_STATUS_LABEL) as MusterStatus[]).map((value) => ({
  value,
  label: MUSTER_STATUS_LABEL[value],
}));

export default function CommandScreen() {
  const api = useAccountability();
  const { colors } = useTheme();
  const [ask, setAsk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [override, setOverride] = useState<{ id: string; name: string; current: string | null } | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<MusterStatus>('PRESENT');
  if (!api.sailor) return null;
  if (!hasRole(api.sailor, 'COMMAND_CERTIFIER')) {
    return (
      <Screen>
        <Note>Switch to Command Certifier to certify the command muster.</Note>
      </Screen>
    );
  }

  const today = todayInZone(api.state.command.timezone, new Date());
  const people = api.state.sailors.filter((sailor) => sailor.commandId === api.state.command.id);
  const rows = people.map((sailor) => {
    const record = currentMuster(api.state, sailor.id, today);
    return {
      id: sailor.id,
      division: sailor.division,
      name: displayName(sailor),
      status: record?.status ?? null,
      label: record ? `${MUSTER_STATUS_SHORT[record.status]} · ${record.verification === 'VERIFIED' ? 'Confirmed' : 'Not confirmed'}` : 'Not mustered',
      confirmed: record?.verification === 'VERIFIED',
    };
  });
  const confirmed = rows.filter((row) => row.confirmed).length;
  const outstanding = rows.filter((row) => !row.confirmed).map((row) => row.name);
  const certification = (api.state.commandCertifications ?? []).find(
    (item) => item.commandId === api.state.command.id && item.reportingDate === today,
  );
  const commandEvent = activeEmergency(api.state);
  const divisions = [...new Set(rows.map((row) => row.division))];

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <Note>
          {confirmed} of {rows.length} confirmed.{outstanding.length > 0 ? ` ${outstanding.length} still outstanding.` : ' The command is fully confirmed.'}
        </Note>
        <View style={{ marginHorizontal: 16, marginTop: 16, backgroundColor: colors.card, borderRadius: 12, padding: 16, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '600', flexShrink: 1 }}>Navy accountability</Text>
              <InfoTip inline>
                Turning this on sends a push notification to every Sailor in the command. Each Sailor must validate their own status and their family’s status.
              </InfoTip>
            </View>
            <Switch
              accessibilityLabel="Navy accountability"
              value={Boolean(commandEvent)}
              onValueChange={(open) => {
                const result = api.pushCommandAccountability(open);
                if (!result.ok) setError(result.error);
              }}
              trackColor={{ false: colors.line, true: colors.green }}
            />
          </View>
        </View>
        {divisions.map((division) => (
          <View key={division} style={{ marginTop: 18, marginHorizontal: 16, backgroundColor: colors.card, borderRadius: 12, overflow: 'hidden' }}>
            <Text style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, color: colors.ink, fontSize: 13, fontWeight: '700' }}>{division.toUpperCase()}</Text>
            <View>
              {rows.filter((row) => row.division === division).map((row, index, list) => (
                <View key={row.id} style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: index < list.length - 1 ? 1 : 0, borderBottomColor: colors.line }}>
                  <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '600' }}>{row.name}</Text>
                  <Text style={{ color: row.confirmed ? colors.green : colors.muted, fontSize: 15, marginTop: 3 }}>{row.label}</Text>
                  {row.id !== api.sailor?.id ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setOverrideStatus(row.status ?? 'PRESENT');
                        setOverride({ id: row.id, name: row.name, current: row.status ? row.label : null });
                      }}
                      style={{ marginTop: 8, alignSelf: 'flex-start' }}
                    >
                      <Text style={{ color: colors.navy, fontSize: 15, fontWeight: '700' }}>Override Muster</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        ))}
        {certification ? (
          <Note>
            Certified at {formatTimestamp(certification.certifiedAt, api.state.command.timezone)} by {displayName(api.state.sailors.find((sailor) => sailor.id === certification.certifiedBy) ?? api.sailor)}.
          </Note>
        ) : (
          <PrimaryButton label="Certify Command" onPress={() => setAsk(true)} />
        )}
        {error ? <Note>{error}</Note> : null}
      </Screen>
      {override ? (
        <ConfirmModal
          title="Override Muster"
          body={
            override.current
              ? `Override ${override.name}'s muster? The current submission is ${override.current}. This records the new status under command certifier authority.`
              : `Record today’s muster for ${override.name} under command certifier authority.`
          }
          confirmLabel="Override Muster"
          onCancel={() => setOverride(null)}
          onConfirm={() => {
            const result = api.overrideMuster(override.id, overrideStatus);
            setOverride(null);
            if (!result.ok) setError(result.error);
          }}
        >
          <Dropdown label="Report status" value={overrideStatus} options={statusOptions} onChange={setOverrideStatus} />
        </ConfirmModal>
      ) : null}
      {ask ? (
        <ConfirmModal
          title="Certify Command Muster"
          body={
            outstanding.length > 0
              ? `${confirmed} Sailors are confirmed. ${outstanding.join(', ')} ${outstanding.length === 1 ? 'is' : 'are'} still outstanding. Certify the command with that rollup?`
              : `${confirmed} Sailors are confirmed. Certify the command muster?`
          }
          confirmLabel="Certify Command"
          onCancel={() => setAsk(false)}
          onConfirm={() => {
            const result = api.certifyCommand();
            setAsk(false);
            if (!result.ok) setError(result.error);
          }}
        />
      ) : null}
    </View>
  );
}
