"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GOAL, GROCERY_ORDER, MAIN_LIFT_NAMES, MEALS, MONTHS, NUTRITION_MONTHS,
  SAT_RUN, WED_RUNS, WORKOUTS_B1, WORKOUTS_B2,
  isDeloadWeek, isTestWeek, weekPct, workingWeight,
  type Exercise, type Meal, type RunPlan, type Workout,
} from "./data";
import { uid, useTrainStore, type LoggedSession, type TrainState } from "./store";

/* ── shared helpers ─────────────────────────────────────────── */

let audioCtx: AudioContext | null = null;
function beep() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = audioCtx || new AC();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = "sine"; o.frequency.value = 880;
    g.gain.setValueAtTime(0.001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
    o.connect(g).connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + 0.55);
    if (navigator.vibrate) navigator.vibrate(200);
  } catch { /* audio blocked until first tap — fine */ }
}

// Keep the screen on while a session is running (gym phones lock fast)
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let lock: { release?: () => Promise<void> } | null = null;
    const acquire = async () => {
      try {
        lock = await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<never> } }).wakeLock?.request("screen") ?? null;
      } catch { /* unsupported or denied */ }
    };
    acquire();
    const onVis = () => { if (document.visibilityState === "visible") acquire(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      lock?.release?.().catch(() => {});
    };
  }, [active]);
}

