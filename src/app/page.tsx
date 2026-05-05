"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Check, Printer, RotateCcw, Flame, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  departments,
  acuityLevels,
  orgLevels,
  weights,
  calcWeightedTech,
  calcFinal,
  interpretScore,
  isRedZone,
  type Department,
  type Process,
} from "@/lib/data";

type StepId = "intro" | "dept" | "process" | "acuity" | "tech" | "org" | "result";

const stepOrder: StepId[] = ["intro", "dept", "process", "acuity", "tech", "org", "result"];
const stepLabels: Record<StepId, string> = {
  intro: "Старт",
  dept: "Отдел",
  process: "Процесс",
  acuity: "Острота",
  tech: "Техника",
  org: "Команда",
  result: "Результат",
};

type State = {
  step: StepId;
  deptId: string | null;
  processId: string | null;
  acuity: number | null;
  tech: Record<string, number>;
  org: number | null;
};

const initialState: State = {
  step: "intro",
  deptId: null,
  processId: null,
  acuity: null,
  tech: {},
  org: null,
};

export default function WizardPage() {
  const [state, setState] = useState<State>(initialState);

  // Persist between refreshes — но не «навсегда», только текущая сессия
  useEffect(() => {
    const saved = sessionStorage.getItem("ai-readiness-state");
    if (saved) {
      try {
        setState(JSON.parse(saved));
      } catch {}
    }
  }, []);
  useEffect(() => {
    sessionStorage.setItem("ai-readiness-state", JSON.stringify(state));
  }, [state]);

  const dept = useMemo<Department | null>(
    () => departments.find((d) => d.id === state.deptId) ?? null,
    [state.deptId]
  );
  const process = useMemo<Process | null>(
    () => dept?.processes.find((p) => p.id === state.processId) ?? null,
    [dept, state.processId]
  );

  const techScore = useMemo(() => {
    if (!dept) return 0;
    return calcWeightedTech(state.tech, dept.tech);
  }, [state.tech, dept]);

  const techComplete = useMemo(() => {
    if (!dept) return false;
    return dept.tech.every((c) => typeof state.tech[c.id] === "number");
  }, [state.tech, dept]);

  const goto = (step: StepId) => setState((s) => ({ ...s, step }));
  const next = () => {
    const idx = stepOrder.indexOf(state.step);
    if (idx < stepOrder.length - 1) goto(stepOrder[idx + 1]);
  };
  const back = () => {
    const idx = stepOrder.indexOf(state.step);
    if (idx > 0) goto(stepOrder[idx - 1]);
  };
  const reset = () => {
    sessionStorage.removeItem("ai-readiness-state");
    setState(initialState);
  };

  const stepIndex = stepOrder.indexOf(state.step);
  const showStepper = state.step !== "intro" && state.step !== "result";

  return (
    <main className="min-h-screen paper">
      <TopBar stepIndex={stepIndex} onReset={reset} />

      <div className="mx-auto w-full max-w-5xl px-4 pb-20 pt-8 sm:px-6 sm:pb-24 sm:pt-14">
        {showStepper && <Stepper current={state.step} />}

        <AnimatePresence mode="wait">
          <motion.div
            key={state.step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="mt-8 sm:mt-12"
          >
            {state.step === "intro" && <IntroStep onStart={next} />}
            {state.step === "dept" && (
              <DeptStep
                onPick={(id) => setState((s) => ({ ...s, deptId: id, processId: null, tech: {}, step: "process" }))}
                selected={state.deptId}
              />
            )}
            {state.step === "process" && dept && (
              <ProcessStep
                dept={dept}
                onPick={(id) => setState((s) => ({ ...s, processId: id, step: "acuity" }))}
                selected={state.processId}
                onBack={back}
              />
            )}
            {state.step === "acuity" && process && (
              <AcuityStep
                process={process}
                value={state.acuity}
                onPick={(v) => setState((s) => ({ ...s, acuity: v }))}
                onNext={next}
                onBack={back}
              />
            )}
            {state.step === "tech" && dept && (
              <TechStep
                dept={dept}
                values={state.tech}
                onPick={(id, v) => setState((s) => ({ ...s, tech: { ...s.tech, [id]: v } }))}
                techScore={techScore}
                complete={techComplete}
                onNext={next}
                onBack={back}
              />
            )}
            {state.step === "org" && (
              <OrgStep
                value={state.org}
                onPick={(v) => setState((s) => ({ ...s, org: v }))}
                onNext={next}
                onBack={back}
              />
            )}
            {state.step === "result" && dept && process && state.acuity != null && state.org != null && (
              <ResultStep
                dept={dept}
                process={process}
                acuity={state.acuity}
                tech={techScore}
                org={state.org}
                techBreakdown={dept.tech.map((c) => ({
                  name: c.name,
                  weight: c.weight,
                  score: state.tech[c.id] ?? 0,
                }))}
                onRestart={reset}
                onAnotherProcess={() =>
                  setState((s) => ({ ...s, processId: null, acuity: null, tech: {}, org: null, step: "process" }))
                }
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <Footer />
    </main>
  );
}

/* ──────────────────────────────────────────────────────────── */

function TopBar({ stepIndex, onReset }: { stepIndex: number; onReset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-5 sm:px-6 sm:pt-8">
      <div className="flex items-center justify-between gap-3 rule-bottom pb-4 sm:pb-5">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-flame">
            <Flame className="h-3.5 w-3.5 text-bone" strokeWidth={2.5} />
          </span>
          <span className="truncate font-mono text-[10px] uppercase tracking-widest text-ink/70 sm:text-[11px]">
            <span className="sm:hidden">Готовность к ИИ</span>
            <span className="hidden sm:inline">Готовность к ИИ · Дилерский центр</span>
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted sm:text-[11px]">
            {String(Math.max(0, stepIndex)).padStart(2, "0")} / 06
          </span>
          {stepIndex > 0 && (
            <button
              onClick={onReset}
              className="font-mono text-[10px] uppercase tracking-widest text-muted hover:text-flame sm:text-[11px]"
            >
              Сбросить
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stepper({ current }: { current: StepId }) {
  const visible = stepOrder.filter((s) => s !== "intro" && s !== "result");
  const idx = visible.indexOf(current as (typeof visible)[number]);
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
      <div className="flex min-w-max items-center gap-x-2 gap-y-2 font-mono text-[11px] uppercase tracking-widest sm:min-w-0 sm:flex-wrap sm:gap-x-3">
        {visible.map((s, i) => {
          const done = i < idx;
          const active = i === idx;
          return (
            <div key={s} className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] tabular-nums transition-colors",
                    done && "border-ink bg-ink text-bone",
                    active && "border-flame bg-flame text-bone",
                    !done && !active && "border-rule text-muted"
                  )}
                >
                  {done ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
                </span>
                <span className={cn("whitespace-nowrap", active ? "text-ink" : "text-muted")}>{stepLabels[s]}</span>
              </div>
              {i < visible.length - 1 && <span className="text-muted/60">—</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */

function IntroStep({ onStart }: { onStart: () => void }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-14">
      <div>
        <Caption>Метод · Один процесс · Семь минут</Caption>
        <h1 className="mt-4 font-display text-[clamp(28px,7vw,52px)] font-black leading-[1.08] tracking-tight text-ink sm:mt-5">
          Прежде чем покупать ИИ —{" "}
          <span className="italic text-flame">проверьте</span> отдел.
        </h1>
        <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-inkSoft sm:mt-6 sm:text-lg">
          Большинство пилотов умирают не из-за модели. Из-за того, что данные разбросаны, регламенты не работают, а менеджеры саботируют новый инструмент.
        </p>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-inkSoft sm:mt-4 sm:text-lg">
          Здесь вы оцените один процесс по трём осям: насколько он болит, насколько готова техника, насколько готова команда. На выходе — балл от 1 до 5 и понимание, что делать.
        </p>
        <div className="mt-7 flex flex-col items-stretch gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <Button variant="flame" size="lg" onClick={onStart} className="w-full sm:w-auto">
            Начать оценку <ArrowRight className="h-4 w-4" />
          </Button>
          <span className="text-center font-mono text-[10px] uppercase tracking-widest text-muted sm:text-left sm:text-[11px]">
            5 отделов · 29 процессов · ~7 минут
          </span>
        </div>
      </div>

      <div className="grid gap-3">
        <FormulaCard />
        <Pillars />
      </div>
    </div>
  );
}

function FormulaCard() {
  return (
    <Card className="bg-coal text-bone">
      <CardContent className="p-5 sm:p-7">
        <Caption tone="dark">Формула</Caption>
        <div className="mt-4 break-words font-mono text-[12px] leading-relaxed text-bone/80 sm:text-[13px]">
          <span className="text-flameSoft">ƒ</span>  Готовность ={" "}
          <span className="text-bone">Острота</span>×<span className="text-flameSoft">0.40</span>{" "}
          + <span className="text-bone">Техника</span>×<span className="text-flameSoft">0.35</span>{" "}
          + <span className="text-bone">Команда</span>×<span className="text-flameSoft">0.25</span>
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-bone/65 sm:text-sm">
          Острота весит больше всех — потому что без боли любой проект ИИ заглохнет на втором месяце. Техника вторая — без данных модели глупеют. Команда последняя по весу, но первая по тому, как часто валит проекты.
        </p>
      </CardContent>
    </Card>
  );
}

function Pillars() {
  const items = [
    { num: "01", label: "Острота", note: "Насколько болит — определяет, появится ли вообще проектная команда." },
    { num: "02", label: "Техника", note: "Качество данных и интеграции. Без них модель не на чем учить." },
    { num: "03", label: "Команда", note: "Готовность людей. Семьдесят процентов провалов — здесь." },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((i) => (
        <div key={i.num} className="rounded-xl border border-rule bg-boneSoft p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-flame">{i.num}</div>
          <div className="mt-2 font-display text-base font-bold tracking-tight">{i.label}</div>
          <div className="mt-2 text-[12px] leading-snug text-muted">{i.note}</div>
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */

function DeptStep({ onPick, selected }: { onPick: (id: string) => void; selected: string | null }) {
  return (
    <div>
      <StepHeading caption="Шаг 01 · Отдел">С какого отдела начнём?</StepHeading>
      <p className="mt-4 max-w-2xl text-base text-inkSoft">
        Оценивать готовность всего ДЦ одной цифрой бессмысленно. У продаж и сервиса разные системы, разные данные, разные люди. Берём один отдел — сейчас один процесс из него.
      </p>

      <div className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-2 lg:grid-cols-3">
        {departments.map((d, idx) => (
          <motion.button
            key={d.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.04, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => onPick(d.id)}
            className={cn(
              "group relative flex h-full flex-col rounded-2xl border bg-boneSoft p-5 text-left transition-all hover:-translate-y-0.5 hover:border-ink/30 hover:shadow-[0_12px_40px_-16px_rgba(26,22,20,0.3)] sm:p-6",
              selected === d.id ? "border-flame" : "border-rule"
            )}
          >
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[11px] uppercase tracking-widest text-flame">
                {d.number}
              </span>
              <ArrowRight className="h-4 w-4 text-muted transition-all group-hover:translate-x-1 group-hover:text-flame" />
            </div>
            <h3 className="mt-4 font-display text-xl font-bold leading-tight tracking-tight sm:mt-6 sm:text-2xl">
              {d.name}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted sm:mt-3">{d.blurb}</p>
            <div className="mt-4 font-mono text-[10px] uppercase tracking-widest text-muted sm:mt-6">
              {d.processes.length} {pluralProcesses(d.processes.length)}
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function pluralProcesses(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "процесс";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "процесса";
  return "процессов";
}

/* ──────────────────────────────────────────────────────────── */

function ProcessStep({
  dept,
  onPick,
  selected,
  onBack,
}: {
  dept: Department;
  onPick: (id: string) => void;
  selected: string | null;
  onBack: () => void;
}) {
  return (
    <div>
      <StepHeading caption={`Шаг 02 · Процесс · ${dept.name}`}>
        Какой процесс смотрим?
      </StepHeading>
      <p className="mt-4 max-w-2xl text-base text-inkSoft">
        Выбирайте по принципу «где больнее всего» или «где у нас лучше всего получается измерять». Идеальный кандидат — болит сильно и при этом данные есть.
      </p>

      <div className="mt-8 grid gap-2 sm:mt-10">
        {dept.processes.map((p, idx) => (
          <motion.button
            key={p.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.03, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => onPick(p.id)}
            className={cn(
              "group grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-xl border bg-boneSoft p-4 text-left transition-all hover:border-ink/30 hover:bg-bone sm:gap-5 sm:p-5",
              selected === p.id ? "border-flame" : "border-rule"
            )}
          >
            <span className="pt-1 font-mono text-[10px] uppercase tracking-widest text-muted sm:text-[11px]">
              {String(idx + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <div className="font-display text-base font-bold leading-tight tracking-tight sm:text-lg">{p.name}</div>
              <div className="mt-1.5 text-[13px] leading-relaxed text-inkSoft sm:text-sm">
                <span className="text-muted">Где больно: </span>
                {p.pain}
              </div>
              <div className="mt-1 text-[13px] leading-relaxed text-inkSoft sm:text-sm">
                <span className="text-flame">Куда обычно идут: </span>
                {p.aiHint}
              </div>
            </div>
            <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-muted transition-all group-hover:translate-x-1 group-hover:text-flame" />
          </motion.button>
        ))}
      </div>

      <div className="mt-10">
        <Button variant="ghost" onClick={onBack} size="sm">
          <ArrowLeft className="h-3 w-3" /> К отделам
        </Button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */

function AcuityStep({
  process,
  value,
  onPick,
  onNext,
  onBack,
}: {
  process: Process;
  value: number | null;
  onPick: (v: number) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <StepHeading caption={`Шаг 03 · Острота · вес 0.40`}>
        Насколько больно прямо сейчас?
      </StepHeading>
      <p className="mt-4 max-w-2xl text-base text-inkSoft">
        Оцените процесс <span className="font-medium text-ink">«{process.name}»</span> — не отдел в целом, а именно его. Чем выше балл, тем сильнее потребность что-то менять. Эта ось весит больше остальных: без боли проект внедрения не доживёт до запуска.
      </p>

      <div className="mt-10 grid gap-3">
        {acuityLevels.map((lv) => (
          <ScaleRow
            key={lv.score}
            score={lv.score}
            title={lv.title}
            description={lv.description}
            selected={value === lv.score}
            onClick={() => onPick(lv.score)}
          />
        ))}
      </div>

      <NavRow onBack={onBack} onNext={onNext} disabled={value == null} />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */

function TechStep({
  dept,
  values,
  onPick,
  techScore,
  complete,
  onNext,
  onBack,
}: {
  dept: Department;
  values: Record<string, number>;
  onPick: (id: string, v: number) => void;
  techScore: number;
  complete: boolean;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <StepHeading caption="Шаг 04 · Техника · вес 0.35">Что под капотом?</StepHeading>
      <p className="mt-4 max-w-2xl text-base text-inkSoft">
        Качество данных, регламенты, интеграции, культура — четыре-пять критериев со своими весами. Сумма даст балл «Техники». Это самый честный момент: без данных и связки систем ИИ — это калькулятор.
      </p>

      <div className="mt-8 grid gap-4 sm:mt-10 sm:gap-5">
        {dept.tech.map((c) => {
          const val = values[c.id];
          const descriptor = val == null ? null : val <= 2 ? c.low : val <= 4 ? c.mid : c.high;
          return (
            <Card key={c.id} className="bg-boneSoft">
              <CardContent className="p-5 sm:p-7">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-display text-base font-bold leading-tight tracking-tight sm:text-lg">{c.name}</h3>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                    Вес {c.weight.toFixed(2).replace("0.", "·")}0
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-5 gap-1.5 sm:mt-5 sm:gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => onPick(c.id, n)}
                      className={cn(
                        "h-11 rounded-lg border font-mono text-sm font-bold tabular-nums transition-all sm:h-12",
                        val === n
                          ? "border-flame bg-flame text-bone shadow-[0_4px_16px_-4px_rgba(255,90,31,0.4)]"
                          : "border-rule bg-bone text-ink hover:border-ink/30 hover:bg-ink/5"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>

                <div className="mt-4 min-h-[3em] text-[13px] leading-relaxed text-inkSoft sm:text-sm">
                  {descriptor ? (
                    <span>
                      <span className="text-muted">Сейчас: </span>
                      {descriptor}
                    </span>
                  ) : (
                    <span className="text-muted/70">
                      1–2 — слабо · 3–4 — средне · 5 — сильно
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-rule bg-coal px-5 py-4 text-bone sm:mt-8 sm:px-6 sm:py-5">
        <div className="font-mono text-[10px] uppercase tracking-widest text-bone/70 sm:text-[11px]">
          Балл «Техника»
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-black tabular-nums text-flameSoft sm:text-3xl">
            {techScore.toFixed(2)}
          </span>
          <span className="font-mono text-xs text-bone/50">/ 5.00</span>
        </div>
      </div>

      <NavRow onBack={onBack} onNext={onNext} disabled={!complete} />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */

function OrgStep({
  value,
  onPick,
  onNext,
  onBack,
}: {
  value: number | null;
  onPick: (v: number) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <StepHeading caption="Шаг 05 · Команда · вес 0.25">
        Как команда отнесётся к новому инструменту?
      </StepHeading>
      <p className="mt-4 max-w-2xl text-base text-inkSoft">
        Самая частая причина смерти пилотов — не техника, а люди. Не «ИИ не работает», а «менеджеры в него не поверили». Ставьте балл честно: смотрите на прошлые ИТ-проекты в этом отделе.
      </p>

      <div className="mt-10 grid gap-3">
        {orgLevels.map((lv) => (
          <ScaleRow
            key={lv.score}
            score={lv.score}
            title={lv.title}
            description={lv.description}
            selected={value === lv.score}
            onClick={() => onPick(lv.score)}
          />
        ))}
      </div>

      <NavRow onBack={onBack} onNext={onNext} disabled={value == null} nextLabel="Посчитать балл" />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */

function ResultStep({
  dept,
  process,
  acuity,
  tech,
  org,
  techBreakdown,
  onRestart,
  onAnotherProcess,
}: {
  dept: Department;
  process: Process;
  acuity: number;
  tech: number;
  org: number;
  techBreakdown: { name: string; weight: number; score: number }[];
  onRestart: () => void;
  onAnotherProcess: () => void;
}) {
  const final = calcFinal(acuity, tech, org);
  const interp = interpretScore(final);
  const red = isRedZone(acuity, tech, org);

  // Анимированный счётчик
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const dur = 900;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      setDisplayed(final * ease(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [final]);

  return (
    <div className="grid gap-8">
      <Caption>Результат · {dept.name} · {process.name}</Caption>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr] lg:gap-6">
        {/* Big score */}
        <Card className="bg-coal text-bone">
          <CardContent className="grid gap-6 p-6 sm:gap-7 sm:p-9">
            <div className="font-mono text-[10px] uppercase tracking-widest text-bone/60 sm:text-[11px]">
              Итоговый балл
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-display text-[clamp(72px,18vw,120px)] font-black leading-none tabular-nums text-flame">
                {displayed.toFixed(2)}
              </span>
              <span className="font-mono text-xs text-bone/50 sm:text-sm">/ 5.00</span>
            </div>
            <ScoreBar value={final} />
            <div>
              <div className="font-display text-2xl font-black tracking-tight sm:text-3xl">
                {interp.title}
              </div>
              <div className="mt-2 text-[15px] text-bone/70 sm:text-base">{interp.summary}</div>
            </div>
          </CardContent>
        </Card>

        {/* Breakdown */}
        <Card>
          <CardContent className="p-5 sm:p-7">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted sm:text-[11px]">
              Из чего сложился балл
            </div>
            <div className="mt-5 grid gap-5 sm:mt-6">
              <AxisRow label="Острота" weight={weights.acuity} score={acuity} note="насколько процесс болит" />
              <AxisRow label="Техника" weight={weights.tech} score={tech} note="данные, регламенты, интеграции" />
              <AxisRow label="Команда" weight={weights.org} score={org} note="готовность людей" />
            </div>
            <div className="mt-6 rule-bottom sm:mt-7" />
            <div className="mt-5">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted sm:text-[11px]">
                Техника — раскладка по критериям
              </div>
              <div className="mt-3 grid gap-2 text-[13px] sm:text-sm">
                {techBreakdown.map((b) => (
                  <div key={b.name} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-inkSoft">{b.name}</span>
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted sm:text-xs">
                      {b.score.toFixed(0)} × {b.weight.toFixed(2)} = {(b.score * b.weight).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Red zone warning */}
      {red && (
        <Card className="border-flame bg-flame/8">
          <CardContent>
            <div className="flex items-start gap-4">
              <AlertTriangle className="h-5 w-5 shrink-0 text-flame mt-1" />
              <div>
                <div className="font-display text-lg font-bold tracking-tight text-flame">
                  Красная зона
                </div>
                <div className="mt-2 text-sm leading-relaxed text-inkSoft">
                  Острота высокая, а техника или команда не дотягивают. Самый опасный кейс: проблема горит, а решать её ИИ нельзя — ни данных, ни принятия. Если внедрить как есть, провал отравит тему ИИ внутри компании ещё на год.
                </div>
                <div className="mt-3 text-sm leading-relaxed text-inkSoft">
                  Что делать сейчас: не покупать платформу, а потратить три-шесть месяцев на чистку данных, регламенты и обучение. После — повторная оценка.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      <Card>
        <CardContent>
          <Caption>Что делать дальше</Caption>
          <p className="mt-3 text-base leading-relaxed text-inkSoft">{interp.detail}</p>
          <ol className="mt-6 grid gap-3">
            {interp.next.map((step, i) => (
              <li key={i} className="flex items-baseline gap-4">
                <span className="font-mono text-[11px] uppercase tracking-widest text-flame tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-base leading-relaxed text-ink">{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-7 rule-bottom" />
          <div className="mt-5 grid gap-2">
            <div className="font-mono text-[11px] uppercase tracking-widest text-muted">
              Если результат подтвердится — типичное направление решения
            </div>
            <div className="text-base text-ink">{process.aiHint}</div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col items-stretch gap-3 no-print sm:flex-row sm:flex-wrap sm:items-center">
        <Button variant="flame" onClick={onAnotherProcess} className="w-full sm:w-auto">
          Оценить ещё процесс <ArrowRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={() => window.print()} className="w-full sm:w-auto">
          <Printer className="h-4 w-4" /> Распечатать
        </Button>
        <Button variant="ghost" onClick={onRestart} className="w-full sm:w-auto">
          <RotateCcw className="h-4 w-4" /> Начать заново
        </Button>
      </div>
    </div>
  );
}

function ScoreBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value / 5)) * 100;
  return (
    <div className="grid gap-1.5">
      <div className="relative h-1.5 overflow-hidden rounded-full bg-bone/15">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="h-full rounded-full bg-flame"
        />
        {[3.5, 4.0, 4.5].map((t) => (
          <div
            key={t}
            className="absolute top-0 h-full w-px bg-bone/30"
            style={{ left: `${(t / 5) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between font-mono text-[10px] uppercase tracking-widest text-bone/40">
        <span>1.0</span>
        <span>3.5</span>
        <span>4.0</span>
        <span>4.5</span>
        <span>5.0</span>
      </div>
    </div>
  );
}

function AxisRow({
  label,
  weight,
  score,
  note,
}: {
  label: string;
  weight: number;
  score: number;
  note: string;
}) {
  const pct = Math.max(0, Math.min(1, score / 5)) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <span className="font-display text-base font-bold tracking-tight">{label}</span>
          <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-muted">
            вес {weight.toFixed(2)}
          </span>
        </div>
        <div className="font-mono text-sm tabular-nums text-ink">
          {score.toFixed(2)} <span className="text-muted">/ 5</span>
        </div>
      </div>
      <div className="mt-2 text-xs text-muted">{note}</div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink/8">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="h-full rounded-full bg-ink"
        />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */

function ScaleRow({
  score,
  title,
  description,
  selected,
  onClick,
}: {
  score: number;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-xl border bg-boneSoft p-4 text-left transition-all hover:border-ink/30 hover:bg-bone sm:gap-5 sm:p-5",
        selected ? "border-flame bg-flame/5" : "border-rule"
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-display text-base font-black tabular-nums transition-all sm:h-11 sm:w-11 sm:text-lg",
          selected ? "bg-flame text-bone" : "bg-ink/5 text-ink group-hover:bg-ink group-hover:text-bone"
        )}
      >
        {score}
      </span>
      <div className="min-w-0">
        <div className="font-display text-[15px] font-bold leading-tight tracking-tight sm:text-base">{title}</div>
        <div className="mt-1 text-[13px] leading-relaxed text-inkSoft sm:text-sm">{description}</div>
      </div>
      <span
        className={cn(
          "mt-3 h-2 w-2 shrink-0 rounded-full transition-all",
          selected ? "bg-flame" : "bg-transparent border border-rule"
        )}
      />
    </button>
  );
}

function NavRow({
  onBack,
  onNext,
  disabled,
  nextLabel = "Дальше",
}: {
  onBack: () => void;
  onNext: () => void;
  disabled: boolean;
  nextLabel?: string;
}) {
  return (
    <div className="mt-10 flex items-center justify-between">
      <Button variant="ghost" onClick={onBack} size="sm">
        <ArrowLeft className="h-3 w-3" /> Назад
      </Button>
      <Button variant="flame" onClick={onNext} disabled={disabled}>
        {nextLabel} <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */

function StepHeading({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <div>
      <Caption>{caption}</Caption>
      <h2 className="mt-4 font-display text-[clamp(26px,5.5vw,48px)] font-black leading-[1.08] tracking-tight sm:mt-5 sm:text-[clamp(32px,5vw,56px)] sm:leading-[1.02]">
        {children}
      </h2>
    </div>
  );
}

function Caption({ children, tone = "light" }: { children: React.ReactNode; tone?: "light" | "dark" }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest",
        tone === "dark" ? "text-flameSoft" : "text-flame"
      )}
    >
      <span className={cn("h-px w-6", tone === "dark" ? "bg-flameSoft" : "bg-flame")} />
      {children}
    </div>
  );
}

function Footer() {
  return (
    <footer className="mx-auto w-full max-w-5xl px-6 pb-10">
      <div className="rule-bottom mb-5" />
      <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-widest text-muted">
        <span>BACHATA × SPASLEAD · AI Playbook · Интерактив</span>
        <span>Формула из плейбука · 0.40 / 0.35 / 0.25</span>
      </div>
    </footer>
  );
}
