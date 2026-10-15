import { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAccountability } from '../../src/app/state/AccountabilityProvider';
import { hasRole } from '../../src/domain/accountability';
import { MUSTER_STATUS_LABEL } from '../../src/domain/labels';
import { workCenterQueue } from '../../src/domain/viewModels';
import type { MusterStatus } from '../../src/domain/types';
import { useTheme } from '../../src/ui/theme';
import { ConfirmModal, Dropdown, Note, PrimaryButton, Screen } from '../../src/ui/ios';

const statusOptions = (Object.keys(MUSTER_STATUS_LABEL) as MusterStatus[]).map((value) => ({
  value,
  label: MUSTER_STATUS_LABEL[value],
}));

export default function TeamScreen() {
  const api = useAccountability();
  const router = useRouter();
  const { colors } = useTheme();
  const [message, setMessage] = useState<string | null>(null);
  const [behalf, setBehalf] = useState<{ id: string; name: string } | null>(null);
  const [behalfStatus, setBehalfStatus] = useState<MusterStatus>('PRESENT');
  const [picked, setPicked] = useState<Record<string, boolean> | null>(null);
  if (!api.sailor) return null;
  if (!hasRole(api.sailor, 'SUPERVISOR')) {
    return (
      <Screen>
        <Note>Switch to Supervisor to confirm muster and review snivs.</Note>
      </Screen>
    );
  }

  const members = workCenterQueue(api.state, api.sailor, new Date(), api.settings.forceDutyDay);
  const defaults = Object.fromEntries(members.map((member) => [member.sailorId, member.track === 'Ready' || member.track === 'Confirmed']));
  const selected = picked ?? defaults;

  return (
    <View style={{ flex: 1 }}>
    <Screen>
      <Note>Turn a Sailor on or off to include them. Approve work center is what confirms those musters. The switch does not approve by itself. Open a Sailor to review snivs.</Note>
      <View style={{ marginTop: 16, marginHorizontal: 16, backgroundColor: colors.card, borderRadius: 12, overflow: 'hidden' }}>
        {members.map((member, index) => {
          return (
            <View
              key={member.sailorId}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 12,
                gap: 12,
                borderBottomWidth: index < members.length - 1 ? 1 : 0,
                borderBottomColor: colors.line,
              }}
            >
              <Pressable accessibilityRole="button" style={{ flex: 1 }} onPress={() => router.push(`/member/${member.sailorId}`)}>
                <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '600' }}>{member.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 15, marginTop: 3 }}>
                  {member.track === 'Not mustered'
                    ? 'Not mustered'
                    : `${member.musterLabel} · ${member.track === 'Ready' ? 'Awaiting confirmation' : member.track}`}
                </Text>
                {member.pendingSnivs > 0 ? (
                  <Text style={{ color: colors.gold, fontSize: 15, marginTop: 3 }}>
                    {member.pendingSnivs} sniv{member.pendingSnivs === 1 ? '' : 's'} to review
                  </Text>
                ) : null}
                {member.track === 'Not mustered' ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setBehalfStatus('PRESENT');
                      setBehalf({ id: member.sailorId, name: member.name });
                    }}
                    style={{ marginTop: 8, alignSelf: 'flex-start' }}
                  >
                    <Text style={{ color: colors.navy, fontSize: 15, fontWeight: '700' }}>Muster On Behalf</Text>
                  </Pressable>
                ) : null}
              </Pressable>
              <Switch
                accessibilityLabel={`Include ${member.name} in the work center approval`}
                value={Boolean(selected[member.sailorId])}
                onValueChange={(on) => setPicked({ ...selected, [member.sailorId]: on })}
                trackColor={{ false: colors.line, true: colors.green }}
              />
            </View>
          );
        })}
      </View>
      <PrimaryButton
        label="Approve work center"
        onPress={() => {
          const sailorIds = members.filter((member) => selected[member.sailorId]).map((member) => member.sailorId);
          const result = api.confirmWorkCenter(sailorIds);
          setMessage(result.ok ? result.message : result.error);
        }}
      />
      <PrimaryButton label="Work center settings" onPress={() => router.push('/settings')} />
      {message ? <Note>{message}</Note> : null}
    </Screen>
    {behalf ? (
      <ConfirmModal
        title="Muster On Behalf"
        body={`Muster on behalf of ${behalf.name}? This records and confirms today’s muster for that Sailor.`}
        confirmLabel="Confirm Muster"
        onCancel={() => setBehalf(null)}
        onConfirm={() => {
          const result = api.musterOnBehalf(behalf.id, behalfStatus);
          setBehalf(null);
          setMessage(result.ok ? null : result.error);
        }}
      >
        <Dropdown label="Report status" value={behalfStatus} options={statusOptions} onChange={setBehalfStatus} />
      </ConfirmModal>
    ) : null}
    </View>
  );
}
