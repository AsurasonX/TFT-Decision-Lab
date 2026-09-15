"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";


const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000";


const INITIAL_STRATEGIES = [
  "WIN_STREAK",
  "LOSE_STREAK",
  "FLEXIBLE",
  "EXPERIMENT",
] as const;


const EVENT_TYPES = [
  "LOSE_STREAK_BROKEN",
  "WIN_STREAK_BROKEN",
  "UNEXPECTED_WIN",
  "UNEXPECTED_LOSS",
  "LOW_HP",
  "STAGE_TRANSITION",
] as const;


const DECISION_TYPES = [
  "MAKE_ECON",
  "STRENGTHEN_BOARD",
  "WEAKEN_BOARD",
  "LEVEL",
  "ROLL",
  "PIVOT",
  "SLAM_ITEM",
  "HOLD_UNITS",
  "SELL_UNITS",
  "NO_CHANGE",
] as const;


const STAGES = [
  2,
  3,
  4,
  5,
  6,
  7,
  8,
];


const ROUNDS = [
  1,
  2,
  3,
  4,
  5,
  6,
  7,
];


// ---------------------------------------------------------
// TYPES
// ---------------------------------------------------------


type Game = {
  id: number;

  game_name: string;
  tag_line: string;

  riot_match_id?: string | null;

  initial_strategy: string;

  status: string;

  started_at?: string;

  completed_at?: string | null;

  placement?: number | null;

  top4?: boolean | null;
  win?: boolean | null;

  patch?: string | null;
};


type GameEvent = {
  id: number;

  game_id: number;

  stage: number;
  round: number;

  event_type: string;

  hp?: number | null;
  gold?: number | null;
  level?: number | null;

  streak_type?: string | null;
  streak_length?: number | null;

  created_at?: string;
};


type Decision = {
  id: number;

  game_id: number;
  event_id: number;

  sequence_order: number;

  decision_type: string;

  gold_before?: number | null;
  gold_after?: number | null;

  level_before?: number | null;
  level_after?: number | null;

  notes?: string | null;

  created_at?: string;
};


type TimelineEntry = {
  event: GameEvent;

  decisions: Decision[];
};


type TimelineResponse = {
  game?: Game;

  timeline?: TimelineEntry[];

  entries?: TimelineEntry[];
};


type RiotUnit = {
  character_id?: string;

  name?: string;

  rarity?: number;

  tier?: number;

  itemNames?: string[];

  item_names?: string[];
};


type RiotTrait = {
  name?: string;

  num_units?: number;

  style?: number;

  tier_current?: number;

  tier_total?: number;
};


type RiotMatch = {
  match_id?: string;

  game_datetime?: number;

  placement?: number | null;

  top4?: boolean | null;

  win?: boolean | null;

  level?: number | null;

  last_round?: number | null;

  game_version?: string | null;

  units?: RiotUnit[];

  traits?: RiotTrait[];
};


/*
 * Day 8:
 * Temporary live game phase returned by FastAPI.
 */
type LivePhaseState = {
  game_id: number;

  stage: number;

  round: number;

  source?: string;

  updated_at?: string;
};


// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------


function displayLabel(
  value: string
) {
  return value
    .toLowerCase()
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}


function getErrorMessage(
  data: unknown,
  fallback: string
) {
  if (
    typeof data === "object" &&
    data !== null &&
    "detail" in data
  ) {
    const detail = (
      data as {
        detail?: unknown;
      }
    ).detail;


    if (
      typeof detail === "string"
    ) {
      return detail;
    }


    if (
      typeof detail === "object" &&
      detail !== null &&
      "message" in detail
    ) {
      const message = (
        detail as {
          message?: unknown;
        }
      ).message;


      if (
        typeof message === "string"
      ) {
        return message;
      }
    }


    try {
      return JSON.stringify(
        detail
      );
    } catch {
      return fallback;
    }
  }


  return fallback;
}


// ---------------------------------------------------------
// PAGE
// ---------------------------------------------------------


