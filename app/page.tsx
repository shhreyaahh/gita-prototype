"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Flame,
  Heart,
  Lock,
  Home as HomeIcon,
  Trophy,
  Dumbbell,
  MoreHorizontal,
  Sparkles,
} from "lucide-react";

export default function Home() {
  const [level1Completed, setLevel1Completed] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem("level1Completed") === "true";
    setLevel1Completed(completed);
  }, []);

  return (
    <main>
      <div className="app-container">

        {/* TOP STATS */}
        <header className="stats-bar">
          <div className="stat">
            <BookOpen size={22} className="gita-stat-icon" />
            <span className="stat-value">1</span>
          </div>

          <div className="stat">
            <Flame size={24} className="streak-stat-icon" />
            <span className="stat-value">4</span>
          </div>

          <div className="stat">
            <Heart size={22} className="heart-stat-icon" fill="currentColor" />
            <span className="stat-value">10</span>
          </div>
        </header>

        {/* CHAPTER BANNER */}
        <section className="chapter-banner">
          <div className="chapter-content">
            <p className="chapter-label">CHAPTER 1</p>
            <h1>Arjuna Vishada Yoga</h1>
          </div>

          <div className="chapter-action">
            <BookOpen size={34} />
            <Sparkles size={14} className="chapter-sparkle" />
          </div>
        </section>

        {/* LESSON PATH */}
        <section className="path-section">
          <div className="lesson-path">

            {/* simple dotted path decorations */}
            <div className="path-line line-1" />
            <div className="path-line line-2" />
            <div className="path-line line-3" />
            <div className="path-line line-4" />

            {/* LEVEL 1 */}
            <Link
              href="/level/1"
              className={`lesson-node node-1 ${
                level1Completed ? "completed" : "current"
              }`}
            >
              {level1Completed ? "✓" : "1"}
            </Link>

            {/* LEVEL 2 */}
            <div
              className={`lesson-node node-2 ${
                level1Completed ? "unlocked" : "locked"
              }`}
            >
              {level1Completed ? "2" : <Lock size={24} />}
            </div>

            {/* LEVEL 3 */}
            <div className="lesson-node node-3 locked">
              <Lock size={24} />
            </div>

            {/* LEVEL 4 */}
            <div className="lesson-node node-4 locked">
              <Lock size={24} />
            </div>

            {/* LEVEL 5 */}
            <div className="lesson-node node-5 locked">
              <Lock size={24} />
            </div>

          </div>
        </section>

        {/* BOTTOM NAV */}
        <nav className="bottom-nav">

          <div className="nav-item active">
            <HomeIcon size={25} fill="currentColor" />
            <span>Journey</span>
          </div>

          <div className="nav-item">
            <BookOpen size={25} />
            <span>Learn</span>
          </div>

          <div className="nav-item">
            <Trophy size={25} />
            <span>Challenges</span>
          </div>

          <div className="nav-item">
            <Dumbbell size={25} />
            <span>Practice</span>
          </div>

          <div className="nav-item">
            <MoreHorizontal size={28} />
            <span>More</span>
          </div>

        </nav>

      </div>
    </main>
  );
}