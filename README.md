# QUICKFIRE — Multiplayer Progressive Trivia Game

QUICKFIRE is a real-time online multiplayer progressive trivia game where players compete to answer questions faster than everyone else.

---

## ⚡ Core Game Mechanics

1. **First-Correct-Answer Scoring**: Only the first player to submit an eligible correct answer scores a point. Authoritative server-side receipt order and atomic scoring guarantee no dual-point race conditions.
2. **Independent Progression**: Each player advances independently without waiting for or blocking other players.
   - **Formula**: `requiredCorrectAnswers = 2 + currentRound`
     - Round 1: 3 correct answers
     - Round 2: 4 correct answers
     - Round 3: 5 correct answers
     - Round $N$: $2 + N$
   - Round progress counter resets to zero upon entering each new round.
   - Question difficulty escalates with the player's round (Easy $\to$ Medium $\to$ Hard).
3. **Anti-Cheat Focus Detection**: Detects browser tab-switching and window unfocus during active questions:
   - **1st Violation**: Warning notification banner.
   - **2nd Violation**: 5-second answer submission lockout.
   - **3rd Violation**: Deduction of 1 earned point.
   - **4th Violation**: Match disqualification.
   - Overlapping `blur` and `visibilitychange` events are deduplicated with a configurable grace period.
4. **Winning Condition**: First player to complete **Round 10** (or the configurable target round in custom lobbies, e.g. Round 3 Blitz or Round 5) wins the match.
5. **Reconnection & State Resynchronization**: Preserves player session tokens in `localStorage` with a 60-second grace period for instant resynchronization upon page reload or network drop.
6. **Local Test Mode & Simulated AI Opponents**: Hosts can enable Local Test Mode to play solo or add simulated AI opponents with human-like response timings and accuracy to test competitive head-to-head racing immediately.

---

## 🏗️ Architecture & Project Structure

Organized into modular workspaces:

```
geeg/
├── client/              # React 19 + TypeScript + Vite + Tailwind CSS frontend
│   ├── src/
│   │   ├── components/  # HomeScreen, LobbyScreen, GameplayScreen, ResultsScreen, Navbar, RulesModal
│   │   ├── services/    # Socket.IO connection & session persistence
│   │   └── utils/       # Web Audio API sound synthesizer
│   └── vite.config.ts   # Dev proxy to server
├── server/              # Authoritative multiplayer server (Node.js + Express + Socket.IO)
│   ├── src/
│   │   ├── data/        # Curated Question Bank (Text & Image questions)
│   │   ├── db/          # Supabase PostgreSQL client with in-memory fallback
│   │   ├── game/        # Match, MatchManager, QuestionManager, AntiCheatEngine
│   │   └── __tests__/   # Vitest automated test suite covering all 17 requirements
│   └── tsconfig.json
├── shared/              # Shared types, Zod schemas, normalization, progression logic
│   └── src/
│       ├── types.ts
│       ├── normalization.ts
│       ├── progression.ts
│       └── validation.ts
└── database/            # Supabase PostgreSQL migration & seed scripts
    ├── schema.sql       # Profiles, questions, matches, submissions, violations tables & RLS
    └── seed.sql         # Initial curated question records
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18+ (tested on Node v24)
- **npm**: v9+

### 1. Install Dependencies

```bash
npm install
```

### 2. Run the Automated Test Suite

Run the full suite of automated unit and integration tests covering all 17 specification requirements:

```bash
npm test
```

### 3. Start Development Servers

Run both the authoritative server (port 3001) and Vite frontend (port 5173) concurrently:

```bash
npm run dev
```

- **Frontend Client**: [http://localhost:5173](http://localhost:5173)
- **Authoritative Server**: [http://localhost:3001](http://localhost:3001)
- **Health Check**: [http://localhost:3001/health](http://localhost:3001/health)

---

## 🗄️ Database & Supabase Configuration

QUICKFIRE automatically runs out of the box using an in-memory Question Bank and Match Store when credentials are not configured.

To connect to Supabase PostgreSQL:
1. Create a project on [Supabase](https://supabase.com).
2. Execute `database/schema.sql` in the Supabase SQL Editor to create tables (`profiles`, `questions`, `matches`, `match_players`, `question_instances`, `answer_submissions`, `focus_violations`) and RLS policies.
3. Execute `database/seed.sql` to populate initial curated questions.
4. Add your Supabase credentials to `server/.env`:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

---

## 🧪 Automated Testing Verification

The automated test suite in `server/src/__tests__/quickfire.test.ts` tests:

1. Two players submitting the correct answer nearly simultaneously (server receipt order arbitration).
2. Only one point being awarded for a shared question instance.
3. Incorrect answers awarding no points and allowing retries.
4. Alternative accepted answers and punctuation/capitalization normalization.
5. Round 1 requiring 3 correct answers.
6. Round 2 requiring 4 correct answers.
7. Round requirements increasing by one each round ($2 + \text{round}$).
8. Independent progression (Player A advancing without altering Player B's state).
9. Questions being assigned according to each player's current round difficulty.
10. Duplicate submissions not awarding duplicate points.
11. Question timeout handling.
12. Reconnection restoring the correct state and session.
13. Duplicate focus events not causing duplicate penalties (debounce grace period).
14. Focus-loss graduated penalties being enforced server-side.
15. Match completion and winner selection upon target round conquest.
16. Private-room join codes (6-character codes).
17. Disconnections and abandoned matches.
