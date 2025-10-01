import React, { createContext, useContext, useMemo, useReducer } from "react";

const AppContext = createContext();

const initial = {
  simSpeed: 1,
  drag: 1,
  overlayType: "none",      // "none" | "atmoRivers" | "elNino"
  overlayDate: new Date().toISOString().slice(0, 10),
  selection: null,          // last hovered/clicked info from Globe3D
  queue: [],                // [{ id, name, kind, alt_km, inc_deg, raan_deg }]
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_SIM_SPEED":   return { ...state, simSpeed: action.value };
    case "SET_DRAG":        return { ...state, drag: action.value };
    case "SET_OVERLAY":     return { ...state, overlayType: action.value };
    case "SET_OVERLAY_DATE":return { ...state, overlayDate: action.value };
    case "SET_SELECTION":   return { ...state, selection: action.value };
    case "ADD_TO_QUEUE": {
      const item = action.item;
      const id = item?.name ?? String(Date.now());
      if (state.queue.find(q => q.id === id)) return state;
      const qItem = {
        id,
        name: item.name ?? id,
        kind: item.kind ?? "sat",
        alt_km: item.alt_km ?? NaN,
        inc_deg: item.inc_deg ?? NaN,
        raan_deg: item.raan_deg ?? NaN,
      };
      const queue = [...state.queue, qItem];
      return { ...state, queue };
    }
    case "REMOVE_FROM_QUEUE":
      return { ...state, queue: state.queue.filter(q => q.id !== action.id) };
    case "CLEAR_QUEUE":     return { ...state, queue: [] };
    case "LOAD_QUEUE":
      return { ...state, queue: Array.isArray(action.items) ? action.items : [] };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initial);

  const actions = useMemo(() => ({
    setSimSpeed: (v) => dispatch({ type: "SET_SIM_SPEED", value: v }),
    setDrag: (v) => dispatch({ type: "SET_DRAG", value: v }),
    setOverlay: (v) => dispatch({ type: "SET_OVERLAY", value: v }),
    setOverlayDate: (d) => dispatch({ type: "SET_OVERLAY_DATE", value: d }),
    setSelection: (s) => dispatch({ type: "SET_SELECTION", value: s }),
    addToQueue: (item) => dispatch({ type: "ADD_TO_QUEUE", item }),
    removeFromQueue: (id) => dispatch({ type: "REMOVE_FROM_QUEUE", id }),
    clearQueue: () => dispatch({ type: "CLEAR_QUEUE" }),
    loadQueue: (items) => dispatch({ type: "LOAD_QUEUE", items }),
  }), []);

  return (
    <AppContext.Provider value={{ state, actions }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
