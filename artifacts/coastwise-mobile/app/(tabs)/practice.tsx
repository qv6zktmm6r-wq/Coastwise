import { useState } from 'react';
import { Pressable, Text, View, AccessibilityInfo, Linking } from 'react-native';
import { Card, Body, Eyebrow, Screen, Title, usePalette, styles } from '@/components/ui';
import { colors } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import { useCoastwise } from '@/lib/coastwise-context';
import { getMobilePracticePack } from '@/lib/practice-content';

export default function PracticeScreen() {
  const palette = usePalette();
  const { jurisdiction, contentPackVersion, recordPracticeAnswer } = useCoastwise();
  const questions = getMobilePracticePack(jurisdiction);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const question = questions[index];
  
  const choose = (option: number) => {
    if (selected === null) {
      setSelected(option);
      recordPracticeAnswer(question.id, question.topic, option === question.answer);
      if (option === question.answer) {
        AccessibilityInfo.announceForAccessibility("Correct. Good call.");
      } else {
        AccessibilityInfo.announceForAccessibility("Incorrect. Try the safer principle.");
      }
    }
  };
  
  const handleNext = () => {
    setIndex((index + 1) % questions.length);
    setSelected(null);
  };

  return (
    <Screen>
      <View style={{ marginTop: 12, marginBottom: 24 }}>
        <Eyebrow>Permit & knowledge</Eyebrow>
        <Title large>Practice one calm question.</Title>
        <Body muted>No streaks or pressure. Learn the reason, then try another.</Body>
      </View>
      
      <Card padding={24}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={[styles.eyebrow, { color: colors.primary, marginBottom: 0 }]}>Question {index + 1} of {questions.length}</Text>
          <Ionicons name="book" size={20} color={colors.primary} />
        </View>
        
        <Text style={[styles.title, { color: palette.text, fontSize: 22, lineHeight: 30, marginBottom: 24 }]}>{question.prompt}</Text>
        
        <View style={{ gap: 12 }}>
          {question.options.map((option, optionIndex) => {
            const isSelected = selected === optionIndex;
            const isCorrectAnswer = selected !== null && optionIndex === question.answer;
            const isWrongSelection = isSelected && optionIndex !== question.answer;
            
            let bgColor: string = palette.card;
            let borderColor: string = palette.border;
            let textColor: string = palette.text;
            let iconName: keyof typeof Ionicons.glyphMap = 'ellipse-outline';
            let iconColor: string = palette.muted;

            let opacity = 1;

            if (selected !== null) {
              if (isCorrectAnswer) {
                bgColor = `${palette.success}18`;
                borderColor = palette.success;
                textColor = palette.success;
                iconName = 'checkmark-circle';
                iconColor = palette.success;
              } else if (isWrongSelection) {
                bgColor = `${palette.warning}18`;
                borderColor = palette.warning;
                textColor = palette.warning;
                iconName = 'close-circle';
                iconColor = palette.warning;
              } else {
                opacity = 0.5;
              }
            } else if (isSelected) {
              bgColor = palette.soft;
              borderColor = colors.primary;
            }

            return (
              <Pressable 
                key={option} 
                onPress={() => choose(optionIndex)} 
                disabled={selected !== null}
                accessibilityRole="radio" 
                accessibilityState={{ selected: isSelected }} 
                style={({ pressed }) => [
                  { 
                    borderWidth: 1.5, 
                    borderColor: pressed && selected === null ? colors.primary : borderColor, 
                    borderRadius: 16, 
                    padding: 16, 
                    backgroundColor: pressed && selected === null ? palette.soft : bgColor,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 16,
                    opacity: opacity
                  }
                ]}
              >
                <Ionicons name={iconName} size={24} color={iconColor} />
                <Text style={{ color: textColor, fontSize: 16, lineHeight: 22, fontWeight: '600', flex: 1 }}>{option}</Text>
              </Pressable>
            );
          })}
        </View>
        
        {selected !== null && (
          <View style={{ marginTop: 32, padding: 20, backgroundColor: palette.soft, borderRadius: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Ionicons name={selected === question.answer ? "checkmark-circle" : "alert-circle"} size={22} color={selected === question.answer ? palette.success : palette.warning} />
              <Text style={{ color: selected === question.answer ? palette.success : palette.warning, fontWeight: '800', fontSize: 18 }}>
                {selected === question.answer ? 'Good call.' : 'Try the safer principle.'}
              </Text>
            </View>
            <Body muted>{question.explanation}</Body>
            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(question.sourceUrl)} style={{ marginTop: 14 }}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>Official source: {question.sourceTitle}</Text>
              <Text style={{ color: palette.muted, fontSize: 12, marginTop: 3 }}>Pack {contentPackVersion}</Text>
            </Pressable>
            <Pressable onPress={handleNext} style={({ pressed }) => [{ marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed ? 0.7 : 1 }]}>
              <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 16 }}>Next question</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.primary} />
            </Pressable>
          </View>
        )}
      </Card>
    </Screen>
  );
}
