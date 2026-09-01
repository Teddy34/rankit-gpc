"use client";

import { useMemo, useState } from "react";
import type { RatingHistoryPlayer } from "@/domain/rating-history";

const width = 960;
const height = 480;
const margin = { top: 28, right: 28, bottom: 52, left: 64 };
const colors = ["#b7f34b", "#63d8ff", "#ff8bb5", "#ffc857", "#a78bfa", "#4ade80", "#fb7185", "#38bdf8", "#f97316", "#e879f9", "#2dd4bf", "#facc15"];

function tickIndexes(eventCount: number): number[] {
  if (eventCount === 0) return [0];
  const count = Math.min(6, eventCount + 1);
  return [...new Set(Array.from({ length: count }, (_, index) => Math.round(index * eventCount / (count - 1))))];
}

export function RatingHistoryChart({ players, eventDates }: { players: RatingHistoryPlayer[]; eventDates: string[] }) {
  const [selected, setSelected] = useState(() => new Set(players.map((player) => player.id)));
  const visiblePlayers = players.filter((player) => selected.has(player.id) && player.points.length > 0);
  const eventCount = eventDates.length;
  const allRatings = visiblePlayers.flatMap((player) => player.points.map((point) => point.rating));
  const rawMin = allRatings.length ? Math.min(...allRatings) : 1400;
  const rawMax = allRatings.length ? Math.max(...allRatings) : 1600;
  const yMin = Math.floor((rawMin - 25) / 50) * 50;
  const yMax = Math.ceil((rawMax + 25) / 50) * 50 || yMin + 50;
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const x = (eventIndex: number) => margin.left + (eventCount ? eventIndex / eventCount : 0) * plotWidth;
  const y = (rating: number) => margin.top + (yMax - rating) / (yMax - yMin) * plotHeight;
  const yTicks = useMemo(() => Array.from({ length: 5 }, (_, index) => Math.round(yMax - index * (yMax - yMin) / 4)), [yMax, yMin]);
  const xTicks = tickIndexes(eventCount);

  function togglePlayer(id: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return <section className="history-layout">
    <aside className="panel history-filter" aria-labelledby="player-filter-title">
      <div className="panel-heading"><h2 id="player-filter-title">Players</h2><span>{selected.size} selected</span></div>
      <div className="filter-actions"><button type="button" onClick={() => setSelected(new Set(players.map((player) => player.id)))}>All</button><button type="button" onClick={() => setSelected(new Set())}>None</button></div>
      <div className="player-filters">
        {players.map((player, index) => <label key={player.id}>
          <input type="checkbox" checked={selected.has(player.id)} onChange={() => togglePlayer(player.id)} />
          <i style={{ backgroundColor: colors[index % colors.length] }} />
          <span>{player.avatar} {player.displayName}<small>{player.retired ? "Retired" : player.points.length ? "Active" : "No games"}</small></span>
        </label>)}
      </div>
    </aside>

    <section className="panel history-chart-panel" aria-labelledby="chart-title">
      <div className="panel-heading"><h2 id="chart-title">Elo history</h2><span>{eventCount} event{eventCount === 1 ? "" : "s"}</span></div>
      {eventCount === 0 ? <p className="empty-state">The graph will appear after the first game.</p> : visiblePlayers.length === 0 ? <p className="empty-state">Select a player with game history to show their rating.</p> : <div className="chart-scroll">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="chart-svg-title chart-svg-description">
          <title id="chart-svg-title">Player Elo rating history</title>
          <desc id="chart-svg-description">A line graph showing selected players&apos; Elo ratings after each recorded game, with admin resets marked as filled points.</desc>
          {yTicks.map((tick) => <g key={tick}><line className="chart-grid" x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} /><text className="chart-axis-label" x={margin.left - 12} y={y(tick) + 4} textAnchor="end">{tick}</text></g>)}
          {xTicks.map((tick) => <g key={tick}><line className="chart-tick" x1={x(tick)} x2={x(tick)} y1={height - margin.bottom} y2={height - margin.bottom + 6} /><text className="chart-axis-label" x={x(tick)} y={height - 22} textAnchor={tick === 0 ? "start" : tick === eventCount ? "end" : "middle"}>{tick === 0 ? eventDates[0] : eventDates[tick - 1]}</text></g>)}
          <line className="chart-axis" x1={margin.left} x2={width - margin.right} y1={height - margin.bottom} y2={height - margin.bottom} />
          {players.map((player, index) => selected.has(player.id) && player.points.length > 0 ? <g key={player.id} style={{ color: colors[index % colors.length] }}>
            <polyline className="rating-line" points={player.points.map((point) => `${x(point.eventIndex)},${y(point.rating)}`).join(" ")} />
            {player.points.map((point, pointIndex) => <circle
              className={point.kind === "reset" ? "rating-point-reset" : "rating-point"}
              key={`${point.eventIndex}-${pointIndex}`}
              cx={x(point.eventIndex)}
              cy={y(point.rating)}
              r={point.kind === "reset" ? "5" : "4"}
            ><title>{player.displayName}: {point.rating} on {point.date}{point.kind === "reset" ? " (Elo reset by an admin)" : ""}</title></circle>)}
          </g> : null)}
        </svg>
      </div>}
    </section>
  </section>;
}
