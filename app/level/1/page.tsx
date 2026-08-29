"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import { level1 } from "../../../data/level1";

type Word = {
  s: string;
  g: string;
  fn?: number; // connector flag - locked, never quizzed
};

type RawLine = {
  text?: string;
  words?: Word[];
  t?: string;
  ws?: Word[];
};

type Lesson = {
  id: number;
  ref: string;
  title: string;
  story: string;
  meaning: string;
  teaching?: string;
  apply?: string;
  proTip?: string;
  tips?: { label: string; text: string }[];
  lines: RawLine[];
};

type Line = { text: string; words: Word[] };

/*
  STEP SEQUENCE (per verse):

  intro
  learn(line0), rebuild(line0)
  learn(line1), rebuild(line1)
  ...repeats per line...
  match   <- ONE match game, pulled from every line combined (max 4 pairs)
  fill    <- ONE fill-in-the-blank, on the line with the most content words
  master  <- ONE final rebuild of the WHOLE verse, all lines combined
*/
type Step =
  | { type: "intro" }
  | { type: "learn"; line: number }
  | { type: "rebuild"; line: number }
  | { type: "match" }
  | { type: "fill" }
  | { type: "master" };

const isConnector = (w: Word) => !!w.fn;

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

/*
  Verse 1.1 audio files.
  Put these files inside: public/audio/1-1/
  The filenames below match the recordings shown in the user's folder.
*/
const WORD_AUDIO: Record<string, string> = {
  dhṛtarāṣṭraḥ: "/audio/1-1/धृतराष्ट्र उवाच.wav",
  uvāca: "/audio/1-1/धृतराष्ट्र उवाच.wav",

  "dharma-kṣetre": "/audio/1-1/धर्मक्षेत्रे.mp3.mpeg",
  "kuru-kṣetre": "/audio/1-1/कुरुक्षेत्रे.mp3.mpeg",
  samavetāḥ: "/audio/1-1/समवेता.mp3.mpeg",
  yuyutsavaḥ: "/audio/1-1/युयुत्सवः.mp3.mpeg",

  māmakāḥ: "/audio/1-1/मामका.wav",
  pāṇḍavāḥ: "/audio/1-1/पाण्डवा.mp3.mpeg",
  "ca eva": "/audio/1-1/चैव.wav",
  kim: "/audio/1-1/किम.mp3.mpeg",
  akurvata: "/audio/1-1/कुर्वत.wav",
  sañjaya: "/audio/1-1/सञ्जय.wav",
};

// Whole-shloka recording. Put this exact file inside public/audio/1-1/.
const WHOLE_VERSE_AUDIO =
  "/audio/1-1/ElevenLabs_2026-08-29T11_23_46_Manav -  Husky, Conversational voice_pvc_sp91_s50_sb75_se0_b_m2.mp3.mpeg";

const VERSE_TIPS: Record<string, { label: string; text: string }[]> = {
  "1.1": [
    {
      label: "PRO TIP",
      text: "Words ending in -e like kṣhetre are saptamī vibhakti (locative): “in/at the field”. Think: “-e = where?”",
    },
    {
      label: "SANDHI ALERT",
      text: "“पाण्डवाश्चैव” = पाण्डवाः + च + एव. When a visarga (ः) comes before च, it often becomes श् → पाण्डवाश्च.",
    },
  ],
};

let activeAudio: HTMLAudioElement | null = null;

function audioForWord(word: string) {
  return WORD_AUDIO[word.trim()] || "";
}

function stopAudio() {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
}

function playAudio(src: string) {
  if (!src || typeof window === "undefined") return;

  stopAudio();

  const audio = new Audio(src);
  activeAudio = audio;

  audio.addEventListener("ended", () => {
    if (activeAudio === audio) {
      activeAudio = null;
    }
  });

  void audio.play().catch(() => {
    if (activeAudio === audio) {
      activeAudio = null;
    }
  });
}

function playWordAudio(word: string) {
  playAudio(audioForWord(word));
}

function contentWords(words: Word[]) {
  const c = words.filter((w) => !isConnector(w));
  return c.length ? c : words;
}

/*
  A speaker tag ("dhṛtarāṣṭra uvāca" - name + "said") sometimes sits as its
  own entry in a verse's lines[]. It's not a real pāda of the shloka, so it
  should never get its own learn/rebuild part or be quizzed. Heuristic: a
  LEADING line with 2 or fewer words is treated as attribution, not content.
*/
function isSpeakerLine(line: Line) {
  return line.words.length > 0 && line.words.length <= 2;
}

function countStepsForLesson(_lesson: Lesson) {
  return 8; // intro + one-time tips + six learning/testing pages
}

