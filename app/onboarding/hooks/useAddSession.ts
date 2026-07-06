"use client";

import { useReducer } from "react";

interface AddSessionState {
  /** Selected `sport_types.id` (as string), or "" when none picked. */
  sportId: string;
  /** Weekday ids (0-6) the session will be added to. */
  days: Set<number>;
  /** Whether the collapsed time / repeat-until block is open. */
  moreOptionsOpen: boolean;
}

type AddSessionAction =
  | { type: "selectSport"; sportId: string }
  | { type: "toggleDay"; day: number }
  | { type: "toggleMoreOptions" }
  | { type: "reset"; entryDay: number };

function initState(entryDay: number): AddSessionState {
  return { sportId: "", days: new Set([entryDay]), moreOptionsOpen: false };
}

function reducer(
  state: AddSessionState,
  action: AddSessionAction,
): AddSessionState {
  switch (action.type) {
    case "selectSport":
      return {
        ...state,
        sportId: state.sportId === action.sportId ? "" : action.sportId,
      };
    case "toggleDay": {
      const days = new Set(state.days);
      if (days.has(action.day)) days.delete(action.day);
      else days.add(action.day);
      return { ...state, days };
    }
    case "toggleMoreOptions":
      return { ...state, moreOptionsOpen: !state.moreOptionsOpen };
    case "reset":
      return initState(action.entryDay);
    default:
      return state;
  }
}

/**
 * Local state for the inline day-first session picker: which sport is chosen,
 * which days it fans out to (the tapped day pre-selected), and whether the
 * optional time / repeat-until block is expanded. Grouped into a reducer since
 * the three fields change together across the flow.
 */
export function useAddSession(entryDay: number) {
  const [state, dispatch] = useReducer(reducer, entryDay, initState);

  return {
    sportId: state.sportId,
    days: state.days,
    moreOptionsOpen: state.moreOptionsOpen,
    canAdd: state.sportId !== "" && state.days.size > 0,
    selectSport: (sportId: string) =>
      dispatch({ type: "selectSport", sportId }),
    toggleDay: (day: number) => dispatch({ type: "toggleDay", day }),
    toggleMoreOptions: () => dispatch({ type: "toggleMoreOptions" }),
    reset: () => dispatch({ type: "reset", entryDay }),
  };
}