export default function Home() {

  // -------------------------------------------------------
  // PLAYER
  // -------------------------------------------------------


  const [
    gameName,
    setGameName,
  ] = useState("");


  const [
    tagLine,
    setTagLine,
  ] = useState("");


  // -------------------------------------------------------
  // GAME
  // -------------------------------------------------------


  const [
    gameId,
    setGameId,
  ] = useState<number | null>(
    null
  );


  const [
    game,
    setGame,
  ] = useState<Game | null>(
    null
  );


  // -------------------------------------------------------
  // PHASE
  // -------------------------------------------------------


  const [
    stage,
    setStage,
  ] = useState(2);


  const [
    round,
    setRound,
  ] = useState(1);


  /*
   * Day 8
   */
  const [
    autoTracking,
    setAutoTracking,
  ] = useState(true);


  const [
    livePhase,
    setLivePhase,
  ] =
    useState<LivePhaseState | null>(
      null
    );


  // -------------------------------------------------------
  // OPTIONAL GAME STATE
  // -------------------------------------------------------


  const [
    hp,
    setHp,
  ] = useState("");


  const [
    gold,
    setGold,
  ] = useState("");


  const [
    level,
    setLevel,
  ] = useState("");


  const [
    streakType,
    setStreakType,
  ] = useState("");


  const [
    streakLength,
    setStreakLength,
  ] = useState("");


  // -------------------------------------------------------
  // EVENT
  // -------------------------------------------------------


  const [
    currentEventId,
    setCurrentEventId,
  ] = useState<number | null>(
    null
  );


  const [
    currentEventType,
    setCurrentEventType,
  ] = useState<string | null>(
    null
  );


  // -------------------------------------------------------
  // DECISION
  // -------------------------------------------------------


  const [
    notes,
    setNotes,
  ] = useState("");


  // -------------------------------------------------------
  // TIMELINE
  // -------------------------------------------------------


  const [
    timeline,
    setTimeline,
  ] = useState<
    TimelineEntry[]
  >([]);


  // -------------------------------------------------------
  // RIOT
  // -------------------------------------------------------


  const [
    riotMatch,
    setRiotMatch,
  ] =
    useState<RiotMatch | null>(
      null
    );


  // -------------------------------------------------------
  // UI
  // -------------------------------------------------------


  const [
    message,
    setMessage,
  ] = useState("");


  const [
    loading,
    setLoading,
  ] = useState(false);


  /*
   * Protect against extremely fast double-clicks
   * before React disables the decision button.
   */
  const pendingDecisionKeys =
    useRef<Set<string>>(
      new Set()
    );


  // -------------------------------------------------------
  // RESTORE SAVED RIOT ID
  // -------------------------------------------------------


  useEffect(() => {

    const savedGameName =
      localStorage.getItem(
        "tft_game_name"
      );


    const savedTagLine =
      localStorage.getItem(
        "tft_tag_line"
      );


    if (
      savedGameName
    ) {
      setGameName(
        savedGameName
      );
    }


    if (
      savedTagLine
    ) {
      setTagLine(
        savedTagLine
      );
    }

  }, []);


  // -------------------------------------------------------
  // SAVE RIOT ID
  // -------------------------------------------------------


  useEffect(() => {

    if (
      gameName.trim()
    ) {
      localStorage.setItem(
        "tft_game_name",
        gameName.trim()
      );
    }

  }, [
    gameName,
  ]);


  useEffect(() => {

    if (
      tagLine.trim()
    ) {
      localStorage.setItem(
        "tft_tag_line",
        tagLine.trim()
      );
    }

  }, [
    tagLine,
  ]);


  // -------------------------------------------------------
  // DUPLICATE DECISION PROTECTION
  // -------------------------------------------------------


  const decisionsLoggedThisPhase =
    useMemo(() => {

      const logged =
        new Set<string>();


      for (
        const entry of timeline
      ) {

        if (
          entry.event.stage ===
            stage &&
          entry.event.round ===
            round
        ) {

          for (
            const decision of
            entry.decisions
          ) {
            logged.add(
              decision.decision_type
            );
          }

        }

      }


      return logged;

    }, [
      timeline,
      stage,
      round,
    ]);


  // -------------------------------------------------------
  // LOAD TIMELINE
  // -------------------------------------------------------


  async function loadTimeline(
    targetGameId: number
  ) {

    try {

      const response =
        await fetch(
          `${API_URL}/api/games/${targetGameId}/timeline`
        );


      const data:
        TimelineResponse =
        await response.json();


      if (
        !response.ok
      ) {

        throw new Error(
          getErrorMessage(
            data,
            "Could not load timeline."
          )
        );

      }


      if (
        data.game
      ) {
        setGame(
          data.game
        );
      }


      setTimeline(
        data.timeline ??
          data.entries ??
          []
      );

    } catch (
      error
    ) {

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load timeline."
      );

    }

  }


  // -------------------------------------------------------
  // START GAME
  // -------------------------------------------------------


  async function startGame(
    initialStrategy: string
  ) {

    if (
      !gameName.trim() ||
      !tagLine.trim()
    ) {

      setMessage(
        "Enter your Riot game name and tag line first."
      );

      return;

    }


    setLoading(true);

    setMessage("");


    try {

      const response =
        await fetch(
          `${API_URL}/api/games/start`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                game_name:
                  gameName.trim(),

                tag_line:
                  tagLine.trim(),

                initial_strategy:
                  initialStrategy,
              }),
          }
        );


      const data =
        await response.json();


      /*
       * Existing active game.
       */
      if (
        response.status === 409
      ) {

        const existingId =
          data?.detail?.game_id ??
          data?.game_id ??
          null;


        if (
          typeof existingId ===
          "number"
        ) {

          setGameId(
            existingId
          );


          setLivePhase(
            null
          );


          await loadTimeline(
            existingId
          );


          setMessage(
            `Active Game #${existingId} resumed.`
          );


          return;

        }

      }


      if (
        !response.ok
      ) {

        throw new Error(
          getErrorMessage(
            data,
            "Could not start game."
          )
        );

      }


      const newGame:
        Game =
        data.game ??
        data;


      setGame(
        newGame
      );


      setGameId(
        newGame.id
      );


      setTimeline(
        []
      );


      setCurrentEventId(
        null
      );


      setCurrentEventType(
        null
      );


      setRiotMatch(
        null
      );


      setLivePhase(
        null
      );


      setStage(
        2
      );


      setRound(
        1
      );


      setAutoTracking(
        true
      );


      setMessage(
        `Game #${newGame.id} started.`
      );

    } catch (
      error
    ) {

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not start game."
      );

    } finally {

      setLoading(
        false
      );

    }

  }


  // -------------------------------------------------------
  // RESUME GAME
  // -------------------------------------------------------


  async function resumeActiveGame() {

    if (
      !gameName.trim() ||
      !tagLine.trim()
    ) {

      setMessage(
        "Enter your Riot game name and tag line first."
      );

      return;

    }


    setLoading(
      true
    );


    setMessage(
      ""
    );


    try {

      const response =
        await fetch(
          `${API_URL}/api/games/active/${encodeURIComponent(
            gameName.trim()
          )}/${encodeURIComponent(
            tagLine.trim()
          )}`
        );


      const data =
        await response.json();


      if (
        !response.ok
      ) {

        throw new Error(
          getErrorMessage(
            data,
            "Could not check active game."
          )
        );

      }


      const activeGame:
        Game | null =
        data.game ??
        null;


      if (
        !activeGame
      ) {

        setMessage(
          "No active session found."
        );

        return;

      }


      setGame(
        activeGame
      );


      setGameId(
        activeGame.id
      );


      setRiotMatch(
        null
      );


      setLivePhase(
        null
      );


      await loadTimeline(
        activeGame.id
      );


      setMessage(
        `Resumed Game #${activeGame.id}.`
      );

    } catch (
      error
    ) {

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not resume game."
      );

    } finally {

      setLoading(
        false
      );

    }

  }


  // -------------------------------------------------------
  // LIVE PHASE POLLING — DAY 8
  // -------------------------------------------------------


  useEffect(() => {

    if (
      gameId === null ||
      game?.status !==
        "ACTIVE" ||
      !autoTracking
    ) {

      return;

    }


    let cancelled =
      false;


    async function pollLivePhase() {

      try {

        const response =
          await fetch(
            `${API_URL}/api/games/${gameId}/live-phase`,
            {
              cache:
                "no-store",
            }
          );


        if (
          !response.ok
        ) {
          return;
        }


        const data =
          await response.json();


        if (
          cancelled ||
          !data.live_state
        ) {
          return;
        }


        const live:
          LivePhaseState =
          data.live_state;


        setLivePhase(
          live
        );


        /*
         * Only reset the selected event when
         * the actual phase changes.
         */
        if (
          live.stage !==
            stage ||
          live.round !==
            round
        ) {

          setStage(
            live.stage
          );


          setRound(
            live.round
          );


          setCurrentEventId(
            null
          );


          setCurrentEventType(
            null
          );

        }

      } catch {

        /*
         * Do nothing.
         *
         * Manual logging must remain usable if
         * the native companion is unavailable.
         */

      }

    }


    pollLivePhase();


    const interval =
      window.setInterval(
        pollLivePhase,
        1000
      );


    return () => {

      cancelled =
        true;


      window.clearInterval(
        interval
      );

    };

  }, [
    gameId,
    game?.status,
    autoTracking,
    stage,
    round,
  ]);


  // -------------------------------------------------------
  // CREATE EVENT
  // -------------------------------------------------------


  async function createEvent(
    eventType: string
  ) {

    if (
      gameId === null
    ) {

      setMessage(
        "Start or resume a game first."
      );

      return;

    }


    if (
      game?.status !==
      "ACTIVE"
    ) {

      setMessage(
        "Events can only be added to an active game."
      );

      return;

    }


    setLoading(
      true
    );


    setMessage(
      ""
    );


    try {

      const response =
        await fetch(
          `${API_URL}/api/games/${gameId}/events`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                stage,
                round,

                event_type:
                  eventType,

                hp:
                  hp.trim() ===
                  ""
                    ? null
                    : Number(
                        hp
                      ),

                gold:
                  gold.trim() ===
                  ""
                    ? null
                    : Number(
                        gold
                      ),

                level:
                  level.trim() ===
                  ""
                    ? null
                    : Number(
                        level
                      ),

                streak_type:
                  streakType.trim() ===
                  ""
                    ? null
                    : streakType,

                streak_length:
                  streakLength.trim() ===
                  ""
                    ? null
                    : Number(
                        streakLength
                      ),
              }),
          }
        );


      const data =
        await response.json();


      /*
       * Duplicate event.
       *
       * Resume existing event.
       */
      if (
        response.status ===
        409
      ) {

        const existingEventId =
          data?.detail?.event_id ??
          data?.event_id ??
          null;


        if (
          typeof existingEventId ===
          "number"
        ) {

          setCurrentEventId(
            existingEventId
          );


          setCurrentEventType(
            eventType
          );


          await loadTimeline(
            gameId
          );


          setMessage(
            `${displayLabel(
              eventType
            )} already exists at Stage ${stage}-${round}. Existing event resumed.`
          );


          return;

        }

      }


      if (
        !response.ok
      ) {

        throw new Error(
          getErrorMessage(
            data,
            "Could not record event."
          )
        );

      }


      const event:
        GameEvent =
        data.event ??
        data;


      setCurrentEventId(
        event.id
      );


      setCurrentEventType(
        event.event_type
      );


      await loadTimeline(
        gameId
      );


      setMessage(
        `${displayLabel(
          event.event_type
        )} recorded at Stage ${stage}-${round}.`
      );

    } catch (
      error
    ) {

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not record event."
      );

    } finally {

      setLoading(
        false
      );

    }

  }


  // -------------------------------------------------------
  // LOG DECISION
  // -------------------------------------------------------


  async function logDecision(
    decisionType: string
  ) {

    if (
      gameId === null
    ) {

      setMessage(
        "No active game."
      );

      return;

    }


    if (
      currentEventId ===
      null
    ) {

      setMessage(
        "Record or select an event before adding a decision."
      );

      return;

    }


    if (
      game?.status !==
      "ACTIVE"
    ) {

      setMessage(
        "Decisions can only be recorded during an active game."
      );

      return;

    }


    /*
     * Frontend duplicate protection.
     */
    if (
      decisionsLoggedThisPhase.has(
        decisionType
      )
    ) {

      setMessage(
        `${displayLabel(
          decisionType
        )} has already been recorded for Stage ${stage}-${round}.`
      );

      return;

    }


    const pendingKey =
      `${gameId}-${stage}-${round}-${decisionType}`;


    /*
     * Fast double-click protection.
     */
    if (
      pendingDecisionKeys.current.has(
        pendingKey
      )
    ) {

      return;

    }


    pendingDecisionKeys.current.add(
      pendingKey
    );


    setLoading(
      true
    );


    setMessage(
      ""
    );


    try {

      const response =
        await fetch(
          `${API_URL}/api/events/${currentEventId}/decisions`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                decision_type:
                  decisionType,

                notes:
                  notes.trim() ===
                  ""
                    ? null
                    : notes.trim(),
              }),
          }
        );


      const data =
        await response.json();


      /*
       * Backend duplicate protection.
       */
      if (
        response.status ===
        409
      ) {

        await loadTimeline(
          gameId
        );


        setMessage(
          getErrorMessage(
            data,
            `${displayLabel(
              decisionType
            )} has already been recorded for Stage ${stage}-${round}.`
          )
        );


        return;

      }


      if (
        !response.ok
      ) {

        throw new Error(
          getErrorMessage(
            data,
            "Could not record decision."
          )
        );

      }


      setNotes(
        ""
      );


      await loadTimeline(
        gameId
      );


      setMessage(
        `${displayLabel(
          decisionType
        )} recorded for Stage ${stage}-${round}.`
      );

    } catch (
      error
    ) {

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not record decision."
      );

    } finally {

      pendingDecisionKeys.current.delete(
        pendingKey
      );


      setLoading(
        false
      );

    }

  }


  // -------------------------------------------------------
  // ABANDON GAME
  // -------------------------------------------------------


  async function abandonGame() {

    if (
      gameId === null
    ) {

      setMessage(
        "No active game."
      );

      return;

    }


    const confirmed =
      window.confirm(
        `Abandon Game #${gameId}?`
      );


    if (
      !confirmed
    ) {

      return;

    }


    setLoading(
      true
    );


    setMessage(
      ""
    );


    try {

      const response =
        await fetch(
          `${API_URL}/api/games/${gameId}/abandon`,
          {
            method:
              "POST",
          }
        );


      const data =
        await response.json();


      if (
        !response.ok
      ) {

        throw new Error(
          getErrorMessage(
            data,
            "Could not abandon session."
          )
        );

      }


      setGameId(
        null
      );


      setGame(
        null
      );


      setTimeline(
        []
      );


      setCurrentEventId(
        null
      );


      setCurrentEventType(
        null
      );


      setRiotMatch(
        null
      );


      setLivePhase(
        null
      );


      setMessage(
        "Session abandoned. You can start a new game."
      );

    } catch (
      error
    ) {

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not abandon session."
      );

    } finally {

      setLoading(
        false
      );

    }

  }


  // -------------------------------------------------------
  // RIOT RESULT SYNC
  // -------------------------------------------------------


  async function syncRiotResult() {

    if (
      gameId === null
    ) {

      setMessage(
        "No game to sync."
      );

      return;

    }


    setLoading(
      true
    );


    setMessage(
      ""
    );


    try {

      const response =
        await fetch(
          `${API_URL}/api/games/${gameId}/sync-riot`,
          {
            method:
              "POST",
          }
        );


      const data =
        await response.json();


      if (
        !response.ok
      ) {

        throw new Error(
          getErrorMessage(
            data,
            "Could not sync Riot result."
          )
        );

      }


      if (
        data.game
      ) {

        setGame(
          data.game
        );

      }


      if (
        data.riot_match
      ) {

        setRiotMatch(
          data.riot_match
        );

      }


      await loadTimeline(
        gameId
      );


      setMessage(
        data.message ??
          "Official Riot result synced."
      );

    } catch (
      error
    ) {

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not sync Riot result."
      );

    } finally {

      setLoading(
        false
      );

    }

  }


  // -------------------------------------------------------
  // NEW SESSION RESET
  // -------------------------------------------------------


  function resetForNewSession() {

    setGameId(
      null
    );


    setGame(
      null
    );


    setTimeline(
      []
    );


    setCurrentEventId(
      null
    );


    setCurrentEventType(
      null
    );


    setRiotMatch(
      null
    );


    setLivePhase(
      null
    );


    setStage(
      2
    );


    setRound(
      1
    );


    setHp(
      ""
    );


    setGold(
      ""
    );


    setLevel(
      ""
    );


    setStreakType(
      ""
    );


    setStreakLength(
      ""
    );


    setNotes(
      ""
    );


    setAutoTracking(
      true
    );


    setMessage(
      ""
    );

  }


  // -------------------------------------------------------
  // RENDER
  // -------------------------------------------------------


  return (

    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100">

      <div className="mx-auto max-w-6xl">


        {/* HEADER */}

        <header className="mb-8">

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <h1 className="text-3xl font-bold">
                TFT Decision Lab
              </h1>


              <p className="mt-2 text-sm text-zinc-400">
                Track decisions, review behavior,
                and connect choices to actual TFT
                outcomes.
              </p>

            </div>


            <nav className="flex gap-2">

              <Link
                href="/"
                className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm"
              >
                Logger
              </Link>


              <Link
                href="/history"
                className="rounded-xl border border-zinc-800 px-4 py-2 text-sm transition hover:border-zinc-600"
              >
                History
              </Link>


              <Link
                href="/analytics"
                className="rounded-xl border border-zinc-800 px-4 py-2 text-sm transition hover:border-zinc-600"
              >
                Analytics
              </Link>

            </nav>

          </div>

        </header>


        {/* RIOT ID */}

        <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">

          <h2 className="text-lg font-semibold">
            Riot ID
          </h2>


          <div className="mt-4 grid gap-3 sm:grid-cols-2">

            <div>

              <label className="mb-1 block text-sm text-zinc-400">
                Game Name
              </label>


              <input
                value={
                  gameName
                }
                onChange={(
                  event
                ) =>
                  setGameName(
                    event.target.value
                  )
                }
                placeholder="Asurason"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-zinc-500"
              />

            </div>


            <div>

              <label className="mb-1 block text-sm text-zinc-400">
                Tag Line
              </label>


              <input
                value={
                  tagLine
                }
                onChange={(
                  event
                ) =>
                  setTagLine(
                    event.target.value
                  )
                }
                placeholder="JP1"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-zinc-500"
              />

            </div>

          </div>


          {!game && (

            <button
              onClick={
                resumeActiveGame
              }
              disabled={
                loading
              }
              className="mt-4 rounded-xl border border-zinc-700 px-4 py-2 text-sm transition hover:border-zinc-500 disabled:opacity-50"
            >
              Resume Active Game
            </button>

          )}

        </section>


        {/* START GAME */}

        {!game && (

          <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">

            <h2 className="text-lg font-semibold">
              Opening Intent
            </h2>


            <p className="mt-1 text-sm text-zinc-400">
              What is your intended approach at
              the beginning of this game?
            </p>


            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

              {INITIAL_STRATEGIES.map(
                (
                  strategy
                ) => (

                  <button
                    key={
                      strategy
                    }
                    onClick={() =>
                      startGame(
                        strategy
                      )
                    }
                    disabled={
                      loading
                    }
                    className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium transition hover:border-zinc-500 disabled:opacity-50"
                  >
                    {displayLabel(
                      strategy
                    )}
                  </button>

                )
              )}

            </div>

          </section>

        )}


        {/* CURRENT SESSION */}

        {game && (

          <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

              <div>

                <h2 className="text-lg font-semibold">
                  Current Session
                </h2>


                <div className="mt-3 space-y-1 text-sm">

                  <p>

                    <span className="text-zinc-500">
                      Game:
                    </span>{" "}

                    #{game.id}

                  </p>


                  <p>

                    <span className="text-zinc-500">
                      Intent:
                    </span>{" "}

                    {displayLabel(
                      game.initial_strategy
                    )}

                  </p>


                  <p>

                    <span className="text-zinc-500">
                      Status:
                    </span>{" "}

                    {game.status}

                  </p>


                  {game.placement !=
                    null && (

                    <p>

                      <span className="text-zinc-500">
                        Placement:
                      </span>{" "}

                      #{game.placement}

                    </p>

                  )}

                </div>

              </div>


              <div className="flex flex-wrap gap-2">

                {game.status ===
                  "ACTIVE" && (

                  <>

                    <button
                      onClick={
                        syncRiotResult
                      }
                      disabled={
                        loading
                      }
                      className="rounded-xl border border-emerald-800 px-4 py-2 text-sm text-emerald-300 transition hover:border-emerald-500 disabled:opacity-50"
                    >
                      Sync Riot Result
                    </button>


                    <button
                      onClick={
                        abandonGame
                      }
                      disabled={
                        loading
                      }
                      className="rounded-xl border border-red-900 px-4 py-2 text-sm text-red-400 transition hover:border-red-500 disabled:opacity-50"
                    >
                      Abandon Session
                    </button>

                  </>

                )}


                {game.status !==
                  "ACTIVE" && (

                  <button
                    onClick={
                      resetForNewSession
                    }
                    className="rounded-xl border border-zinc-700 px-4 py-2 text-sm transition hover:border-zinc-500"
                  >
                    New Session
                  </button>

                )}

              </div>

            </div>

          </section>

        )}


        {/* LOGGER */}

        {game?.status ===
          "ACTIVE" && (

          <>


            {/* PHASE */}

            <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">

              <h2 className="text-lg font-semibold">
                Phase
              </h2>


              {/* AUTO TRACKING */}

              <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4">

                <div className="flex flex-wrap items-center justify-between gap-4">

                  <div>

                    <p className="font-medium">
                      Automatic Phase Tracking
                    </p>


                    <p className="mt-1 text-sm text-zinc-500">

                      {autoTracking
                        ? livePhase
                          ? `Detected: ${livePhase.stage}-${livePhase.round}${
                              livePhase.source
                                ? ` · ${livePhase.source}`
                                : ""
                            }`
                          : "Waiting for TFT phase data..."
                        : "Automatic tracking paused."}

                    </p>

                  </div>


                  <button
                    type="button"
                    onClick={() => {

                      setAutoTracking(
                        (
                          current
                        ) =>
                          !current
                      );

                    }}
                    className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                      autoTracking
                        ? "border-emerald-800 bg-emerald-950/20 text-emerald-400"
                        : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                    }`}
                  >

                    {autoTracking
                      ? "Auto ON"
                      : "Auto OFF"}

                  </button>

                </div>


                <p className="mt-3 text-xs text-zinc-600">
                  Turn Auto OFF to control Stage and
                  Round manually.
                </p>

              </div>


              {/* STAGE */}

              <div className="mt-5">

                <p className="mb-2 text-sm text-zinc-400">
                  Stage
                </p>


                <div className="flex flex-wrap gap-2">

                  {STAGES.map(
                    (
                      stageNumber
                    ) => (

                      <button
                        key={
                          stageNumber
                        }
                        onClick={() => {

                          setStage(
                            stageNumber
                          );


                          setCurrentEventId(
                            null
                          );


                          setCurrentEventType(
                            null
                          );

                        }}
                        className={`rounded-xl border px-4 py-2 ${
                          stage ===
                          stageNumber
                            ? "border-zinc-300 bg-zinc-100 text-zinc-950"
                            : "border-zinc-700 bg-zinc-950 hover:border-zinc-500"
                        }`}
                      >
                        {stageNumber}
                      </button>

                    )
                  )}

                </div>

              </div>


              {/* ROUND */}

              <div className="mt-5">

                <p className="mb-2 text-sm text-zinc-400">
                  Round
                </p>


                <div className="flex flex-wrap gap-2">

                  {ROUNDS.map(
                    (
                      roundNumber
                    ) => (

                      <button
                        key={
                          roundNumber
                        }
                        onClick={() => {

                          setRound(
                            roundNumber
                          );


                          setCurrentEventId(
                            null
                          );


                          setCurrentEventType(
                            null
                          );

                        }}
                        className={`rounded-xl border px-4 py-2 ${
                          round ===
                          roundNumber
                            ? "border-zinc-300 bg-zinc-100 text-zinc-950"
                            : "border-zinc-700 bg-zinc-950 hover:border-zinc-500"
                        }`}
                      >
                        {roundNumber}
                      </button>

                    )
                  )}

                </div>

              </div>


              {/* SELECTED PHASE */}

              <div className="mt-5 rounded-xl bg-zinc-950 p-4">

                <p className="text-sm text-zinc-400">
                  Selected phase
                </p>


                <p className="mt-1 text-2xl font-semibold">
                  {stage}-{round}
                </p>


                {autoTracking && (

                  <p className="mt-1 text-xs text-emerald-500">
                    Automatic tracking enabled
                  </p>

                )}

              </div>

            </section>


            {/* OPTIONAL STATE */}

            <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">

              <h2 className="text-lg font-semibold">
                Game State
              </h2>


              <p className="mt-1 text-sm text-zinc-400">
                Optional context for this event.
              </p>


              <div className="mt-4 grid gap-3 sm:grid-cols-3">

                <input
                  type="number"
                  value={
                    hp
                  }
                  onChange={(
                    event
                  ) =>
                    setHp(
                      event.target.value
                    )
                  }
                  placeholder="HP"
                  className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none"
                />


                <input
                  type="number"
                  value={
                    gold
                  }
                  onChange={(
                    event
                  ) =>
                    setGold(
                      event.target.value
                    )
                  }
                  placeholder="Gold"
                  className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none"
                />


                <input
                  type="number"
                  value={
                    level
                  }
                  onChange={(
                    event
                  ) =>
                    setLevel(
                      event.target.value
                    )
                  }
                  placeholder="Level"
                  className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none"
                />

              </div>


              <div className="mt-3 grid gap-3 sm:grid-cols-2">

                <select
                  value={
                    streakType
                  }
                  onChange={(
                    event
                  ) =>
                    setStreakType(
                      event.target.value
                    )
                  }
                  className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none"
                >

                  <option value="">
                    No streak
                  </option>

                  <option value="WIN">
                    Win Streak
                  </option>

                  <option value="LOSE">
                    Lose Streak
                  </option>

                </select>


                <input
                  type="number"
                  value={
                    streakLength
                  }
                  onChange={(
                    event
                  ) =>
                    setStreakLength(
                      event.target.value
                    )
                  }
                  placeholder="Streak length"
                  className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none"
                />

              </div>

            </section>


            {/* EVENT */}

            <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">

              <h2 className="text-lg font-semibold">
                What happened?
              </h2>


              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">

                {EVENT_TYPES.map(
                  (
                    eventType
                  ) => (

                    <button
                      key={
                        eventType
                      }
                      onClick={() =>
                        createEvent(
                          eventType
                        )
                      }
                      disabled={
                        loading
                      }
                      className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm transition hover:border-zinc-500 disabled:opacity-50"
                    >
                      {displayLabel(
                        eventType
                      )}
                    </button>

                  )
                )}

              </div>


              {currentEventId !==
                null && (

                <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm">

                  <span className="text-zinc-500">
                    Selected event:
                  </span>{" "}


                  {currentEventType
                    ? displayLabel(
                        currentEventType
                      )
                    : `#${currentEventId}`}

                </div>

              )}

            </section>


            {/* DECISION */}

            <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">

              <h2 className="text-lg font-semibold">
                What did you decide?
              </h2>


              {currentEventId ===
                null && (

                <p className="mt-2 text-sm text-amber-400">
                  Select an event first.
                </p>

              )}


              <div className="mt-4">

                <label className="mb-2 block text-sm text-zinc-400">
                  Notes
                </label>


                <textarea
                  value={
                    notes
                  }
                  onChange={(
                    event
                  ) =>
                    setNotes(
                      event.target.value
                    )
                  }
                  placeholder="Optional note..."
                  rows={
                    3
                  }
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none"
                />

              </div>


              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">

                {DECISION_TYPES.map(
                  (
                    decisionType
                  ) => {

                    const alreadyLogged =
                      decisionsLoggedThisPhase.has(
                        decisionType
                      );


                    return (

                      <button
                        key={
                          decisionType
                        }
                        onClick={() =>
                          logDecision(
                            decisionType
                          )
                        }
                        disabled={
                          loading ||
                          currentEventId ===
                            null ||
                          alreadyLogged
                        }
                        className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                          alreadyLogged
                            ? "cursor-not-allowed border-emerald-900 bg-emerald-950/30 text-emerald-500"
                            : "border-zinc-700 bg-zinc-950 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
                        }`}
                      >

                        {alreadyLogged
                          ? `${displayLabel(
                              decisionType
                            )} ✓`
                          : displayLabel(
                              decisionType
                            )}

                      </button>

                    );

                  }
                )}

              </div>


              <p className="mt-4 text-xs text-zinc-500">
                Each decision type can only
                be recorded once during the
                same Stage + Round.
              </p>

            </section>

          </>

        )}


        {/* MESSAGE */}

        {message && (

          <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm">
            {message}
          </section>

        )}


        {/* OFFICIAL RIOT RESULT */}

        {riotMatch && (

          <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">

            <h2 className="text-lg font-semibold">
              Official Riot Result
            </h2>


            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">


              <div className="rounded-xl bg-zinc-950 p-4">

                <p className="text-xs text-zinc-500">
                  Placement
                </p>


                <p className="mt-1 text-2xl font-semibold">

                  {riotMatch.placement !=
                  null
                    ? `#${riotMatch.placement}`
                    : "—"}

                </p>

              </div>


              <div className="rounded-xl bg-zinc-950 p-4">

                <p className="text-xs text-zinc-500">
                  Result
                </p>


                <p className="mt-1 font-semibold">

                  {riotMatch.win
                    ? "Win"
                    : riotMatch.top4
                    ? "Top 4"
                    : "Bottom 4"}

                </p>

              </div>


              <div className="rounded-xl bg-zinc-950 p-4">

                <p className="text-xs text-zinc-500">
                  Level
                </p>


                <p className="mt-1 text-xl font-semibold">

                  {riotMatch.level ??
                    "—"}

                </p>

              </div>


              <div className="rounded-xl bg-zinc-950 p-4">

                <p className="text-xs text-zinc-500">
                  Last Round
                </p>


                <p className="mt-1 text-xl font-semibold">

                  {riotMatch.last_round ??
                    "—"}

                </p>

              </div>

            </div>


            {/* FINAL BOARD */}

            {riotMatch.units &&
              riotMatch.units.length >
                0 && (

              <div className="mt-6">

                <h3 className="font-semibold">
                  Final Board
                </h3>


                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">

                  {riotMatch.units.map(
                    (
                      unit,
                      index
                    ) => {

                      const unitName =
                        unit.name ??
                        unit.character_id ??
                        `Unit ${
                          index + 1
                        }`;


                      const items =
                        unit.itemNames ??
                        unit.item_names ??
                        [];


                      return (

                        <div
                          key={`${unitName}-${index}`}
                          className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"
                        >

                          <p className="font-medium">
                            {unitName}
                          </p>


                          {unit.tier !=
                            null && (

                            <p className="mt-1 text-sm text-zinc-400">
                              {unit.tier}★
                            </p>

                          )}


                          {items.length >
                            0 && (

                            <div className="mt-2 text-xs text-zinc-500">

                              {items.join(
                                ", "
                              )}

                            </div>

                          )}

                        </div>

                      );

                    }
                  )}

                </div>

              </div>

            )}


            {/* TRAITS */}

            {riotMatch.traits &&
              riotMatch.traits.length >
                0 && (

              <div className="mt-6">

                <h3 className="font-semibold">
                  Traits
                </h3>


                <div className="mt-3 flex flex-wrap gap-2">

                  {riotMatch.traits.map(
                    (
                      trait,
                      index
                    ) => (

                      <div
                        key={`${trait.name}-${index}`}
                        className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                      >

                        {trait.name ??
                          "Unknown Trait"}


                        {trait.num_units !=
                          null &&
                          ` (${trait.num_units})`}

                      </div>

                    )
                  )}

                </div>

              </div>

            )}

          </section>

        )}


        {/* TIMELINE */}

        {game && (

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">

            <div className="flex items-center justify-between gap-4">

              <div>

                <h2 className="text-lg font-semibold">
                  Decision Timeline
                </h2>


                <p className="mt-1 text-sm text-zinc-400">
                  Game #{game.id}
                </p>

              </div>


              <button
                onClick={() => {

                  if (
                    gameId !==
                    null
                  ) {

                    loadTimeline(
                      gameId
                    );

                  }

                }}
                disabled={
                  loading
                }
                className="rounded-xl border border-zinc-700 px-3 py-2 text-sm transition hover:border-zinc-500 disabled:opacity-50"
              >
                Refresh
              </button>

            </div>


            {timeline.length ===
              0 ? (

              <p className="mt-5 text-sm text-zinc-500">
                No events recorded yet.
              </p>

            ) : (

              <div className="mt-5 space-y-4">

                {timeline.map(
                  (
                    entry
                  ) => (

                    <div
                      key={
                        entry.event.id
                      }
                      className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"
                    >

                      <div className="flex flex-wrap items-start justify-between gap-2">

                        <div>

                          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">

                            Stage{" "}
                            {
                              entry.event
                                .stage
                            }
                            -
                            {
                              entry.event
                                .round
                            }

                          </p>


                          <p className="mt-1 font-semibold">

                            {displayLabel(
                              entry.event
                                .event_type
                            )}

                          </p>

                        </div>


                        <button
                          onClick={() => {

                            /*
                             * Selecting a historical timeline
                             * event is a manual action.
                             *
                             * Pause auto tracking so the
                             * companion does not immediately
                             * move away from it.
                             */
                            setAutoTracking(
                              false
                            );


                            setStage(
                              entry.event
                                .stage
                            );


                            setRound(
                              entry.event
                                .round
                            );


                            setCurrentEventId(
                              entry.event
                                .id
                            );


                            setCurrentEventType(
                              entry.event
                                .event_type
                            );

                          }}
                          disabled={
                            game.status !==
                            "ACTIVE"
                          }
                          className="rounded-lg border border-zinc-800 px-3 py-1 text-xs text-zinc-400 hover:border-zinc-600 disabled:opacity-30"
                        >
                          Select
                        </button>

                      </div>


                      {(entry.event.hp !=
                        null ||
                        entry.event.gold !=
                          null ||
                        entry.event.level !=
                          null) && (

                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500">


                          {entry.event.hp !=
                            null && (

                            <span>
                              HP{" "}
                              {
                                entry.event
                                  .hp
                              }
                            </span>

                          )}


                          {entry.event.gold !=
                            null && (

                            <span>
                              Gold{" "}
                              {
                                entry.event
                                  .gold
                              }
                            </span>

                          )}


                          {entry.event.level !=
                            null && (

                            <span>
                              Level{" "}
                              {
                                entry.event
                                  .level
                              }
                            </span>

                          )}

                        </div>

                      )}


                      <div className="mt-4 space-y-2">

                        {entry.decisions
                          .length ===
                          0 ? (

                          <p className="text-sm text-zinc-600">
                            No decisions recorded.
                          </p>

                        ) : (

                          [
                            ...entry.decisions,
                          ]
                            .sort(
                              (
                                a,
                                b
                              ) =>
                                a.sequence_order -
                                b.sequence_order
                            )
                            .map(
                              (
                                decision
                              ) => (

                                <div
                                  key={
                                    decision.id
                                  }
                                  className="rounded-lg border border-zinc-800 px-3 py-2"
                                >

                                  <div className="flex gap-2 text-sm">

                                    <span className="text-zinc-500">
                                      #
                                      {
                                        decision.sequence_order
                                      }
                                    </span>


                                    <span className="font-medium">

                                      {displayLabel(
                                        decision.decision_type
                                      )}

                                    </span>

                                  </div>


                                  {decision.notes && (

                                    <p className="mt-1 text-xs text-zinc-500">
                                      {
                                        decision.notes
                                      }
                                    </p>

                                  )}

                                </div>

                              )
                            )

                        )}

                      </div>

                    </div>

                  )
                )}

              </div>

            )}

          </section>

        )}

      </div>

    </main>

  );

}