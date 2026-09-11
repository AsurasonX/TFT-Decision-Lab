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

  started_at: string;

  placement: number | null;

  top4: boolean | null;

  win: boolean | null;

  riot_match_id: string | null;
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


export default function HistoryPage() {

  const [
    games,
    setGames
  ] = useState<Game[]>([]);

  const [
    gameName,
    setGameName
  ] = useState("");

  const [
    tagLine,
    setTagLine
  ] = useState("");

  const [
    message,
    setMessage
  ] = useState("");


  useEffect(() => {

    const storedName =
      localStorage.getItem(
        "tft_game_name"
      );

    const storedTag =
      localStorage.getItem(
        "tft_tag_line"
      );


    if (
      !storedName ||
      !storedTag
    ) {

      setMessage(
        "Start a game from the Logger first."
      );

      return;
    }


    setGameName(
      storedName
    );

    setTagLine(
      storedTag
    );


    loadGames(
      storedName,
      storedTag
    );

  }, []);


  async function loadGames(
    name: string,
    tag: string
  ) {

    try {

      const response = await fetch(
        `${API_URL}/api/games/history/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`
      );


      if (!response.ok) {

        throw new Error(
          "Could not load history."
        );
      }


      const data =
        await response.json();


      setGames(
        data.games
      );


    } catch (error) {

      setMessage(
        error instanceof Error
          ? error.message
          : "History failed."
      );
    }
  }


  return (

    <main className="min-h-screen bg-zinc-950 text-zinc-100">

      <div className="mx-auto max-w-5xl px-5 py-10">


        <header className="flex flex-wrap items-center justify-between gap-4">

          <div>

            <p className="text-sm uppercase tracking-[0.25em] text-violet-400">
              TFT Decision Lab
            </p>

            <h1 className="mt-2 text-4xl font-bold">
              Match History
            </h1>

            {gameName && (

              <p className="mt-2 text-zinc-500">
                {gameName}#{tagLine}
              </p>

            )}

          </div>


          <nav className="flex gap-2">

            <Link
              href="/"
              className="rounded-lg border border-zinc-700 px-4 py-2"
            >
              Logger
            </Link>

            <Link
              href="/analytics"
              className="rounded-lg border border-zinc-700 px-4 py-2"
            >
              Analytics
            </Link>

          </nav>

        </header>


        <div className="mt-8 space-y-4">

          {games.map(
            game => (

              <Link

                key={
                  game.id
                }

                href={
                  `/history/${game.id}`
                }

                className="block rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-violet-500"
              >

                <div className="flex items-center justify-between gap-4">


                  <div>

                    <p className="text-sm text-zinc-500">
                      Game #{game.id}
                    </p>

                    <h2 className="mt-1 text-lg font-semibold">
                      {pretty(
                        game.initial_strategy
                      )}
                    </h2>

                  </div>


                  <div className="text-right">

                    {game.placement !== null ? (

                      <>

                        <p className="text-3xl font-bold">
                          #{game.placement}
                        </p>

                        <p className="text-sm text-zinc-500">

                          {game.win
                            ? "WIN"
                            : game.top4
                            ? "Top 4"
                            : "Bottom 4"}

                        </p>

                      </>

                    ) : (

                      <p className="text-amber-400">
                        {game.status}
                      </p>

                    )}

                  </div>

                </div>


                <p className="mt-4 text-xs text-zinc-600">

                  {new Date(
                    game.started_at
                  ).toLocaleString()}

                </p>

              </Link>

            )
          )}

        </div>


        {games.length === 0 &&
          !message && (

          <p className="mt-10 text-zinc-500">
            No Decision Lab games yet.
          </p>

        )}


        {message && (

          <p className="mt-8 text-zinc-400">
            {message}
          </p>

        )}

      </div>

    </main>
  );
}