function today(): string { return new Date().toISOString().slice(0, 10); }
function fmtTime(s: number): string {
  const m = Math.floor(s / 60), r = Math.max(0, s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

// Wall-clock countdown that survives tab throttling / screen locks.
function useCountdown(onDone: () => void) {
  const [remaining, setRemaining] = useState(0);
  const [total, setTotal] = useState(0);
  const endsAt = useRef(0);
  const raf = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const stop = useCallback(() => {
    if (raf.current) clearInterval(raf.current);
    raf.current = null;
  }, []);

  const start = useCallback((seconds: number) => {
    stop();
    endsAt.current = Date.now() + seconds * 1000;
    setTotal(seconds);
    setRemaining(seconds);
    raf.current = setInterval(() => {
      const left = Math.round((endsAt.current - Date.now()) / 1000);
      if (left <= 0) {
        stop();
        setRemaining(0);
        beep();
        doneRef.current();
        return;
      }
      setRemaining(left);
    }, 250);
  }, [stop]);

  const add = useCallback((seconds: number) => {
    endsAt.current += seconds * 1000;
    setTotal((t) => t + seconds);
  }, []);

  useEffect(() => stop, [stop]);
  return { remaining, total, start, stop, add };
}

function Ring({ remaining, total, kindClass }: { remaining: number; total: number; kindClass?: string }) {
  const C = 471.2;
  const off = total > 0 ? C * (1 - remaining / total) : 0;
  return (
    <div className="tt-ringwrap">
      <svg width="180" height="180" viewBox="0 0 170 170">
        <circle className="tt-ringbg" cx="85" cy="85" r="75" />
        <circle className={`tt-ringfg ${kindClass || ""}`} cx="85" cy="85" r="75"
          strokeDasharray={C} strokeDashoffset={off} />
      </svg>
      <div className="tt-ringtime">{fmtTime(remaining)}</div>
    </div>
  );
}

function SyncChip({ sync }: { sync: string }) {
  const label = { synced: "Synced", syncing: "Syncing…", local: "Local only", offline: "Offline" }[sync] || sync;
  return <span className={`tt-syncchip mono s-${sync}`}>{label}</span>;
}

/* ── Lift tab ───────────────────────────────────────────────── */

function defaultMonthIndex(): number {
  // July 2026 = index 0 … December 2026 = index 5
  const now = new Date();
  const idx = (now.getFullYear() - 2026) * 12 + now.getMonth() - 6;
  return Math.min(5, Math.max(0, idx));
}

type PlayerState = {
  day: "A" | "B" | "C";
  exIndex: number;
  setIndex: number;
  phase: "work" | "rest";
  loggedWeights: Record<string, number>;
};

function LiftTab({ state, update }: { state: TrainState; update: (fn: (s: TrainState) => TrainState) => void }) {
  const [monthIdx, setMonthIdx] = useState(defaultMonthIndex);
  const [weekIdx, setWeekIdx] = useState(0);
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [weightInput, setWeightInput] = useState("");
  const countdown = useCountdown(() => setPlayer((p) => (p ? { ...p, phase: "work" } : p)));
  useWakeLock(player !== null);

  const month = MONTHS[monthIdx];
  const weekStr = month.weeks[weekIdx];
  const pct = weekPct(weekStr);
  const test = isTestWeek(weekStr);
  const deload = isDeloadWeek(weekStr) || test;
  const useB2 = month.accessoryBlock === 2 && state.block2Confirmed;
  const workouts = useB2 ? WORKOUTS_B2 : WORKOUTS_B1;

  const mainWeightFor = useCallback((w: Workout): string | null => {
    if (test) return "TEST — work to a 1–3RM";
    const rm = state.oneRMs[w.mainLift];
    if (!rm || !pct) return null;
    return `${workingWeight(rm, pct)} lb`;
  }, [state.oneRMs, pct, test]);

  const lastLogged = useCallback((exName: string): number | null => {
    for (let i = state.sessions.length - 1; i >= 0; i--) {
      const w = state.sessions[i].weights?.[exName];
      if (w) return w;
    }
    return null;
  }, [state.sessions]);

  const saveSession = useCallback((p: PlayerState, completed: boolean) => {
    if (!completed && Object.keys(p.loggedWeights).length === 0) return;
    const entry: LoggedSession = {
      id: uid(), type: "lift", date: today(), day: p.day,
      label: workouts[p.day].label, month: month.name, week: weekIdx + 1,
      completed, weights: p.loggedWeights,
    };
    update((s) => ({ ...s, sessions: [...s.sessions, entry] }));
  }, [update, workouts, month.name, weekIdx]);

  // ── picker ──
  if (!player) {
    return (
      <>
        <TMPanel state={state} update={update} pct={pct} test={test} />
        <div className="tt-panel">
          <h2>Today&apos;s lift</h2>
          <p className="tt-sub">Pick month + week — loading updates automatically, deloads included.</p>
          <div className="tt-fieldrow">
            <div className="tt-field">
              <label htmlFor="tt-month">Month</label>
              <select id="tt-month" value={monthIdx} onChange={(e) => setMonthIdx(+e.target.value)}>
                {MONTHS.map((m, i) => <option key={m.name} value={i}>{m.name} — {m.block}</option>)}
              </select>
            </div>
            <div className="tt-field">
              <label htmlFor="tt-week">Week</label>
              <select id="tt-week" value={weekIdx} onChange={(e) => setWeekIdx(+e.target.value)}>
                <option value={0}>Week 1</option><option value={1}>Week 2</option>
                <option value={2}>Week 3</option><option value={3}>Week 4 (deload/test)</option>
              </select>
            </div>
          </div>
          <div className="tt-banner">Main lifts this week: {weekStr} · % of TM (TM = 90% of 1RM)</div>
          {deload && (
            <div className="tt-banner warn">
              {test ? "Test week — ramp to a heavy 1–3RM, then deload. " : "Deload — leave the ego at the door. "}
              Skip or shorten this week&apos;s runs. Trim finishers first if short on time.
            </div>
          )}
          {month.accessoryBlock === 2 && !state.block2Confirmed && (
            <div className="tt-banner">Block 2 accessory rotation not confirmed yet — using Block 1 accessories. Confirm in the Week tab.</div>
          )}
          <div className="tt-daygrid">
            {(Object.keys(workouts) as Array<"A" | "B" | "C">).map((key) => {
              const w = workouts[key];
              const mw = mainWeightFor(w);
              return (
                <button key={key} className="tt-daycard" onClick={() => { setPlayer({ day: key, exIndex: 0, setIndex: 0, phase: "work", loggedWeights: {} }); setWeightInput(""); }}>
                  <div className="lbl">Day {key}</div>
                  <div className="name">{w.short}</div>
                  <div className="meta">{w.exercises.length} blocks · ~75 min</div>
                  <div className="meta">{MAIN_LIFT_NAMES[w.mainLift]}: <span className="mono">{mw ?? "set 1RM above"}</span></div>
                </button>
              );
            })}
          </div>
        </div>
      </>
    );
  }

  // ── player ──
  const workout = workouts[player.day];
  const exs = workout.exercises;
  const done = player.exIndex >= exs.length;
  const ex: Exercise | undefined = exs[player.exIndex];
  const next = exs[player.exIndex + 1];
  const progress = Math.min(100, (player.exIndex / exs.length) * 100);

  const exit = (completed: boolean) => {
    countdown.stop();
    saveSession(player, completed);
    setPlayer(null);
  };

  const completeSet = () => {
    if (!ex) return;
    const logged = { ...player.loggedWeights };
    if (ex.logWeight && weightInput) logged[ex.name] = parseFloat(weightInput);
    if (ex.isWarm) {
      setPlayer({ ...player, exIndex: player.exIndex + 1, setIndex: 0, phase: "work", loggedWeights: logged });
      setWeightInput("");
      return;
    }
    const nextSet = player.setIndex + 1;
    if (nextSet >= ex.sets) {
      setPlayer({ ...player, exIndex: player.exIndex + 1, setIndex: 0, phase: "work", loggedWeights: logged });
      setWeightInput("");
    } else {
      setPlayer({ ...player, setIndex: nextSet, phase: "rest", loggedWeights: logged });
      countdown.start(ex.rest);
    }
  };

  const skipRest = () => { countdown.stop(); setPlayer({ ...player, phase: "work" }); };

  const mainLoad = ex?.isMain ? mainWeightFor(workout) : null;
  const last = ex?.logWeight ? lastLogged(ex.name) : null;

  return (
    <div className="tt-panel">
      <div className="tt-playerhead">
        <div className="tt-sub" style={{ margin: 0 }}>{workout.label} · {month.name} W{weekIdx + 1}</div>
        <button className="tbtn tbtn-ghost tbtn-sm" onClick={() => exit(false)}>Exit</button>
      </div>
      <div className="tt-progress"><div className="tt-progressfill" style={{ width: `${done ? 100 : progress}%` }} /></div>

      {done ? (
        <div className="tt-stage tt-done">
          <div className="display">Session Complete</div>
          <p className="tt-sub" style={{ marginTop: 8 }}>Logged. Shake, stretch, eat.</p>
          <div className="tt-btnrow"><button className="tbtn tbtn-primary" onClick={() => exit(true)}>Back to Days</button></div>
        </div>
      ) : ex && (
        <div className="tt-stage">
          <div className="eyebrow">{ex.isWarm ? "Prep / Finisher" : `Block ${player.exIndex + 1} of ${exs.length}`}</div>
          <h3>{ex.name}</h3>
          <div className="setsreps">{ex.isMain ? weekStr : ex.setsreps}</div>
          {mainLoad && <div className="loadline">Work sets: <b>{mainLoad}</b></div>}
          <div className="cue">{ex.cue}</div>
          {ex.sets > 1 && !ex.isWarm && (
            <div className="tt-pips">
              {Array.from({ length: ex.sets }).map((_, i) => (
                <div key={i} className={`tt-pip ${i < player.setIndex ? "done" : i === player.setIndex ? "current" : ""}`} />
              ))}
            </div>
          )}
          {player.phase === "work" ? (
            <>
              {ex.logWeight && (
                <>
                  {last && <div className="tt-lastweight">Last session: <b>{last} lb</b></div>}
                  <div className="tt-weightlog">
                    <input type="number" inputMode="decimal" placeholder="Weight"
                      value={weightInput || player.loggedWeights[ex.name] || ""}
                      onChange={(e) => setWeightInput(e.target.value)} />
                    <span className="unit">lb</span>
                  </div>
                </>
              )}
              <div className="tt-btnrow">
                <button className="tbtn tbtn-primary" onClick={completeSet}>{ex.isWarm ? "Mark Done" : "Complete Set"}</button>
              </div>
            </>
          ) : (
            <>
              <div className="eyebrow" style={{ marginBottom: 10 }}>Resting</div>
              <Ring remaining={countdown.remaining} total={countdown.total} />
              <div className="tt-btnrow">
                <button className="tbtn tbtn-ghost" onClick={skipRest}>Skip Rest</button>
                <button className="tbtn tbtn-ghost" onClick={() => countdown.add(15)}>+15s</button>
              </div>
            </>
          )}
          <div className="tt-upnext">{next ? <>Up next — <span>{next.name}</span></> : "Last block"}</div>
        </div>
      )}

      <details className="tt-drawer">
        <summary>Full session plan</summary>
        <div className="tt-planlist">
          {exs.map((e, i) => (
            <div key={e.name} className={`tt-planitem ${i < player.exIndex ? "pi-done" : i === player.exIndex ? "pi-current" : ""}`}>
              <div className="pi-name">{e.name}{player.loggedWeights[e.name] ? ` · ${player.loggedWeights[e.name]} lb` : ""}</div>
              <div className="pi-sets">{e.isMain ? weekStr : e.setsreps}</div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

function TMPanel({ state, update, pct, test }: {
  state: TrainState; update: (fn: (s: TrainState) => TrainState) => void; pct: number | null; test: boolean;
}) {
  const lifts: Array<{ key: "squat" | "bench" | "deadlift"; label: string }> = [
    { key: "squat", label: "Back Squat" }, { key: "bench", label: "Bench Press" }, { key: "deadlift", label: "Deadlift" },
  ];
  return (
    <details className="tt-drawer" style={{ marginTop: 0, marginBottom: 16 }}>
      <summary>Training maxes — 1RM per lift (TM = 90%)</summary>
      <div className="tt-planlist">
        <div className="tt-fieldrow" style={{ paddingTop: 10 }}>
          {lifts.map(({ key, label }) => (
            <div key={key} className="tt-field">
              <label htmlFor={`rm-${key}`}>{label} 1RM (lb)</label>
              <input id={`rm-${key}`} type="number" inputMode="decimal" placeholder="e.g. 315"
                value={state.oneRMs[key] ?? ""}
                onChange={(e) => {
                  const v = e.target.value ? parseFloat(e.target.value) : null;
                  update((s) => ({ ...s, oneRMs: { ...s.oneRMs, [key]: v } }));
                }} />
              <div className="tt-note">
                {state.oneRMs[key]
                  ? <>TM {Math.round(state.oneRMs[key]! * 0.9)} lb{pct && !test ? <> · this week <b className="mono">{workingWeight(state.oneRMs[key]!, pct)} lb</b></> : null}</>
                  : "Set after your next test."}
              </div>
            </div>
          ))}
        </div>
        <p className="tt-note">Re-test and update these after the September and December test weeks. Stall rule: two bad sleep nights or a lift stalled two sessions running → back off 5–10%.</p>
      </div>
    </details>
  );
}

/* ── Run tab ────────────────────────────────────────────────── */

function RunTab({ update }: { update: (fn: (s: TrainState) => TrainState) => void }) {
  const [monthIdx, setMonthIdx] = useState(defaultMonthIndex);
  const [active, setActive] = useState<{ plan: RunPlan; which: "wed" | "sat" } | null>(null);
  const [segIdx, setSegIdx] = useState(0);
  const segIdxRef = useRef(0);
  const countdown = useCountdown(() => advanceSegment());
  useWakeLock(active !== null);

  const wed = WED_RUNS[monthIdx];

  function startRun(plan: RunPlan, which: "wed" | "sat") {
    setActive({ plan, which });
    setSegIdx(0);
    segIdxRef.current = 0;
    countdown.start(plan.segments[0].minutes * 60);
  }

  function advanceSegment() {
    setActive((a) => {
      if (!a) return a;
      const nextIdx = segIdxRef.current + 1;
      if (nextIdx >= a.plan.segments.length) {
        finishRun(a, true);
        return null;
      }
      segIdxRef.current = nextIdx;
      setSegIdx(nextIdx);
      countdown.start(a.plan.segments[nextIdx].minutes * 60);
      return a;
    });
  }

  function finishRun(a: { plan: RunPlan; which: "wed" | "sat" }, completed: boolean) {
    const entry: LoggedSession = {
      id: uid(), type: "run", date: today(),
      label: `${a.which === "wed" ? "Wed run" : "Sat Zone 2"} — ${a.plan.name}`,
      month: MONTHS[monthIdx].name, week: 0, completed, weights: {},
    };
    update((s) => ({ ...s, sessions: [...s.sessions, entry] }));
  }

  if (active) {
    const seg = active.plan.segments[segIdx];
    const nextSeg = active.plan.segments[segIdx + 1];
    const doneMin = active.plan.segments.slice(0, segIdx).reduce((n, s) => n + s.minutes, 0);
    const totalMin = active.plan.segments.reduce((n, s) => n + s.minutes, 0);
    return (
      <div className="tt-panel">
        <div className="tt-playerhead">
          <div className="tt-sub" style={{ margin: 0 }}>{active.plan.name}</div>
          <button className="tbtn tbtn-ghost tbtn-sm" onClick={() => { countdown.stop(); finishRun(active, false); setActive(null); }}>End Run</button>
        </div>
        <div className="tt-progress"><div className="tt-progressfill" style={{ width: `${(doneMin / totalMin) * 100}%` }} /></div>
        <div className="tt-stage">
          <div className="eyebrow">Segment {segIdx + 1} of {active.plan.segments.length}</div>
          <h3>{seg.label}</h3>
          <div className="cue">{active.plan.desc}</div>
          <Ring remaining={countdown.remaining} total={countdown.total} kindClass={`run-${seg.kind === "steady" ? "easy" : seg.kind}`} />
          <div className="tt-btnrow">
            <button className="tbtn tbtn-ghost" onClick={() => advanceSegment()}>Skip Segment</button>
            <button className="tbtn tbtn-ghost" onClick={() => countdown.add(60)}>+1 min</button>
          </div>
          <div className="tt-upnext">{nextSeg ? <>Up next — <span>{nextSeg.label} · {nextSeg.minutes} min</span></> : "Last segment"}</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="tt-panel">
        <h2>Guided runs</h2>
        <p className="tt-sub">Beeps at every segment change — pocket the phone and go. Deload/test weeks (W4): skip or halve.</p>
        <div className="tt-fieldrow">
          <div className="tt-field">
            <label htmlFor="run-month">Month (sets Wed progression)</label>
            <select id="run-month" value={monthIdx} onChange={(e) => setMonthIdx(+e.target.value)}>
              {MONTHS.map((m, i) => <option key={m.name} value={i}>{m.name}</option>)}
            </select>
          </div>
        </div>
        <div className="tt-daygrid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
          {[{ plan: wed, which: "wed" as const, lbl: "Wed 8:15 pm" }, { plan: SAT_RUN, which: "sat" as const, lbl: "Sat 9:00 am" }].map(({ plan, which, lbl }) => (
            <button key={which} className="tt-daycard" onClick={() => startRun(plan, which)}>
              <div className="lbl">{lbl}</div>
              <div className="name">{plan.name}</div>
              <div className="meta">{plan.desc}</div>
            </button>
          ))}
        </div>
        <ul className="tt-seglist">
          {wed.segments.map((s, i) => (
            <li key={i}><span className={`k k-${s.kind}`} />{s.label}<span className="min">{s.minutes} min</span></li>
          ))}
        </ul>
      </div>
    </>
  );
}

/* ── Fuel tab (meal generator) ──────────────────────────────── */

type WeekPlan = { dayMeals: Meal[][]; mealsPerDay: number };
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SLOT_NAMES = ["Breakfast", "Lunch", "Dinner", "Snack", "Snack 2"];
const SLOT_CATS: Array<keyof typeof MEALS> = ["breakfast", "lunch", "dinner", "snack", "snack"];

function FuelTab() {
  const [monthIdx, setMonthIdx] = useState(defaultMonthIndex);
  const [mealsPerDay, setMealsPerDay] = useState(4);
  const [mode, setMode] = useState<"rotate" | "repeat">("rotate");
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const target = NUTRITION_MONTHS[monthIdx];

  function generate() {
    const dayMeals: Meal[][] = DAY_NAMES.map((_, i) => {
      const meals: Meal[] = [];
      for (let slot = 0; slot < mealsPerDay; slot++) {
        const bank = MEALS[SLOT_CATS[slot]];
        meals.push(mode === "repeat" ? bank[0] : bank[(i + (slot >= 3 ? slot : 0)) % bank.length]);
      }
      return meals;
    });
    setPlan({ dayMeals, mealsPerDay });
    setChecked(new Set());
  }

  function swap(dayIdx: number, slotIdx: number) {
    if (!plan) return;
    const bank = MEALS[SLOT_CATS[slotIdx]];
    const cur = plan.dayMeals[dayIdx][slotIdx];
    const next = bank[(bank.findIndex((m) => m.name === cur.name) + 1) % bank.length];
    const dayMeals = plan.dayMeals.map((dm, d) => d === dayIdx ? dm.map((m, s) => (s === slotIdx ? next : m)) : dm);
    setPlan({ ...plan, dayMeals });
  }

  const grocery = useMemo(() => {
    if (!plan) return null;
    const totals: Record<string, { name: string; qty: number; unit: string; cat: string }> = {};
    plan.dayMeals.flat().forEach((m) => m.ing.forEach((it) => {
      const k = `${it.n}|${it.u}`;
      totals[k] = totals[k] || { name: it.n, qty: 0, unit: it.u, cat: it.cat };
      totals[k].qty += it.q;
    }));
    const byCat: Record<string, Array<{ name: string; qty: number; unit: string }>> = {};
    Object.values(totals).forEach((it) => { (byCat[it.cat] = byCat[it.cat] || []).push(it); });
    Object.values(byCat).forEach((list) => list.sort((a, b) => a.name.localeCompare(b.name)));
    return byCat;
  }, [plan]);

  const stats = useMemo(() => {
    if (!plan) return null;
    let kcal = 0, p = 0;
    plan.dayMeals.flat().forEach((m) => { kcal += m.kcal; p += m.p; });
    return { avgK: Math.round(kcal / 7), avgP: Math.round(p / 7) };
  }, [plan]);

  const gap = stats ? target.kcal - stats.avgK : 0;
  const note = !stats ? "" :
    gap > 50 ? `~${gap} kcal under target — bump meals/day up or add ${Math.max(1, Math.round(gap / 220))} shake(s). Put the extra carbs around Mon/Thu/Fri lifts.` :
    gap < -50 ? `~${Math.abs(gap)} kcal over — trim a carb portion if the 7-day scale average runs past ~0.75 lb/week.` :
    "Within range of this month's target.";

  function printList() {
    if (!grocery) return;
    const w = window.open("", "_blank", "width=420,height=640");
    if (!w) return;
    const items = GROCERY_ORDER.filter((c) => grocery[c]).map((cat) =>
      `<h3>${cat}</h3><ul>` + grocery[cat].map((it) => {
        const q = Math.round(it.qty * 10) / 10;
        return `<li>☐ ${it.name} — ${q} ${it.unit}${q > 1 && it.unit !== "ea" ? "s" : ""}</li>`;
      }).join("") + "</ul>"
    ).join("");
    w.document.write(`<html><head><title>Grocery — week of ${today()}</title>
      <style>body{font-family:system-ui;padding:20px;font-size:14px}h3{margin:14px 0 4px;font-size:13px;text-transform:uppercase;letter-spacing:.05em}ul{list-style:none;margin:0;padding:0}li{padding:3px 0}</style>
      </head><body><h2>Grocery list — one Whole Foods pass</h2>${items}</body></html>`);
    w.document.close();
    w.print();
  }

  return (
    <>
      <div className="tt-panel">
        <h2>Generate this week&apos;s meals</h2>
        <p className="tt-sub">Whole-foods, minimal cooking. Builds the week + a categorized grocery list. Do this Sunday 8–9 pm.</p>
        <div className="tt-fieldrow">
          <div className="tt-field">
            <label htmlFor="f-month">Month (sets targets)</label>
            <select id="f-month" value={monthIdx} onChange={(e) => setMonthIdx(+e.target.value)}>
              {NUTRITION_MONTHS.map((m, i) => <option key={m.name} value={i}>{m.name} — {m.kcal.toLocaleString()} kcal / {m.protein}P</option>)}
            </select>
          </div>
          <div className="tt-field">
            <label htmlFor="f-mpd">Meals per day</label>
            <select id="f-mpd" value={mealsPerDay} onChange={(e) => setMealsPerDay(+e.target.value)}>
              <option value={3}>3 — B / L / D</option>
              <option value={4}>4 — + Snack</option>
              <option value={5}>5 — + 2 Snacks</option>
            </select>
          </div>
          <div className="tt-field">
            <label htmlFor="f-mode">Variety</label>
            <select id="f-mode" value={mode} onChange={(e) => setMode(e.target.value as "rotate" | "repeat")}>
              <option value="rotate">Rotate options</option>
              <option value="repeat">Repeat favorites</option>
            </select>
          </div>
        </div>
        <div className="tt-btnrow" style={{ justifyContent: "flex-start" }}>
          <button className="tbtn tbtn-primary" onClick={generate}>Generate Week</button>
        </div>
      </div>

      {plan && stats && (
        <>
          <div className="tt-panel">
            <h2>This week</h2>
            <div className="tt-macroline">
              Target: <b>{target.kcal} kcal</b> / <b>{target.protein}g P</b> · Plan averages: <b>{stats.avgK} kcal</b> / <b>{stats.avgP}g P</b>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="plan">
                <thead>
                  <tr><th>Day</th>{Array.from({ length: plan.mealsPerDay }).map((_, i) => <th key={i}>{SLOT_NAMES[i]}</th>)}<th>Kcal / P</th></tr>
                </thead>
                <tbody>
                  {DAY_NAMES.map((d, di) => {
                    const dm = plan.dayMeals[di];
                    return (
                      <tr key={d}>
                        <td className="day">{d}</td>
                        {dm.map((m, si) => (
                          <td key={si}>
                            <div className="tt-mealcell">
                              {m.name}
                              <button className="tt-swap" onClick={() => swap(di, si)}>⇄ swap</button>
                            </div>
                          </td>
                        ))}
                        <td className="macro-cell">{dm.reduce((a, m) => a + m.kcal, 0)} / {dm.reduce((a, m) => a + m.p, 0)}g</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="tt-note">{note}</p>
          </div>

          <div className="tt-panel">
            <div className="tt-playerhead">
              <h2 style={{ margin: 0 }}>Grocery list</h2>
              <button className="tbtn tbtn-ghost tbtn-sm" onClick={printList}>Print / Share</button>
            </div>
            <p className="tt-sub">Totaled for the week. One Whole Foods pass. Check items off as you shop.</p>
            <div className="tt-grocery">
              {grocery && GROCERY_ORDER.filter((c) => grocery[c]).map((cat) => (
                <div className="tt-gcat" key={cat}>
                  <h4>{cat}</h4>
                  <ul>
                    {grocery[cat].map((it) => {
                      const k = `${it.name}|${it.unit}`;
                      const q = Math.round(it.qty * 10) / 10;
                      const isChecked = checked.has(k);
                      return (
                        <li key={k} className={isChecked ? "checked" : ""}>
                          <input type="checkbox" checked={isChecked} onChange={() => {
                            setChecked((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });
                          }} />
                          {it.name}
                          <span className="q">{q} {it.unit}{q > 1 && it.unit !== "ea" ? "s" : ""}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}

/* ── Body tab (weight tracker) ──────────────────────────────── */

function rollingAvg(entries: Array<{ date: string; lb: number }>, atDate: string): number | null {
  const at = new Date(atDate).getTime();
  const windowStart = at - 6 * 86400_000;
  const inWindow = entries.filter((e) => {
    const t = new Date(e.date).getTime();
    return t >= windowStart && t <= at;
  });
  if (inWindow.length === 0) return null;
  return inWindow.reduce((n, e) => n + e.lb, 0) / inWindow.length;
}

function BodyTab({ state, update }: { state: TrainState; update: (fn: (s: TrainState) => TrainState) => void }) {
  const [input, setInput] = useState("");
  const entries = state.bodyweights;

  const log = () => {
    const lb = parseFloat(input);
    if (!lb || lb < 100 || lb > 300) return;
    const date = today();
    update((s) => ({
      ...s,
      bodyweights: [...s.bodyweights.filter((e) => e.date !== date), { date, lb }].sort((a, b) => (a.date < b.date ? -1 : 1)),
    }));
    setInput("");
  };

  // chart geometry
  const W = 640, H = 260, PAD = 34;
  const t0 = new Date(GOAL.start.date).getTime(), t1 = new Date(GOAL.end.date).getTime();
  const yMin = 160, yMax = 190;
  const x = (d: string) => PAD + ((new Date(d).getTime() - t0) / (t1 - t0)) * (W - 2 * PAD);
  const y = (lb: number) => H - PAD - ((lb - yMin) / (yMax - yMin)) * (H - 2 * PAD);

  const avgPoints = entries
    .map((e) => ({ date: e.date, avg: rollingAvg(entries, e.date) }))
    .filter((p): p is { date: string; avg: number } => p.avg !== null);
  const avgPath = avgPoints.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.date).toFixed(1)},${y(p.avg).toFixed(1)}`).join(" ");

  // pace check: latest rolling avg vs 14 days prior
  let adjust: { dir: "up" | "down" | "ok"; msg: string } | null = null;
  if (avgPoints.length >= 2) {
    const latest = avgPoints[avgPoints.length - 1];
    const twoWeeksAgo = new Date(new Date(latest.date).getTime() - 14 * 86400_000).toISOString().slice(0, 10);
    const prior = rollingAvg(entries, twoWeeksAgo);
    if (prior !== null && entries.length >= 7) {
      const weeklyPace = (latest.avg - prior) / 2;
      if (weeklyPace < 0.4) adjust = { dir: "up", msg: `Pace ${weeklyPace.toFixed(2)} lb/wk — under the 0.75 target. Add +200 kcal from carbs, placed around Mon/Thu/Fri lifts.` };
      else if (weeklyPace > 1.1) adjust = { dir: "down", msg: `Pace ${weeklyPace.toFixed(2)} lb/wk — hot. If the waist is climbing fast, pull −100 kcal from fat.` };
      else adjust = { dir: "ok", msg: `Pace ${weeklyPace.toFixed(2)} lb/wk — on track. Change nothing.` };
    }
  }

  const latestAvg = avgPoints.length ? avgPoints[avgPoints.length - 1].avg : null;

  return (
    <>
      <div className="tt-panel">
        <h2>Bodyweight</h2>
        <p className="tt-sub">Log daily, trust only the 7-day average. Goal line runs 165 → 185 by Dec 31.</p>
        <div className="tt-fieldrow" style={{ alignItems: "flex-end" }}>
          <div className="tt-field" style={{ maxWidth: 180 }}>
            <label htmlFor="bw">Today&apos;s weight (lb)</label>
            <input id="bw" type="number" inputMode="decimal" step="0.1" placeholder="e.g. 166.4"
              value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && log()} />
          </div>
          <button className="tbtn tbtn-primary" onClick={log}>Log</button>
          {latestAvg && <div className="tt-banner" style={{ margin: 0 }}>7-day avg: {latestAvg.toFixed(1)} lb</div>}
        </div>

        <svg className="tt-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bodyweight vs goal line">
          {[165, 170, 175, 180, 185].map((g) => (
            <g key={g}>
              <line x1={PAD} x2={W - PAD} y1={y(g)} y2={y(g)} stroke="#3a362a" strokeWidth="1" />
              <text x={6} y={y(g) + 4} fill="#b4ad9c" fontSize="10" fontFamily="monospace">{g}</text>
            </g>
          ))}
          {["2026-07-01", "2026-08-01", "2026-09-01", "2026-10-01", "2026-11-01", "2026-12-01"].map((d, i) => (
            <text key={d} x={x(d)} y={H - 10} fill="#b4ad9c" fontSize="10" fontFamily="monospace" textAnchor="middle">
              {["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][i]}
            </text>
          ))}
          <line x1={x(GOAL.start.date)} y1={y(GOAL.start.lb)} x2={x(GOAL.end.date)} y2={y(GOAL.end.lb)}
            stroke="#8a713a" strokeWidth="1.5" strokeDasharray="6 4" />
          {avgPath && <path d={avgPath} fill="none" stroke="#c9a24b" strokeWidth="2.5" />}
          {entries.map((e) => (
            <circle key={e.date} cx={x(e.date)} cy={y(e.lb)} r="2.5" fill="#5b8fa8" opacity="0.7" />
          ))}
        </svg>

        {adjust && <div className={`tt-adjust ${adjust.dir === "ok" ? "" : adjust.dir}`}><b>{adjust.dir === "up" ? "EAT MORE — " : adjust.dir === "down" ? "EASE OFF — " : "ON PACE — "}</b>{adjust.msg}</div>}
        {!adjust && entries.length > 0 && entries.length < 7 && (
          <div className="tt-adjust">Keep logging — pace guidance unlocks after 7 days of entries.</div>
        )}

        {entries.length > 0 && (
          <ul className="tt-bwlist">
            {[...entries].reverse().slice(0, 10).map((e) => (
              <li key={e.date}><span>{e.date}</span><span className="mono">{e.lb.toFixed(1)} lb</span></li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

/* ── Week tab ───────────────────────────────────────────────── */

function WeekTab({ state, update }: { state: TrainState; update: (fn: (s: TrainState) => TrainState) => void }) {
  return (
    <>
      <div className="tt-panel">
        <h2>Weekly structure</h2>
        <p className="tt-sub">Matched to your calendar blocks. Recovery placed to protect hypertrophy days.</p>
        <div style={{ overflowX: "auto" }}>
          <table className="sched">
            <thead><tr><th>Day</th><th>Session</th><th>Recovery</th></tr></thead>
            <tbody>
              <tr><td className="d">Mon</td><td><span className="tt-badge lift">Lift</span> Day A — Lower (Squat) · 8:15–9:30pm → stretch 9:30</td><td>Fast shake at 9:30 before stretch. No plunge.</td></tr>
              <tr><td className="d">Tue</td><td><span className="tt-badge rest">Rest</span> Easy walk / mobility</td><td><span className="tt-badge sauna">Sauna</span> <span className="tt-badge plunge">Plunge</span> Contrast 7:45pm — 15 min sauna → 2–3 min cold</td></tr>
              <tr><td className="d">Wed</td><td><span className="tt-badge cardio">Run</span> 8:15–9pm → stretch 9pm</td><td><span className="tt-badge sauna">Sauna</span> 9:15pm post-run</td></tr>
              <tr><td className="d">Thu</td><td><span className="tt-badge lift">Lift</span> Day B — Upper (Bench) · 7:45–9pm</td><td>No plunge.</td></tr>
              <tr><td className="d">Fri</td><td><span className="tt-badge lift">Lift</span> Day C — Deadlift + Vertical · 7:45–9pm → stretch 9pm</td><td>No plunge.</td></tr>
              <tr><td className="d">Sat</td><td><span className="tt-badge cardio">Zone 2 Run</span> 9–10:15am (75 min)</td><td><span className="tt-badge plunge">Plunge</span> Optional 2–3 min post-run</td></tr>
              <tr><td className="d">Sun</td><td><span className="tt-badge rest">Rest</span> Meal prep · schedule check 8–9pm</td><td>Generate next week&apos;s meals here.</td></tr>
            </tbody>
          </table>
        </div>
        <p className="tt-note">Cold plunge stays off Mon/Thu/Fri — cold within ~6 hours after lifting blunts the hypertrophy signal you&apos;re training for. Sauna is fine on lift days.</p>
      </div>

      <div className="tt-panel">
        <h2>6-Month periodization</h2>
        <div style={{ overflowX: "auto" }}>
          <table className="sched">
            <thead><tr><th>Month</th><th>Block</th><th>W1</th><th>W2</th><th>W3</th><th>W4</th></tr></thead>
            <tbody>
              {MONTHS.map((m) => (
                <tr key={m.name}>
                  <td className="d">{m.name}</td><td>{m.block}</td>
                  {m.weeks.map((w) => <td key={w} className="macro-cell">{w}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="tt-panel">
        <h2>Block 2 accessories (Oct–Dec)</h2>
        <p className="tt-sub">
          Main lifts stay identical; accessories rotate: Hack Squat, Nordic/GHR, Bulgarian Split Squat + Hip Thrust,
          Close-Grip Bench, Pendlay + Single-Arm Rows, Machine Press + Pec Deck, Push Press, Weighted Chin-Up + Meadows Row,
          Reverse Curl + Cable Crunch, heavier/shorter carries.
        </p>
        {state.block2Confirmed ? (
          <div className="tt-banner">Block 2 rotation CONFIRMED — Oct–Dec sessions use the new accessories. <button className="tt-swap" onClick={() => update((s) => ({ ...s, block2Confirmed: false }))}>undo</button></div>
        ) : (
          <>
            <div className="tt-banner warn">Not confirmed — Oct–Dec currently falls back to Block 1 accessories.</div>
            <div className="tt-btnrow" style={{ justifyContent: "flex-start" }}>
              <button className="tbtn tbtn-primary" onClick={() => update((s) => ({ ...s, block2Confirmed: true }))}>Confirm Block 2 rotation</button>
            </div>
            <p className="tt-note">Want tweaks first (like you made in Block 1)? Tell Claude what to change — the list lives in data.ts.</p>
          </>
        )}
      </div>
    </>
  );
}

/* ── Log tab ────────────────────────────────────────────────── */

function LogTab({ state, replaceAll, sync }: { state: TrainState; replaceAll: (s: TrainState) => void; sync: string }) {
  const [trendEx, setTrendEx] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const allExercises = useMemo(() => {
    const set = new Set<string>();
    state.sessions.forEach((s) => Object.keys(s.weights || {}).forEach((k) => set.add(k)));
    return [...set].sort();
  }, [state.sessions]);

  const trend = useMemo(() => {
    if (!trendEx) return [];
    return state.sessions
      .filter((s) => s.weights?.[trendEx])
      .map((s) => ({ date: s.date, lb: s.weights[trendEx] }));
  }, [state.sessions, trendEx]);

  function exportCSV() {
    const rows = [["date", "type", "day", "label", "month", "week", "completed", "exercise", "weight_lb"]];
    state.sessions.forEach((s) => {
      const weights = Object.entries(s.weights || {});
      if (weights.length === 0) rows.push([s.date, s.type, s.day || "", s.label, s.month, String(s.week), String(s.completed), "", ""]);
      weights.forEach(([ex, lb]) => rows.push([s.date, s.type, s.day || "", s.label, s.month, String(s.week), String(s.completed), ex, String(lb)]));
    });
    downloadBlob(rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n"), `training-log-${today()}.csv`, "text/csv");
  }

  function exportJSON() {
    downloadBlob(JSON.stringify(state, null, 2), `training-fuel-backup-${today()}.json`, "application/json");
  }

  function downloadBlob(content: string, filename: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function importJSON(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const incoming = JSON.parse(String(reader.result));
        if (incoming && incoming.version === 1) replaceAll(incoming);
      } catch { alert("That file didn't parse as a valid backup."); }
    };
    reader.readAsText(file);
  }

  // trend sparkline
  const SW = 620, SH = 120, SP = 26;
  const lbs = trend.map((t) => t.lb);
  const lo = lbs.length ? Math.min(...lbs) - 10 : 0, hi = lbs.length ? Math.max(...lbs) + 10 : 100;
  const sx = (i: number) => SP + (trend.length > 1 ? (i / (trend.length - 1)) * (SW - 2 * SP) : 0);
  const sy = (lb: number) => SH - SP - ((lb - lo) / (hi - lo)) * (SH - 2 * SP);
  const sparkPath = trend.map((t, i) => `${i === 0 ? "M" : "L"}${sx(i).toFixed(1)},${sy(t.lb).toFixed(1)}`).join(" ");

  return (
    <>
      <div className="tt-panel">
        <h2>Exercise trend</h2>
        <p className="tt-sub">Pick a lift, see every weight you&apos;ve logged for it.</p>
        <div className="tt-fieldrow">
          <div className="tt-field">
            <label htmlFor="trend-ex">Exercise</label>
            <select id="trend-ex" value={trendEx} onChange={(e) => setTrendEx(e.target.value)}>
              <option value="">— pick —</option>
              {allExercises.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
        </div>
        {trend.length > 0 && (
          <>
            <svg className="tt-chart" viewBox={`0 0 ${SW} ${SH}`}>
              <path d={sparkPath} fill="none" stroke="#c9a24b" strokeWidth="2" />
              {trend.map((t, i) => <circle key={i} cx={sx(i)} cy={sy(t.lb)} r="3" fill="#c9a24b" />)}
              <text x={SP} y={14} fill="#b4ad9c" fontSize="11" fontFamily="monospace">
                {trend[0].lb} → {trend[trend.length - 1].lb} lb over {trend.length} session{trend.length > 1 ? "s" : ""}
              </text>
            </svg>
            <ul className="tt-bwlist">
              {[...trend].reverse().slice(0, 8).map((t, i) => (
                <li key={i}><span>{t.date}</span><span className="mono">{t.lb} lb</span></li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="tt-panel">
        <div className="tt-playerhead">
          <h2 style={{ margin: 0 }}>Training log</h2>
          <SyncChip sync={sync} />
        </div>
        <p className="tt-sub">Every logged session, newest first. Synced to your account when the database is connected.</p>
        <div className="tt-btnrow" style={{ justifyContent: "flex-start", marginBottom: 12 }}>
          <button className="tbtn tbtn-ghost tbtn-sm" onClick={exportCSV}>Export CSV (Excel)</button>
          <button className="tbtn tbtn-ghost tbtn-sm" onClick={exportJSON}>Backup JSON</button>
          <button className="tbtn tbtn-ghost tbtn-sm" onClick={() => fileRef.current?.click()}>Import JSON</button>
          <input ref={fileRef} type="file" accept="application/json" style={{ display: "none" }}
            onChange={(e) => e.target.files?.[0] && importJSON(e.target.files[0])} />
        </div>
        {state.sessions.length === 0 ? (
          <div className="tt-empty">No sessions logged yet. Weights you enter during a workout land here.</div>
        ) : (
          [...state.sessions].reverse().map((s) => (
            <div className="tt-hist" key={s.id}>
              <div>
                <b>{s.type === "run" ? "Run" : `Day ${s.day}`}</b> · {s.month}{s.week ? ` W${s.week}` : ""} {s.completed ? "✓" : "(partial)"}
                <br />
                <span style={{ color: "var(--chalk-dim)", fontSize: 12 }}>
                  {Object.entries(s.weights || {}).map(([k, v]) => `${k}: ${v} lb`).join(" · ") || s.label}
                </span>
              </div>
              <div className="h-date">{s.date}</div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

/* ── shell ──────────────────────────────────────────────────── */

const TABS = [
  { id: "lift", label: "Lift" },
  { id: "run", label: "Run" },
  { id: "fuel", label: "Fuel" },
  { id: "body", label: "Body" },
  { id: "week", label: "Week" },
  { id: "log", label: "Log" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function TrainApp() {
  const { state, update, replaceAll, hydrated, sync } = useTrainStore();
  const [tab, setTab] = useState<TabId>("lift");

  return (
    <div className="tt-app">
      <div className="tt-brand">
        <div>
          <h1>Trey — Training &amp; Fuel</h1>
          <div className="tt-tag">Phase 2 · Jul–Dec 2026 · 165 → 185 lb · <Link href="/dashboard">← dashboard</Link></div>
        </div>
        <div className="tt-tag mono">Press start. Don&apos;t think.</div>
      </div>

      <div className="tt-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`tt-tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {!hydrated ? (
        <div className="tt-panel"><div className="tt-empty">Loading…</div></div>
      ) : (
        <>
          {tab === "lift" && <LiftTab state={state} update={update} />}
          {tab === "run" && <RunTab update={update} />}
          {tab === "fuel" && <FuelTab />}
          {tab === "body" && <BodyTab state={state} update={update} />}
          {tab === "week" && <WeekTab state={state} update={update} />}
          {tab === "log" && <LogTab state={state} replaceAll={replaceAll} sync={sync} />}
        </>
      )}
    </div>
  );
}
