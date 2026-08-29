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
  return 6;
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
  const words = lines.flatMap((line) => line.words);

  return (
    <>
      <div className={styles.sectionPill}>LEARN THE SHLOKA</div>
      <p className={styles.screenType}>VERSE {lesson.ref}</p>
      <h1>Read each Sanskrit word with its meaning</h1>

      {speakerLine && (
        <p className={styles.speakerLine}>{speakerLine.text}</p>
      )}

      <div className={styles.wordMeaningTable}>
        <div className={styles.wordMeaningHeader}>
          <span>SANSKRIT</span>
          <span>MEANING</span>
        </div>

        {words.map((word, i) => (
          <div key={`${word.s}-${i}`} className={styles.wordMeaningRow}>
            <div className={styles.wordMeaningSanskrit}>{word.s}</div>
            <div className={styles.wordMeaningEnglish}>{word.g}</div>
          </div>
        ))}
      </div>

      <button className={styles.actionButton} onClick={onDone}>
        CONTINUE
      </button>
    </>
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

      <button className={styles.actionButton} disabled={!allViewed} onClick={onDone}>
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
  anchorIndices = [],
  onContinue,
}: {
  words: Word[];
  prompt: string;
  hint: string;
  anchorIndices?: number[];
  onContinue: (ok: boolean) => void;
}) {
  const solution = useMemo(() => words.map((w) => w.s), [words]);
  const glosses = useMemo(() => words.map((w) => w.g), [words]);
  const N = words.length;

  const preLocked = useMemo(() => {
    const locked = new Set<number>();

    words.forEach((w, i) => {
      if (isConnector(w)) locked.add(i);
    });

    anchorIndices.forEach((i) => {
      if (i >= 0 && i < words.length && !isConnector(words[i])) {
        locked.add(i);
      }
    });

    return locked;
  }, [words, anchorIndices]);

  const maxTries = Math.max(3, Math.ceil((N - preLocked.size) / 3));

  const initialPool = useMemo(
    () =>
      shuffle(
        words.map((w, i) => ({ id: i, text: w.s })).filter((t) => !preLocked.has(t.id)),
      ),
    [words], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const [slots, setSlots] = useState<({ id: number; text: string } | null)[]>(() =>
    words.map((w, i) => (preLocked.has(i) ? { id: i, text: w.s } : null)),
  );
  const [pool, setPool] = useState(initialPool);
  const [locked, setLocked] = useState<Set<number>>(new Set(preLocked));
  const [flash, setFlash] = useState<Set<number>>(new Set());
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [tries, setTries] = useState(0);
  const [status, setStatus] = useState<"playing" | "solved" | "revealed">("playing");

  function firstEmpty() {
    return slots.findIndex((s, i) => s === null && !locked.has(i));
  }

  function placeTile(tile: { id: number; text: string }) {
    if (status !== "playing") return;
    const idx = selectedSlot !== null && slots[selectedSlot] === null ? selectedSlot : firstEmpty();
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
      {hint && (
        <p className={`${styles.tapHint} ${anchorIndices.length ? styles.masterHint : ""}`}>
          {hint}
        </p>
      )}

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
                <span className={styles.landedSanskrit} style={{ borderTop: "none" }}>
                  {tile.text}
                </span>
              )}
              {isPre && (
                <span style={{ display: "block", fontSize: 10.5, marginTop: 3 }}>
                  {glosses[i]} · connector
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className={styles.wordGrid} style={{ marginTop: 18 }}>
        {pool.map((tile) => (
          <button key={tile.id} className={styles.wordButton} onClick={() => placeTile(tile)}>
            {tile.text}
          </button>
        ))}
      </div>

      {status === "playing" ? (
        <button className={styles.actionButton} disabled={!filledAll} onClick={check}>
          CHECK
        </button>
      ) : (
        <>
          <div
            className={`${styles.feedbackBox} ${
              status === "solved" ? styles.correctFeedback : styles.wrongFeedback
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
  const items = useMemo(
    () => words.map((word, id) => ({ ...word, id })),
    [words],
  );

  const meanings = useMemo(
    () => shuffle(items.map((item) => ({ id: item.id, text: item.g }))),
    [items],
  );

  const [selectedSanskrit, setSelectedSanskrit] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [wrong, setWrong] = useState<Set<number>>(new Set());

  function chooseSanskrit(id: number) {
    if (matched.has(id)) return;
    setWrong(new Set());
    setSelectedSanskrit((current) => (current === id ? null : id));
  }

  function chooseMeaning(id: number) {
    if (matched.has(id) || selectedSanskrit === null) return;

    if (id === selectedSanskrit) {
      const next = new Set(matched);
      next.add(id);
      setMatched(next);
      setSelectedSanskrit(null);

      if (next.size === items.length) {
        setTimeout(() => onContinue(true), 350);
      }
      return;
    }

    setWrong(new Set([selectedSanskrit, id]));
    setTimeout(() => {
      setWrong(new Set());
      setSelectedSanskrit(null);
    }, 550);
  }

  return (
    <>
      <div className={styles.sectionPill}>EXERCISE 1</div>
      <p className={styles.screenType}>MATCH</p>
      <h1>Match each word with its meaning</h1>
      <p className={styles.tapHint}>
        Tap a Sanskrit word, then tap its matching meaning.
      </p>

      <div className={styles.wordMatchTable}>
        <div className={styles.wordMatchHeader}>
          <span>SANSKRIT</span>
          <span>MEANING</span>
        </div>

        <div className={styles.wordMatchColumns}>
          <div className={styles.wordMatchColumn}>
            {items.map((item) => {
              const isMatched = matched.has(item.id);
              const isSelected = selectedSanskrit === item.id;
              const isWrong = wrong.has(item.id);

              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={isMatched}
                  onClick={() => chooseSanskrit(item.id)}
                  className={`${styles.wordMatchButton} ${
                    isSelected ? styles.matchSelected : ""
                  } ${isMatched ? styles.matchCorrect : ""} ${
                    isWrong ? styles.matchWrong : ""
                  }`}
                >
                  {isMatched && <span className={styles.matchCheck}>✓</span>}
                  {item.s}
                </button>
              );
            })}
          </div>

          <div className={styles.wordMatchColumn}>
            {meanings.map((meaning) => {
              const isMatched = matched.has(meaning.id);
              const isWrong = wrong.has(meaning.id);

              return (
                <button
                  key={meaning.id}
                  type="button"
                  disabled={isMatched || selectedSanskrit === null}
                  onClick={() => chooseMeaning(meaning.id)}
                  className={`${styles.wordMatchButton} ${
                    isMatched ? styles.matchCorrect : ""
                  } ${isWrong ? styles.matchWrong : ""}`}
                >
                  {isMatched && <span className={styles.matchCheck}>✓</span>}
                  {meaning.text}
                </button>
              );
            })}
          </div>
        </div>
      </div>
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
        verseWords.filter((w) => w.s !== target.s && !others.some((o) => o.s === w.s)),
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
          {line.words.map((w, i) => (i === targetIndex ? "____" : w.s)).join(" ")}
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
        <button className={styles.actionButton} disabled={!choice} onClick={check}>
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
          <button className={styles.actionButton} onClick={() => onContinue(checked!)}>
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
      {words.filter((w) => !isConnector(w)).map((word, i) => (
        <div className={styles.wordMeaningRow} key={`${word.s}-${i}`}>
          <div className={styles.wordMeaningSanskrit}>{word.s}</div>
          <div className={styles.wordMeaningEnglish}>{word.g}</div>
        </div>
      ))}
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
  const content = useMemo(
    () => words.filter((w) => !isConnector(w)),
    [words],
  );

  const meanings = useMemo(
    () => shuffle(content.map((word, originalIndex) => ({
      text: word.g,
      originalIndex,
    }))),
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
  const content = useMemo(
    () => words.filter((w) => !isConnector(w)),
    [words],
  );

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
    () =>
      shuffle(
        blankIndexes.map((i) => content[i]),
      ),
    [blankIndexes, content],
  );

  function chooseAnswer(word: Word) {
    if (checked !== null) return;

    const emptyIndex = blankIndexes.find(
      (index) => !answers[index],
    );

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
            {!checked && (
              <p>{content.map((word) => word.s).join(" ")}</p>
            )}
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
  const [stepIndex, setStepIndex] = useState(0);
  const [hearts, setHearts] = useState(5);
  const [mistakes, setMistakes] = useState(0);
  const [score, setScore] = useState(0);
  const [isLevelComplete, setIsLevelComplete] = useState(false);

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

  const splitAt = Math.ceil(wholeWords.length / 2);

  const firstHalfWords = useMemo(
    () => wholeWords.slice(0, splitAt),
    [wholeWords, splitAt],
  );

  const secondHalfWords = useMemo(
    () => wholeWords.slice(splitAt),
    [wholeWords, splitAt],
  );

  const steps: Step[] = useMemo(
    () => [
      { type: "learnHalf1" },
      { type: "matchHalf1" },
      { type: "learnHalf2" },
      { type: "fillHalf2" },
      { type: "matchWhole" },
      { type: "fillWhole" },
    ],
    [],
  );

  // Whole-verse master: give the learner three anchors so the verse is
  // challenging but not a completely blank wall.
  const masterHintIndices = useMemo(() => {
    const allWords = teachableLines.flatMap((line) => line.words);
    const contentIndices = allWords
      .map((word, i) => (isConnector(word) ? -1 : i))
      .filter((i) => i >= 0);

    if (contentIndices.length === 0) return [];

    const first = contentIndices[0];
    const middle = contentIndices[Math.floor((contentIndices.length - 1) / 2)];
    const last = contentIndices[contentIndices.length - 1];

    return [...new Set([first, middle, last])];
  }, [teachableLines]);

  // Hearts reset per verse, like the inspo build (5 per lesson attempt)
  useEffect(() => {
    setHearts(5);
    setMistakes(0);
    setStepIndex(0);
  }, [lessonIndex]);

  function advance(ok?: boolean) {
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
  const completedBefore = stepCounts.slice(0, lessonIndex).reduce((a, b) => a + b, 0);
  const currentStep = completedBefore + Math.min(stepIndex, steps.length);
  const progress = totalSteps > 0 ? Math.min((currentStep / totalSteps) * 100, 100) : 0;

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

            <button className={styles.actionButton} onClick={handleNextVerse}>
              NEXT VERSE
            </button>
          </>
        ) : (
          <>
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