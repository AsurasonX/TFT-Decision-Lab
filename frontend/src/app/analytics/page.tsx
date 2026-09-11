"use client";

import Link from "next/link";

import {
  useEffect,
  useState
} from "react";


const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000";


/* ==========================================
   TYPES
========================================== */

type StrategyResult = {
  strategy: string;
  games: number;
  top4_rate: number | null;
  win_rate: number | null;
  average_placement: number | null;
};


type SummaryResponse = {
  total_games: number;
  top4_rate: number | null;
  win_rate: number | null;
  average_placement: number | null;

  strategy_results?: StrategyResult[];

  strategies?: StrategyResult[];
};


type EventResponseItem = {
  decision_type: string;
  occurrences: number;
  decision_percentage: number | null;
  top4_rate: number | null;
  win_rate: number | null;
  average_placement: number | null;
};


type EventAnalysisResponse = {
  event_type: string;
  stage: number | null;
  occurrences: number;
  responses: EventResponseItem[];
};


type SequenceResponseItem = {
  sequence: string;
  occurrences: number;
  top4_rate: number | null;
  win_rate: number | null;
  average_placement: number | null;
};


type SequenceAnalysisResponse = {
  event_type: string;
  stage: number | null;
  sequences: SequenceResponseItem[];
};


/* ==========================================
   OPTIONS
========================================== */

const eventTypes = [
  "LOSE_STREAK_BROKEN",
  "WIN_STREAK_BROKEN",
  "UNEXPECTED_WIN",
  "UNEXPECTED_LOSS",
  "LOW_HP",
  "STAGE_TRANSITION"
];


const stages = [
  2,
  3,
  4,
  5,
  6
];


/* ==========================================
   HELPERS
========================================== */

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


function formatPercent(
  value:
    number |
    null |
    undefined
) {

  if (
    value === null ||
    value === undefined
  ) {

    return "—";
  }


  return `${value.toFixed(1)}%`;
}


function formatPlacement(
  value:
    number |
    null |
    undefined
) {

  if (
    value === null ||
    value === undefined
  ) {

    return "—";
  }


  return value.toFixed(2);
}


function sampleLabel(
  count: number
) {

  if (
    count < 5
  ) {

    return {
      text:
        "Very small sample",

      className:
        "text-red-400"
    };
  }


  if (
    count < 15
  ) {

    return {
      text:
        "Small sample",

      className:
        "text-amber-400"
    };
  }


  if (
    count < 30
  ) {

    return {
      text:
        "Developing sample",

      className:
        "text-yellow-300"
    };
  }


  return {
    text:
      "Stronger sample",

    className:
      "text-emerald-400"
  };
}


/* ==========================================
   ANALYTICS PAGE
========================================== */

