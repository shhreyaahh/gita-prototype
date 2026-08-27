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

type Screen = "story" | "line" | "tip" | "game" | "feedback" | "complete";

type GameType = "rebuild" | "match" | "fill";

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

export default function LevelOnePage() {
  const lessons = level1 as Lesson[];

  const [lessonIndex, setLessonIndex] = useState(0);
  const [screen, setScreen] = useState<Screen>("story");

  const [lineIndex, setLineIndex] = useState(0);

  const [selectedWord, setSelectedWord] = useState<Word | null>(null);

  const [hearts, setHearts] = useState(10);
  const [score, setScore] = useState(0);

  /*
    GAME STATE
  */

  // Rebuild + Match
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const [gameAnswers, setGameAnswers] = useState<(string | null)[]>([]);

  const [lockedAnswers, setLockedAnswers] = useState<Set<number>>(new Set());

  const [wrongAnswers, setWrongAnswers] = useState<Set<number>>(new Set());

  // Fill
  const [fillAnswer, setFillAnswer] = useState<string | null>(null);

  const [fillResult, setFillResult] = useState<boolean | null>(null);

  const lesson = lessons[lessonIndex];

  const lines = (lesson?.lines ?? []).map((line) => ({
    text: line.text ?? line.t ?? "",
    words: line.words ?? line.ws ?? [],
  }));

  const currentLine = lines[lineIndex];

  /*
    GAME ROTATION

    Verse 1 → Rebuild
    Verse 2 → Match
    Verse 3 → Fill
    Verse 4 → Rebuild
    ...
  */
  const gameType: GameType =
    lessonIndex % 3 === 0
      ? "rebuild"
      : lessonIndex % 3 === 1
        ? "match"
        : "fill";

  /*
    IMPORTANT:

    We do NOT test the entire verse in one giant
    13-word game.

    We choose ONE manageable line from the verse
    for the game.
  */
  const gameLineIndex = lines.length > 0 ? lessonIndex % lines.length : 0;

  const gameLine = lines[gameLineIndex] ?? {
    text: "",
    words: [],
  };

  const gameWords = gameLine.words;

  /*
    Stable shuffled game options.
    They only change when moving to another verse.
  */
  const shuffledGameWords = useMemo(() => {
    return shuffle(gameWords);
  }, [lessonIndex]);

  /*
    FILL GAME TARGET

    One word is removed from the selected line.
  */
  const fillTargetIndex =
    gameWords.length > 0 ? lessonIndex % gameWords.length : 0;

  const fillTarget = gameWords[fillTargetIndex];

  const fillOptions = useMemo(() => {
    if (!fillTarget) return [];

    const verseWords = lines.flatMap((line) => line.words);

    const distractors = shuffle(
      verseWords.filter((word) => word.s !== fillTarget.s),
    ).slice(0, 3);

    return shuffle([fillTarget, ...distractors]);
  }, [lessonIndex, fillTargetIndex]);

  /*
    PROGRESS

    Per verse:

    Story
    Line 1
    Line 2
    Line 3
    Pro Tip
    Game
    Feedback
  */
  const totalSteps = lessons.reduce((total, item) => {
    return total + item.lines.length + 4;
  }, 0);

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

  if (screen === "game") {
    currentStep += 2 + lines.length;
  }

  if (screen === "feedback") {
    currentStep += 3 + lines.length;
  }

  const progress =
    totalSteps > 0 ? Math.min((currentStep / totalSteps) * 100, 100) : 0;

  /*
    STORY
  */
  function handleContinueStory() {
    setLineIndex(0);
    setSelectedWord(null);

    if (lines.length > 0) {
      setScreen("line");
    } else {
      setScreen("tip");
    }
  }

  /*
    LINE LEARNING
  */
  function handleContinueLine() {
    if (!selectedWord) return;

    const isLastLine = lineIndex >= lines.length - 1;

    if (isLastLine) {
      setSelectedWord(null);
      setScreen("tip");
      return;
    }

    setLineIndex((previous) => previous + 1);
    setSelectedWord(null);
  }

  /*
    START GAME
  */
  function startGame() {
    setSelectedIndex(null);

    setGameAnswers(Array(gameWords.length).fill(null));

    setLockedAnswers(new Set());
    setWrongAnswers(new Set());

    setFillAnswer(null);
    setFillResult(null);

    setScreen("game");
  }

  /*
    =========================
    REBUILD GAME
    =========================

    Tap Sanskrit word
    ↓
    Tap correct position
  */
  function handleRebuildWordClick(word: string) {
    if (gameAnswers.includes(word)) return;

    const wordIndex = shuffledGameWords.findIndex((item) => item.s === word);

    setSelectedIndex(wordIndex);
  }

  function handleRebuildSlotClick(index: number) {
    if (lockedAnswers.has(index)) return;

    if (gameAnswers[index] !== null) {
      setGameAnswers((previous) => {
        const updated = [...previous];
        updated[index] = null;
        return updated;
      });

      return;
    }

    if (selectedIndex === null) return;

    const selected = shuffledGameWords[selectedIndex];

    if (!selected) return;

    setGameAnswers((previous) => {
      const updated = [...previous];

      const existingIndex = updated.findIndex(
        (answer) => answer === selected.s,
      );

      if (
        existingIndex !== -1 &&
        existingIndex !== index &&
        !lockedAnswers.has(existingIndex)
      ) {
        updated[existingIndex] = null;
      }

      updated[index] = selected.s;

      return updated;
    });

    setSelectedIndex(null);
  }

  function checkRebuildGame() {
    if (
      gameAnswers.length === 0 ||
      gameAnswers.some((answer) => answer === null)
    ) {
      return;
    }

    const correct = new Set<number>();
    const wrong = new Set<number>();

    gameWords.forEach((word, index) => {
      if (gameAnswers[index] === word.s) {
        correct.add(index);
      } else {
        wrong.add(index);
      }
    });

    setLockedAnswers(correct);
    setWrongAnswers(wrong);

    if (wrong.size === 0) {
      handleGameSuccess();
      return;
    }

    handleGameWrong(wrong);
  }

  /*
    =========================
    MATCH GAME
    =========================

    Tap English meaning
    ↓
    Tap matching Sanskrit word
  */
  function handleMatchMeaningClick(index: number) {
    if (lockedAnswers.has(index)) return;
    if (wrongAnswers.has(index)) return;

    if (gameAnswers[index] !== null) {
      setGameAnswers((previous) => {
        const updated = [...previous];
        updated[index] = null;
        return updated;
      });

      setSelectedIndex(null);
      return;
    }

    setSelectedIndex(index);
  }

  function handleMatchSanskritClick(word: string) {
    if (selectedIndex === null) return;

    setGameAnswers((previous) => {
      const updated = [...previous];

      const existingIndex = updated.findIndex((answer) => answer === word);

      if (
        existingIndex !== -1 &&
        existingIndex !== selectedIndex &&
        !lockedAnswers.has(existingIndex)
      ) {
        updated[existingIndex] = null;
      }

      updated[selectedIndex] = word;

      return updated;
    });

    setSelectedIndex(null);
  }

  function checkMatchGame() {
    if (
      gameAnswers.length === 0 ||
      gameAnswers.some((answer) => answer === null)
    ) {
      return;
    }

    const correct = new Set<number>();
    const wrong = new Set<number>();

    gameWords.forEach((word, index) => {
      if (gameAnswers[index] === word.s) {
        correct.add(index);
      } else {
        wrong.add(index);
      }
    });

    setLockedAnswers(correct);
    setWrongAnswers(wrong);

    if (wrong.size === 0) {
      handleGameSuccess();
      return;
    }

    handleGameWrong(wrong);
  }

  /*
    =========================
    FILL GAME
    =========================
  */
  function handleFillAnswer(word: string) {
    if (!fillTarget) return;
    if (fillAnswer !== null) return;

    const isCorrect = word === fillTarget.s;

    setFillAnswer(word);
    setFillResult(isCorrect);

    if (isCorrect) {
      handleGameSuccess();
      return;
    }

    setHearts((previous) => Math.max(previous - 1, 0));

    setTimeout(() => {
      setFillAnswer(null);
      setFillResult(null);
    }, 650);
  }

  /*
    =========================
    GAME SUCCESS
    =========================
  */
  function handleGameSuccess() {
    setScore((previous) => previous + 1);

    setHearts((previous) => Math.min(previous + 1, 10));

    setTimeout(() => {
      setScreen("feedback");
    }, 650);
  }

  /*
    =========================
    GAME WRONG
    =========================
  */
  function handleGameWrong(wrongIndexes: Set<number>) {
    setHearts((previous) => Math.max(previous - 1, 0));

    setSelectedIndex(null);

    setTimeout(() => {
      setGameAnswers((previous) =>
        previous.map((answer, index) =>
          wrongIndexes.has(index) ? null : answer,
        ),
      );

      setWrongAnswers(new Set());
    }, 650);
  }

  /*
    NEXT VERSE
  */
  function handleNextVerse() {
    const isLastLesson = lessonIndex === lessons.length - 1;

    if (isLastLesson) {
      localStorage.setItem("level1Completed", "true");

      setScreen("complete");
      return;
    }

    setLessonIndex((previous) => previous + 1);

    setLineIndex(0);
    setSelectedWord(null);

    setSelectedIndex(null);
    setGameAnswers([]);

    setLockedAnswers(new Set());
    setWrongAnswers(new Set());

    setFillAnswer(null);
    setFillResult(null);

    setScreen("story");
  }

  /*
    GAME TEXT
  */
  const gameTitle =
    gameType === "rebuild"
      ? "Rebuild the line"
      : gameType === "match"
        ? "Match the meanings"
        : "Fill in the missing word";

  const gameInstruction =
    gameType === "rebuild"
      ? "Choose the Sanskrit words and place them in the correct order."
      : gameType === "match"
        ? "Tap a meaning, then choose its matching Sanskrit word."
        : "Choose the Sanskrit word that correctly completes the line.";

  if (!lesson) {
    return (
      <main className={styles.game}>
        <p>Lesson not found.</p>
      </main>
    );
  }

  /*
    COMPLETE
  */
  if (screen === "complete") {
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
            <span>Games completed</span>
            <strong>{score}</strong>
          </div>

          <Link href="/" className={styles.completeButton}>
            CONTINUE JOURNEY
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.game}>
      <header className={styles.header}>
        <Link href="/" className={styles.close} aria-label="Close lesson">
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
          <span className={styles.hearts}>❤️ {hearts}</span>

          <span className={styles.counter}>{lesson.ref}</span>
        </div>
      </header>

      <section className={styles.content}>
        {/* STORY */}

        {screen === "story" && (
          <>
            <div className={styles.sectionPill}>VERSE {lesson.ref}</div>

            <p className={styles.screenType}>LEARN</p>

            <h1>{lesson.title}</h1>

            <div className={styles.storyBox}>
              <div className={styles.boxIcon}>📖</div>

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

        {/* LINE BY LINE LEARNING */}

        {screen === "line" && (
          <>
            <div className={styles.sectionPill}>VERSE {lesson.ref}</div>

            <p className={styles.screenType}>WORD BY WORD</p>

            <h1>{lesson.title}</h1>

            <div key={lineIndex} className={styles.verseBox}>
              {currentLine ? (
                <>
                  <div className={styles.lineCounter}>
                    LINE {lineIndex + 1} OF {lines.length}
                  </div>

                  <p className={styles.sanskritText}>{currentLine.text}</p>

                  <p className={styles.tapHint}>
                    Tap a word to discover its meaning
                  </p>

                  <div className={styles.wordGrid}>
                    {currentLine.words.map((word) => (
                      <button
                        key={word.s}
                        className={`${styles.wordButton} ${
                          selectedWord?.s === word.s ? styles.wordSelected : ""
                        }`}
                        onClick={() => setSelectedWord(word)}
                      >
                        {word.s}
                      </button>
                    ))}
                  </div>

                  {selectedWord && (
                    <div className={styles.wordMeaning}>
                      <span className={styles.meaningWord}>
                        {selectedWord.s}
                      </span>

                      <span className={styles.meaningTranslation}>
                        {selectedWord.g}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <p className={styles.tapHint}>No Sanskrit line was found.</p>
              )}
            </div>

            <button
              className={styles.actionButton}
              disabled={!selectedWord}
              onClick={handleContinueLine}
            >
              {lineIndex === lines.length - 1 ? "CONTINUE" : "NEXT LINE"}
            </button>
          </>
        )}

        {/* PRO TIP */}

        {screen === "tip" && (
          <div className={styles.proTipPopup}>
            <div className={styles.proTipPopupTop}>
              <div className={styles.tipIcon}>💡</div>

              <div>
                <p className={styles.proTipEyebrow}>VERSE {lesson.ref}</p>

                <h1>Pro Tip</h1>
              </div>
            </div>

            <div className={styles.proTipContent}>
              <p className={styles.proTipText}>
                {lesson.proTip ??
                  lesson.teaching ??
                  "Look closely at how each Sanskrit word contributes to the meaning of the verse."}
              </p>

              {lesson.apply && (
                <div className={styles.proTipApply}>
                  <span>TRY THIS</span>

                  <p>{lesson.apply}</p>
                </div>
              )}
            </div>

            <button
              className={`${styles.actionButton} ${styles.proTipButton}`}
              onClick={startGame}
            >
              TEST YOURSELF
            </button>
          </div>
        )}

        {/* SINGLE GAME */}

        {screen === "game" && (
          <>
            <div className={styles.sectionPill}>TEST YOURSELF</div>

            <p className={styles.screenType}>
              {gameType === "rebuild"
                ? "REBUILD"
                : gameType === "match"
                  ? "MATCH"
                  : "FILL THE BLANK"}
            </p>

            <h1>{gameTitle}</h1>

            <p className={styles.tapHint}>{gameInstruction}</p>

            {/* REBUILD */}
            {/* REBUILD */}

            {gameType === "rebuild" && (
              <>
                <div className={styles.rebuildSlots}>
                  {gameWords.map((word, index) => {
                    const answer = gameAnswers[index];

                    const isLocked = lockedAnswers.has(index);

                    const isWrong = wrongAnswers.has(index);

                    const isEmpty = answer === null;

                    const isWordSelected = selectedIndex !== null;

                    return (
                      <button
                        key={`${word.s}-${index}`}
                        disabled={isLocked || isWrong}
                        className={`${styles.rebuildSlot} ${
                          isEmpty ? styles.empty : styles.filled
                        } ${
                          isEmpty && isWordSelected ? styles.available : ""
                        } ${isLocked ? styles.correctMeaning : ""} ${
                          isWrong ? styles.wrongMeaning : ""
                        }`}
                        onClick={() => handleRebuildSlotClick(index)}
                      >
                        {answer && (
                          <span className={styles.landedSanskrit}>
                            {answer}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* KEEP YOUR EXISTING WORD BANK BELOW */}
                <div
                  className={styles.wordGrid}
                  style={{
                    marginTop: "24px",
                  }}
                >
                  {shuffledGameWords.map((word, index) => {
                    const used = gameAnswers.includes(word.s);

                    return (
                      <button
                        key={word.s}
                        disabled={used}
                        className={`${styles.wordButton} ${
                          selectedIndex === index ? styles.wordSelected : ""
                        } ${used ? styles.matchedWord : ""}`}
                        onClick={() => handleRebuildWordClick(word.s)}
                      >
                        {word.s}
                      </button>
                    );
                  })}
                </div>

                <button
                  className={styles.actionButton}
                  disabled={
                    gameAnswers.some((answer) => answer === null) ||
                    wrongAnswers.size > 0
                  }
                  onClick={checkRebuildGame}
                >
                  CHECK
                </button>
              </>
            )}

            {/* MATCH */}

            {gameType === "match" && (
              <>
                <div
                  className={styles.options}
                  style={{
                    marginTop: "24px",
                  }}
                >
                  {gameWords.map((word, index) => {
                    const answer = gameAnswers[index];

                    const isLocked = lockedAnswers.has(index);

                    const isWrong = wrongAnswers.has(index);

                    return (
                      <button
                        key={`${word.g}-${index}`}
                        disabled={isLocked || isWrong}
                        className={`${styles.option} ${
                          selectedIndex === index ? styles.selected : ""
                        } ${isLocked ? styles.correctMeaning : ""} ${
                          isWrong ? styles.wrongMeaning : ""
                        }`}
                        onClick={() => handleMatchMeaningClick(index)}
                      >
                        <span className={styles.englishMeaning}>{word.g}</span>

                        {answer && (
                          <span className={styles.landedSanskrit}>
                            {answer}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div
                  className={styles.wordGrid}
                  style={{
                    marginTop: "24px",
                  }}
                >
                  {shuffledGameWords.map((word) => {
                    const used = gameAnswers.includes(word.s);

                    return (
                      <button
                        key={word.s}
                        disabled={used || selectedIndex === null}
                        className={`${styles.wordButton} ${
                          used ? styles.matchedWord : ""
                        }`}
                        onClick={() => handleMatchSanskritClick(word.s)}
                      >
                        {word.s}
                      </button>
                    );
                  })}
                </div>

                <button
                  className={styles.actionButton}
                  disabled={
                    gameAnswers.some((answer) => answer === null) ||
                    wrongAnswers.size > 0
                  }
                  onClick={checkMatchGame}
                >
                  CHECK
                </button>
              </>
            )}

            {/* FILL THE BLANK */}

            {gameType === "fill" && fillTarget && (
              <>
                <div
                  className={styles.verseBox}
                  style={{
                    marginTop: "24px",
                  }}
                >
                  <p className={styles.sanskritText}>
                    {gameWords
                      .map((word, index) =>
                        index === fillTargetIndex ? "‎ " : word.s,
                      )
                      .join(" ")}
                  </p>

                  <div className={styles.wordMeaning}>
                    <span className={styles.meaningTranslation}>
                      Hint: {fillTarget.g}
                    </span>
                  </div>
                </div>

                <div
                  className={styles.wordGrid}
                  style={{
                    marginTop: "24px",
                  }}
                >
                  {fillOptions.map((word) => {
                    const selected = fillAnswer === word.s;

                    const isCorrect = selected && fillResult === true;

                    const isWrong = selected && fillResult === false;

                    return (
                      <button
                        key={word.s}
                        disabled={fillAnswer !== null}
                        className={`${styles.wordButton} ${
                          isCorrect ? styles.matchedWord : ""
                        } ${isWrong ? styles.wrongMeaning : ""}`}
                        onClick={() => handleFillAnswer(word.s)}
                      >
                        {word.s}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* FEEDBACK */}

        {screen === "feedback" && (
          <>
            <div className={`${styles.feedbackBox} ${styles.correctFeedback}`}>
              <div className={styles.feedbackIcon}>✓</div>

              <h1>Perfect!</h1>

              <p>You completed this challenge correctly.</p>
            </div>

            <div
              className={styles.verseBox}
              style={{
                marginTop: "20px",
              }}
            >
              <p className={styles.tapHint}>The line you just practiced</p>

              <p className={styles.sanskritText}>{gameLine.text}</p>
            </div>

            <button className={styles.actionButton} onClick={handleNextVerse}>
              NEXT VERSE
            </button>
          </>
        )}
      </section>
    </main>
  );
}
