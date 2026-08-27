"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import { level1 } from "../../../data/level1";

type Word = {
  s: string;
  g: string;
  fn?: number;
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

  test?: {
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
  };
};

type Screen =
  | "story"
  | "line"
  | "tip"
  | "rebuild"
  | "feedback"
  | "complete";

export default function LevelOnePage() {
  const lessons = level1 as Lesson[];

  const [lessonIndex, setLessonIndex] = useState(0);
  const [screen, setScreen] = useState<Screen>("story");

  const [lineIndex, setLineIndex] = useState(0);

  const [selectedWord, setSelectedWord] =
    useState<Word | null>(null);

  const [hearts, setHearts] = useState(10);
  const [score, setScore] = useState(0);

  const [rebuildPart, setRebuildPart] = useState(0);

  const [selectedMeaningIndex, setSelectedMeaningIndex] =
    useState<number | null>(null);

  const [rebuildAnswers, setRebuildAnswers] = useState<
    (string | null)[]
  >([]);

  const [lockedAnswers, setLockedAnswers] = useState<
    Set<number>
  >(new Set());

  const [wrongAnswers, setWrongAnswers] = useState<
    Set<number>
  >(new Set());

  const [lastAnswerCorrect, setLastAnswerCorrect] =
    useState(false);

  const lesson = lessons[lessonIndex];

  const lines = (lesson?.lines ?? []).map((line) => ({
    text: line.text ?? line.t ?? "",
    words: line.words ?? line.ws ?? [],
  }));

  const currentLine = lines[lineIndex];

  const verseWords = useMemo(() => {
    return lines.flatMap((line) => line.words);
  }, [lessonIndex]);

  const rebuildParts = useMemo(() => {
    if (verseWords.length === 0) return [];

    const splitPoint = Math.ceil(
      verseWords.length / 2
    );

    return [
      verseWords.slice(0, splitPoint),
      verseWords.slice(splitPoint),
    ].filter((part) => part.length > 0);
  }, [verseWords]);

  const currentRebuildWords =
    rebuildParts[rebuildPart] ?? [];

  const shuffledOptions = useMemo(() => {
    return [...currentRebuildWords].sort(
      () => Math.random() - 0.5
    );
  }, [lessonIndex, rebuildPart]);

  const totalSteps = lessons.reduce(
    (total, item) => {
      return total + item.lines.length + 4;
    },
    0
  );

  const completedBefore = lessons
    .slice(0, lessonIndex)
    .reduce((total, item) => {
      return total + item.lines.length + 4;
    }, 0);

  let currentStep = completedBefore;

  if (screen === "story") {
    currentStep += 1;
  }

  if (screen === "line") {
    currentStep += 1 + lineIndex;
  }

  if (screen === "tip") {
    currentStep += 1 + lines.length;
  }

  if (screen === "rebuild") {
    currentStep +=
      2 + lines.length + rebuildPart;
  }

  if (screen === "feedback") {
    currentStep +=
      3 + lines.length;
  }

  const progress =
    totalSteps > 0
      ? Math.min(
          (currentStep / totalSteps) * 100,
          100
        )
      : 0;

  function handleContinueStory() {
    setLineIndex(0);
    setSelectedWord(null);

    if (lines.length > 0) {
      setScreen("line");
    } else {
      setScreen("tip");
    }
  }

  function handleContinueLine() {
    if (!selectedWord) return;

    const isLastLine =
      lineIndex >= lines.length - 1;

    if (isLastLine) {
      setSelectedWord(null);
      setScreen("tip");
      return;
    }

    setLineIndex((previous) => previous + 1);
    setSelectedWord(null);
  }

  function startRebuild() {
    setRebuildPart(0);

    const firstPart = rebuildParts[0] ?? [];

    setRebuildAnswers(
      Array(firstPart.length).fill(null)
    );

    setLockedAnswers(new Set());
    setWrongAnswers(new Set());

    setSelectedMeaningIndex(null);

    setLastAnswerCorrect(false);

    setScreen("rebuild");
  }

 function handleMeaningClick(index: number) {
  // Correct/locked answers cannot be changed
  if (lockedAnswers.has(index)) return;

  // If this block already has a Sanskrit word,
  // clicking it removes the word and returns it
  // to the Sanskrit choices below.
  if (rebuildAnswers[index] !== null) {
    setRebuildAnswers((previous) => {
      const updated = [...previous];
      updated[index] = null;
      return updated;
    });

    setSelectedMeaningIndex(null);
    return;
  }

  // Otherwise select this empty English meaning block
  setSelectedMeaningIndex(index);
}

  function handleSanskritClick(word: string) {
    if (selectedMeaningIndex === null) return;

    if (lockedAnswers.has(selectedMeaningIndex)) {
      return;
    }

    setRebuildAnswers((previous) => {
      const updated = [...previous];

      /*
        If this Sanskrit word was already placed
        somewhere else incorrectly, remove it first.
      */
      const existingIndex =
        updated.findIndex(
          (answer) => answer === word
        );

      if (
        existingIndex !== -1 &&
        existingIndex !== selectedMeaningIndex &&
        !lockedAnswers.has(existingIndex)
      ) {
        updated[existingIndex] = null;
      }

      updated[selectedMeaningIndex] = word;

      return updated;
    });

    setSelectedMeaningIndex(null);
  }

  function handleCheckRebuild() {
    const allAnswered =
      rebuildAnswers.length ===
        currentRebuildWords.length &&
      rebuildAnswers.every(
        (answer) => answer !== null
      );

    if (!allAnswered) return;

    const correctIndexes = new Set<number>();
    const wrongIndexes = new Set<number>();

    currentRebuildWords.forEach(
      (word, index) => {
        if (rebuildAnswers[index] === word.s) {
          correctIndexes.add(index);
        } else {
          wrongIndexes.add(index);
        }
      }
    );

    /*
      EVERYTHING CORRECT
    */
    if (wrongIndexes.size === 0) {
      setLockedAnswers(correctIndexes);
      setWrongAnswers(new Set());

      setSelectedMeaningIndex(null);

      setScore((previous) => previous + 1);

      setHearts((previous) =>
        Math.min(previous + 1, 10)
      );

      setLastAnswerCorrect(true);

      /*
        Keep green state visible briefly
        before feedback appears.
      */
      setTimeout(() => {
        setScreen("feedback");
      }, 700);

      return;
    }

    /*
      SOME ANSWERS ARE WRONG

      Correct:
      green + locked

      Wrong:
      red + wiggle
    */
    setLockedAnswers(correctIndexes);

    setWrongAnswers(wrongIndexes);

    setSelectedMeaningIndex(null);

    setHearts((previous) =>
      Math.max(previous - 1, 0)
    );

    /*
      After animation, remove ONLY
      the wrong Sanskrit answers.

      Correct green pairs remain.
    */
    setTimeout(() => {
      setRebuildAnswers((previous) =>
        previous.map((answer, index) =>
          wrongIndexes.has(index)
            ? null
            : answer
        )
      );

      setWrongAnswers(new Set());
    }, 650);
  }

  function moveToNextRebuildPart() {
    const nextPart = rebuildPart + 1;

    if (nextPart < rebuildParts.length) {
      const nextWords =
        rebuildParts[nextPart] ?? [];

      setRebuildPart(nextPart);

      setRebuildAnswers(
        Array(nextWords.length).fill(null)
      );

      setLockedAnswers(new Set());
      setWrongAnswers(new Set());

      setSelectedMeaningIndex(null);

      setLastAnswerCorrect(false);

      setScreen("rebuild");

      return;
    }

    handleNextVerse();
  }

  function handleNextVerse() {
    const isLastLesson =
      lessonIndex === lessons.length - 1;

    if (isLastLesson) {
      localStorage.setItem(
        "level1Completed",
        "true"
      );

      setScreen("complete");

      return;
    }

    setLessonIndex((previous) => previous + 1);

    setLineIndex(0);
    setSelectedWord(null);

    setRebuildPart(0);
    setSelectedMeaningIndex(null);

    setRebuildAnswers([]);

    setLockedAnswers(new Set());
    setWrongAnswers(new Set());

    setLastAnswerCorrect(false);

    setScreen("story");
  }

  if (!lesson) {
    return (
      <main className={styles.game}>
        <p>Lesson not found.</p>
      </main>
    );
  }

  if (screen === "complete") {
    return (
      <main className={styles.game}>
        <section className={styles.completeScreen}>
          <div className={styles.completeIcon}>
            🏹
          </div>

          <p className={styles.completeLabel}>
            SECTION COMPLETE
          </p>

          <h1>Well done!</h1>

          <p className={styles.completeText}>
            You completed this section of Chapter 1.
          </p>

          <div className={styles.scoreCard}>
            <span>Correct rebuilds</span>

            <strong>{score}</strong>
          </div>

          <Link
            href="/"
            className={styles.completeButton}
          >
            CONTINUE JOURNEY
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.game}>
      <header className={styles.header}>
        <Link
          href="/"
          className={styles.close}
          aria-label="Close lesson"
        >
          ✕
        </Link>

        <div className={styles.progressTrack}>
          <div
            className={styles.progress}
            style={{
              width: `${progress}%`,
            }}
          />
        </div>

        <div className={styles.gameStats}>
          <span className={styles.hearts}>
            ❤️ {hearts}
          </span>

          <span className={styles.counter}>
            {lesson.ref}
          </span>
        </div>
      </header>

      <section className={styles.content}>
        {/* STORY */}

        {screen === "story" && (
          <>
            <div className={styles.sectionPill}>
              VERSE {lesson.ref}
            </div>

            <p className={styles.screenType}>
              LEARN
            </p>

            <h1>{lesson.title}</h1>

            <div className={styles.storyBox}>
              <div className={styles.boxIcon}>
                📖
              </div>

              <p>{lesson.story}</p>
            </div>

            <div className={styles.meaningBox}>
              <span>WHAT IT MEANS</span>

              <p>{lesson.meaning}</p>
            </div>

            <button
              className={styles.actionButton}
              onClick={handleContinueStory}
            >
              CONTINUE
            </button>
          </>
        )}

        {/* WORD BY WORD */}

        {screen === "line" && (
          <>
            <div className={styles.sectionPill}>
              VERSE {lesson.ref}
            </div>

            <p className={styles.screenType}>
              WORD BY WORD
            </p>

            <h1>{lesson.title}</h1>

            <div className={styles.verseBox}>
              {currentLine ? (
                <>
                  <div className={styles.lineCounter}>
                    LINE {lineIndex + 1} OF{" "}
                    {lines.length}
                  </div>

                  <p
                    className={
                      styles.sanskritText
                    }
                  >
                    {currentLine.text}
                  </p>

                  <p className={styles.tapHint}>
                    Tap a word to discover its
                    meaning
                  </p>

                  <div className={styles.wordGrid}>
                    {currentLine.words.map(
                      (word) => (
                        <button
                          key={word.s}
                          className={`${styles.wordButton} ${
                            selectedWord?.s ===
                            word.s
                              ? styles.wordSelected
                              : ""
                          }`}
                          onClick={() =>
                            setSelectedWord(word)
                          }
                        >
                          {word.s}
                        </button>
                      )
                    )}
                  </div>

                  {selectedWord && (
                    <div
                      className={
                        styles.wordMeaning
                      }
                    >
                      <span
                        className={
                          styles.meaningWord
                        }
                      >
                        {selectedWord.s}
                      </span>

                      <span
                        className={
                          styles.meaningTranslation
                        }
                      >
                        {selectedWord.g}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <p className={styles.tapHint}>
                  No Sanskrit line was found.
                </p>
              )}
            </div>

            <button
              className={styles.actionButton}
              disabled={!selectedWord}
              onClick={handleContinueLine}
            >
              {lineIndex === lines.length - 1
                ? "CONTINUE"
                : "NEXT LINE"}
            </button>
          </>
        )}

        {/* PRO TIP */}

        {screen === "tip" && (
          <>
            <div className={styles.sectionPill}>
              VERSE {lesson.ref}
            </div>

            <p className={styles.screenType}>
              GO DEEPER
            </p>

            <h1>Pro Tip</h1>

            <div className={styles.proTipBox}>
              <div className={styles.tipIcon}>
                💡
              </div>

              <p>
                {lesson.proTip ??
                  lesson.teaching ??
                  "Look closely at how each Sanskrit word contributes to the meaning of the verse."}
              </p>
            </div>

            {lesson.apply && (
              <div className={styles.applyBox}>
                <span>TRY THIS</span>

                <p>{lesson.apply}</p>
              </div>
            )}

            <button
              className={styles.actionButton}
              onClick={startRebuild}
            >
              TEST YOURSELF
            </button>
          </>
        )}

        {/* REBUILD GAME */}

        {screen === "rebuild" && (
          <>
            <div className={styles.sectionPill}>
              TEST YOURSELF
            </div>

            <p className={styles.screenType}>
              REBUILD PART {rebuildPart + 1} OF{" "}
              {rebuildParts.length}
            </p>

            <h1>
              Match the meanings to the Sanskrit
              words
            </h1>

            <p className={styles.tapHint}>
              Tap a meaning, then choose its
              matching Sanskrit word.
            </p>

            {/* ENGLISH MEANING BLOCKS */}

            <div className={styles.options}>
              {currentRebuildWords.map(
                (word, index) => {
                  const answer =
                    rebuildAnswers[index];

                  const isLocked =
                    lockedAnswers.has(index);

                  const isWrong =
                    wrongAnswers.has(index);

                  return (
                    <button
                      key={`${word.g}-${index}`}
                      disabled={
                        isLocked || isWrong
                      }
                      className={`${styles.option} ${
                        selectedMeaningIndex ===
                        index
                          ? styles.selected
                          : ""
                      } ${
                        isLocked
                          ? styles.correctMeaning
                          : ""
                      } ${
                        isWrong
                          ? styles.wrongMeaning
                          : ""
                      }`}
                      onClick={() =>
                        handleMeaningClick(index)
                      }
                    >
                      <span
                        className={
                          styles.englishMeaning
                        }
                      >
                        {word.g}
                      </span>

                      {answer && (
                        <span
                          className={
                            styles.landedSanskrit
                          }
                        >
                          {answer}
                        </span>
                      )}
                    </button>
                  );
                }
              )}
            </div>

            {/* SANSKRIT CHOICES */}

            <div
              className={styles.wordGrid}
              style={{
                marginTop: "24px",
              }}
            >
              {shuffledOptions.map((word) => {
                const alreadyUsed =
                  rebuildAnswers.includes(
                    word.s
                  );

                return (
                  <button
                    key={word.s}
                    className={`${styles.wordButton} ${
                      alreadyUsed
                        ? styles.matchedWord
                        : ""
                    }`}
                    disabled={
                      alreadyUsed ||
                      selectedMeaningIndex ===
                        null
                    }
                    onClick={() =>
                      handleSanskritClick(word.s)
                    }
                  >
                    {word.s}
                  </button>
                );
              })}
            </div>

            <button
              className={styles.actionButton}
              disabled={
                rebuildAnswers.length === 0 ||
                rebuildAnswers.some(
                  (answer) => answer === null
                ) ||
                wrongAnswers.size > 0
              }
              onClick={handleCheckRebuild}
            >
              CHECK
            </button>
          </>
        )}

        {/* FEEDBACK */}

        {screen === "feedback" && (
          <>
            <div
              className={`${styles.feedbackBox} ${
                lastAnswerCorrect
                  ? styles.correctFeedback
                  : styles.wrongFeedback
              }`}
            >
              <div className={styles.feedbackIcon}>
                {lastAnswerCorrect ? "✓" : "!"}
              </div>

              <h1>
                {lastAnswerCorrect
                  ? "Perfect!"
                  : "Not quite"}
              </h1>

              <p>
                You correctly rebuilt this part of
                the verse.
              </p>
            </div>

            <div
              className={styles.verseBox}
              style={{
                marginTop: "20px",
              }}
            >
              <p className={styles.tapHint}>
                Correct translation pairs
              </p>

              <div className={styles.wordGrid}>
                {currentRebuildWords.map(
                  (word) => (
                    <div
                      key={word.s}
                      className={
                        styles.wordMeaning
                      }
                    >
                      <span
                        className={
                          styles.meaningWord
                        }
                      >
                        {word.s}
                      </span>

                      <span
                        className={
                          styles.meaningTranslation
                        }
                      >
                        {word.g}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>

            <button
              className={styles.actionButton}
              onClick={moveToNextRebuildPart}
            >
              {rebuildPart <
              rebuildParts.length - 1
                ? "NEXT PART"
                : "NEXT VERSE"}
            </button>
          </>
        )}
      </section>
    </main>
  );
}