/* ---------------------------------------------------------------------- */
/* INTRO - flip card. Front: sanskrit + meaning. Back: story + teaching + apply. */
/* ---------------------------------------------------------------------- */
function Intro({
  lesson,
  lines,
  speakerLine,
  onDone,
}: {
  lesson: Lesson;
  lines: Line[];
  speakerLine: Line | null;
  onDone: () => void;
}) {
  const [flipped, setFlipped] = useState(false);

  return (
    <>
      <div className={styles.sectionPill}>VERSE {lesson.ref}</div>
      <p className={styles.screenType}>THE WHOLE VERSE</p>
      <h1>{lesson.title}</h1>

      {!flipped ? (
        <>
          <div className={styles.verseBox}>
            {speakerLine && (
              <p className={styles.tapHint} style={{ fontStyle: "italic" }}>
                {speakerLine.text}
              </p>
            )}
            {lines.map((line, i) => (
              <p key={i} className={styles.sanskritText}>
                {line.text}
              </p>
            ))}
          </div>

          <div className={styles.meaningBox}>
            <span>WHAT IT MEANS</span>
            <p>{lesson.meaning}</p>
          </div>

          <button
            type="button"
            className={styles.listenButton}
            onClick={() => playAudio(WHOLE_VERSE_AUDIO)}
          >
            🔊 LISTEN TO THE WHOLE SHLOKA
          </button>
        </>
      ) : (
        <div className={styles.proTipPopup}>
          <div className={styles.proTipPopupTop}>
            <div className={styles.tipIcon}>📖</div>
            <div>
              <p className={styles.proTipEyebrow}>VERSE {lesson.ref}</p>
              <h1>The Story</h1>
            </div>
          </div>

          <div className={styles.proTipContent}>
            <p className={styles.proTipText}>{lesson.story}</p>

            {lesson.teaching && (
              <div className={styles.proTipApply} style={{ marginTop: 20 }}>
                <span>THE TEACHING</span>
                <p>{lesson.teaching}</p>
              </div>
            )}

            {lesson.apply && (
              <div className={styles.proTipApply}>
                <span>FOR YOU, TODAY</span>
                <p>{lesson.apply}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <button
        className={styles.tapHint}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          display: "block",
        }}
        onClick={() => setFlipped((f) => !f)}
      >
        {flipped ? "TAP TO RETURN ↻" : "TAP FOR THE STORY ↻"}
      </button>

      <button className={styles.actionButton} onClick={onDone}>
        BREAK IT DOWN
      </button>
    </>
  );
}

/* ---------------------------------------------------------------------- */
/* TIPS POPUP - shown once before the first exercise of each verse        */
/* ---------------------------------------------------------------------- */
function TipsPopup({ lesson, onDone }: { lesson: Lesson; onDone: () => void }) {
  const tips = [
    ...(lesson.proTip ? [{ label: "PRO TIP", text: lesson.proTip }] : []),
    ...(lesson.tips ?? []),
    ...(VERSE_TIPS[lesson.ref] ?? []),
  ];

  // If a lesson has no blue-note content, don't add an empty screen.
  if (tips.length === 0) {
    onDone();
    return null;
  }

  return (
    <div className={styles.tipOverlay}>
      <div className={styles.tipModal}>
        <div className={styles.tipModalHeader}>
          <span className={styles.tipModalIcon}>💡</span>
          <div>
            <p className={styles.tipModalEyebrow}>PRO TIP</p>
            <h1>Before the exercise</h1>
          </div>
        </div>

        <div className={styles.tipModalBody}>
          {tips.map((tip, i) => (
            <div className={styles.tipItem} key={`${tip.label}-${i}`}>
              <span>{tip.label}</span>
              <p>{tip.text}</p>
            </div>
          ))}
        </div>

        <button className={styles.actionButton} onClick={onDone}>
          LET&apos;S GO
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* LEARN - one line. Tap a word to reveal it (sanskrit + gloss) in the     */
/* single reveal card below. Continue unlocks once every word's been seen. */
/* ---------------------------------------------------------------------- */
function LearnPart({
  line,
  part,
  total,
  onDone,
}: {
  line: Line;
  part: number;
  total: number;
  onDone: () => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [viewed, setViewed] = useState<Set<number>>(new Set());

  function tapWord(i: number) {
    setSelectedIndex(i);
    setViewed((prev) => new Set(prev).add(i));
  }

  const selected = selectedIndex !== null ? line.words[selectedIndex] : null;
  const allViewed = line.words.length > 0 && viewed.size === line.words.length;

  return (
    <>
      <div className={styles.sectionPill}>WORD BY WORD</div>
      <p className={styles.screenType}>
        PART {part} OF {total}
      </p>
      <h1>{line.text}</h1>

      <div className={styles.verseBox}>
        <p className={styles.tapHint}>Tap each word to see its meaning</p>

        <div className={styles.wordGrid}>
          {line.words.map((word, i) => (
            <button
              key={`${word.s}-${i}`}
              onClick={() => tapWord(i)}
              className={`${styles.wordButton} ${
                selectedIndex === i ? styles.wordSelected : ""
              }`}
            >
              {word.s}
            </button>
          ))}
        </div>

        {selected && (
          <div className={styles.wordMeaning}>
            <strong>{selected.s}</strong>
            <span>
              {isConnector(selected) ? `${selected.g} · connector` : selected.g}
            </span>
          </div>
        )}
      </div>

      <button
        className={styles.actionButton}
        disabled={!allViewed}
        onClick={onDone}
      >
        GOT IT
      </button>
    </>
  );
}

/* ---------------------------------------------------------------------- */
/* ARRANGE - rebuild game. Used for BOTH the per-line rebuild AND the      */
/* final master step (whole verse). Connectors are pre-locked in place    */
/* and never quizzed. Has its own try-limit, separate from lesson hearts. */
/* Hearts are only docked (via onContinue(false)) if the tries run out.   */
/* ---------------------------------------------------------------------- */
function Arrange({
  words,
  prompt,
  hint,
  onContinue,
}: {
  words: Word[];
  prompt: string;
  hint: string;
  onContinue: (ok: boolean) => void;
}) {
  const solution = useMemo(() => words.map((w) => w.s), [words]);
  const glosses = useMemo(() => words.map((w) => w.g), [words]);
  const N = words.length;

  const preLocked = useMemo(
    () =>
      new Set(
        words.map((w, i) => (isConnector(w) ? i : -1)).filter((i) => i >= 0),
      ),
    [words],
  );

  const maxTries = Math.max(3, Math.ceil((N - preLocked.size) / 3));

  const initialPool = useMemo(
    () =>
      shuffle(
        words
          .map((w, i) => ({ id: i, text: w.s }))
          .filter((t) => !preLocked.has(t.id)),
      ),
    [words], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const [slots, setSlots] = useState<({ id: number; text: string } | null)[]>(
    () => words.map((w, i) => (preLocked.has(i) ? { id: i, text: w.s } : null)),
  );
  const [pool, setPool] = useState(initialPool);
  const [locked, setLocked] = useState<Set<number>>(new Set(preLocked));
  const [flash, setFlash] = useState<Set<number>>(new Set());
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [tries, setTries] = useState(0);
  const [status, setStatus] = useState<"playing" | "solved" | "revealed">(
    "playing",
  );

  function firstEmpty() {
    return slots.findIndex((s, i) => s === null && !locked.has(i));
  }

  function placeTile(tile: { id: number; text: string }) {
    if (status !== "playing") return;
    const idx =
      selectedSlot !== null && slots[selectedSlot] === null
        ? selectedSlot
        : firstEmpty();
    if (idx === -1) return;

    setSlots((prev) => {
      const next = [...prev];
      next[idx] = tile;
      return next;
    });
    setPool((prev) => prev.filter((t) => t.id !== tile.id));
    setSelectedSlot(null);
  }

  function onSlotTap(i: number) {
    if (status !== "playing" || locked.has(i)) return;

    if (slots[i]) {
      const tile = slots[i]!;
      setSlots((prev) => {
        const next = [...prev];
        next[i] = null;
        return next;
      });
      setPool((prev) => [...prev, tile]);
    } else {
      setSelectedSlot((sel) => (sel === i ? null : i));
    }
  }

  function check() {
    if (slots.some((s) => s === null)) return;

    const correct = new Set(locked);
    const wrong: number[] = [];

    slots.forEach((s, i) => {
      if (s!.text === solution[i]) correct.add(i);
      else if (!locked.has(i)) wrong.push(i);
    });

    if (correct.size === N) {
      setLocked(correct);
      setStatus("solved");
      return;
    }

    const used = tries + 1;
    setTries(used);

    if (used >= maxTries) {
      setSlots(solution.map((text, i) => ({ id: i, text })));
      setLocked(new Set(solution.map((_, i) => i)));
      setPool([]);
      setStatus("revealed");
      return;
    }

    setLocked(correct);
    setFlash(new Set(wrong));
    const bounced = wrong.map((i) => slots[i]!);

    setTimeout(() => {
      setSlots((prev) => prev.map((s, i) => (wrong.includes(i) ? null : s)));
      setPool((prev) => [...prev, ...bounced]);
      setFlash(new Set());
    }, 550);
  }

  const filledAll = slots.every((s) => s !== null);
  const triesLeft = Math.max(maxTries - tries, 0);

  return (
    <>
      <div className={styles.sectionPill}>TEST YOURSELF</div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <h1>{prompt}</h1>
        {status === "playing" && (
          <span style={{ fontSize: 13, letterSpacing: 2 }}>
            {"◆".repeat(triesLeft)}
            <span style={{ opacity: 0.3 }}>{"◇".repeat(tries)}</span>
          </span>
        )}
      </div>
      {hint && <p className={styles.tapHint}>&ldquo;{hint}&rdquo;</p>}

      <div className={styles.rebuildSlots}>
        {slots.map((tile, i) => {
          const isPre = preLocked.has(i);
          const isLocked = locked.has(i);
          const isFlash = flash.has(i);
          const isSel = selectedSlot === i;

          return (
            <button
              key={i}
              disabled={status !== "playing" || isPre || isLocked}
              onClick={() => onSlotTap(i)}
              className={`${styles.rebuildSlot} ${
                tile ? styles.filled : styles.empty
              } ${!tile && isSel ? styles.available : ""} ${
                isLocked ? styles.correctMeaning : ""
              } ${isFlash ? styles.wrongMeaning : ""}`}
              style={{ opacity: isPre ? 0.65 : 1 }}
            >
              {tile && (
                <span
                  className={styles.landedSanskrit}
                  style={{ borderTop: "none" }}
                >
                  {tile.text}
                </span>
              )}
              {isPre && (
                <span
                  style={{ display: "block", fontSize: 10.5, marginTop: 3 }}
                >
                  {glosses[i]} · connector
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className={styles.wordGrid} style={{ marginTop: 18 }}>
        {pool.map((tile) => (
          <button
            key={tile.id}
            className={styles.wordButton}
            onClick={() => placeTile(tile)}
          >
            {tile.text}
          </button>
        ))}
      </div>

      {status === "playing" ? (
        <button
          className={styles.actionButton}
          disabled={!filledAll}
          onClick={check}
        >
          CHECK
        </button>
      ) : (
        <>
          <div
            className={`${styles.feedbackBox} ${
              status === "solved"
                ? styles.correctFeedback
                : styles.wrongFeedback
            }`}
            style={{ marginTop: 16 }}
          >
            <h2>{status === "solved" ? "Correct!" : "Here's the answer"}</h2>
            {status === "revealed" && <p>{solution.join(" ")}</p>}
          </div>
          <button
            className={styles.actionButton}
            onClick={() => onContinue(status === "solved")}
          >
            CONTINUE
          </button>
        </>
      )}
    </>
  );
}

/* ---------------------------------------------------------------------- */
/* MATCH - ONE per verse. Pulled from every line combined, connectors     */
/* dropped, deduped, capped at 4 pairs. Tap a meaning card, then tap the  */
/* matching Sanskrit tile from the word bank below. Mismatches are free - */
/* no tries, no heart cost - only reaching "solved" advances.             */
/* ---------------------------------------------------------------------- */
function MatchPairs({
  words,
  onContinue,
}: {
  words: Word[];
  onContinue: (ok: boolean) => void;
}) {
  const subset = useMemo(() => {
    const uniq: Word[] = [];
    const seenS = new Set<string>();
    const seenG = new Set<string>();

    for (const w of shuffle(words.filter((w) => !isConnector(w)))) {
      if (!seenS.has(w.s) && !seenG.has(w.g)) {
        uniq.push(w);
        seenS.add(w.s);
        seenG.add(w.g);
      }
      if (uniq.length === 4) break;
    }

    return uniq;
  }, [words]); // eslint-disable-line react-hooks/exhaustive-deps

  const bank = useMemo(
    () => shuffle(subset.map((w, i) => ({ id: i, text: w.s }))),
    [subset],
  );

  const [answers, setAnswers] = useState<(string | null)[]>(() =>
    Array(subset.length).fill(null),
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [locked, setLocked] = useState<Set<number>>(new Set());
  const [wrong, setWrong] = useState<Set<number>>(new Set());

  function tapMeaning(i: number) {
    if (locked.has(i) || wrong.has(i)) return;

    if (answers[i]) {
      setAnswers((prev) => {
        const next = [...prev];
        next[i] = null;
        return next;
      });
      setSelectedIndex(null);
      return;
    }

    setSelectedIndex(i);
  }

  function tapWord(text: string) {
    if (selectedIndex === null) return;

    setAnswers((prev) => {
      const next = [...prev];
      const existing = next.findIndex((a) => a === text);
      if (
        existing !== -1 &&
        existing !== selectedIndex &&
        !locked.has(existing)
      ) {
        next[existing] = null;
      }
      next[selectedIndex] = text;
      return next;
    });
    setSelectedIndex(null);
  }

  function check() {
    if (answers.some((a) => a === null)) return;

    const correct = new Set(locked);
    const wrongNow: number[] = [];

    subset.forEach((w, i) => {
      if (answers[i] === w.s) correct.add(i);
      else if (!locked.has(i)) wrongNow.push(i);
    });

    if (correct.size === subset.length) {
      setLocked(correct);
      setTimeout(() => onContinue(true), 500);
      return;
    }

    setLocked(correct);
    setWrong(new Set(wrongNow));

    setTimeout(() => {
      setAnswers((prev) =>
        prev.map((a, i) => (wrongNow.includes(i) ? null : a)),
      );
      setWrong(new Set());
    }, 650);
  }

  const filledAll = answers.every((a) => a !== null);
  const usedTexts = new Set(answers.filter(Boolean) as string[]);

  return (
    <>
      <div className={styles.sectionPill}>TEST YOURSELF</div>
      <p className={styles.screenType}>MATCH</p>
      <h1>Match the meanings</h1>
      <p className={styles.tapHint}>
        Tap a meaning, then tap its matching Sanskrit word.
      </p>

      <div className={styles.options}>
        {subset.map((w, i) => {
          const answer = answers[i];
          const isLocked = locked.has(i);
          const isWrong = wrong.has(i);

          return (
            <button
              key={i}
              disabled={isLocked}
              onClick={() => tapMeaning(i)}
              className={`${styles.option} ${selectedIndex === i ? styles.selected : ""} ${
                answer ? styles.filledMeaning : ""
              } ${isLocked ? styles.correctMeaning : ""} ${isWrong ? styles.wrongMeaning : ""}`}
            >
              <span className={styles.englishMeaning}>{w.g}</span>
              {answer && (
                <span className={styles.landedSanskrit}>{answer}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className={styles.wordGrid} style={{ marginTop: 20 }}>
        {bank.map((tile) => {
          const used = usedTexts.has(tile.text);
          return (
            <button
              key={tile.id}
              disabled={used || selectedIndex === null}
              onClick={() => tapWord(tile.text)}
              className={`${styles.wordButton} ${used ? styles.matchedWord : ""}`}
            >
              {tile.text}
            </button>
          );
        })}
      </div>

      <button
        className={styles.actionButton}
        disabled={!filledAll}
        onClick={check}
      >
        CHECK
      </button>
    </>
  );
}

/* ---------------------------------------------------------------------- */
/* FILL - ONE per verse. Targets the line with the most content words,    */
/* blanks its single longest content word. Wrong answer costs one heart.  */
/* ---------------------------------------------------------------------- */
function FillBlank({
  lines,
  fillLineIndex,
  onContinue,
}: {
  lines: Line[];
  fillLineIndex: number;
  onContinue: (ok: boolean) => void;
}) {
  const line = lines[fillLineIndex];

  const content = useMemo(() => contentWords(line.words), [line]);
  const target = useMemo(
    () => content.reduce((a, b) => (b.s.length > a.s.length ? b : a)),
    [content],
  );
  const targetIndex = useMemo(
    () => line.words.findIndex((w) => w.s === target.s),
    [line, target],
  );

  const options = useMemo(() => {
    const verseWords = lines.flatMap((l) => l.words);
    let others = shuffle(content.filter((w) => w.s !== target.s)).slice(0, 2);

    if (others.length < 2) {
      const extra = shuffle(
        verseWords.filter(
          (w) => w.s !== target.s && !others.some((o) => o.s === w.s),
        ),
      ).slice(0, 2 - others.length);
      others = others.concat(extra);
    }

    return shuffle([target, ...others]);
  }, [line, target, content, lines]);

  const [choice, setChoice] = useState<string | null>(null);
  const [checked, setChecked] = useState<boolean | null>(null);

  function check() {
    setChecked(choice === target.s);
  }

  return (
    <>
      <div className={styles.sectionPill}>TEST YOURSELF</div>
      <p className={styles.screenType}>FILL THE BLANK</p>
      <h1>Fill in the missing word</h1>

      <div className={styles.verseBox} style={{ marginTop: 14 }}>
        <p className={styles.sanskritText}>
          {line.words
            .map((w, i) => (i === targetIndex ? "____" : w.s))
            .join(" ")}
        </p>
        <div className={styles.wordMeaning}>
          <span>Hint: {target.g}</span>
        </div>
      </div>

      <div className={styles.wordGrid} style={{ marginTop: 18 }}>
        {options.map((o) => (
          <button
            key={o.s}
            disabled={checked !== null}
            onClick={() => checked === null && setChoice(o.s)}
            className={`${styles.wordButton} ${choice === o.s ? styles.wordSelected : ""}`}
          >
            {o.s}
          </button>
        ))}
      </div>

      {checked === null ? (
        <button
          className={styles.actionButton}
          disabled={!choice}
          onClick={check}
        >
          CHECK
        </button>
      ) : (
        <>
          <div
            className={`${styles.feedbackBox} ${
              checked ? styles.correctFeedback : styles.wrongFeedback
            }`}
            style={{ marginTop: 16 }}
          >
            <h2>{checked ? "Correct!" : "Not quite"}</h2>
            {!checked && <p>Answer: {target.s}</p>}
          </div>
          <button
            className={styles.actionButton}
            onClick={() => onContinue(checked!)}
          >
            CONTINUE
          </button>
        </>
      )}
    </>
  );
}

function WordMeaningTable({ words }: { words: Word[] }) {
  return (
    <div className={styles.wordMeaningList}>
      {words.map((word, i) => {
        const audio = audioForWord(word.s);

        return (
          <div className={styles.wordMeaningRow} key={`${word.s}-${i}`}>
            <button
              type="button"
              className={styles.wordMeaningSanskrit}
              onClick={() => playWordAudio(word.s)}
              disabled={!audio}
              aria-label={`Play pronunciation for ${word.s}`}
            >
              <span className={styles.wordAudioIcon}>🔊</span>
              <span>{word.s}</span>
            </button>
            <div className={styles.wordMeaningEnglish}>{word.g}</div>
          </div>
        );
      })}
    </div>
  );
}

function HalfLearning({
  words,
  half,
  onDone,
}: {
  words: Word[];
  half: 1 | 2;
  onDone: () => void;
}) {
  return (
    <>
      <div className={styles.sectionPill}>LEARN</div>
      <p className={styles.screenType}>HALF {half} OF THE VERSE</p>
      <h1>Learn the words</h1>
      <WordMeaningTable words={words} />
      <button className={styles.actionButton} onClick={onDone}>
        CONTINUE
      </button>
    </>
  );
}

function MatchWordMeanings({
  words,
  title,
  onContinue,
}: {
  words: Word[];
  title: string;
  onContinue: (ok: boolean) => void;
}) {
  const content = useMemo(() => words.filter((w) => !isConnector(w)), [words]);

  const meanings = useMemo(
    () =>
      shuffle(
        content.map((word, originalIndex) => ({
          text: word.g,
          originalIndex,
        })),
      ),
    [content],
  );

  const [selectedWord, setSelectedWord] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [wrong, setWrong] = useState<string | null>(null);

  const sentence = content
    .filter((_, i) => matched.has(i))
    .map((word) => word.s)
    .join(" ");

  function selectMeaning(meaningIndex: number) {
    if (selectedWord === null) return;

    const correct = meanings[meaningIndex].originalIndex === selectedWord;

    if (correct) {
      const next = new Set(matched);
      next.add(selectedWord);
      setMatched(next);
      setSelectedWord(null);

      if (next.size === content.length) {
        setTimeout(() => onContinue(true), 450);
      }
    } else {
      setWrong(`${selectedWord}-${meaningIndex}`);
      setTimeout(() => setWrong(null), 500);
    }
  }

  return (
    <>
      <div className={styles.sectionPill}>TEST YOURSELF</div>
      <p className={styles.screenType}>MATCH</p>
      <h1>{title}</h1>
      <p className={styles.tapHint}>
        Match each Sanskrit word with its meaning.
      </p>

      <div className={styles.wordMatchGame}>
        <div className={styles.wordMatchColumn}>
          <div className={styles.matchColumnLabel}>SANSKRIT</div>
          {content.map((word, i) => (
            <button
              key={`sanskrit-${i}`}
              className={`${styles.wordMatchButton} ${
                selectedWord === i ? styles.matchSelected : ""
              } ${matched.has(i) ? styles.matchCorrect : ""}`}
              disabled={matched.has(i)}
              onClick={() => setSelectedWord(i)}
            >
              {word.s}
            </button>
          ))}
        </div>

        <div className={styles.wordMatchColumn}>
          <div className={styles.matchColumnLabel}>MEANING</div>
          {meanings.map((meaning, i) => {
            const isMatched = matched.has(meaning.originalIndex);
            const isWrong = wrong === `${selectedWord}-${i}`;

            return (
              <button
                key={`meaning-${i}`}
                className={`${styles.wordMatchButton} ${
                  isWrong ? styles.matchWrong : ""
                } ${isMatched ? styles.matchCorrect : ""}`}
                disabled={isMatched}
                onClick={() => selectMeaning(i)}
              >
                {meaning.text}
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.sentenceBuild}>
        <span>YOUR SENTENCE</span>
        <p>{sentence || "Match words to build the sentence"}</p>
      </div>
    </>
  );
}

function FillVerse({
  words,
  title,
  hint,
  onContinue,
}: {
  words: Word[];
  title: string;
  hint: string;
  onContinue: (ok: boolean) => void;
}) {
  const content = useMemo(() => words.filter((w) => !isConnector(w)), [words]);

  // Keep three blanks for a short verse, otherwise use roughly 30–40%
  // of the content words. Each blank shows its English meaning as a hint.
  const blankIndexes = useMemo(() => {
    if (content.length <= 3) return content.map((_, i) => i);

    const count = Math.max(3, Math.ceil(content.length * 0.35));
    const indexes = new Set<number>();

    for (let i = 0; indexes.size < count && i < content.length; i += 1) {
      const candidate = Math.round(
        (i * (content.length - 1)) / Math.max(1, count - 1),
      );
      indexes.add(candidate);
    }

    return [...indexes].sort((a, b) => a - b);
  }, [content]);

  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState<boolean | null>(null);

  const wordBank = useMemo(
    () => shuffle(blankIndexes.map((i) => content[i])),
    [blankIndexes, content],
  );

  function chooseAnswer(word: Word) {
    if (checked !== null) return;

    const emptyIndex = blankIndexes.find((index) => !answers[index]);

    if (emptyIndex === undefined) return;

    setAnswers((prev) => ({
      ...prev,
      [emptyIndex]: word.s,
    }));
  }

  function clearAnswer(index: number) {
    if (checked !== null) return;

    setAnswers((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  }

  function check() {
    const ok = blankIndexes.every(
      (index) => answers[index] === content[index].s,
    );
    setChecked(ok);
  }

  return (
    <>
      <div className={styles.sectionPill}>TEST YOURSELF</div>
      <p className={styles.screenType}>FILL THE BLANKS</p>
      <h1>{title}</h1>

      <p className={styles.masterHint}>{hint}</p>

      <div className={styles.fillVerse}>
        {content.map((word, i) => {
          const isBlank = blankIndexes.includes(i);

          if (!isBlank) {
            return (
              <span className={styles.fillWord} key={`${word.s}-${i}`}>
                {word.s}
              </span>
            );
          }

          return (
            <button
              key={`${word.s}-${i}`}
              className={`${styles.fillBlank} ${
                answers[i] ? styles.fillBlankFilled : ""
              } ${
                checked !== null
                  ? answers[i] === word.s
                    ? styles.fillBlankCorrect
                    : styles.fillBlankWrong
                  : ""
              }`}
              disabled={checked !== null}
              onClick={() => clearAnswer(i)}
              title="Tap to remove your answer"
            >
              {answers[i] || `${word.g}`}
            </button>
          );
        })}
      </div>

      <p className={styles.fillInstruction}>
        Choose the Sanskrit word that completes each blank.
      </p>

      <div className={styles.fillWordBank}>
        {wordBank.map((word) => {
          const alreadyUsed = Object.values(answers).includes(word.s);

          return (
            <button
              key={word.s}
              className={styles.fillWordOption}
              disabled={alreadyUsed || checked !== null}
              onClick={() => chooseAnswer(word)}
            >
              {word.s}
            </button>
          );
        })}
      </div>

      {checked === null ? (
        <button
          className={styles.actionButton}
          disabled={blankIndexes.some((i) => !answers[i])}
          onClick={check}
        >
          CHECK
        </button>
      ) : (
        <>
          <div
            className={`${styles.feedbackBox} ${
              checked ? styles.correctFeedback : styles.wrongFeedback
            }`}
          >
            <h2>{checked ? "Correct!" : "Not quite"}</h2>
            {!checked && <p>{content.map((word) => word.s).join(" ")}</p>}
          </div>

          <button
            className={styles.actionButton}
            onClick={() => onContinue(checked)}
          >
            CONTINUE
          </button>
        </>
      )}
    </>
  );
}

/* ---------------------------------------------------------------------- */
/* ROOT PAGE                                                              */
/* ---------------------------------------------------------------------- */
export default function LevelOnePage() {
  const lessons = level1 as Lesson[];

  const [lessonIndex, setLessonIndex] = useState(0);

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);
  const [stepIndex, setStepIndex] = useState(0);
  const [hearts, setHearts] = useState(5);
  const [mistakes, setMistakes] = useState(0);
  const [score, setScore] = useState(0);
  const [isLevelComplete, setIsLevelComplete] = useState(false);

  // Stop any audio as soon as the user changes exercise or verse.
  useEffect(() => {
    stopAudio();
  }, [stepIndex, lessonIndex]);

  const lesson = lessons[lessonIndex];

  const lines: Line[] = useMemo(
    () =>
      (lesson?.lines ?? []).map((line) => ({
        text: line.text ?? line.t ?? "",
        words: line.words ?? line.ws ?? [],
      })),
    [lesson],
  );

  // A leading speaker tag (e.g. "dhṛtarāṣṭra uvāca") is attribution, not a
  // real pāda - pull it out so it's shown but never taught as its own part.
  const speakerLine = useMemo(
    () => (lines.length > 1 && isSpeakerLine(lines[0]) ? lines[0] : null),
    [lines],
  );
  const teachableLines = useMemo(
    () => (speakerLine ? lines.slice(1) : lines),
    [lines, speakerLine],
  );

  const wholeWords = useMemo(
    () => teachableLines.flatMap((line) => line.words),
    [teachableLines],
  );

  // Split the actual word sequence into two halves.
  // For a 4-pāda shloka this naturally gives the first 2 pādas and last 2 pādas.
  const firstHalfWords = useMemo(() => {
    if (teachableLines.length >= 4) {
      return teachableLines
        .slice(0, Math.ceil(teachableLines.length / 2))
        .flatMap((line) => line.words);
    }
    const split = Math.ceil(wholeWords.length / 2);
    return wholeWords.slice(0, split);
  }, [teachableLines, wholeWords]);

  const secondHalfWords = useMemo(() => {
    if (teachableLines.length >= 4) {
      return teachableLines
        .slice(Math.ceil(teachableLines.length / 2))
        .flatMap((line) => line.words);
    }
    const split = Math.ceil(wholeWords.length / 2);
    return wholeWords.slice(split);
  }, [teachableLines, wholeWords]);

  const steps: Step[] = useMemo(
    () => [
      { type: "intro" },
      { type: "learnHalf1" },
      { type: "tips" },
      { type: "matchHalf1" },
      { type: "learnHalf2" },
      { type: "fillHalf2" },
      { type: "matchWhole" },
      { type: "fillWhole" },
    ],
    [],
  );

  // Hearts reset per verse, like the inspo build (5 per lesson attempt)
  useEffect(() => {
    setHearts(5);
    setMistakes(0);
    setStepIndex(0);
  }, [lessonIndex]);

  function advance(ok?: boolean) {
    stopAudio();
    if (ok === false) {
      setHearts((h) => Math.max(0, h - 1));
      setMistakes((m) => m + 1);
    }
    setStepIndex((i) => i + 1);
  }

  function handleNextVerse() {
    setScore((s) => s + 1);

    const isLast = lessonIndex === lessons.length - 1;
    if (isLast) {
      localStorage.setItem("level1Completed", "true");
      setIsLevelComplete(true);
      return;
    }

    setLessonIndex((i) => i + 1);
  }

  const stepCounts = useMemo(() => lessons.map(countStepsForLesson), [lessons]);
  const totalSteps = stepCounts.reduce((a, b) => a + b, 0);
  const completedBefore = stepCounts
    .slice(0, lessonIndex)
    .reduce((a, b) => a + b, 0);
  const currentStep = completedBefore + Math.min(stepIndex, steps.length);
  const progress =
    totalSteps > 0 ? Math.min((currentStep / totalSteps) * 100, 100) : 0;

  if (!lesson) {
    return (
      <main className={styles.game}>
        <p>Lesson not found.</p>
      </main>
    );
  }

  if (isLevelComplete) {
    return (
      <main className={styles.game}>
        <section className={styles.completeScreen}>
          <div className={styles.completeIcon}>🏹</div>
          <p className={styles.completeLabel}>SECTION COMPLETE</p>
          <h1>Well done!</h1>
          <p className={styles.completeText}>
            You completed this section of Chapter 1.
          </p>
          <div className={styles.scoreCard}>
            <span>Verses learned</span>
            <strong>{score}</strong>
          </div>
          <Link href="/" className={styles.completeButton}>
            CONTINUE JOURNEY
          </Link>
        </section>
      </main>
    );
  }

  const verseDone = stepIndex >= steps.length;
  const step = steps[stepIndex];

  return (
    <main className={styles.game}>
      <header className={styles.header}>
        <Link href="/" className={styles.close} aria-label="Close lesson">
          ✕
        </Link>

        <div className={styles.progressTrack}>
          <div className={styles.progress} style={{ width: `${progress}%` }} />
        </div>

        <div className={styles.gameStats}>
          <span className={styles.hearts}>❤️ {hearts}</span>
          <span className={styles.counter}>{lesson.ref}</span>
        </div>
      </header>

      <section className={styles.content}>
        {verseDone ? (
          <>
            <div className={`${styles.feedbackBox} ${styles.correctFeedback}`}>
              <h2>{mistakes === 0 ? "Flawless!" : "Verse complete"}</h2>
              <p>
                {mistakes === 0
                  ? "You got every part right."
                  : "You mastered this verse."}
              </p>
            </div>

            <div className={styles.verseBox} style={{ marginTop: 20 }}>
              {lines.map((line, i) => (
                <p key={i} className={styles.sanskritText}>
                  {line.text}
                </p>
              ))}
            </div>

            <div className={styles.meaningBox}>
              <span>WHAT IT MEANS</span>
              <p>{lesson.meaning}</p>
            </div>

            <button
              type="button"
              className={styles.listenButton}
              onClick={() => playAudio(WHOLE_VERSE_AUDIO)}
            >
              🔊 LISTEN TO THE WHOLE SHLOKA
            </button>

            <button className={styles.actionButton} onClick={handleNextVerse}>
              NEXT VERSE
            </button>
          </>
        ) : (
          <>
            {step.type === "intro" && (
              <Intro
                key={stepIndex}
                lesson={lesson}
                lines={teachableLines}
                speakerLine={speakerLine}
                onDone={() => advance()}
              />
            )}

            {step.type === "tips" && (
              <TipsPopup
                key={stepIndex}
                lesson={lesson}
                onDone={() => advance()}
              />
            )}

            {step.type === "learnHalf1" && (
              <HalfLearning
                words={firstHalfWords}
                half={1}
                onDone={() => advance()}
              />
            )}

            {step.type === "matchHalf1" && (
              <MatchWordMeanings
                words={firstHalfWords}
                title="Match the first half"
                onContinue={advance}
              />
            )}

            {step.type === "learnHalf2" && (
              <HalfLearning
                words={secondHalfWords}
                half={2}
                onDone={() => advance()}
              />
            )}

            {step.type === "fillHalf2" && (
              <FillVerse
                words={secondHalfWords}
                title="Complete the second half"
                hint={lesson.meaning}
                onContinue={advance}
              />
            )}

            {step.type === "matchWhole" && (
              <MatchWordMeanings
                words={wholeWords}
                title="Match the whole verse"
                onContinue={advance}
              />
            )}

            {step.type === "fillWhole" && (
              <FillVerse
                words={wholeWords}
                title="Complete the whole verse"
                hint={lesson.meaning}
                onContinue={advance}
              />
            )}
          </>
        )}
      </section>
    </main>
  );
}
