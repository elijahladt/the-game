import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  MatchSummary,
  ClientQuestion,
  LeaderboardEntry,
  PlayerState,
  FocusPenaltyTier,
} from '@quickfire/shared';
import {
  socket,
  saveSessionToken,
  getSavedSessionToken,
  clearSessionToken,
  resolveServerUrl,
} from './services/socket';
import { LocalGameEngine } from './services/localGame';
import { sound } from './utils/sound';
import { Navbar } from './components/Navbar';
import { RulesModal } from './components/RulesModal';
import { ServerConfigModal } from './components/ServerConfigModal';
import { HomeScreen } from './components/HomeScreen';
import { LobbyScreen } from './components/LobbyScreen';
import { GameplayScreen } from './components/GameplayScreen';
import { ResultsScreen } from './components/ResultsScreen';

export function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [username, setUsername] = useState(() => {
    try {
      return localStorage.getItem('quickfire_username') || `Racer${Math.floor(100 + Math.random() * 900)}`;
    } catch {
      return 'Player1';
    }
  });

  const [currentPlayerId, setCurrentPlayerId] = useState<string>('');
  const [match, setMatch] = useState<MatchSummary | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<ClientQuestion | null>(null);
  const [round, setRound] = useState(1);
  const [roundProgress, setRoundProgress] = useState(0);
  const [requiredForRound, setRequiredForRound] = useState(3);
  const [totalScore, setTotalScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // Anti-cheat state
  const [violationsCount, setViolationsCount] = useState(0);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [isDisqualified, setIsDisqualified] = useState(false);

  // Results state
  const [winnerInfo, setWinnerInfo] = useState<{ id: string; name: string } | null>(null);
  const [matchStats, setMatchStats] = useState({ durationSeconds: 0, totalQuestionsAnswered: 0 });

  // UI state
  const [showRules, setShowRules] = useState(false);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [answerFeedback, setAnswerFeedback] = useState<{
    status: 'idle' | 'correct' | 'incorrect' | 'expired';
    message: string;
    earnedPoint?: boolean;
    canonical?: string;
  }>({ status: 'idle', message: '' });

  // Persist username
  const handleUsernameChange = (newName: string) => {
    setUsername(newName);
    try {
      localStorage.setItem('quickfire_username', newName);
    } catch {}
  };

  // Socket setup and listeners
  useEffect(() => {
    const url = resolveServerUrl();
    if (url) {
      socket.connect();
    } else {
      setIsConnected(false);
    }

    const onConnect = () => {
      setIsConnected(true);

      const params = new URLSearchParams(window.location.search);
      const urlRoom = params.get('room');
      const savedToken = getSavedSessionToken();

      if (urlRoom && urlRoom.length === 6) {
        socket.emit('lobby:join', { username, roomCode: urlRoom.toUpperCase() }, (jRes: any) => {
          if (jRes.success) {
            if (jRes.sessionToken) saveSessionToken(jRes.sessionToken);
            if (jRes.playerId) setCurrentPlayerId(jRes.playerId);
            if (jRes.match) setMatch(jRes.match);
          } else if (savedToken) {
            socket.emit('lobby:reconnect', { sessionToken: savedToken }, (rRes: any) => {
              if (rRes.success && rRes.match) {
                setMatch(rRes.match);
              } else {
                clearSessionToken();
              }
            });
          }
        });
      } else if (savedToken) {
        socket.emit('lobby:reconnect', { sessionToken: savedToken }, (res: any) => {
          if (!res.success) {
            clearSessionToken();
          } else if (res.match) {
            setMatch(res.match);
          }
        });
      }
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    const onLobbyUpdated = (data: { match: MatchSummary }) => {
      setMatch(data.match);
      const myP = Object.values(data.match.players).find((p) => p.username === username);
      if (myP) {
        setCurrentPlayerId(myP.id);
      }
      if (data.match.status === 'in_progress') {
        setWinnerInfo(null);
      }
    };

    const onMatchStarted = (data: { match: MatchSummary }) => {
      setMatch(data.match);
      const myP = Object.values(data.match.players).find((p) => p.username === username);
      if (myP) {
        setCurrentPlayerId(myP.id);
      }
      setWinnerInfo(null);
      setAnswerFeedback({ status: 'idle', message: '' });
    };

    const onQuestionAssigned = (data: {
      question: ClientQuestion;
      round: number;
      progress: number;
      required: number;
    }) => {
      setActiveQuestion(data.question);
      setRound(data.round);
      setRoundProgress(data.progress);
      setRequiredForRound(data.required);
      setAnswerFeedback({ status: 'idle', message: '' });
    };

    const onAnswerResult = (data: {
      correct: boolean;
      earnedPoint: boolean;
      canonicalAnswer?: string;
      message: string;
      roundAdvanced?: boolean;
      newRound?: number;
      totalScore: number;
      roundProgress: number;
      requiredForRound: number;
      winnerName?: string;
    }) => {
      setTotalScore(data.totalScore);
      setRoundProgress(data.roundProgress);
      setRequiredForRound(data.requiredForRound);

      if (data.correct) {
        sound.playCorrect();
        setAnswerFeedback({
          status: 'correct',
          message: data.earnedPoint ? 'Correct! +1 Point' : 'Correct, but answered after deadline!',
          earnedPoint: data.earnedPoint,
          canonical: data.canonicalAnswer,
        });
      } else {
        sound.playIncorrect();
        setAnswerFeedback({
          status: 'incorrect',
          message: data.message,
        });
      }

      if (data.roundAdvanced) {
        sound.playRoundUp();
        if (data.newRound) setRound(data.newRound);
      }
    };

    const onPlayerAdvanced = (data: {
      playerId: string;
      username: string;
      newRound: number;
      totalScore: number;
    }) => {
      if (data.playerId !== currentPlayerId) {
        // Another player advanced!
      }
    };

    const onLeaderboardUpdated = (data: { leaderboard: LeaderboardEntry[] }) => {
      setLeaderboard(data.leaderboard);
      const myEntry = data.leaderboard.find((e) => e.playerId === currentPlayerId);
      if (myEntry) {
        setTotalScore(myEntry.totalScore);
        setRound(myEntry.currentRound);
        setRoundProgress(myEntry.roundProgress);
        setIsDisqualified(myEntry.isDisqualified);
      }
    };

    const onAntiCheatWarning = (data: {
      violationsCount: number;
      penalty: FocusPenaltyTier;
      message: string;
      lockedUntil?: number;
    }) => {
      setViolationsCount(data.violationsCount);
      sound.playIncorrect();

      if (data.penalty === 'lockout' && data.lockedUntil) {
        setIsLockedOut(true);
        setLockedUntil(data.lockedUntil);
        setTimeout(() => setIsLockedOut(false), data.lockedUntil - Date.now());
      } else if (data.penalty === 'disqualified') {
        setIsDisqualified(true);
      }
    };

    const onMatchCompleted = (data: {
      winnerId: string;
      winnerName: string;
      finalLeaderboard: LeaderboardEntry[];
      matchStats: {
        durationSeconds: number;
        totalQuestionsAnswered: number;
      };
    }) => {
      setWinnerInfo({ id: data.winnerId, name: data.winnerName });
      setLeaderboard(data.finalLeaderboard);
      setMatchStats(data.matchStats);
    };

    const onPlayerReconnected = (data: { match: MatchSummary; sessionToken: string }) => {
      setMatch(data.match);
      // Find my playerId by matching username or socket
      const myP = Object.values(data.match.players).find((p) => p.username === username);
      if (myP) {
        setCurrentPlayerId(myP.id);
        setTotalScore(myP.totalScore);
        setRound(myP.currentRound);
        setRoundProgress(myP.roundCorrectAnswers);
        setViolationsCount(myP.focusStatus.violationsCount);
        setIsDisqualified(myP.focusStatus.isDisqualified);
        if (myP.currentQuestion) {
          setActiveQuestion(myP.currentQuestion);
        }
      }
    };

    const onErrorMessage = (data: { code: string; message: string }) => {
      setErrorMessage(data.message);
      setIsLoading(false);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('lobby:updated', onLobbyUpdated);
    socket.on('match:started', onMatchStarted);
    socket.on('question:assigned', onQuestionAssigned);
    socket.on('answer:result', onAnswerResult);
    socket.on('player:advanced', onPlayerAdvanced);
    socket.on('leaderboard:updated', onLeaderboardUpdated);
    socket.on('anticheat:warning', onAntiCheatWarning);
    socket.on('match:completed', onMatchCompleted);
    socket.on('player:reconnected', onPlayerReconnected);
    socket.on('error:message', onErrorMessage);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('lobby:updated', onLobbyUpdated);
      socket.off('match:started', onMatchStarted);
      socket.off('question:assigned', onQuestionAssigned);
      socket.off('answer:result', onAnswerResult);
      socket.off('player:advanced', onPlayerAdvanced);
      socket.off('leaderboard:updated', onLeaderboardUpdated);
      socket.off('anticheat:warning', onAntiCheatWarning);
      socket.off('match:completed', onMatchCompleted);
      socket.off('player:reconnected', onPlayerReconnected);
      socket.off('error:message', onErrorMessage);
    };
  }, [currentPlayerId, username]);

  // Anti-Cheat Window Focus Listeners
  // Only triggered during an active in_progress match
  useEffect(() => {
    if (match?.status !== 'in_progress' || !activeQuestion || isDisqualified) {
      return;
    }

    const handleFocusLoss = (eventType: 'blur' | 'visibilitychange') => {
      socket.emit('anticheat:focus_lost', {
        eventType,
        timestamp: Date.now(),
      });
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        handleFocusLoss('visibilitychange');
      }
    };

    const onBlur = () => {
      handleFocusLoss('blur');
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
    };
  }, [match?.status, activeQuestion, isDisqualified]);

  const localEngineRef = useRef<LocalGameEngine | null>(null);

  // Helper to create and enter a local lobby instantly
  const createLocalRoom = useCallback(
    (isTestMode: boolean = true, targetRound: number = 5, code?: string) => {
      setIsLoading(false);
      setErrorMessage(null);
      const roomCode = code || Math.random().toString(36).substring(2, 8).toUpperCase();
      const myId = 'local-user';
      setCurrentPlayerId(myId);

      const userPlayer: PlayerState = {
        id: myId,
        socketId: 'local-sock',
        username,
        avatarSeed: username.toLowerCase(),
        isReady: true,
        isHost: true,
        isConnected: true,
        currentRound: 1,
        roundCorrectAnswers: 0,
        totalScore: 0,
        highestRound: 1,
        totalSubmissions: 0,
        correctSubmissions: 0,
        fastestAnswerMs: 999999,
        focusStatus: {
          violationsCount: 0,
          lastViolationTimestamp: 0,
          isLockedOut: false,
          lockedUntil: 0,
          isDisqualified: false,
          penaltyLog: [],
        },
      };

      const localMatch: MatchSummary = {
        matchId: `local-${Date.now()}`,
        roomCode,
        isPrivate: true,
        status: 'waiting',
        winnerPlayerId: null,
        winnerUsername: null,
        settings: {
          targetRound,
          questionTimeLimitSeconds: 30,
          minPlayersToStart: 1,
          maxPlayers: 12,
          antiCheatEnabled: true,
          isTestMode,
        },
        players: {
          [myId]: userPlayer,
        },
      };

      setMatch(localMatch);
    },
    [username]
  );

  const handleStartSolo = useCallback(() => {
    setIsLoading(false);
    setErrorMessage(null);
    setWinnerInfo(null);
    const myId = 'local-user';
    setCurrentPlayerId(myId);

    const userPlayer: PlayerState = {
      id: myId,
      socketId: 'local-socket',
      username,
      avatarSeed: username.toLowerCase(),
      isReady: true,
      isHost: true,
      isConnected: true,
      currentRound: 1,
      roundCorrectAnswers: 0,
      totalScore: 0,
      highestRound: 1,
      totalSubmissions: 0,
      correctSubmissions: 0,
      fastestAnswerMs: 999999,
      focusStatus: {
        violationsCount: 0,
        lastViolationTimestamp: 0,
        isLockedOut: false,
        lockedUntil: 0,
        isDisqualified: false,
        penaltyLog: [],
      },
    };

    const botPlayer: PlayerState = {
      id: 'bot-1',
      socketId: 'sock-bot-1',
      username: 'PixelPro [AI]',
      avatarSeed: 'pixelpro',
      isReady: true,
      isHost: false,
      isConnected: true,
      isBot: true,
      currentRound: 1,
      roundCorrectAnswers: 0,
      totalScore: 0,
      highestRound: 1,
      totalSubmissions: 0,
      correctSubmissions: 0,
      fastestAnswerMs: 999999,
      focusStatus: {
        violationsCount: 0,
        lastViolationTimestamp: 0,
        isLockedOut: false,
        lockedUntil: 0,
        isDisqualified: false,
        penaltyLog: [],
      },
    };

    const playersMap = {
      [myId]: userPlayer,
      'bot-1': botPlayer,
    };

    const engine = new LocalGameEngine(playersMap, myId, 3, 'SOLO', {
      onQuestionAssigned: (data) => {
        setActiveQuestion(data.question);
        setRound(data.round);
        setRoundProgress(data.progress);
        setRequiredForRound(data.required);
        setAnswerFeedback({ status: 'idle', message: '' });
      },
      onAnswerResult: (data) => {
        setTotalScore(data.totalScore);
        setRoundProgress(data.roundProgress);
        setRequiredForRound(data.requiredForRound);

        if (data.correct) {
          sound.playCorrect();
          setAnswerFeedback({
            status: 'correct',
            message: data.earnedPoint ? 'Correct! +1 Point' : 'Correct!',
            earnedPoint: data.earnedPoint,
            canonical: data.canonicalAnswer,
          });
        } else {
          sound.playIncorrect();
          setAnswerFeedback({
            status: 'incorrect',
            message: data.message,
          });
        }

        if (data.roundAdvanced) {
          sound.playRoundUp();
          if (data.newRound) setRound(data.newRound);
        }
      },
      onLeaderboardUpdated: (board) => {
        setLeaderboard(board);
      },
      onMatchCompleted: (data) => {
        setWinnerInfo({ id: data.winnerId, name: data.winnerName });
        setLeaderboard(data.finalLeaderboard);
        setMatchStats(data.matchStats);
      },
    });

    localEngineRef.current = engine;
    const summary = engine.start();
    setMatch(summary);
  }, [username]);

  // Lobby & Action Handlers
  const handleQuickPlay = useCallback(() => {
    setErrorMessage(null);

    if (isConnected && socket.connected) {
      setIsLoading(true);
      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          setIsLoading(false);
          handleStartSolo();
        }
      }, 1500);

      socket.emit('lobby:join', { username, quickPlay: true }, (res) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        setIsLoading(false);
        if (res.success && res.sessionToken) {
          saveSessionToken(res.sessionToken);
        } else {
          handleStartSolo();
        }
      });
      return;
    }

    // Offline / Instant
    handleStartSolo();
  }, [username, isConnected, handleStartSolo]);

  const handleCreateRoom = useCallback(
    (isTestMode: boolean, targetRound: number) => {
      setErrorMessage(null);
      clearSessionToken();

      if (isConnected && socket.connected) {
        setIsLoading(true);

        socket.emit(
          'lobby:create',
          { username, isPrivate: true, isTestMode, targetRound },
          (res: any) => {
            setIsLoading(false);
            if (res.success && res.match) {
              if (res.sessionToken) saveSessionToken(res.sessionToken);
              if (res.playerId) setCurrentPlayerId(res.playerId);
              setMatch(res.match);
              if (res.roomCode) {
                const url = new URL(window.location.href);
                url.searchParams.set('room', res.roomCode);
                window.history.replaceState({}, '', url.toString());
              }
            } else if (res.success && res.roomCode) {
              if (res.sessionToken) saveSessionToken(res.sessionToken);
              createLocalRoom(isTestMode, targetRound, res.roomCode);
            } else {
              createLocalRoom(isTestMode, targetRound);
            }
          }
        );
        return;
      }

      // Offline / Instant
      createLocalRoom(isTestMode, targetRound);
    },
    [username, isConnected, createLocalRoom]
  );

  const handleJoinRoom = useCallback(
    (roomCode: string) => {
      setErrorMessage(null);
      const cleanCode = roomCode.trim().toUpperCase();

      if (isConnected && socket.connected) {
        setIsLoading(true);

        socket.emit('lobby:join', { username, roomCode: cleanCode }, (res: any) => {
          setIsLoading(false);
          if (res.success && res.match) {
            if (res.sessionToken) saveSessionToken(res.sessionToken);
            if (res.playerId) setCurrentPlayerId(res.playerId);
            setMatch(res.match);
            const url = new URL(window.location.href);
            url.searchParams.set('room', cleanCode);
            window.history.replaceState({}, '', url.toString());
          } else if (res.success && res.roomCode) {
            if (res.sessionToken) saveSessionToken(res.sessionToken);
            createLocalRoom(true, 5, cleanCode);
          } else {
            setErrorMessage(res?.error || 'Failed to join room');
          }
        });
        return;
      }

      // Offline / Instant
      createLocalRoom(true, 5, cleanCode);
    },
    [username, isConnected, createLocalRoom]
  );

  const handleToggleReady = useCallback((ready: boolean) => {
    if (match && match.matchId.startsWith('local-')) {
      setMatch((prev) => {
        if (!prev) return null;
        const p = prev.players['local-user'];
        if (p) p.isReady = ready;
        return { ...prev };
      });
      return;
    }
    socket.emit('lobby:ready', { isReady: ready });
  }, [match]);

  const handleStartMatch = useCallback(() => {
    if (match && match.matchId.startsWith('local-')) {
      const engine = new LocalGameEngine(
        match.players,
        currentPlayerId || 'local-user',
        match.settings.targetRound,
        match.roomCode,
        {
          onQuestionAssigned: (data) => {
            setActiveQuestion(data.question);
            setRound(data.round);
            setRoundProgress(data.progress);
            setRequiredForRound(data.required);
            setAnswerFeedback({ status: 'idle', message: '' });
          },
          onAnswerResult: (data) => {
            setTotalScore(data.totalScore);
            setRoundProgress(data.roundProgress);
            setRequiredForRound(data.requiredForRound);

            if (data.correct) {
              sound.playCorrect();
              setAnswerFeedback({
                status: 'correct',
                message: data.earnedPoint ? 'Correct! +1 Point' : 'Correct!',
                earnedPoint: data.earnedPoint,
                canonical: data.canonicalAnswer,
              });
            } else {
              sound.playIncorrect();
              setAnswerFeedback({
                status: 'incorrect',
                message: data.message,
              });
            }

            if (data.roundAdvanced) {
              sound.playRoundUp();
              if (data.newRound) setRound(data.newRound);
            }
          },
          onLeaderboardUpdated: (board) => {
            setLeaderboard(board);
          },
          onMatchCompleted: (data) => {
            setWinnerInfo({ id: data.winnerId, name: data.winnerName });
            setLeaderboard(data.finalLeaderboard);
            setMatchStats(data.matchStats);
          },
        }
      );

      localEngineRef.current = engine;
      const started = engine.start();
      setMatch(started);
      return;
    }

    socket.emit('lobby:start');
  }, [match, currentPlayerId]);

  const handleAddBot = useCallback(() => {
    if (match && match.matchId.startsWith('local-')) {
      const currentBots = Object.values(match.players).filter((p) => p.isBot).length;
      const botNames = ['PixelPro [AI]', 'TriviaBot [AI]', 'BrainyNova [AI]', 'SpeedyFox [AI]'];
      const botName = botNames[currentBots % botNames.length];
      const botId = `bot-${Date.now()}`;

      const botPlayer: PlayerState = {
        id: botId,
        socketId: `sock-${botId}`,
        username: botName,
        avatarSeed: botName.toLowerCase(),
        isReady: true,
        isHost: false,
        isConnected: true,
        isBot: true,
        currentRound: 1,
        roundCorrectAnswers: 0,
        totalScore: 0,
        highestRound: 1,
        totalSubmissions: 0,
        correctSubmissions: 0,
        fastestAnswerMs: 999999,
        focusStatus: {
          violationsCount: 0,
          lastViolationTimestamp: 0,
          isLockedOut: false,
          lockedUntil: 0,
          isDisqualified: false,
          penaltyLog: [],
        },
      };

      setMatch((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          players: {
            ...prev.players,
            [botId]: botPlayer,
          },
        };
      });
      return;
    }

    socket.emit('lobby:add_bot');
  }, [match]);

  const handleLeaveLobby = useCallback(() => {
    if (localEngineRef.current) {
      localEngineRef.current.cleanup();
      localEngineRef.current = null;
    }
    socket.emit('lobby:leave');
    clearSessionToken();
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('room')) {
        url.searchParams.delete('room');
        window.history.replaceState({}, '', url.pathname);
      }
    } catch {}
    setMatch(null);
    setActiveQuestion(null);
    setWinnerInfo(null);
  }, []);

  const handleSubmitAnswer = useCallback(
    (instanceId: string, answer: string): Promise<{ correct?: boolean; earnedPoint?: boolean; error?: string }> => {
      if (localEngineRef.current) {
        const res = localEngineRef.current.submitAnswer(answer);
        return Promise.resolve(res);
      }

      return new Promise((resolve) => {
        socket.emit('question:submit_answer', { instanceId, answer }, (res) => {
          resolve(res);
        });
      });
    },
    []
  );

  const handleRematch = useCallback(() => {
    if (localEngineRef.current) {
      handleStartSolo();
      return;
    }
    socket.emit('match:rematch');
    setWinnerInfo(null);
  }, [handleStartSolo]);

  const handleReturnHome = useCallback(() => {
    handleLeaveLobby();
  }, [handleLeaveLobby]);

  // Determine current player ID if not set
  useEffect(() => {
    if (match && !currentPlayerId) {
      const me = Object.values(match.players).find(
        (p) => p.socketId === socket.id || p.username === username
      );
      if (me) {
        setCurrentPlayerId(me.id);
      }
    }
  }, [match, currentPlayerId, username]);

  return (
    <div className="min-h-screen flex flex-col game-bg-grid">
      <Navbar
        isConnected={isConnected}
        onOpenRules={() => setShowRules(true)}
        onOpenServerConfig={() => setShowServerConfig(true)}
        roomCode={match?.roomCode}
      />

      <main className="flex-1 flex flex-col items-center justify-center">
        {/* Screen Switching Logic */}
        {!match ? (
          <HomeScreen
            username={username}
            onUsernameChange={handleUsernameChange}
            onQuickPlay={handleQuickPlay}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            onOpenRules={() => setShowRules(true)}
            isLoading={isLoading}
            errorMessage={errorMessage}
          />
        ) : winnerInfo || match.status === 'completed' ? (
          <ResultsScreen
            winnerId={winnerInfo?.id || match.winnerPlayerId || ''}
            winnerName={winnerInfo?.name || match.winnerUsername || 'Contender'}
            currentPlayerId={currentPlayerId}
            leaderboard={leaderboard}
            matchStats={matchStats}
            onRematch={handleRematch}
            onReturnHome={handleReturnHome}
          />
        ) : match.status === 'in_progress' ? (
          <GameplayScreen
            question={activeQuestion}
            round={round}
            progress={roundProgress}
            required={requiredForRound}
            totalScore={totalScore}
            leaderboard={leaderboard}
            currentPlayerId={currentPlayerId}
            violationsCount={violationsCount}
            isLockedOut={isLockedOut}
            lockedUntil={lockedUntil}
            isDisqualified={isDisqualified}
            onSubmitAnswer={handleSubmitAnswer}
            answerFeedback={answerFeedback}
          />
        ) : (
          <LobbyScreen
            match={match}
            currentPlayerId={currentPlayerId}
            onToggleReady={handleToggleReady}
            onStartMatch={handleStartMatch}
            onAddBot={handleAddBot}
            onLeaveLobby={handleLeaveLobby}
          />
        )}
      </main>

      {/* Rules Modal */}
      <RulesModal isOpen={showRules} onClose={() => setShowRules(false)} />

      {/* Server Configuration Modal */}
      <ServerConfigModal
        isOpen={showServerConfig}
        onClose={() => setShowServerConfig(false)}
        isConnected={isConnected}
      />
    </div>
  );
}

export default App;
