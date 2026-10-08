import { Link } from 'expo-router';
import { useState, useMemo } from 'react';
import { Text, View, Pressable, TextInput, Alert, Share } from 'react-native';
import { ActionButton, Body, Card, Eyebrow, IconRow, Screen, Title, usePalette } from '@/components/ui';
import { useCoastwise, type MobileDrive } from '@/lib/coastwise-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { driveNightMinutes, nextFocus, permitProgress, skillTrends } from '@/lib/permit-progress';

const formatHours = (minutes: number) => (minutes / 60).toFixed(1);

function ProgressBar({ value, color, track }: { value: number; color: string; track: string }) {
  return (
    <View style={{ height: 10, borderRadius: 5, backgroundColor: track, overflow: 'hidden', marginTop: 8 }}>
      <View style={{ width: `${Math.min(100, Math.max(0, value * 100))}%`, height: '100%', backgroundColor: color }} />
    </View>
  );
}

export default function ParentScreen() {
  const palette = usePalette();
  const { drives, plan, role, parentGoal, setParentGoal, jurisdiction } = useCoastwise();
  const permit = useMemo(() => permitProgress(drives, jurisdiction), [drives, jurisdiction]);
  const skills = useMemo(() => skillTrends(drives), [drives]);
  const focus = nextFocus(skills.trends);
  
  const [filterMode, setFilterMode] = useState<'all' | 'day' | 'night'>('all');
  const [filterSkill, setFilterSkill] = useState<string | null>(null);

  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalMinutes, setGoalMinutes] = useState(parentGoal?.targetMinutes?.toString() ?? '120');
  const [goalSkill, setGoalSkill] = useState(parentGoal?.skill ?? 'intersections');

  const filteredDrives = useMemo(() => {
    let result = [...drives].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (filterMode === 'day') result = result.filter(d => !d.night);
    if (filterMode === 'night') result = result.filter(d => d.night);
    if (filterSkill) result = result.filter(d => d.skills.includes(filterSkill));
    return result;
  }, [drives, filterMode, filterSkill]);

  const allSkills = useMemo(() => {
    const skills = new Set<string>();
    drives.forEach(d => d.skills.forEach(s => skills.add(s)));
    return Array.from(skills).sort();
  }, [drives]);

  const goalProgress = useMemo(() => {
    if (!parentGoal) return null;
    const now = new Date();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const matchingDrives = drives.filter(d => {
      const date = new Date(d.date);
      return date >= weekStart && date <= now && d.skills.includes(parentGoal.skill);
    });
    const minutes = matchingDrives.reduce((sum, d) => sum + d.durationMinutes, 0);
    return {
      minutes,
      target: parentGoal.targetMinutes,
      completed: minutes >= parentGoal.targetMinutes
    };
  }, [drives, parentGoal]);

  const handleSaveGoal = () => {
    const mins = parseInt(goalMinutes, 10);
    if (isNaN(mins) || mins <= 0 || !goalSkill.trim()) {
      Alert.alert('Invalid goal', 'Please enter a valid target in minutes and a skill.');
      return;
    }
    setParentGoal({ targetMinutes: mins, skill: goalSkill.trim() });
    setIsEditingGoal(false);
  };

  const exportDMV = async () => {
    try {
      if (drives.length === 0) {
        Alert.alert('No drives', 'Complete a drive to export a record.');
        return;
      }
      
      let csv = 'Coastwise Personal Record (Not an official DMV submission)\n\n';
      csv += `Total Minutes,${permit.totalMinutes}\n`;
      csv += `Night Minutes,${permit.nightMinutes}\n`;
      csv += `Required,${permit.totalHours} hours including ${permit.nightHours} ${permit.nightLabel}\n\n`;
      csv += 'Date,Duration (min),Night (min),Distance (mi),Skills\n';
      
      const sorted = [...drives].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      sorted.forEach(d => {
        csv += `${new Date(d.date).toLocaleDateString()},${d.durationMinutes},${driveNightMinutes(d)},${d.distanceMiles.toFixed(1)},"${d.skills.join('; ')}"\n`;
      });
      
      if (FileSystem.documentDirectory) {
        const path = `${FileSystem.documentDirectory}coastwise_export_${Date.now()}.csv`;
        await FileSystem.writeAsStringAsync(path, csv);
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(path, {
            dialogTitle: 'Coastwise Personal Record',
            mimeType: 'text/csv',
            UTI: 'public.comma-separated-values-text',
          });
        } else {
          await Share.share({ message: csv, title: 'Coastwise Personal Record' });
        }
      } else {
        await Share.share({
          message: csv,
          title: 'Coastwise Personal Record'
        });
      }
    } catch (e) {
      Alert.alert('Export failed', 'Could not create export file.');
    }
  };

  const shareFamilySummary = async () => {
    if (drives.length === 0) {
      Alert.alert('No drives', 'Complete a drive to share a summary.');
      return;
    }
    
    const now = new Date();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const weeklyDrives = drives.filter(d => {
      const date = new Date(d.date);
      return date >= weekStart && date <= now;
    });
    const weeklyMinutes = weeklyDrives.reduce((sum, d) => sum + d.durationMinutes, 0);
    const lastDrive = [...drives].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    
    const summary = {
      practiceLog: {
        totalHours: Number(formatHours(permit.totalMinutes)),
        nightHours: Number(formatHours(permit.nightMinutes)),
        required: `${permit.totalHours} hours including ${permit.nightHours} ${permit.nightLabel}`,
      },
      nextFocus: focus?.label ?? null,
      weeklyMinutes,
      weeklyDriveCount: weeklyDrives.length,
      practicedSkills: Array.from(new Set(weeklyDrives.flatMap(d => d.skills))),
      parentGoalStatus: goalProgress ? {
        skill: parentGoal?.skill,
        progressMinutes: goalProgress.minutes,
        targetMinutes: goalProgress.target,
        completed: goalProgress.completed
      } : null,
      lastDriveDate: new Date(lastDrive.date).toLocaleDateString(),
      privacyNote: "This summary is privacy-sanitized. It contains no recordings, exact routes, coordinates, AI notes, or metadata."
    };
    
    try {
      await Share.share({
        message: JSON.stringify(summary, null, 2),
        title: 'Coastwise Family Summary'
      });
    } catch (e) {
      Alert.alert('Share failed', 'Could not share family summary.');
    }
  };
  
  return (
    <Screen>
      <View style={{ marginTop: 12, marginBottom: 24 }}>
        <Eyebrow>{role === 'teen' ? 'Progress view' : 'Parent view'}</Eyebrow>
        <Title large>Keep practice calm and specific.</Title>
        <Body muted>Coastwise keeps drive media and precise locations on the driver’s device. Use this view to review history and set goals.</Body>
      </View>

      <Card padding={24} accent>
        <Eyebrow>Supervised practice log</Eyebrow>
        <Title>
          {formatHours(permit.totalMinutes)} of {permit.totalHours} hours
        </Title>
        <ProgressBar value={permit.totalMinutes / (permit.totalHours * 60)} color={permit.totalComplete ? palette.success : colors.primary} track={palette.soft} />
        <Text style={{ color: palette.text, fontSize: 16, fontWeight: '700', marginTop: 16 }}>
          {formatHours(permit.nightMinutes)} of {permit.nightHours} hours {permit.nightLabel}
        </Text>
        <ProgressBar value={permit.nightMinutes / (permit.nightHours * 60)} color={permit.nightComplete ? palette.success : colors.accent} track={palette.soft} />
        <Text style={{ color: palette.muted, fontSize: 13, lineHeight: 18, marginTop: 16 }}>
          {permit.totalMiles.toFixed(1)} miles logged. Night time is measured from local sunset and sunrise on this device. This is a personal log; follow your state’s official certification process.
        </Text>
      </Card>

      <View style={{ height: 16 }} />

      <Card padding={24}>
        <Eyebrow>Driving skills (measured)</Eyebrow>
        {skills.drivesConsidered === 0 ? (
          <Body muted>Complete a coached drive to see measured skills. Coastwise only reports what GPS and map data recorded.</Body>
        ) : (
          <>
            <Text style={{ color: palette.muted, fontSize: 13, marginBottom: 12 }}>
              Last {skills.drivesConsidered} measured drive{skills.drivesConsidered === 1 ? '' : 's'} · {skills.miles.toFixed(1)} miles
            </Text>
            <View style={{ gap: 10 }}>
              {skills.trends.filter((trend) => trend.summary !== null).map((trend) => (
                <View key={trend.id}>
                  <Text style={{ color: palette.text, fontWeight: '700', fontSize: 15 }}>{trend.label}</Text>
                  <Text style={{ color: palette.muted, fontSize: 14, marginTop: 2 }}>{trend.summary}</Text>
                </View>
              ))}
            </View>
            <View style={{ backgroundColor: palette.soft, borderRadius: 16, padding: 16, marginTop: 16 }}>
              <Eyebrow>Next practice focus</Eyebrow>
              <Text style={{ color: palette.text, fontSize: 15, lineHeight: 22, fontWeight: '600' }}>
                {focus ? `${focus.label}: ${focus.focus}` : 'Nothing measured needs extra work. Keep building hours in new conditions.'}
              </Text>
            </View>
          </>
        )}
      </Card>

      <View style={{ height: 16 }} />

      <Card padding={24} accent>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: `${colors.primary}18`, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="flag" size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Eyebrow>Weekly parent goal</Eyebrow>
            <Title>{parentGoal ? parentGoal.skill : 'No goal set'}</Title>
          </View>
        </View>
        
        {parentGoal && goalProgress && !isEditingGoal ? (
          <View>
            <Text style={{ color: palette.text, fontSize: 32, fontWeight: '800', letterSpacing: -1 }}>
              {goalProgress.minutes} <Text style={{ fontSize: 16, color: palette.muted, fontWeight: '600' }}>/ {goalProgress.target} min</Text>
            </Text>
            {goalProgress.completed && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                <Ionicons name="checkmark-circle" size={16} color={palette.success} />
                <Text style={{ color: palette.success, fontWeight: '700' }}>Goal completed!</Text>
              </View>
            )}
            
            {role === 'parent' && (
              <Pressable onPress={() => setIsEditingGoal(true)} style={({ pressed }) => [{ marginTop: 16, opacity: pressed ? 0.7 : 1 }]}>
                <Text style={{ color: colors.primary, fontWeight: '700' }}>Edit goal</Text>
              </Pressable>
            )}
          </View>
        ) : isEditingGoal && role === 'parent' ? (
          <View style={{ gap: 12 }}>
            <View>
              <Text style={{ color: palette.muted, fontSize: 13, marginBottom: 6, fontWeight: '600' }}>Skill</Text>
              <TextInput
                value={goalSkill}
                onChangeText={setGoalSkill}
                style={{ backgroundColor: palette.soft, color: palette.text, padding: 16, borderRadius: 12, fontSize: 16 }}
                placeholder="e.g. intersections"
                placeholderTextColor={palette.muted}
              />
            </View>
            <View>
              <Text style={{ color: palette.muted, fontSize: 13, marginBottom: 6, fontWeight: '600' }}>Target (minutes)</Text>
              <TextInput
                value={goalMinutes}
                onChangeText={setGoalMinutes}
                keyboardType="number-pad"
                style={{ backgroundColor: palette.soft, color: palette.text, padding: 16, borderRadius: 12, fontSize: 16 }}
                placeholder="120"
                placeholderTextColor={palette.muted}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <ActionButton onPress={() => setIsEditingGoal(false)} secondary>Cancel</ActionButton>
              </View>
              <View style={{ flex: 1 }}>
                <ActionButton onPress={handleSaveGoal}>Save</ActionButton>
              </View>
            </View>
          </View>
        ) : role === 'parent' ? (
          <ActionButton onPress={() => setIsEditingGoal(true)}>Set a goal</ActionButton>
        ) : (
          <Body muted>Ask your parent to set a focus goal for you.</Body>
        )}
      </Card>

      <View style={{ marginTop: 32 }}>
        <Eyebrow>Drive History</Eyebrow>
        
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {(['all', 'day', 'night'] as const).map(mode => (
            <Pressable 
              key={mode}
              onPress={() => setFilterMode(mode)}
              accessibilityRole="radio"
              accessibilityState={{ selected: filterMode === mode }}
              style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, backgroundColor: filterMode === mode ? colors.primary : palette.soft }}
            >
              <Text style={{ color: filterMode === mode ? '#FFFFFF' : palette.text, fontWeight: '600', textTransform: 'capitalize' }}>{mode}</Text>
            </Pressable>
          ))}
          
          {allSkills.length > 0 && (
            <Pressable 
              onPress={() => {
                if (!filterSkill) {
                  setFilterSkill(allSkills[0]);
                  return;
                }
                const nextIndex = allSkills.indexOf(filterSkill) + 1;
                setFilterSkill(nextIndex < allSkills.length ? allSkills[nextIndex] : null);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: filterSkill !== null }}
              style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, backgroundColor: filterSkill ? `${colors.accent}22` : palette.soft, borderWidth: 1, borderColor: filterSkill ? colors.accent : 'transparent' }}
            >
              <Text style={{ color: filterSkill ? colors.accent : palette.text, fontWeight: '600' }}>{filterSkill ? `Skill: ${filterSkill}` : 'Filter by skill'}</Text>
            </Pressable>
          )}
        </View>

        {filteredDrives.length > 0 ? (
          <View style={{ gap: 12 }}>
            {filteredDrives.map(d => (
              <Card key={d.id} padding={16}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View>
                    <Text style={{ color: palette.text, fontSize: 18, fontWeight: '700' }}>{d.durationMinutes} min</Text>
                    <Text style={{ color: palette.muted, fontSize: 14, marginTop: 4 }}>{new Date(d.date).toLocaleDateString()}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: palette.soft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                    <Ionicons name={d.night ? "moon" : "sunny"} size={14} color={palette.muted} />
                    <Text style={{ color: palette.muted, fontSize: 13, fontWeight: '600' }}>{d.night ? 'Night' : 'Day'}</Text>
                  </View>
                </View>
                {d.skills.length > 0 && (
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                    {d.skills.map(s => (
                      <View key={s} style={{ backgroundColor: `${colors.primary}18`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>{s}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            ))}
          </View>
        ) : (
          <View style={{ padding: 24, backgroundColor: palette.soft, borderRadius: 24, alignItems: 'center' }}>
            <Text style={{ color: palette.muted, fontSize: 15 }}>No matching drives found.</Text>
          </View>
        )}
      </View>

      <View style={{ marginTop: 32, gap: 16 }}>
        <Card padding={24}>
          <Eyebrow>Export & Sharing</Eyebrow>
          <View style={{ gap: 12, marginTop: 16 }}>
            <ActionButton onPress={shareFamilySummary} secondary>Share family summary (Privacy safe)</ActionButton>
            <ActionButton onPress={exportDMV} secondary>Export DMV record (CSV)</ActionButton>
          </View>
          <Text style={{ color: palette.muted, fontSize: 13, marginTop: 16, lineHeight: 18 }}>
            Family summaries contain no raw videos, locations, or notes. DMV records are unofficial personal logs.
          </Text>
        </Card>
      </View>

      <Link href="/privacy" asChild>
        <Pressable style={({ pressed }) => [{ marginTop: 32, marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: pressed ? 0.7 : 1 }]}>
          <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 16 }}>Review privacy details</Text>
        </Pressable>
      </Link>
    </Screen>
  );
}
