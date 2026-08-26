"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import { level1 } from "../../../data/level1";

export default function LevelOnePage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<string[]>([]);
  const [selectedBlanks, setSelectedBlanks] = useState<string[]>([]);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);

  const [score, setScore] = useState(0);
  const [hearts, setHearts] = useState(10);
  const [gameOver, setGameOver] = useState(false);
  const [completed, setCompleted] = useState(false);

  const currentQuestion = level1[currentStep];

  const handleAnswer = (answer: string) => {
    if (!checked) {
      setSelectedAnswer(answer);
    }
  };

  const handleOrderAnswer = (answer: string) => {
    if (!checked && !selectedOrder.includes(answer)) {
      setSelectedOrder([...selectedOrder, answer]);
    }
  };

  const handleMultiBlankAnswer = (answer: string) => {
    if (!checked && !selectedBlanks.includes(answer)) {
      setSelectedBlanks([...selectedBlanks, answer]);
    }
  };

  const handleMatch = (right: string) => {
    if (!selectedLeft || checked) return;

    const rightAlreadyUsed = Object.values(matches).includes(right);

    if (rightAlreadyUsed) return;

    setMatches((previousMatches) => ({
      ...previousMatches,
      [selectedLeft]: right,
    }));

    setSelectedLeft(null);
  };

  const handleCheck = () => {
    if (currentQuestion.type === "tap-order") {
      if (selectedOrder.length !== currentQuestion.options!.length) return;
    }

    if (currentQuestion.type === "multi-blank") {
      if (selectedBlanks.length !== (currentQuestion.correctAnswer as string[]).length) return;
    }

    if (currentQuestion.type === "match-pairs") {
      if (Object.keys(matches).length !== currentQuestion.pairs!.length) return;
    }

    if (
      currentQuestion.type !== "tap-order" &&
      currentQuestion.type !== "multi-blank" &&
      currentQuestion.type !== "match-pairs" &&
      !selectedAnswer
    ) {
      return;
    }

    setChecked(true);

    if (isCorrect()) {
      setScore((previousScore) => previousScore + 1);
    } else {
      setHearts((previousHearts) => {
        const newHearts = previousHearts - 1;

        if (newHearts <= 0) {
          setGameOver(true);
        }

        return newHearts;
      });
    }
  };

  const isCorrect = () => {
    if (currentQuestion.type === "tap-order") {
      return (
        JSON.stringify(selectedOrder) ===
        JSON.stringify(currentQuestion.correctAnswer)
      );
    }

    if (currentQuestion.type === "multi-blank") {
      return (
        JSON.stringify(selectedBlanks) ===
        JSON.stringify(currentQuestion.correctAnswer)
      );
    }

    if (currentQuestion.type === "match-pairs") {
      return currentQuestion.pairs!.every(
        (pair: { left: string; right: string }) =>
          matches[pair.left] === pair.right
      );
    }

    return selectedAnswer === currentQuestion.correctAnswer;
  };

  const answerCorrect = isCorrect();

  const handleNext = () => {
    if (currentStep === level1.length - 1) {
      localStorage.setItem("level1Completed", "true");
      setCompleted(true);
      return;
    }

    setCurrentStep((previousStep) => previousStep + 1);
    setSelectedAnswer(null);
    setSelectedOrder([]);
    setSelectedBlanks([]);
    setSelectedLeft(null);
    setMatches({});
    setChecked(false);
  };

  if (gameOver) {
    return (
      <main className={styles.game}>
        <section className={styles.completeScreen}>
          <div className={styles.completeIcon}>🙏</div>

          <p className={styles.completeLabel}>OUT OF HEARTS</p>

          <h1>Take another shot</h1>

          <p className={styles.completeText}>
            Review what you learned and try Level 1 again.
          </p>

          <button
            className={styles.actionButton}
            onClick={() => window.location.reload()}
          >
            TRY AGAIN
          </button>
        </section>
      </main>
    );
  }

  if (completed) {
    return (
      <main className={styles.game}>
        <section className={styles.completeScreen}>
          <div className={styles.completeIcon}>🏹</div>

          <p className={styles.completeLabel}>CHAPTER 1 COMPLETE</p>

          <h1>Arjuna's Dilemma</h1>

          <p className={styles.completeText}>
            You completed your first step into the Bhagavad Gita.
          </p>

          <div className={styles.scoreCard}>
            <span>Your score</span>
            <strong>
              {score}/{level1.length}
            </strong>
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
        <Link href="/" className={styles.close}>
          ✕
        </Link>

        <div className={styles.progressTrack}>
          <div
            className={styles.progress}
            style={{
              width: `${((currentStep + 1) / level1.length) * 100}%`,
            }}
          />
        </div>

        <div className={styles.gameStats}>
          <span className={styles.hearts}>❤️ {hearts}</span>

          <span className={styles.counter}>
            {currentStep + 1}/{level1.length}
          </span>
        </div>
      </header>

      <section className={styles.content}>
        <h1>{currentQuestion.question}</h1>

        {currentQuestion.type === "fill-blank" && (
          <div className={styles.blank}>
            {selectedAnswer || " ‎ "}
          </div>
        )}

        {currentQuestion.type === "multi-blank" && (
          <div className={styles.multiBlankPreview}>
            {selectedBlanks.length === 0
              ? "Tap the words below to fill the blanks"
              : selectedBlanks.map((word, index) => (
                  <span key={word}>
                    {index > 0 && " "}
                    {word}
                  </span>
                ))}
          </div>
        )}

        {currentQuestion.type === "tap-order" && (
          <div className={styles.orderPreview}>
            {selectedOrder.length === 0
              ? "Tap the events below in order"
              : selectedOrder.map((item, index) => (
                  <div key={item}>
                    {index + 1}. {item}
                  </div>
                ))}
          </div>
        )}

        {currentQuestion.type === "match-pairs" && (
          <div className={styles.matchGame}>
            <div className={styles.matchColumn}>
              {currentQuestion.pairs!.map(
                (pair: { left: string; right: string }) => {
                  const isMatched = matches[pair.left] !== undefined;

                  return (
                    <button
                      key={pair.left}
                      type="button"
                      className={`${styles.matchButton} ${
                        selectedLeft === pair.left
                          ? styles.matchSelected
                          : ""
                      } ${isMatched ? styles.matched : ""}`}
                      disabled={isMatched || checked}
                      onClick={() => setSelectedLeft(pair.left)}
                    >
                      {pair.left}
                    </button>
                  );
                }
              )}
            </div>

            <div className={styles.matchColumn}>
              {[
                currentQuestion.pairs![1],
                currentQuestion.pairs![2],
                currentQuestion.pairs![0],
              ].map((pair: { left: string; right: string }) => {
                const isUsed = Object.values(matches).includes(pair.right);

                return (
                  <button
                    key={pair.right}
                    type="button"
                    className={`${styles.matchButton} ${
                      isUsed ? styles.matched : ""
                    }`}
                    disabled={isUsed || checked}
                    onClick={() => handleMatch(pair.right)}
                  >
                    {pair.right}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {currentQuestion.type !== "match-pairs" && (
          <div className={styles.options}>
            {currentQuestion.options!.map((option: string) => {
              const isOrderQuestion =
                currentQuestion.type === "tap-order";

              const isMultiBlank =
                currentQuestion.type === "multi-blank";

              const isSelected = isOrderQuestion
                ? selectedOrder.includes(option)
                : isMultiBlank
                ? selectedBlanks.includes(option)
                : selectedAnswer === option;

              let optionClass = styles.option;

              if (isSelected) {
                optionClass += ` ${styles.selected}`;
              }

              if (
                checked &&
                !isOrderQuestion &&
                !isMultiBlank &&
                option === currentQuestion.correctAnswer
              ) {
                optionClass += ` ${styles.correct}`;
              }

              if (
                checked &&
                !isOrderQuestion &&
                !isMultiBlank &&
                option === selectedAnswer &&
                option !== currentQuestion.correctAnswer
              ) {
                optionClass += ` ${styles.wrong}`;
              }

              return (
                <button
                  key={option}
                  type="button"
                  className={optionClass}
                  onClick={() => {
                    if (isOrderQuestion) {
                      handleOrderAnswer(option);
                    } else if (isMultiBlank) {
                      handleMultiBlankAnswer(option);
                    } else {
                      handleAnswer(option);
                    }
                  }}
                >
                  {isOrderQuestion && selectedOrder.includes(option)
                    ? `${selectedOrder.indexOf(option) + 1}. `
                    : ""}

                  {isMultiBlank && selectedBlanks.includes(option)
                    ? `${selectedBlanks.indexOf(option) + 1}. `
                    : ""}

                  {option}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <footer className={styles.footer}>
        {!checked ? (
          <button
            type="button"
            className={styles.actionButton}
            onClick={handleCheck}
          >
            CHECK
          </button>
        ) : (
          <div
            className={`${styles.feedback} ${
              answerCorrect
                ? styles.correctFeedback
                : styles.wrongFeedback
            }`}
          >
            <div>
              <strong>
                {answerCorrect ? "Correct!" : "Not quite!"}
              </strong>

              <p>{currentQuestion.explanation}</p>
            </div>

            <button
              type="button"
              className={styles.actionButton}
              onClick={handleNext}
            >
              CONTINUE
            </button>
          </div>
        )}
      </footer>
    </main>
  );
}