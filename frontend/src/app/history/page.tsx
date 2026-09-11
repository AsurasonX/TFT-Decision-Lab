"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000";


type Game = {
  id: number;
  game_name: string;
  tag_line: string;

  riot_match_id?: string | null;

  initial_strategy: string;

  status: string;

  started_at?: string | null;
  completed_at?: string | null;

  placement?: number | null;

  top4?: boolean | null;
  win?: boolean | null;

  patch?: string | null;
};


function displayLabel(value: string) {
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


function formatDate(
  value?: string | null
) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleString();
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
  }

  return fallback;
}


export default function HistoryPage() {
  const [
    gameName,
    setGameName,
  ] = useState("");

  const [
    tagLine,
    setTagLine,
  ] = useState("");

  const [
    games,
    setGames,
  ] = useState<Game[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    deletingGameId,
    setDeletingGameId,
  ] = useState<number | null>(
    null
  );

  const [
    message,
    setMessage,
  ] = useState("");


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

    if (
      savedGameName &&
      savedTagLine
    ) {
      loadHistory(
        savedGameName,
        savedTagLine
      );
    }
  }, []);


  // -------------------------------------------------------
  // LOAD HISTORY
  // -------------------------------------------------------

  async function loadHistory(
    nameOverride?: string,
    tagOverride?: string
  ) {
    const name =
      nameOverride ??
      gameName.trim();

    const tag =
      tagOverride ??
      tagLine.trim();

    if (
      !name ||
      !tag
    ) {
      setMessage(
        "Enter your Riot game name and tag line."
      );

      return;
    }

    localStorage.setItem(
      "tft_game_name",
      name
    );

    localStorage.setItem(
      "tft_tag_line",
      tag
    );

    setLoading(true);
    setMessage("");

    try {
      const response =
        await fetch(
          `${API_URL}/api/games/history/${encodeURIComponent(
            name
          )}/${encodeURIComponent(
            tag
          )}?limit=100`
        );

      const data =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          getErrorMessage(
            data,
            "Could not load history."
          )
        );
      }

      /*
       * Supports either:
       *
       * { games: [...] }
       *
       * or a direct array,
       * in case older backend code is used.
       */

      const loadedGames:
        Game[] =
        Array.isArray(data)
          ? data
          : data.games ?? [];

      setGames(
        loadedGames
      );

      if (
        loadedGames.length === 0
      ) {
        setMessage(
          "No Decision Lab games found."
        );
      }
    } catch (
      error
    ) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load history."
      );
    } finally {
      setLoading(false);
    }
  }


  // -------------------------------------------------------
  // DELETE TEST RUN
  // -------------------------------------------------------

  async function deleteGame(gameId: number) {
  const game = games.find(
    (item) => item.id === gameId
  );

  const gameDescription =
    game?.placement != null
      ? `Game #${gameId} — Placement #${game.placement}`
      : `Game #${gameId}`;

  const confirmed = window.confirm(
    `Delete ${gameDescription} permanently?\n\n` +
      `This removes the local Decision Lab test run, ` +
      `including its events, decisions, and Riot snapshot.\n\n` +
      `It does NOT delete the actual Riot match.\n\n` +
      `This cannot be undone.`
  );

  if (!confirmed) {
    return;
  }

  setDeletingGameId(gameId);
  setMessage("");

  try {
    const response = await fetch(
      `${API_URL}/api/games/${gameId}`,
      {
        method: "DELETE",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        getErrorMessage(
          data,
          "Could not delete game."
        )
      );
    }

    // Immediately remove it visually
    setGames((currentGames) =>
      currentGames.filter(
        (item) => item.id !== gameId
      )
    );

    // Then reload from the backend/database
    await loadHistory();

    setMessage(
      `Game #${gameId} deleted successfully.`
    );
  } catch (error) {
    setMessage(
      error instanceof Error
        ? error.message
        : "Could not delete game."
    );
  } finally {
    setDeletingGameId(null);
  }
}

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100">
      <div className="mx-auto max-w-5xl">

        {/* HEADER */}

        <header className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <h1 className="text-3xl font-bold">
                Match History
              </h1>

              <p className="mt-2 text-sm text-zinc-400">
                Review Decision Lab sessions
                and remove test runs.
              </p>
            </div>

            <nav className="flex flex-wrap gap-2">

              <Link
                href="/"
                className="rounded-xl border border-zinc-800 px-4 py-2 text-sm transition hover:border-zinc-600"
              >
                Logger
              </Link>

              <Link
                href="/history"
                className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm"
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


        {/* PLAYER */}

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
                    event.target
                      .value
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
                    event.target
                      .value
                  )
                }
                placeholder="JP1"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-zinc-500"
              />
            </div>

          </div>


          <button
            onClick={() =>
              loadHistory()
            }
            disabled={
              loading
            }
            className="mt-4 rounded-xl border border-zinc-700 px-4 py-2 text-sm transition hover:border-zinc-500 disabled:opacity-50"
          >
            {loading
              ? "Loading..."
              : "Load History"}
          </button>

        </section>


        {/* MESSAGE */}

        {message && (
          <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm">
            {message}
          </section>
        )}


        {/* HISTORY */}

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">

          <div className="flex items-center justify-between gap-4">

            <div>
              <h2 className="text-lg font-semibold">
                Decision Lab Games
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                {games.length} session
                {games.length === 1
                  ? ""
                  : "s"}
              </p>
            </div>

          </div>


          {games.length ===
          0 ? (
            <p className="mt-5 text-sm text-zinc-500">
              No games loaded.
            </p>
          ) : (
            <div className="mt-5 space-y-3">

              {games.map(
                (game) => (
                  <div
                    key={
                      game.id
                    }
                    className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"
                  >

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                      {/* GAME INFORMATION */}

                      <div>

                        <div className="flex flex-wrap items-center gap-2">

                          <h3 className="font-semibold">
                            Game #{game.id}
                          </h3>

                          <span
                            className={`rounded-full border px-2 py-0.5 text-xs ${
                              game.status ===
                              "COMPLETED"
                                ? "border-emerald-900 text-emerald-400"
                                : game.status ===
                                  "ABANDONED"
                                ? "border-amber-900 text-amber-400"
                                : "border-blue-900 text-blue-400"
                            }`}
                          >
                            {game.status}
                          </span>

                        </div>


                        <div className="mt-2 space-y-1 text-sm text-zinc-400">

                          <p>
                            Intent:{" "}
                            <span className="text-zinc-200">
                              {displayLabel(
                                game.initial_strategy
                              )}
                            </span>
                          </p>


                          <p>
                            Started:{" "}
                            <span className="text-zinc-300">
                              {formatDate(
                                game.started_at
                              )}
                            </span>
                          </p>


                          {game.placement !=
                            null && (
                            <p>
                              Placement:{" "}
                              <span className="font-semibold text-zinc-100">
                                #{game.placement}
                              </span>

                              {game.win &&
                                " — Win"}

                              {!game.win &&
                                game.top4 &&
                                " — Top 4"}
                            </p>
                          )}


                          {game.riot_match_id && (
                            <p className="break-all text-xs text-zinc-600">
                              Riot:{" "}
                              {
                                game.riot_match_id
                              }
                            </p>
                          )}

                        </div>
                      </div>


                      {/* ACTIONS */}

                      <div className="flex flex-wrap gap-2">

                        <Link
                          href={`/history/${game.id}`}
                          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm transition hover:border-zinc-500"
                        >
                          Review
                        </Link>


                        <button
                          type="button"
                          onClick={() =>
                            deleteGame(
                              game.id
                            )
                          }
                          disabled={
                            deletingGameId ===
                            game.id
                          }
                          className="rounded-lg border border-red-900 px-3 py-2 text-sm text-red-400 transition hover:border-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {deletingGameId ===
                          game.id
                            ? "Deleting..."
                            : "Delete Test Run"}
                        </button>

                      </div>

                    </div>
                  </div>
                )
              )}

            </div>
          )}

        </section>


        {/* WARNING */}

        <section className="mt-6 rounded-xl border border-amber-900/60 bg-amber-950/20 p-4">

          <p className="text-sm text-amber-300">
            Developer testing feature
          </p>

          <p className="mt-1 text-xs leading-5 text-zinc-500">
            Delete Test Run permanently
            removes the selected session
            from the local Decision Lab
            database. It does not delete
            or modify Riot match history.
          </p>

        </section>

      </div>
    </main>
  );
}