export default function AnalyticsPage() {


  /* ========================================
     PLAYER
  ======================================== */

  const [
    gameName,
    setGameName
  ] = useState(
    ""
  );


  const [
    tagLine,
    setTagLine
  ] = useState(
    "JP1"
  );


  /* ========================================
     FILTERS
  ======================================== */

  const [
    eventType,
    setEventType
  ] = useState(
    "LOSE_STREAK_BROKEN"
  );


  const [
    stage,
    setStage
  ] = useState<
    number | null
  >(
    2
  );


  /* ========================================
     DATA
  ======================================== */

  const [
    summary,
    setSummary
  ] =
    useState<
      SummaryResponse | null
    >(
      null
    );


  const [
    eventAnalysis,
    setEventAnalysis
  ] =
    useState<
      EventAnalysisResponse | null
    >(
      null
    );


  const [
    sequenceAnalysis,
    setSequenceAnalysis
  ] =
    useState<
      SequenceAnalysisResponse | null
    >(
      null
    );


  /* ========================================
     UI
  ======================================== */

  const [
    loading,
    setLoading
  ] = useState(
    false
  );


  const [
    message,
    setMessage
  ] = useState(
    ""
  );


  /* ========================================
     LOAD SAVED RIOT ID
  ======================================== */

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


  /* ========================================
     LOAD ALL ANALYTICS
  ======================================== */

  async function loadAnalytics() {

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


    setLoading(
      true
    );


    setMessage(
      ""
    );


    try {

      const encodedName =
        encodeURIComponent(
          gameName.trim()
        );


      const encodedTag =
        encodeURIComponent(
          tagLine.trim()
        );


      const encodedEventType =
        encodeURIComponent(
          eventType
        );


      const stageQuery =
        stage === null
          ? ""
          : `&stage=${stage}`;


      const [
        summaryResponse,
        eventResponse,
        sequenceResponse
      ] =
        await Promise.all([

          fetch(
            `${API_URL}/api/analytics/${encodedName}/${encodedTag}/summary`
          ),

          fetch(
            `${API_URL}/api/analytics/${encodedName}/${encodedTag}/events?event_type=${encodedEventType}${stageQuery}`
          ),

          fetch(
            `${API_URL}/api/analytics/${encodedName}/${encodedTag}/sequences?event_type=${encodedEventType}${stageQuery}`
          )

        ]);


      if (
        !summaryResponse.ok
      ) {

        throw new Error(
          "Could not load player summary."
        );
      }


      if (
        !eventResponse.ok
      ) {

        throw new Error(
          "Could not load event analytics."
        );
      }


      if (
        !sequenceResponse.ok
      ) {

        throw new Error(
          "Could not load sequence analytics."
        );
      }


      const summaryData:
        SummaryResponse =
          await summaryResponse.json();


      const eventData:
        EventAnalysisResponse =
          await eventResponse.json();


      const sequenceData:
        SequenceAnalysisResponse =
          await sequenceResponse.json();


      setSummary(
        summaryData
      );


      setEventAnalysis(
        eventData
      );


      setSequenceAnalysis(
        sequenceData
      );


      setMessage(
        "Analytics updated."
      );


    } catch (
      error
    ) {

      setMessage(

        error instanceof Error

          ? error.message

          : "Could not load analytics."
      );


    } finally {

      setLoading(
        false
      );
    }
  }


  /* ========================================
     NORMALIZE STRATEGY RESULTS
  ======================================== */

  const strategyResults =
    summary?.strategy_results ??
    summary?.strategies ??
    [];


  /* ========================================
     UI
  ======================================== */

  return (

    <main className="min-h-screen bg-zinc-950 text-zinc-100">

      <div className="mx-auto max-w-6xl px-5 py-10">


        {/* =================================
            HEADER
        ================================= */}

        <header>

          <div className="flex flex-wrap items-start justify-between gap-5">


            <div>

              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-violet-400">
                Behavioral Analytics
              </p>


              <h1 className="mt-2 text-4xl font-bold">
                TFT Decision Lab
              </h1>


              <p className="mt-3 max-w-2xl text-zinc-400">
                See how your recurring decisions
                are associated with Top-4 rate,
                win rate and average placement.
              </p>

            </div>


            <nav className="flex flex-wrap gap-2">

              <Link
                href="/"
                className="rounded-lg border border-zinc-700 px-4 py-2 transition hover:border-violet-500"
              >
                Logger
              </Link>


              <Link
                href="/history"
                className="rounded-lg border border-zinc-700 px-4 py-2 transition hover:border-violet-500"
              >
                History
              </Link>


              <Link
                href="/analytics"
                className="rounded-lg border border-violet-500 px-4 py-2"
              >
                Analytics
              </Link>

            </nav>


          </div>

        </header>


        {/* =================================
            PLAYER / FILTERS
        ================================= */}

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">


          <h2 className="text-xl font-semibold">
            Analytics Filters
          </h2>


          <div className="mt-5 grid gap-4 md:grid-cols-2">


            <div>

              <label className="mb-2 block text-sm text-zinc-400">
                Riot Game Name
              </label>


              <input

                value={
                  gameName
                }

                onChange={
                  event =>
                    setGameName(
                      event.target.value
                    )
                }

                placeholder="Riot Game Name"

                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition focus:border-violet-500"
              />

            </div>


            <div>

              <label className="mb-2 block text-sm text-zinc-400">
                Tag Line
              </label>


              <input

                value={
                  tagLine
                }

                onChange={
                  event =>
                    setTagLine(
                      event.target.value
                    )
                }

                placeholder="JP1"

                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition focus:border-violet-500"
              />

            </div>


          </div>


          {/* EVENT FILTER */}

          <div className="mt-7">


            <p className="mb-3 text-sm font-medium text-zinc-300">
              Situation
            </p>


            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">


              {eventTypes.map(
                option => (

                  <button

                    key={
                      option
                    }

                    onClick={() =>
                      setEventType(
                        option
                      )
                    }

                    className={

                      eventType ===
                      option

                        ? "rounded-xl border border-violet-500 bg-violet-600/20 p-3 text-left font-medium text-violet-200"

                        : "rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-left text-zinc-300 transition hover:border-zinc-500"

                    }
                  >

                    {prettyName(
                      option
                    )}

                  </button>

                )
              )}


            </div>


          </div>


          {/* STAGE FILTER */}

          <div className="mt-7">


            <p className="mb-3 text-sm font-medium text-zinc-300">
              Stage
            </p>


            <div className="flex flex-wrap gap-2">


              <button

                onClick={() =>
                  setStage(
                    null
                  )
                }

                className={

                  stage === null

                    ? "rounded-lg bg-violet-600 px-4 py-2 font-semibold"

                    : "rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2"

                }
              >

                All Stages

              </button>


              {stages.map(
                stageNumber => (

                  <button

                    key={
                      stageNumber
                    }

                    onClick={() =>
                      setStage(
                        stageNumber
                      )
                    }

                    className={

                      stage ===
                      stageNumber

                        ? "rounded-lg bg-violet-600 px-4 py-2 font-semibold"

                        : "rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2"

                    }
                  >

                    Stage{" "}
                    {stageNumber}

                  </button>

                )
              )}


            </div>


          </div>


          <button

            onClick={
              loadAnalytics
            }

            disabled={
              loading
            }

            className="mt-7 rounded-xl bg-violet-600 px-6 py-3 font-semibold transition hover:bg-violet-500 disabled:opacity-50"
          >

            {loading
              ? "Loading Analytics..."
              : "Analyze Decisions"}

          </button>


        </section>


        {/* =================================
            PLAYER SUMMARY
        ================================= */}

        {summary && (

          <section className="mt-6">


            <div className="mb-4">

              <h2 className="text-2xl font-semibold">
                Overall Performance
              </h2>


              <p className="mt-1 text-sm text-zinc-500">
                Completed Decision Lab games only.
              </p>

            </div>


            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">


              {/* GAMES */}

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">

                <p className="text-sm text-zinc-500">
                  Games
                </p>

                <p className="mt-2 text-3xl font-bold">
                  {summary.total_games}
                </p>


                <p
                  className={
                    `mt-2 text-xs ${
                      sampleLabel(
                        summary.total_games
                      ).className
                    }`
                  }
                >
                  {
                    sampleLabel(
                      summary.total_games
                    ).text
                  }
                </p>

              </div>


              {/* TOP 4 */}

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">

                <p className="text-sm text-zinc-500">
                  Top 4 Rate
                </p>

                <p className="mt-2 text-3xl font-bold">
                  {formatPercent(
                    summary.top4_rate
                  )}
                </p>

              </div>


              {/* WIN */}

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">

                <p className="text-sm text-zinc-500">
                  Win Rate
                </p>

                <p className="mt-2 text-3xl font-bold">
                  {formatPercent(
                    summary.win_rate
                  )}
                </p>

              </div>


              {/* AVG */}

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">

                <p className="text-sm text-zinc-500">
                  Avg Placement
                </p>

                <p className="mt-2 text-3xl font-bold">
                  {formatPlacement(
                    summary.average_placement
                  )}
                </p>

              </div>


            </div>


          </section>

        )}


        {/* =================================
            OPENING INTENT
        ================================= */}

        {summary &&
         strategyResults.length > 0 && (

          <section className="mt-8">


            <div>

              <h2 className="text-2xl font-semibold">
                Opening Intent
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                Results grouped by how you intended
                to approach the game.
              </p>

            </div>


            <div className="mt-4 grid gap-4 md:grid-cols-2">


              {strategyResults.map(
                result => {

                  const sample =
                    sampleLabel(
                      result.games
                    );


                  return (

                    <div

                      key={
                        result.strategy
                      }

                      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
                    >

                      <div className="flex flex-wrap items-start justify-between gap-4">


                        <div>

                          <p className="font-semibold text-violet-300">

                            {prettyName(
                              result.strategy
                            )}

                          </p>

                          <p className="mt-1 text-sm text-zinc-500">

                            {result.games}{" "}

                            {result.games === 1
                              ? "game"
                              : "games"}

                          </p>

                          <p
                            className={
                              `mt-1 text-xs ${sample.className}`
                            }
                          >
                            {sample.text}
                          </p>

                        </div>


                        <div className="grid grid-cols-3 gap-5 text-right">


                          <div>

                            <p className="text-xs text-zinc-500">
                              Top 4
                            </p>

                            <p className="font-semibold">
                              {formatPercent(
                                result.top4_rate
                              )}
                            </p>

                          </div>


                          <div>

                            <p className="text-xs text-zinc-500">
                              Win
                            </p>

                            <p className="font-semibold">
                              {formatPercent(
                                result.win_rate
                              )}
                            </p>

                          </div>


                          <div>

                            <p className="text-xs text-zinc-500">
                              Avg
                            </p>

                            <p className="font-semibold">
                              {formatPlacement(
                                result.average_placement
                              )}
                            </p>

                          </div>


                        </div>


                      </div>

                    </div>

                  );

                }
              )}


            </div>


          </section>

        )}


        {/* =================================
            EVENT ANALYSIS
        ================================= */}

        {eventAnalysis && (

          <section className="mt-10">


            <div className="flex flex-wrap items-end justify-between gap-4">


              <div>

                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">
                  Situation Analysis
                </p>


                <h2 className="mt-2 text-2xl font-semibold">

                  When{" "}

                  {prettyName(
                    eventAnalysis.event_type
                  )}

                </h2>


                <p className="mt-2 text-sm text-zinc-500">

                  {eventAnalysis.stage !==
                    null

                    ? `Stage ${eventAnalysis.stage}`

                    : "All stages"}

                </p>

              </div>


              <div className="text-right">

                <p className="text-sm text-zinc-500">
                  Occurrences
                </p>

                <p className="text-3xl font-bold">
                  {eventAnalysis.occurrences}
                </p>

              </div>


            </div>


            {eventAnalysis.occurrences > 0 && (

              <p
                className={
                  `mt-2 text-sm ${
                    sampleLabel(
                      eventAnalysis.occurrences
                    ).className
                  }`
                }
              >

                {
                  sampleLabel(
                    eventAnalysis.occurrences
                  ).text
                }

              </p>

            )}


            {eventAnalysis.responses.length ===
              0 ? (

              <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

                <p className="text-zinc-500">
                  No recorded responses for this
                  situation yet.
                </p>

              </div>

            ) : (

              <div className="mt-5 grid gap-4 lg:grid-cols-2">


                {eventAnalysis.responses.map(
                  response => {

                    const sample =
                      sampleLabel(
                        response.occurrences
                      );


                    return (

                      <div

                        key={
                          response.decision_type
                        }

                        className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
                      >


                        <div className="flex flex-wrap justify-between gap-4">


                          <div>

                            <p className="text-lg font-semibold">
                              {prettyName(
                                response.decision_type
                              )}
                            </p>


                            <p className="mt-1 text-sm text-zinc-500">

                              Chosen{" "}

                              {formatPercent(
                                response.decision_percentage
                              )}

                            </p>


                            <p className="mt-1 text-sm text-zinc-500">

                              {response.occurrences}{" "}

                              {response.occurrences === 1
                                ? "occurrence"
                                : "occurrences"}

                            </p>


                            <p
                              className={
                                `mt-2 text-xs ${sample.className}`
                              }
                            >
                              {sample.text}
                            </p>

                          </div>


                          <div className="grid grid-cols-3 gap-5 text-right">


                            <div>

                              <p className="text-xs text-zinc-500">
                                Top 4
                              </p>

                              <p className="font-semibold">
                                {formatPercent(
                                  response.top4_rate
                                )}
                              </p>

                            </div>


                            <div>

                              <p className="text-xs text-zinc-500">
                                Win
                              </p>

                              <p className="font-semibold">
                                {formatPercent(
                                  response.win_rate
                                )}
                              </p>

                            </div>


                            <div>

                              <p className="text-xs text-zinc-500">
                                Avg
                              </p>

                              <p className="font-semibold">
                                {formatPlacement(
                                  response.average_placement
                                )}
                              </p>

                            </div>


                          </div>


                        </div>


                      </div>

                    );

                  }
                )}


              </div>

            )}


          </section>

        )}


        {/* =================================
            SEQUENCE ANALYSIS
        ================================= */}

        {sequenceAnalysis && (

          <section className="mt-10">


            <div>

              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
                Decision Sequences
              </p>


              <h2 className="mt-2 text-2xl font-semibold">
                What You Did Next
              </h2>


              <p className="mt-2 max-w-3xl text-sm text-zinc-500">

                These results describe what
                happened historically after each
                decision sequence. They do not
                prove that the decision caused the
                result.

              </p>


            </div>


            {sequenceAnalysis.sequences.length ===
              0 ? (

              <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

                <p className="text-zinc-500">
                  No decision sequences recorded
                  for this situation yet.
                </p>

              </div>

            ) : (

              <div className="mt-5 space-y-4">


                {sequenceAnalysis.sequences.map(
                  (
                    sequence,
                    index
                  ) => {

                    const sample =
                      sampleLabel(
                        sequence.occurrences
                      );


                    return (

                      <div

                        key={
                          `${sequence.sequence}-${index}`
                        }

                        className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
                      >


                        <div className="flex flex-wrap items-start justify-between gap-6">


                          <div className="min-w-0 flex-1">

                            <p className="text-sm text-zinc-500">
                              Sequence
                            </p>


                            <p className="mt-2 break-words text-lg font-semibold text-emerald-300">

                              {sequence.sequence
                                .split(" → ")
                                .map(
                                  prettyName
                                )
                                .join(" → ")}

                            </p>


                            <p className="mt-2 text-sm text-zinc-500">

                              {sequence.occurrences}{" "}

                              {sequence.occurrences === 1
                                ? "occurrence"
                                : "occurrences"}

                            </p>


                            <p
                              className={
                                `mt-1 text-xs ${sample.className}`
                              }
                            >
                              {sample.text}
                            </p>

                          </div>


                          <div className="grid grid-cols-3 gap-6 text-right">


                            <div>

                              <p className="text-xs text-zinc-500">
                                Top 4
                              </p>

                              <p className="font-semibold">
                                {formatPercent(
                                  sequence.top4_rate
                                )}
                              </p>

                            </div>


                            <div>

                              <p className="text-xs text-zinc-500">
                                Win
                              </p>

                              <p className="font-semibold">
                                {formatPercent(
                                  sequence.win_rate
                                )}
                              </p>

                            </div>


                            <div>

                              <p className="text-xs text-zinc-500">
                                Avg
                              </p>

                              <p className="font-semibold">
                                {formatPlacement(
                                  sequence.average_placement
                                )}
                              </p>

                            </div>


                          </div>


                        </div>


                      </div>

                    );

                  }
                )}


              </div>

            )}


          </section>

        )}


        {/* =================================
            EMPTY STATE
        ================================= */}

        {!summary &&
         !eventAnalysis &&
         !sequenceAnalysis && (

          <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">


            <p className="text-lg font-medium">
              Analyze your decision patterns
            </p>


            <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-500">

              Select a situation and stage above,
              then load your completed Decision
              Lab games.

            </p>


          </section>

        )}


        {/* =================================
            MESSAGE
        ================================= */}

        {message && (

          <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-300">

            {message}

          </div>

        )}


        {/* =================================
            DISCLAIMER
        ================================= */}

        {(summary ||
          eventAnalysis ||
          sequenceAnalysis) && (

          <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-950 p-4">


            <p className="text-xs leading-5 text-zinc-600">

              Decision Lab statistics summarize
              your recorded historical games.
              Higher Top-4 or win rates do not by
              themselves establish that one
              decision caused a better outcome.
              Interpret very small samples
              cautiously.

            </p>


          </div>

        )}


      </div>

    </main>
  );
}