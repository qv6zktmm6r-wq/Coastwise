import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Card, Body, Eyebrow, Screen, Title, usePalette, styles } from '@/components/ui';

const questions = [
  { prompt: 'At a four-way stop, you arrive at the same time as another driver on your right. Who goes first?', options: ['You, because you are already rolling', 'The driver on your right', 'Whoever waves first'], answer: 1, explanation: 'When arrival is simultaneous, yield to the driver on your right.' },
  { prompt: 'Rain reduces visibility. What should guide your speed?', options: ['The posted limit only', 'A speed that lets you see and stop comfortably', 'The speed of traffic behind you'], answer: 1, explanation: 'The posted limit is not a target in every condition.' },
];

export default function PracticeScreen() {
  const palette = usePalette();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const question = questions[index];
  const choose = (option: number) => setSelected(option);
  return <Screen><Eyebrow>Permit & knowledge</Eyebrow><Title>Practice one calm question.</Title><Body muted>No streaks or pressure. Learn the reason, then try another.</Body><Card><Text style={[styles.eyebrow, { color: '#0084FF' }]}>Question {index + 1} of {questions.length}</Text><Text style={[styles.title, { color: palette.text }]}>{question.prompt}</Text>{question.options.map((option, optionIndex) => <Pressable key={option} onPress={() => choose(optionIndex)} accessibilityRole="radio" accessibilityState={{ selected: selected === optionIndex }} style={{ borderWidth: 1, borderColor: selected === optionIndex ? '#0084FF' : palette.border, borderRadius: 14, padding: 15, marginTop: 10, backgroundColor: selected === optionIndex ? palette.soft : palette.card }}><Text style={{ color: palette.text, fontSize: 15, lineHeight: 20, fontWeight: '600' }}>{option}</Text></Pressable>)}{selected !== null && <View style={{ marginTop: 18 }}><Text style={{ color: selected === question.answer ? palette.success : palette.warning, fontWeight: '800' }}>{selected === question.answer ? 'Good call.' : 'Try the safer principle.'}</Text><Body muted>{question.explanation}</Body><Pressable onPress={() => { setIndex((index + 1) % questions.length); setSelected(null); }} style={{ marginTop: 16 }}><Text style={{ color: '#0084FF', fontWeight: '800' }}>Next question →</Text></Pressable></View>}</Card></Screen>;
}