import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  CircleHelp,
  Layers3,
  RotateCcw,
  Sparkles,
  Target,
} from 'lucide-react';
import { handbookSections, questionBank, type HandbookQuestion } from '@/data/question-bank';

export type PracticeAnswer = {
  selected: number;
  correct: boolean;
  answeredAt: string;
  attempts: number;
  correctStreak?: number;
  nextReviewAt?: string;
};

type PracticeMode = 'daily' | 'continue' | 'missed' | 'exam' | 'full' | 'topic';

type Props = {
  jurisdiction: import("@/lib/jurisdiction").Jurisdiction;
  answers: Record<string, PracticeAnswer>;
  onAnswer: (question: HandbookQuestion, selected: number) => void;
};

const shuffle = <T,>(values: T[]) => {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

function sectionStats(sectionId: string, answers: Record<string, PracticeAnswer>) {
  const questions = questionBank.filter((question) => question.section === sectionId);
  const answered = questions.filter((question) => answers[question.id]);
  const correct = answered.filter((question) => answers[question.id]?.correct).length;
  const coverage = questions.length ? answered.length / questions.length : 0;
  const accuracy = answered.length ? correct / answered.length : 0;
  return {
    total: questions.length,
    answered: answered.length,
    correct,
    coverage: Math.round(coverage * 100),
    accuracy: Math.round(accuracy * 100),
    mastery: Math.round((coverage * 0.45 + accuracy * 0.55) * 100),
  };
}

function ProgressBar({ value }: { value: number }) {
  return <div className="h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className="h-full rounded-full bg-[hsl(var(--primary))] transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>;
}

function modeLabel(mode: PracticeMode) {
  if (mode === 'daily') return 'Daily practice';
  if (mode === 'continue') return 'Continue handbook';
  if (mode === 'missed') return 'Review missed';
  if (mode === 'exam') return 'DMV-style simulation';
  if (mode === 'full') return 'Full handbook review';
  return 'Topic practice';
}

export function PracticeHub({ jurisdiction, answers, onAnswer }: Props) {
  const [queue, setQueue] = useState<HandbookQuestion[]>([]);
  const [mode, setMode] = useState<PracticeMode | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [sessionAnswers, setSessionAnswers] = useState<Record<string, number>>({});
  const [complete, setComplete] = useState(false);

  const answeredCount = Object.keys(answers).length;
  const correctCount = Object.values(answers).filter((answer) => answer.correct).length;
  const overallCoverage = Math.round((answeredCount / questionBank.length) * 100);
  const overallAccuracy = answeredCount ? Math.round((correctCount / answeredCount) * 100) : 0;
  const missedQuestions = questionBank.filter((question) => answers[question.id] && !answers[question.id].correct);
  const unseenQuestions = questionBank.filter((question) => !answers[question.id]);
  const dueQuestions = questionBank.filter((question) => {
    const reviewAt = answers[question.id]?.nextReviewAt;
    return reviewAt && new Date(reviewAt).getTime() <= Date.now();
  });
  const currentQuestion = queue[questionIndex];
  const currentSelection = currentQuestion ? sessionAnswers[currentQuestion.id] : undefined;
  const sessionCorrect = useMemo(() => queue.filter((question) => sessionAnswers[question.id] === question.answer).length, [queue, sessionAnswers]);

  const startSession = (nextMode: PracticeMode, sectionId?: string) => {
    let questions: HandbookQuestion[];
    if (nextMode === 'missed') {
      questions = shuffle(missedQuestions);
    } else if (nextMode === 'exam') {
      questions = shuffle(questionBank).slice(0, 30);
    } else if (nextMode === 'full') {
      questions = [...questionBank];
    } else if (nextMode === 'topic' && sectionId) {
      questions = shuffle(questionBank.filter((question) => question.section === sectionId));
    } else {
      const weak = questionBank.filter((question) => answers[question.id] && !answers[question.id].correct);
      const due = dueQuestions.filter((question) => !weak.some((item) => item.id === question.id));
      const mastered = questionBank.filter((question) => answers[question.id]?.correct && !due.some((item) => item.id === question.id));
      const ordered = [...shuffle(unseenQuestions), ...shuffle(weak), ...shuffle(due), ...shuffle(mastered)];
      questions = ordered.slice(0, nextMode === 'daily' ? 10 : 15);
    }
    if (questions.length === 0) return;
    setMode(nextMode);
    setQueue(questions);
    setQuestionIndex(0);
    setSessionAnswers({});
    setComplete(false);
  };

  const choose = (selected: number) => {
    if (!currentQuestion || currentSelection !== undefined) return;
    setSessionAnswers((current) => ({ ...current, [currentQuestion.id]: selected }));
    onAnswer(currentQuestion, selected);
  };

  const next = () => {
    if (questionIndex >= queue.length - 1) {
      setComplete(true);
      return;
    }
    setQuestionIndex((index) => index + 1);
  };

  const exitSession = () => {
    setMode(null);
    setQueue([]);
    setComplete(false);
    setQuestionIndex(0);
    setSessionAnswers({});
  };

  if (mode && complete) {
    const answeredThisSession = Object.keys(sessionAnswers).length;
    const score = answeredThisSession ? Math.round((sessionCorrect / answeredThisSession) * 100) : 0;
    return <div>
      <button onClick={exitSession} className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-[hsl(var(--muted-foreground))]" data-testid="button-exit-session"><ArrowLeft size={16} />Practice home</button>
      <section className="overflow-hidden rounded-[26px] bg-[hsl(var(--primary))] p-7 text-[hsl(var(--primary-foreground))] shadow-xl md:p-10">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-[hsl(var(--sidebar-primary))]"><CheckCircle2 size={17} />Session complete</div>
        <h1 className="mt-4 font-display text-4xl md:text-6xl">{score}% this round.</h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-white/68">{sessionCorrect} correct out of {answeredThisSession}. The goal is not a perfect first pass—it is knowing exactly what to review next.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <button onClick={() => startSession(mode)} className="inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--sidebar-primary))] px-4 py-3 text-sm font-extrabold text-[hsl(var(--sidebar-primary-foreground))]" data-testid="button-new-session"><RotateCcw size={16} />New session</button>
          <button onClick={exitSession} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm font-bold text-white">See handbook coverage</button>
        </div>
      </section>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"><div className="text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Questions</div><div className="mt-2 font-display text-4xl">{answeredThisSession}</div></div>
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"><div className="text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Correct</div><div className="mt-2 font-display text-4xl">{sessionCorrect}</div></div>
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"><div className="text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Still to review</div><div className="mt-2 font-display text-4xl">{answeredThisSession - sessionCorrect}</div></div>
      </div>
    </div>;
  }

  if (mode && currentQuestion) {
    const selectedCorrectly = currentSelection === currentQuestion.answer;
    const section = handbookSections.find((item) => item.id === currentQuestion.section);
    return <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <button onClick={exitSession} className="inline-flex items-center gap-2 text-sm font-bold text-[hsl(var(--muted-foreground))]" data-testid="button-exit-session"><ArrowLeft size={16} />Exit</button>
        <div className="rounded-xl bg-[hsl(var(--secondary))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary))]">{modeLabel(mode)}</div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.5fr_.7fr]">
        <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 soft-shadow md:p-8">
          <div className="mb-7 flex items-center justify-between gap-5">
            <div className="font-mono-ui text-xs text-[hsl(var(--muted-foreground))]">QUESTION {String(questionIndex + 1).padStart(2, '0')} / {String(queue.length).padStart(2, '0')}</div>
            <div className="w-32"><ProgressBar value={((questionIndex + 1) / queue.length) * 100} /></div>
          </div>
          <div className="mb-2 text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--accent))]">{section?.title}</div>
          <h1 className="max-w-3xl font-display text-3xl leading-tight md:text-4xl">{currentQuestion.prompt}</h1>
          <div className="mt-7 space-y-3">
            {currentQuestion.options.map((option, optionIndex) => {
              const answered = currentSelection !== undefined;
              const correctOption = answered && optionIndex === currentQuestion.answer;
              const chosenWrong = answered && currentSelection === optionIndex && !correctOption;
              return <button key={option} onClick={() => choose(optionIndex)} disabled={answered} className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left text-sm font-semibold ${correctOption ? 'border-[hsl(var(--success)/.55)] bg-[hsl(var(--success)/.09)] text-[hsl(var(--success))]' : chosenWrong ? 'border-[hsl(var(--accent)/.65)] bg-[hsl(var(--accent)/.1)]' : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--secondary)/.4)] disabled:opacity-100'}`} data-testid={`button-answer-${currentQuestion.id}-${optionIndex}`}>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono-ui text-[11px] ${correctOption ? 'border-[hsl(var(--success))] bg-[hsl(var(--success))] text-white' : 'border-[hsl(var(--border))]'}`}>{String.fromCharCode(65 + optionIndex)}</span>
                <span>{option}</span>
                {correctOption && <Check size={16} className="ml-auto shrink-0" />}
              </button>;
            })}
          </div>
          {currentSelection !== undefined && <div className="mt-6 rounded-2xl bg-[hsl(var(--secondary)/.65)] p-5 animate-fade">
            <div className={`flex items-center gap-2 text-sm font-extrabold ${selectedCorrectly ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--accent-foreground))]'}`}>{selectedCorrectly ? <CheckCircle2 size={18} className="text-[hsl(var(--success))]" /> : <CircleHelp size={18} className="text-[hsl(var(--accent))]" />}{selectedCorrectly ? 'Good call.' : 'Review this one before moving on.'}</div>
            <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{currentQuestion.explanation}</p>
            <div className="mt-4 border-t border-[hsl(var(--border))] pt-3 text-[11px] font-semibold text-[hsl(var(--muted-foreground))]">Source: {jurisdiction.handbookName}{currentQuestion.source.includes(" · ") ? ` · ${currentQuestion.source.split(" · ")[1]}` : ""}</div>
          </div>}
          <div className="mt-7 flex items-center justify-between gap-3">
            <button onClick={() => setQuestionIndex((index) => Math.max(0, index - 1))} disabled={questionIndex === 0} className="rounded-xl px-4 py-2.5 text-sm font-bold text-[hsl(var(--muted-foreground))] disabled:opacity-40">Previous</button>
            <button onClick={next} disabled={currentSelection === undefined} className="inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-bold text-[hsl(var(--primary-foreground))] disabled:opacity-40" data-testid="button-next-question">{questionIndex === queue.length - 1 ? 'Finish session' : 'Next question'}<ArrowRight size={16} /></button>
          </div>
        </section>
        <aside className="space-y-4">
          <div className="rounded-2xl bg-[hsl(var(--primary))] p-6 text-[hsl(var(--primary-foreground))]"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--sidebar-primary))]"><Target size={15} />Learning objective</div><p className="mt-4 font-display text-2xl leading-snug">{currentQuestion.objective}</p><p className="mt-4 text-xs leading-5 text-white/60">Difficulty: {currentQuestion.difficulty}. Every legal explanation is tied to a handbook subject rather than generated during the test.</p></div>
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6"><div className="text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--accent))]">This session</div><div className="mt-4 flex items-end gap-2"><span className="font-display text-4xl">{sessionCorrect}</span><span className="mb-1 text-xs font-bold text-[hsl(var(--muted-foreground))]">correct so far</span></div></div>
        </aside>
      </div>
    </div>;
  }

  const recommendedMode: PracticeMode = missedQuestions.length > 0 ? 'missed' : 'daily';
  const recommendationTitle = missedQuestions.length > 0 ? 'Review the questions you missed' : answeredCount === 0 ? 'Start with a focused 10' : 'Keep your practice moving';
  const recommendationCopy = missedQuestions.length > 0
    ? `${missedQuestions.length} question${missedQuestions.length === 1 ? '' : 's'} need another look. A short review keeps the explanation close.`
    : answeredCount === 0
      ? 'Take ten questions from the handbook. Coastwise will explain each answer and build your review plan as you go.'
      : 'A short mix of new and due questions is ready. Keep the session small and return when you have a clear moment.';
  return <div>
    <header className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div className="max-w-2xl"><div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-[hsl(var(--primary))]"><span className="h-px w-7 bg-[hsl(var(--primary))]" />{jurisdiction.shortName} handbook practice</div><h1 className="font-display text-4xl leading-[1.05] tracking-[-.03em] md:text-5xl">A clear next step for permit practice.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">Short sessions cover the {jurisdiction.handbookName} without turning practice into a score chase.</p></div>
    </header>
    <section className="relative overflow-hidden rounded-[24px] bg-[hsl(var(--primary))] p-6 text-[hsl(var(--primary-foreground))] shadow-[0_16px_40px_hsl(211_100%_50%/.18)] md:p-8">
      <div className="absolute -right-14 -top-20 h-56 w-56 rounded-full border-[24px] border-white/10" />
      <div className="relative max-w-2xl">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-white/70"><Sparkles size={15} />Recommended next session</div>
        <h2 className="mt-3 font-display text-3xl leading-tight md:text-4xl">{recommendationTitle}</h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-white/75">{recommendationCopy}</p>
        <button onClick={() => startSession(recommendedMode)} className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-[hsl(var(--primary))] shadow-sm hover:bg-white/90" data-testid="button-start-recommended-practice">Start session <ArrowRight size={16} /></button>
      </div>
    </section>
    {answeredCount === 0 && <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[hsl(var(--primary)/.2)] bg-[hsl(var(--secondary)/.55)] p-4 text-xs leading-5 text-[hsl(var(--muted-foreground))]"><Target size={17} className="mt-0.5 shrink-0 text-[hsl(var(--primary))]" /><p><strong className="text-[hsl(var(--foreground))]">Start with one short session.</strong> Your coverage and review reminders will appear here as you learn.</p></div>}
    <section className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4"><div className="text-[10px] font-bold uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">Covered</div><div className="mt-2 font-display text-2xl">{answeredCount}<span className="text-sm text-[hsl(var(--muted-foreground))]">/{questionBank.length}</span></div><div className="mt-3"><ProgressBar value={overallCoverage} /></div></div>
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4"><div className="text-[10px] font-bold uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">Accuracy</div><div className="mt-2 font-display text-2xl">{answeredCount ? `${overallAccuracy}%` : '—'}</div><div className="mt-1 text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">{answeredCount ? `${correctCount} correct` : 'after first answer'}</div></div>
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4"><div className="text-[10px] font-bold uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">Review</div><div className="mt-2 font-display text-2xl">{answeredCount ? missedQuestions.length : '—'}</div><div className="mt-1 text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">{answeredCount ? `${dueQuestions.length} due` : 'builds as you learn'}</div></div>
    </section>
    <section className="mt-9">
      <div className="mb-4"><div className="text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">More ways to practice</div><h2 className="mt-1 font-display text-2xl">Choose a different pace.</h2></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
          { mode: 'continue' as const, title: 'Continue', copy: 'Next 15 handbook questions', icon: BookOpen },
          { mode: 'missed' as const, title: 'Review missed', copy: `${missedQuestions.length} waiting`, icon: RotateCcw, disabled: missedQuestions.length === 0 },
          { mode: 'exam' as const, title: 'Test simulation', copy: '30 randomized questions', icon: Award },
          { mode: 'full' as const, title: 'Full handbook', copy: `All ${questionBank.length} questions`, icon: Layers3 },
        ].map((item) => {
          const Icon = item.icon;
          return <button key={item.mode} onClick={() => startSession(item.mode)} disabled={item.disabled} className="group flex items-center gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 text-left hover:border-[hsl(var(--primary)/.5)] hover:bg-[hsl(var(--secondary)/.3)] disabled:cursor-not-allowed disabled:opacity-45" data-testid={`button-mode-${item.mode}`}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--muted))] text-[hsl(var(--primary))]"><Icon size={18} /></span><span><span className="block text-sm font-extrabold">{item.title}</span><span className="mt-1 block text-xs leading-5 text-[hsl(var(--muted-foreground))]">{item.copy}</span></span></button>;
        })}
      </div>
    </section>
    <section className="mt-9">
      <div className="mb-5 flex items-end justify-between gap-4"><div><div className="text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--accent))]">Handbook coverage</div><h2 className="mt-1 font-display text-3xl">Practice by section.</h2></div><span className="font-mono-ui text-xs text-[hsl(var(--muted-foreground))]">{handbookSections.length} sections</span></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {handbookSections.map((section) => {
          const stats = sectionStats(section.id, answers);
          return <button key={section.id} onClick={() => startSession('topic', section.id)} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 text-left hover:border-[hsl(var(--primary))] hover:shadow-md" data-testid={`button-topic-${section.id}`}>
            <div className="flex items-start justify-between gap-3"><div><div className="text-sm font-extrabold">{section.title}</div><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{section.description}</p></div><span className="font-mono-ui text-xs text-[hsl(var(--primary))]">{stats.mastery}%</span></div>
            <div className="mt-4"><ProgressBar value={stats.mastery} /></div>
            <div className="mt-3 flex justify-between text-[10px] font-bold uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]"><span>{stats.answered}/{stats.total} seen</span><span>{stats.accuracy}% accuracy</span></div>
          </button>;
        })}
      </div>
    </section>
    <div className="mt-7 flex gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.45)] p-4 text-xs leading-5 text-[hsl(var(--muted-foreground))]"><CircleHelp size={17} className="mt-0.5 shrink-0 text-[hsl(var(--primary))]" /><p><strong className="text-[hsl(var(--foreground))]">Study guidance, not an official test.</strong> Questions are organized around {jurisdiction.name} handbook subjects and should be used with the current {jurisdiction.agencyName} handbook and official sample tests.</p></div>
  </div>;
}