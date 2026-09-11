"use client";

import Link from "next/link";

import {
  useEffect,
  useState
} from "react";


const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000";


type Game = {
  id: number;
  game_name: string;
  tag_line: string;
  initial_strategy: string;
  status: string;
  riot_match_id: string | null;
  placement: number | null;
  top4: boolean | null;
  win: boolean | null;
  patch: string | null;
};


type Decision = {
  id: number;
  sequence_order: number;
  decision_type: string;
  notes: string | null;
};


type GameEvent = {
  id: number;
  stage: number;
  round: number;
  event_type: string;
  hp: number | null;
  gold: number | null;
  level: number | null;
  streak_type: string | null;
  streak_length: number | null;
};


type TimelineEntry = {
  event: GameEvent;
  decisions: Decision[];
};


type TimelineResponse = {
  game: Game;
  timeline: TimelineEntry[];
};


type RiotUnit = {
  character_id: string | null;
  tier: number | null;
  items: Array<string | number>;
};


type RiotTrait = {
  name: string | null;
  num_units: number | null;
  style: number | null;
  tier_current: number | null;
};


type RiotMatch = {
  match_id: string;
  game_datetime: number | null;
  placement: number;
  top4: boolean;
  win: boolean;
  level: number | null;
  last_round: number | null;
  game_version: string | null;
  units: RiotUnit[];
  traits: RiotTrait[];
};


const strategies = [
  {
    value: "WIN_STREAK",
    label: "🔥 Win Streak"
  },
  {
    value: "LOSE_STREAK",
    label: "💰 Lose Streak"
  },
  {
    value: "FLEXIBLE",
    label: "🔄 Flexible"
  },
  {
    value: "EXPERIMENT",
    label: "🧪 Experiment"
  }
];


const eventTypes = [
  "LOSE_STREAK_BROKEN",
  "WIN_STREAK_BROKEN",
  "UNEXPECTED_WIN",
  "UNEXPECTED_LOSS",
  "LOW_HP",
  "STAGE_TRANSITION"
];


const decisionTypes = [
  "MAKE_ECON",
  "STRENGTHEN_BOARD",
  "WEAKEN_BOARD",
  "LEVEL",
  "ROLL",
  "PIVOT",
  "SLAM_ITEM",
  "HOLD_UNITS",
  "SELL_UNITS",
  "NO_CHANGE"
];


const roundsByStage: Record<
  number,
  number[]
> = {
  2: [1, 2, 3, 4, 5, 6, 7],
  3: [1, 2, 3, 4, 5, 6, 7],
  4: [1, 2, 3, 4, 5, 6, 7],
  5: [1, 2, 3, 4, 5, 6, 7],
  6: [1, 2, 3, 4, 5, 6, 7]
};


function prettyName(
  value: string
) {

  return value
    .replaceAll(
      "_",
      " "
    )
    .toLowerCase()
    .replace(
      /\b\w/g,
      letter =>
        letter.toUpperCase()
    );
}


function optionalNumber(
  value: string
): number | null {

  if (
    value.trim() === ""
  ) {

    return null;
  }


  const result =
    Number(value);


  return Number.isNaN(
    result
  )
    ? null
    : result;
}


