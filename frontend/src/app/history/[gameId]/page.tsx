"use client";

import Link from "next/link";

import {
  use,
  useEffect,
  useState
} from "react";


const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000";


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
};


type TimelineEntry = {
  event: GameEvent;
  decisions: Decision[];
};


type Game = {

  id: number;

  initial_strategy: string;

  placement: number | null;

  top4: boolean | null;

  win: boolean | null;

  status: string;
};


type TimelineResponse = {

  game: Game;

  timeline: TimelineEntry[];
};


function pretty(
  value: string
) {

  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(
      /\b\w/g,
      char => char.toUpperCase()
    );
}


export default function MatchPage({

  params

}: {

  params: Promise<{
    gameId: string
  }>

}) {

  const resolvedParams =
    use(params);

  const gameId =
    resolvedParams.gameId;


  const [
    data,
    setData
  ] =
    useState<TimelineResponse | null>(
      null
    );


  const [
    message,
    setMessage
  ] =
    useState("");


  useEffect(() => {

    loadMatch();

  }, []);


  async function loadMatch() {

    try {

      const response = await fetch(
        `${API_URL}/api/games/${gameId}/timeline`
      );


      if (!response.ok) {

        throw new Error(
          "Could not load match."
        );
      }


      setData(
        await response.json()
      );


    } catch (error) {

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load match."
      );
    }
  }


  return (

    <main className="min-h-screen bg-zinc-950 text-zinc-100">

      <div className="mx-auto max-w-4xl px-5 py-10">


        <Link
          href="/history"
          className="text-sm text-violet-400"
        >
          ← Match History
        </Link>


        {data && (

          <>

            <header className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

              <p className="text-sm text-zinc-500">
                Game #{data.game.id}
              </p>


              <div className="mt-2 flex justify-between gap-4">

                <div>

                  <h1 className="text-3xl font-bold">
                    {pretty(
                      data.game.initial_strategy
                    )}
                  </h1>

                </div>


                {data.game.placement && (

                  <div className="text-right">

                    <p className="text-4xl font-bold">
                      #{data.game.placement}
                    </p>

                    <p className="text-sm text-zinc-500">

                      {data.game.win
                        ? "WIN"
                        : data.game.top4
                        ? "Top 4"
                        : "Bottom 4"}

                    </p>

                  </div>

                )}

              </div>

            </header>


            <section className="mt-6">

              <h2 className="text-xl font-semibold">
                Decision Timeline
              </h2>


              <div className="mt-4 space-y-4">

                {data.timeline.map(
                  entry => (

                    <div
                      key={
                        entry.event.id
                      }
                      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
                    >

                      <p className="font-bold">

                        Stage{" "}
                        {entry.event.stage}
                        -
                        {entry.event.round}

                      </p>


                      <p className="mt-1 text-amber-300">

                        {pretty(
                          entry.event.event_type
                        )}

                      </p>


                      {(entry.event.hp !== null ||
                        entry.event.gold !== null ||
                        entry.event.level !== null) && (

                        <p className="mt-2 text-sm text-zinc-500">

                          {entry.event.hp !== null &&
                            `HP ${entry.event.hp} `}

                          {entry.event.gold !== null &&
                            `· Gold ${entry.event.gold} `}

                          {entry.event.level !== null &&
                            `· Level ${entry.event.level}`}

                        </p>

                      )}


                      <div className="mt-4 space-y-2">

                        {entry.decisions.map(
                          decision => (

                            <div
                              key={
                                decision.id
                              }
                              className="rounded-xl bg-zinc-950 p-3"
                            >

                              <p>

                                <span className="mr-2 text-zinc-500">
                                  #{decision.sequence_order}
                                </span>

                                {pretty(
                                  decision.decision_type
                                )}

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

            </section>

          </>

        )}


        {message && (
          <p className="mt-8">
            {message}
          </p>
        )}

      </div>

    </main>
  );
}