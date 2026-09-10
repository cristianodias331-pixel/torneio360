import React from "react";

export default function TeamCupRoster({ team }) {
  return <span className="tc-roster tc-roster-paired">{team.athletes.map((athlete, index) => <span className="tc-roster-member" key={athlete.id}>
    {index % 2 === 1 && <span className="tc-roster-separator" aria-hidden="true"> | </span>}{athlete.name}{athlete.id === team.captainId ? " (C)" : ""}
  </span>)}</span>;
}