export default function Home() {

  const [
    gameName,
    setGameName
  ] = useState("");


  const [
    tagLine,
    setTagLine
  ] = useState("JP1");


  const [
    gameId,
    setGameId
  ] = useState<number | null>(
    null
  );


  const [
    game,
    setGame
  ] = useState<Game | null>(
    null
  );


  const [
    riotMatch,
    setRiotMatch
  ] = useState<RiotMatch | null>(
    null
  );


  const [
    timeline,
    setTimeline
  ] = useState<TimelineEntry[]>(
    []
  );


  const [
    currentEventId,
    setCurrentEventId
  ] = useState<number | null>(
    null
  );


  const [
    stage,
    setStage
  ] = useState("2");


  const [
    round,
    setRound
  ] = useState("1");


  const [
    hp,
    setHp
  ] = useState("");


  const [
    gold,
    setGold
  ] = useState("");


  const [
    level,
    setLevel
  ] = useState("");


  const [
    streakLength,
    setStreakLength
  ] = useState("");


  const [
    notes,
    setNotes
  ] = useState("");


  const [
    message,
    setMessage
  ] = useState("");


  const [
    loading,
    setLoading
  ] = useState(false);


  useEffect(() => {

    const savedGameName =
      localStorage.getItem(
        "tft_game_name"
      );


    const savedTagLine =
      localStorage.getItem(
        "tft_tag_line"
      );


    if (savedGameName) {

      setGameName(
        savedGameName
      );
    }


    if (savedTagLine) {

      setTagLine(
        savedTagLine
      );
    }

  }, []);


  async function loadTimeline(
    targetGameId: number
  ) {

    try {

      const response =
        await fetch(
          `${API_URL}/api/games/${targetGameId}/timeline`
        );


      if (!response.ok) {
        return;
      }


      const data:
        TimelineResponse =
          await response.json();


      setGame(
        data.game
      );


      setTimeline(
        data.timeline
      );

    } catch {

      // Ignore temporary network error.

    }
  }


  async function startGame(
    strategy: string
  ) {

    if (
      !gameName.trim()
    ) {

      setMessage(
        "Enter your Riot game name."
      );

      return;
    }


    if (
      !tagLine.trim()
    ) {

      setMessage(
        "Enter your Riot tag line."
      );

      return;
    }


    localStorage.setItem(
      "tft_game_name",
      gameName.trim()
    );


    localStorage.setItem(
      "tft_tag_line",
      tagLine.trim()
    );


    setLoading(true);
    setMessage("");


    try {

      const response =
        await fetch(
          `${API_URL}/api/games/start`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({

              game_name:
                gameName.trim(),

              tag_line:
                tagLine.trim(),

              initial_strategy:
                strategy
            })
          }
        );


      const data =
        await response.json();


      if (
        response.status === 409 &&
        data?.detail?.game_id
      ) {

        const existingId:
          number =
            data.detail.game_id;


        setGameId(
          existingId
        );


        setRiotMatch(
          null
        );


        setCurrentEventId(
          null
        );


        await loadTimeline(
          existingId
        );


        setMessage(
          `Resumed Game #${existingId}`
        );


        return;
      }


      if (!response.ok) {

        throw new Error(

          typeof data.detail ===
          "string"

            ? data.detail

            : JSON.stringify(
                data.detail ??
                data
              )
        );
      }


      setGameId(
        data.id
      );


      setGame(
        data
      );


      setTimeline(
        []
      );


      setRiotMatch(
        null
      );


      setCurrentEventId(
        null
      );


      setStage("2");
      setRound("1");
      setHp("");
      setGold("");
      setLevel("");
      setStreakLength("");
      setNotes("");


      setMessage(
        `Game #${data.id} started`
      );


    } catch (error) {

      setMessage(

        error instanceof Error

          ? error.message

          : "Could not start game."
      );


    } finally {

      setLoading(false);
    }
  }


  async function resumeActiveGame() {

    if (
      !gameName.trim() ||
      !tagLine.trim()
    ) {

      setMessage(
        "Enter your Riot ID first."
      );

      return;
    }


    localStorage.setItem(
      "tft_game_name",
      gameName.trim()
    );


    localStorage.setItem(
      "tft_tag_line",
      tagLine.trim()
    );


    setLoading(true);
    setMessage("");


    try {

      const name =
        encodeURIComponent(
          gameName.trim()
        );


      const tag =
        encodeURIComponent(
          tagLine.trim()
        );


      const response =
        await fetch(
          `${API_URL}/api/games/active/${name}/${tag}`
        );


      if (!response.ok) {

        throw new Error(
          "Could not check active game."
        );
      }


      const data =
        await response.json();


      if (!data.game) {

        setMessage(
          "No active game found."
        );

        return;
      }


      const resumedGame:
        Game =
          data.game;


      setGameId(
        resumedGame.id
      );


      setGame(
        resumedGame
      );


      setRiotMatch(
        null
      );


      setCurrentEventId(
        null
      );


      await loadTimeline(
        resumedGame.id
      );


      setMessage(
        `Resumed Game #${resumedGame.id}`
      );


    } catch (error) {

      setMessage(

        error instanceof Error

          ? error.message

          : "Could not resume game."
      );


    } finally {

      setLoading(false);
    }
  }


  async function createEvent(
    eventType: string
  ) {

    if (
      gameId === null
    ) {

      setMessage(
        "No active game."
      );

      return;
    }


    setLoading(true);
    setMessage("");


    try {

      const response =
        await fetch(
          `${API_URL}/api/games/${gameId}/events`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({

              stage:
                Number(stage),

              round:
                Number(round),

              event_type:
                eventType,

              hp:
                optionalNumber(hp),

              gold:
                optionalNumber(gold),

              level:
                optionalNumber(level),

              streak_type:
                eventType ===
                "LOSE_STREAK_BROKEN"

                  ? "LOSE"

                  : eventType ===
                    "WIN_STREAK_BROKEN"

                  ? "WIN"

                  : null,

              streak_length:
                optionalNumber(
                  streakLength
                )
            })
          }
        );


      const data =
        await response.json();


      if (
        response.status === 409 &&
        data?.detail?.event_id
      ) {

        setCurrentEventId(
          data.detail.event_id
        );


        setMessage(
          "This event already exists. Continue adding decisions."
        );


        await loadTimeline(
          gameId
        );


        return;
      }


      if (!response.ok) {

        throw new Error(

          typeof data.detail ===
          "string"

            ? data.detail

            : JSON.stringify(
                data.detail ??
                data
              )
        );
      }


      setCurrentEventId(
        data.id
      );


      setMessage(
        `${prettyName(
          eventType
        )} recorded. Choose your response.`
      );


      await loadTimeline(
        gameId
      );


    } catch (error) {

      setMessage(

        error instanceof Error

          ? error.message

          : "Could not record event."
      );


    } finally {

      setLoading(false);
    }
  }


  async function createDecision(
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
      currentEventId === null
    ) {

      setMessage(
        "Choose what happened first."
      );

      return;
    }


    setLoading(true);
    setMessage("");


    try {

      const response =
        await fetch(
          `${API_URL}/api/events/${currentEventId}/decisions`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({

              decision_type:
                decisionType,

              gold_before:
                optionalNumber(gold),

              gold_after:
                null,

              level_before:
                optionalNumber(level),

              level_after:
                null,

              notes:
                notes.trim() === ""

                  ? null

                  : notes.trim()
            })
          }
        );


      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(

          typeof data.detail ===
          "string"

            ? data.detail

            : JSON.stringify(
                data.detail ??
                data
              )
        );
      }


      setNotes("");


      setMessage(
        `${prettyName(
          decisionType
        )} saved as Decision #${data.sequence_order}`
      );


      await loadTimeline(
        gameId
      );


    } catch (error) {

      setMessage(

        error instanceof Error

          ? error.message

          : "Could not save decision."
      );


    } finally {

      setLoading(false);
    }
  }


  async function syncRiotResult() {

    if (
      gameId === null
    ) {

      setMessage(
        "No active game."
      );

      return;
    }


    setLoading(true);
    setMessage("");


    try {

      const response =
        await fetch(
          `${API_URL}/api/games/${gameId}/sync-riot`,
          {
            method: "POST"
          }
        );


      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(

          typeof data.detail ===
          "string"

            ? data.detail

            : JSON.stringify(
                data.detail ??
                data
              )
        );
      }


      if (data.game) {

        setGame(
          data.game
        );
      }


      if (data.riot_match) {

        setRiotMatch(
          data.riot_match
        );
      }


      await loadTimeline(
        gameId
      );


      const placement =
        data?.game?.placement;


      if (
        placement !== null &&
        placement !== undefined
      ) {

        setMessage(
          `Riot match synced — Placement #${placement}`
        );

      } else {

        setMessage(
          "Riot match synced successfully."
        );
      }


    } catch (error) {

      setMessage(

        error instanceof Error

          ? error.message

          : "Could not sync Riot match."
      );


    } finally {

      setLoading(false);
    }
  }


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


    if (!confirmed) {
      return;
    }


    setLoading(true);
    setMessage("");


    try {

      const response =
        await fetch(
          `${API_URL}/api/games/${gameId}/abandon`,
          {
            method: "POST"
          }
        );


      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(

          typeof data.detail ===
          "string"

            ? data.detail

            : JSON.stringify(
                data.detail ??
                data
              )
        );
      }


      setGameId(null);
      setGame(null);
      setTimeline([]);
      setCurrentEventId(null);
      setRiotMatch(null);


      setMessage(
        "Session abandoned. You can start a new game."
      );


    } catch (error) {

      setMessage(

        error instanceof Error

          ? error.message

          : "Could not abandon session."
      );


    } finally {

      setLoading(false);
    }
  }


  function newSession() {

    setGameId(null);
    setGame(null);
    setTimeline([]);
    setCurrentEventId(null);
    setRiotMatch(null);

    setStage("2");
    setRound("1");

    setHp("");
    setGold("");
    setLevel("");
    setStreakLength("");
    setNotes("");

    setMessage("");
  }


  return (

    <main className="min-h-screen bg-zinc-950 text-zinc-100">

      <div className="mx-auto max-w-5xl px-5 py-10">


        <header className="mb-10">

          <div className="flex flex-wrap items-start justify-between gap-5">

            <div>

              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-violet-400">
                Behavioral Analytics
              </p>

              <h1 className="mt-2 text-4xl font-bold">
                TFT Decision Lab
              </h1>

              <p className="mt-3 max-w-2xl text-zinc-400">
                Track how you respond when game
                conditions change and connect your
                decisions to real TFT results.
              </p>

            </div>


            <nav className="flex flex-wrap gap-2">

              <Link
                href="/"
                className="rounded-lg border border-violet-500 px-4 py-2"
              >
                Logger
              </Link>

              <Link
                href="/history"
                className="rounded-lg border border-zinc-700 px-4 py-2 hover:border-violet-500"
              >
                History
              </Link>

              <Link
                href="/analytics"
                className="rounded-lg border border-zinc-700 px-4 py-2 hover:border-violet-500"
              >
                Analytics
              </Link>

            </nav>

          </div>

        </header>


        {gameId === null && (

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

            <h2 className="text-2xl font-semibold">
              Start Game
            </h2>

            <p className="mt-2 text-sm text-zinc-500">
              Enter your Riot ID and choose your opening intention.
            </p>


            <div className="mt-6 grid gap-4 md:grid-cols-2">

              <input
                value={gameName}
                onChange={
                  event =>
                    setGameName(
                      event.target.value
                    )
                }
                placeholder="Riot Game Name"
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3"
              />


              <input
                value={tagLine}
                onChange={
                  event =>
                    setTagLine(
                      event.target.value
                    )
                }
                placeholder="JP1"
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3"
              />

            </div>


            <button
              onClick={
                resumeActiveGame
              }
              disabled={loading}
              className="mt-4 rounded-xl border border-zinc-700 px-5 py-3 text-sm hover:border-violet-500 disabled:opacity-50"
            >
              Resume Active Game
            </button>


            <h3 className="mt-8 text-xl font-semibold">
              What&apos;s your plan?
            </h3>


            <div className="mt-4 grid gap-3 sm:grid-cols-2">

              {strategies.map(
                strategy => (

                  <button
                    key={strategy.value}
                    disabled={loading}
                    onClick={() =>
                      startGame(
                        strategy.value
                      )
                    }
                    className="rounded-xl border border-zinc-700 bg-zinc-800 p-5 text-left text-lg font-semibold hover:border-violet-500 hover:bg-zinc-700 disabled:opacity-50"
                  >
                    {strategy.label}
                  </button>

                )
              )}

            </div>

          </section>

        )}


        {gameId !== null && (

          <>

            <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

              <div className="flex flex-wrap items-center justify-between gap-4">

                <div>

                  <p className="text-sm text-zinc-400">
                    Current Session
                  </p>

                  <h2 className="text-2xl font-bold">
                    Game #{gameId}
                  </h2>

                </div>


                {game && (

                  <div className="text-right">

                    <p className="font-semibold text-violet-300">
                      {prettyName(
                        game.initial_strategy
                      )}
                    </p>

                    <p className="text-sm text-zinc-400">
                      {game.status}
                    </p>

                  </div>

                )}

              </div>


              {game?.status === "ACTIVE" && (

                <button
                  onClick={abandonGame}
                  disabled={loading}
                  className="mt-5 rounded-xl border border-red-900 px-4 py-2 text-sm text-red-400 hover:border-red-500 disabled:opacity-50"
                >
                  Abandon Session
                </button>

              )}

            </section>


            {game?.status !== "COMPLETED" &&
             game?.status !== "ABANDONED" && (

              <>

                <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

                  <h2 className="text-xl font-semibold">
                    Game State
                  </h2>


                  <p className="mb-2 mt-5 text-sm text-zinc-400">
                    Stage
                  </p>


                  <div className="flex flex-wrap gap-2">

                    {[2, 3, 4, 5, 6].map(
                      stageNumber => (

                        <button
                          key={stageNumber}
                          onClick={() => {

                            setStage(
                              String(
                                stageNumber
                              )
                            );

                            setRound("1");

                            setCurrentEventId(
                              null
                            );

                          }}
                          className={
                            stage ===
                            String(stageNumber)

                              ? "rounded-lg bg-violet-600 px-4 py-2 font-semibold"

                              : "rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2"
                          }
                        >
                          Stage {stageNumber}
                        </button>

                      )
                    )}

                  </div>


                  <p className="mb-2 mt-5 text-sm text-zinc-400">
                    Round
                  </p>


                  <div className="flex flex-wrap gap-2">

                    {roundsByStage[
                      Number(stage)
                    ]?.map(
                      roundNumber => (

                        <button
                          key={roundNumber}
                          onClick={() => {

                            setRound(
                              String(
                                roundNumber
                              )
                            );

                            setCurrentEventId(
                              null
                            );

                          }}
                          className={
                            round ===
                            String(roundNumber)

                              ? "rounded-lg bg-amber-600 px-4 py-2 font-semibold"

                              : "rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2"
                          }
                        >
                          {stage}-{roundNumber}
                        </button>

                      )
                    )}

                  </div>


                  <div className="mt-7">

                    <p className="text-sm font-medium text-zinc-300">
                      Optional Context
                    </p>

                    <p className="mt-1 text-xs text-zinc-500">
                      Skip these if you need to log quickly.
                    </p>


                    <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">

                      <input
                        type="number"
                        value={hp}
                        onChange={
                          event =>
                            setHp(
                              event.target.value
                            )
                        }
                        placeholder="HP"
                        className="rounded-xl border border-zinc-700 bg-zinc-950 p-3"
                      />

                      <input
                        type="number"
                        value={gold}
                        onChange={
                          event =>
                            setGold(
                              event.target.value
                            )
                        }
                        placeholder="Gold"
                        className="rounded-xl border border-zinc-700 bg-zinc-950 p-3"
                      />

                      <input
                        type="number"
                        value={level}
                        onChange={
                          event =>
                            setLevel(
                              event.target.value
                            )
                        }
                        placeholder="Level"
                        className="rounded-xl border border-zinc-700 bg-zinc-950 p-3"
                      />

                      <input
                        type="number"
                        value={streakLength}
                        onChange={
                          event =>
                            setStreakLength(
                              event.target.value
                            )
                        }
                        placeholder="Streak"
                        className="rounded-xl border border-zinc-700 bg-zinc-950 p-3"
                      />

                    </div>

                  </div>

                </section>


                <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

                  <h2 className="text-xl font-semibold">
                    What happened?
                  </h2>

                  <p className="mt-1 text-sm text-zinc-500">
                    Current round: {stage}-{round}
                  </p>


                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">

                    {eventTypes.map(
                      eventType => (

                        <button
                          key={eventType}
                          disabled={loading}
                          onClick={() =>
                            createEvent(
                              eventType
                            )
                          }
                          className="rounded-xl border border-zinc-700 bg-zinc-800 p-4 text-left hover:border-amber-500 disabled:opacity-50"
                        >
                          {prettyName(
                            eventType
                          )}
                        </button>

                      )
                    )}

                  </div>

                </section>


                <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

                  <h2 className="text-xl font-semibold">
                    What did you do?
                  </h2>


                  {currentEventId === null ? (

                    <p className="mt-2 text-sm text-zinc-500">
                      Record what happened first.
                    </p>

                  ) : (

                    <p className="mt-2 text-sm text-emerald-400">
                      Event selected. You can add multiple decisions.
                    </p>

                  )}


                  <textarea
                    value={notes}
                    onChange={
                      event =>
                        setNotes(
                          event.target.value
                        )
                    }
                    placeholder="Optional note..."
                    className="mt-4 min-h-20 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3"
                  />


                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">

                    {decisionTypes.map(
                      decisionType => (

                        <button
                          key={decisionType}
                          disabled={
                            loading ||
                            currentEventId === null
                          }
                          onClick={() =>
                            createDecision(
                              decisionType
                            )
                          }
                          className="rounded-xl border border-zinc-700 bg-zinc-800 p-4 text-left hover:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {prettyName(
                            decisionType
                          )}
                        </button>

                      )
                    )}

                  </div>

                </section>


                <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

                  <h2 className="text-xl font-semibold">
                    Game Finished?
                  </h2>

                  <p className="mt-2 text-sm text-zinc-400">
                    After the TFT match ends, sync the official Riot result.
                  </p>


                  <button
                    onClick={
                      syncRiotResult
                    }
                    disabled={loading}
                    className="mt-4 rounded-xl bg-violet-600 px-6 py-3 font-semibold hover:bg-violet-500 disabled:opacity-50"
                  >
                    {loading
                      ? "Checking Riot..."
                      : "Sync Riot Result"}
                  </button>

                </section>

              </>

            )}


            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

              <div className="flex flex-wrap items-center justify-between gap-4">

                <h2 className="text-xl font-semibold">
                  Decision Timeline
                </h2>


                {game?.placement !== null &&
                 game?.placement !== undefined && (

                  <div className="text-right">

                    <p className="text-2xl font-bold">
                      #{game.placement}
                    </p>

                    <p className="text-sm text-zinc-400">
                      {game.win
                        ? "WIN"
                        : game.top4
                        ? "Top 4"
                        : "Bottom 4"}
                    </p>

                  </div>

                )}

              </div>


              {timeline.length === 0 ? (

                <p className="mt-5 text-zinc-500">
                  No decisions yet.
                </p>

              ) : (

                <div className="mt-6 space-y-4">

                  {timeline.map(
                    entry => (

                      <div
                        key={entry.event.id}
                        className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"
                      >

                        <div className="flex flex-wrap justify-between gap-4">

                          <div>

                            <p className="font-bold">
                              Stage {entry.event.stage}-{entry.event.round}
                            </p>

                            <p className="mt-1 text-amber-300">
                              {prettyName(
                                entry.event.event_type
                              )}
                            </p>

                          </div>


                          <div className="text-right text-sm text-zinc-500">

                            {entry.event.hp !== null && (
                              <div>
                                HP {entry.event.hp}
                              </div>
                            )}

                            {entry.event.gold !== null && (
                              <div>
                                Gold {entry.event.gold}
                              </div>
                            )}

                            {entry.event.level !== null && (
                              <div>
                                Level {entry.event.level}
                              </div>
                            )}

                            {entry.event.streak_length !== null && (
                              <div>
                                Streak {entry.event.streak_length}
                              </div>
                            )}

                          </div>

                        </div>


                        <div className="mt-4 space-y-2">

                          {entry.decisions.length === 0 && (

                            <p className="text-sm text-zinc-600">
                              No response logged.
                            </p>

                          )}


                          {entry.decisions.map(
                            decision => (

                              <div
                                key={decision.id}
                                className="rounded-lg bg-zinc-900 px-3 py-3"
                              >

                                <p>

                                  <span className="mr-2 text-zinc-500">
                                    #{decision.sequence_order}
                                  </span>

                                  <span className="font-medium">
                                    {prettyName(
                                      decision.decision_type
                                    )}
                                  </span>

                                </p>


                                {decision.notes && (

                                  <p className="mt-1 text-sm text-zinc-500">
                                    {decision.notes}
                                  </p>

                                )}

                              </div>

                            )
                          )}

                        </div>

                      </div>

                    )
                  )}

                </div>

              )}

            </section>


            {riotMatch && (

              <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

                <div className="flex flex-wrap justify-between gap-4">

                  <div>

                    <p className="text-sm text-zinc-500">
                      Official Riot Result
                    </p>

                    <h2 className="mt-1 text-4xl font-bold">
                      #{riotMatch.placement}
                    </h2>

                  </div>


                  <div className="text-right">

                    <p className="font-semibold">
                      {riotMatch.win
                        ? "WIN"
                        : riotMatch.top4
                        ? "Top 4"
                        : "Bottom 4"}
                    </p>

                    <p className="mt-1 text-sm text-zinc-500">
                      Level {riotMatch.level ?? "—"}
                    </p>

                    <p className="text-sm text-zinc-500">
                      Last Round {riotMatch.last_round ?? "—"}
                    </p>

                  </div>

                </div>


                <h3 className="mt-7 text-lg font-semibold">
                  Final Board
                </h3>


                <div className="mt-3 grid gap-3 md:grid-cols-2">

                  {riotMatch.units.map(
                    (unit, index) => (

                      <div
                        key={`${unit.character_id}-${index}`}
                        className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"
                      >

                        <p className="font-medium">
                          {unit.character_id ?? "Unknown Unit"}
                        </p>

                        <p className="mt-1 text-sm text-zinc-500">
                          {unit.tier ?? "?"}★
                        </p>

                        {unit.items.length > 0 && (

                          <p className="mt-2 break-words text-xs text-zinc-500">
                            Items: {unit.items.join(", ")}
                          </p>

                        )}

                      </div>

                    )
                  )}

                </div>


                <h3 className="mt-7 text-lg font-semibold">
                  Traits
                </h3>


                <div className="mt-3 flex flex-wrap gap-2">

                  {riotMatch.traits.map(
                    (trait, index) => (

                      <span
                        key={`${trait.name}-${index}`}
                        className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                      >
                        {trait.name ?? "Unknown Trait"}

                        {trait.num_units !== null &&
                          ` · ${trait.num_units}`}
                      </span>

                    )
                  )}

                </div>

              </section>

            )}


            {game?.status === "COMPLETED" && (

              <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

                <h2 className="text-xl font-semibold">
                  Ready for another game?
                </h2>

                <button
                  onClick={newSession}
                  className="mt-4 rounded-xl bg-zinc-100 px-6 py-3 font-semibold text-zinc-950 hover:bg-white"
                >
                  Start New Session
                </button>

              </section>

            )}

          </>

        )}


        {message && (

          <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-300">
            {message}
          </div>

        )}

      </div>

    </main>
  );
}