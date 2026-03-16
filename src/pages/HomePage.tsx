import { useState } from "react";
import { SectionTitle, Widget, SeeMore } from "@/components/hubteam-ui";

// ─── Types ─────────────────────────────────────────────────────────────────

interface LateProject {
  name: string;
  client: string;
  daysLate: number;
}

interface FollowUp {
  client: string;
  daysLate: number;
}

interface Task {
  id: string;
  client: string;
  title: string;
  priority: "Haute" | "Moyenne" | "Basse";
  date: string;
  project: string;
}

interface TodoItem {
  id: string;
  label: string;
  done: boolean;
}

interface DaySchedule {
  label: string;
  date: string;
  isToday: boolean;
  tasks: string[];
}

// ─── Mock data ──────────────────────────────────────────────────────────────

const LATE_PROJECTS: LateProject[] = [
  { name: "Site CASO",           client: "BORDESCA – DISCOURS ET CABAUD", daysLate: 16 },
  { name: "GEO BLANCHON",        client: "BLANCHON",                      daysLate: 27 },
  { name: "Accompagnement 2026", client: "Christian Delorme",             daysLate: 30 },
  { name: "Positionnement Ytong",client: "XELLA THERMOPIERRE",            daysLate: 30 },
  { name: "Wolf Oil 2026",       client: "WOLF OIL",                      daysLate: 30 },
];

const FOLLOW_UPS: FollowUp[] = [
  { client: "XELLA THERMOPIERRE",       daysLate: 14 },
  { client: "Point S",                  daysLate: 19 },
  { client: "SAS Groupe SEB France",    daysLate: 20 },
  { client: "MAVIC GROUP",              daysLate: 21 },
  { client: "WORLDWIDE EURO PROTECTION",daysLate: 23 },
];

const TASKS: Task[] = [
  { id:"1",  client:"SAS GROUPE SEB FRANCE", title:"Fabrication du Prototype",              priority:"Haute",   date:"27/01/2025", project:"Tabliers Lagostina" },
  { id:"2",  client:"",                      title:"Caler un rendez-vous / visio",           priority:"Haute",   date:"13/01/2026", project:"" },
  { id:"3",  client:"",                      title:"Design maquettes homepage",              priority:"Haute",   date:"30/07/2025", project:"" },
  { id:"4",  client:"CHRISTIAN DELORME",     title:"Relancer The Geek Family pour Odoo",     priority:"Moyenne", date:"15/02/2025", project:"Stratégie BS Christian Delorme" },
  { id:"5",  client:"BPW FRANCE",            title:"Réexpédier la servante FACOM",           priority:"Moyenne", date:"09/10/2025", project:"Maud Soutrans" },
  { id:"6",  client:"BRISACH",               title:"Faire un devis pour analyse des besoins",priority:"Moyenne", date:"03/10/2025", project:"ERP Brisach" },
  { id:"7",  client:"",                      title:"Tâche du projet client",                 priority:"Moyenne", date:"03/10/2025", project:"" },
  { id:"8",  client:"BPW FRANCE",            title:"remboursement",                          priority:"Moyenne", date:"30/10/2025", project:"" },
  { id:"9",  client:"C LINE CUISINE",        title:"facturer",                               priority:"Moyenne", date:"14/10/2025", project:"" },
  { id:"10", client:"SAS GROUPE SEB FRANCE", title:"Refaire le devis",                       priority:"Moyenne", date:"14/10/2025", project:"Tabliers Lagostina" },
];

const TODOS_INIT: TodoItem[] = [
  { id:"1", label:"CHEQUE",  done: false },
  { id:"2", label:"NAS",     done: false },
  { id:"3", label:"Kidnans", done: false },
];

const WEEK: DaySchedule[] = [
  { label:"lundi",    date:"16 mars",  isToday: true,  tasks:[] },
  { label:"mardi",    date:"17 mars",  isToday: false, tasks:[] },
  { label:"mercredi", date:"18 mars",  isToday: false, tasks:[] },
  { label:"jeudi",    date:"19 mars",  isToday: false, tasks:[] },
  { label:"vendredi", date:"20 mars",  isToday: false, tasks:[] },
];

const ACTIVITY = [
  "Quelqu'un a mis à jour les clients",
  "Quelqu'un a mis à jour les clients",
  "Quelqu'un a mis à jour les clients",
  "Quelqu'un a mis à jour les clients",
  "Quelqu'un a mis à jour les clients",
];

// ─── Helpers ────────────────────────────────────────────────────────────────

const PRIORITY_STYLE: Record<Task["priority"], { bg: string; color: string }> = {
  Haute:   { bg: "#E8FF4C", color: "#000" },
  Moyenne: { bg: "#000",    color: "#E8FF4C" },
  Basse:   { bg: "#F0F0F0", color: "#6B6B6B" },
};

// ─── Shared UI ──────────────────────────────────────────────────────────────




const SeeMore = ({ count, onClick }: { count: number; onClick: () => void }) => (
  <button
    onClick={onClick}
    style={{
      marginTop: 10,
      background: "transparent",
      border: "none",
      cursor: "pointer",
      fontFamily: "'Instrument Sans', sans-serif",
      fontWeight: 600,
      fontSize: 11,
      color: "#9A9A9A",
      letterSpacing: "0.04em",
      textAlign: "left",
      padding: 0,
      display: "flex",
      alignItems: "center",
      gap: 4,
    }}
  >
    +{count} de plus →
  </button>
);

const DaysBadge = ({ days }: { days: number }) => (
  <span style={{
    fontFamily: "'Instrument Sans', sans-serif",
    fontWeight: 700,
    fontSize: 10,
    padding: "2px 7px",
    background: days >= 25 ? "#000" : "#F0F0F0",
    color: days >= 25 ? "#E8FF4C" : "#6B6B6B",
    letterSpacing: "0.04em",
    flexShrink: 0,
  }}>
    {days} nov.
  </span>
);

// ─── Sidebar icons (inline SVG, stroke-based, 16×16) ────────────────────────

const IcoHome     = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6.5L8 2l6 4.5V14H10v-3.5H6V14H2z"/></svg>;
const IcoFeed     = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="3.5" cy="12.5" r="1"/><path d="M2 8.5a6 6 0 0 1 6 6"/><path d="M2 4.5a10 10 0 0 1 10 10"/></svg>;
const IcoActivity = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>;
const IcoFinances = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="8" cy="8" r="6"/><path d="M8 5v6M6 6.5h3a1 1 0 0 1 0 2H7a1 1 0 0 0 0 2h3"/></svg>;
const IcoCRM      = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/></svg>;
const IcoProsp    = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="6.5" cy="6.5" r="4"/><path d="M10.5 10.5L14 14"/><path d="M6.5 4.5v4M4.5 6.5h4"/></svg>;
const IcoAgences  = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="12" height="8"/><path d="M5 6V4a3 3 0 0 1 6 0v2"/><path d="M2 10h12"/></svg>;
const IcoProjets  = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="12" height="12" rx="1"/><path d="M2 6h12"/><path d="M6 2v4"/></svg>;
const IcoMessages = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M14 10a2 2 0 0 1-2 2H5l-3 2V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z"/></svg>;
const IcoFAQ      = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="8" cy="8" r="6"/><path d="M6.5 6a1.5 1.5 0 0 1 3 0c0 1-1.5 1.5-1.5 2.5"/><circle cx="8" cy="11.5" r=".5" fill="currentColor"/></svg>;
const IcoSmash    = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2l1.5 4.5H14l-3.5 2.5 1.5 4.5L8 11l-4 2.5 1.5-4.5L2 6.5h4.5z"/></svg>;
const IcoSettings = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="2"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.1 3.1l1.4 1.4M11.5 11.5l1.4 1.4M3.1 12.9l1.4-1.4M11.5 4.5l1.4-1.4"/></svg>;

const NAV_ITEMS: { label: string; active: boolean; Icon: () => JSX.Element }[] = [
  { label: "Accueil",     active: true,  Icon: IcoHome     },
  { label: "Feed",        active: false, Icon: IcoFeed     },
  { label: "Activité",    active: false, Icon: IcoActivity },
  { label: "Finances",    active: false, Icon: IcoFinances },
  { label: "CRM",         active: false, Icon: IcoCRM      },
  { label: "Prospection", active: false, Icon: IcoProsp    },
  { label: "Agences",     active: false, Icon: IcoAgences  },
  { label: "Projets",     active: false, Icon: IcoProjets  },
  { label: "Messages",    active: false, Icon: IcoMessages },
  { label: "FAQ",         active: false, Icon: IcoFAQ      },
  { label: "Smash",       active: false, Icon: IcoSmash    },
  { label: "Paramètres",  active: false, Icon: IcoSettings },
];

const Sidebar = () => (
  <div style={{
    width: 188,
    minWidth: 188,
    background: "#0f1422",
    display: "flex",
    flexDirection: "column",
    padding: "20px 0",
    height: "100vh",
    position: "sticky",
    top: 0,
    flexShrink: 0,
  }}>
    {/* Logo */}
    <div style={{ padding: "0 16px 24px" }}>
      <svg style={{ width: 80, height: "auto" }} viewBox="0 0 375.9 122.4" xmlns="http://www.w3.org/2000/svg" fill="#fff">
        <path d="M40,58.6l20.6-10.4c2.2-1.1,3.6-3.3,3.6-5.8V0l-21,13.2c-1.9,1.3-3.1,3.3-3.1,5.6v39.8h-.1Z"/>
        <path d="M0,98.1l15-6.7c2.4-1.1,3.9-3.5,3.9-6V28.5l-15.9,9.9c-1.9,1.3-3.1,3.3-3.1,5.6v54.1Z"/>
        <path d="M91.5,105.6l25.9-8.5c2.6-.8,4.5-3.3,4.5-6.3V15.6l-26.8,13.6c-2.2,1.1-3.6,3.3-3.6,5.8v70.5s.1,0,.1,0Z"/>
        <path d="M39.9,122.4l19.6-6.4c2.6-.8,4.5-3.3,4.5-6.3v-41.4l-20.3,9c-2.4,1.1-3.9,3.5-3.9,6v39.1h.1Z"/>
        <path d="M218.7,61.1v-12.8h5.1v12.8c0,7.2-3.6,13.2-12.5,13.2s-12.5-6-12.5-13.2v-12.8h5.1v12.8c0,5.4,1.7,8.6,7.4,8.6s7.4-3.3,7.4-8.6Z"/>
        <path d="M262,66.8c0,4.9-3.3,7-8.8,7h-14.3v-25.6h12.1c7.9,0,9,3.6,9,6.5s-.7,4-2.6,5c3.5,1,4.6,3.3,4.6,7.1ZM244.1,52.4v5.4h7.5c2.8,0,3.8-1,3.8-2.6s-.7-2.8-4.3-2.8h-7,0ZM256.7,65.9c0-2.1-.6-3.8-5.1-3.8h-7.5v7.2h9.2c2.6,0,3.5-1.4,3.5-3.5h0Z"/>
        <path d="M289,59.2h8.5v4.3h-8.5v8.6h-5v-8.6h-8.5v-4.3h8.5v-8.6h5.1v8.6h-.1Z"/>
        <path d="M331.5,61.1v-12.8h5.1v12.8c0,7.2-3.6,13.2-12.5,13.2s-12.5-6-12.5-13.2v-12.8h5.1v12.8c0,5.4,1.7,8.6,7.4,8.6s7.4-3.3,7.4-8.6h0Z"/>
        <polygon points="178.5 48.1 178.5 58 164.6 63 164.6 48.1 159.6 48.1 159.6 73.7 164.6 73.7 164.6 67.6 178.5 62.6 178.5 73.7 183.7 73.7 183.7 48.1 178.5 48.1"/>
        <path d="M375.9,56.6c0-3.1-1.8-8.5-9-8.5h-15.2v25.6h5.1v-3.8l13.8-4.9h0c4-1.4,5.3-5.4,5.3-8.5ZM367.6,61.6l-10.7,3.9v-12.9h10c3.6,0,4.3,3.1,4.3,4.7s-.8,3.2-3.6,4.3h0Z"/>
      </svg>
    </div>

    {/* Nav */}
    <nav style={{ flex: 1, overflow: "auto" }}>
      {NAV_ITEMS.map(item => (
        <div
          key={item.label}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "9px 16px",
            margin: "1px 8px",
            borderRadius: 4,
            fontFamily: "'Instrument Sans', sans-serif",
            fontWeight: item.active ? 700 : 400,
            fontSize: 13,
            color: item.active ? "#000" : "#7a8099",
            background: item.active ? "#E8FF4C" : "transparent",
            cursor: "pointer",
            transition: "background 0.1s, color 0.1s",
          }}
        >
          <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
            <item.Icon />
          </span>
          {item.label}
        </div>
      ))}
    </nav>

    {/* Déconnexion */}
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "12px 24px",
      fontFamily: "'Instrument Sans', sans-serif",
      fontSize: 12,
      color: "#4a5068",
      cursor: "pointer",
      borderTop: "1px solid #1a2035",
      marginTop: 8,
    }}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M10 11l3-3-3-3M13 8H6"/>
      </svg>
      Déconnexion
    </div>
  </div>
);

// ─── Widget: Projets en retard ───────────────────────────────────────────────

const LateProjectsWidget = () => {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? LATE_PROJECTS : LATE_PROJECTS.slice(0, 5);
  const hidden = LATE_PROJECTS.length - 5;
  return (
    <Widget>
      <SectionTitle>Projets en retard</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {visible.map((p, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "9px 0",
              borderBottom: i < visible.length - 1 ? "1px solid #F0F0F0" : "none",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontFamily: "'Instrument Sans', sans-serif",
                fontWeight: 700,
                fontSize: 13,
                color: "#000",
                letterSpacing: "-0.01em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}>
                {p.name}
              </div>
              <div style={{ fontSize: 11, color: "#9A9A9A", fontFamily: "Roboto, sans-serif", marginTop: 1 }}>
                {p.client}
              </div>
            </div>
            <DaysBadge days={p.daysLate} />
          </div>
        ))}
      </div>
      {!expanded && hidden > 0 && (
        <SeeMore count={hidden} onClick={() => setExpanded(true)} />
      )}
    </Widget>
  );
};

// ─── Widget: Échéances ──────────────────────────────────────────────────────

const DeadlinesWidget = () => (
  <Widget>
    <SectionTitle>Échéances à venir</SectionTitle>
    <div style={{
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 0",
    }}>
      <span style={{ fontSize: 12, color: "#C0C0C0", fontFamily: "Roboto, sans-serif" }}>
        Aucune échéance cette semaine
      </span>
    </div>
  </Widget>
);

// ─── Widget: Rappels suivi client ────────────────────────────────────────────

const FollowUpsWidget = () => {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? FOLLOW_UPS : FOLLOW_UPS.slice(0, 5);
  const hidden = FOLLOW_UPS.length - 5;
  return (
    <Widget>
      <SectionTitle>Rappels de suivi client</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {visible.map((f, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "9px 0",
              borderBottom: i < visible.length - 1 ? "1px solid #F0F0F0" : "none",
            }}
          >
            <span style={{
              fontFamily: "'Instrument Sans', sans-serif",
              fontWeight: 600,
              fontSize: 13,
              color: "#000",
              letterSpacing: "-0.01em",
            }}>
              {f.client}
            </span>
            <DaysBadge days={f.daysLate} />
          </div>
        ))}
      </div>
      {!expanded && hidden > 0 && (
        <SeeMore count={hidden} onClick={() => setExpanded(true)} />
      )}
    </Widget>
  );
};

// ─── Widget: Activité récente ────────────────────────────────────────────────

const ActivityWidget = () => {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? ACTIVITY : ACTIVITY.slice(0, 5);
  const hidden = ACTIVITY.length - 5;
  return (
    <Widget style={{ gridColumn: "span 3" }}>
      <SectionTitle>Activité récente</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {visible.map((a, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 0",
              borderBottom: i < visible.length - 1 ? "1px solid #F0F0F0" : "none",
            }}
          >
            <span style={{ fontSize: 13, color: "#6B6B6B", fontFamily: "Roboto, sans-serif" }}>
              {a}
            </span>
            <span style={{ fontSize: 11, color: "#C0C0C0", fontFamily: "Roboto, sans-serif", flexShrink: 0 }}>
              13:07
            </span>
          </div>
        ))}
      </div>
      {!expanded && hidden > 0 && (
        <SeeMore count={hidden} onClick={() => setExpanded(true)} />
      )}
    </Widget>
  );
};

// ─── Widget: To-do list ──────────────────────────────────────────────────────

const TodoWidget = () => {
  const [todos, setTodos] = useState<TodoItem[]>(TODOS_INIT);
  const [input, setInput] = useState("");

  const toggle = (id: string) =>
    setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));

  const add = () => {
    const val = input.trim();
    if (!val) return;
    setTodos(prev => [...prev, { id: Date.now().toString(), label: val, done: false }]);
    setInput("");
  };

  return (
    <Widget>
      <SectionTitle>Ma to-do list</SectionTitle>

      {/* Input */}
      <div style={{
        display: "flex",
        border: "1px solid #E8E8E8",
        marginBottom: 12,
        background: "#F5F5F5",
      }}>
        <input
          type="text"
          placeholder="Ajouter une tâche… (Entrée)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && add()}
          style={{
            flex: 1,
            border: "none",
            background: "transparent",
            padding: "8px 12px",
            fontSize: 12,
            fontFamily: "Roboto, sans-serif",
            color: "#000",
            outline: "none",
          }}
        />
      </div>

      {/* Items */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {todos.map((t, i) => (
          <div
            key={t.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 0",
              borderBottom: i < todos.length - 1 ? "1px solid #F0F0F0" : "none",
              cursor: "pointer",
            }}
            onClick={() => toggle(t.id)}
          >
            <div style={{
              width: 16, height: 16,
              border: "1.5px solid",
              borderColor: t.done ? "#000" : "#D4D4D4",
              borderRadius: 2,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: t.done ? "#000" : "transparent",
              transition: "all 0.15s",
            }}>
              {t.done && (
                <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#E8FF4C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <span style={{
              fontSize: 13,
              fontFamily: "'Instrument Sans', sans-serif",
              fontWeight: 600,
              color: t.done ? "#C0C0C0" : "#000",
              textDecoration: t.done ? "line-through" : "none",
              letterSpacing: "-0.01em",
              transition: "all 0.15s",
            }}>
              {t.label}
            </span>
          </div>
        ))}
      </div>
    </Widget>
  );
};

// ─── Widget: Notes rapides ───────────────────────────────────────────────────

const NotesWidget = () => {
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState<string[]>([]);

  const save = () => {
    const val = note.trim();
    if (!val) return;
    setSaved(prev => [val, ...prev]);
    setNote("");
  };

  return (
    <Widget>
      <SectionTitle>Notes rapides</SectionTitle>
      <textarea
        placeholder="Écrire une note rapide… (utilisez @ pour mentionner quelqu'un)"
        value={note}
        onChange={e => setNote(e.target.value)}
        style={{
          width: "100%",
          minHeight: 80,
          border: "1px solid #E8E8E8",
          background: "#F5F5F5",
          padding: "10px 12px",
          fontFamily: "Roboto, sans-serif",
          fontSize: 12,
          color: "#000",
          outline: "none",
          resize: "vertical",
          marginBottom: 8,
        }}
      />
      <button
        onClick={save}
        style={{
          background: "#000",
          color: "#E8FF4C",
          border: "none",
          padding: "8px 14px",
          fontFamily: "'Instrument Sans', sans-serif",
          fontWeight: 700,
          fontSize: 12,
          cursor: "pointer",
          letterSpacing: "0.02em",
          alignSelf: "flex-start",
        }}
      >
        Ajouter la note
      </button>
      {saved.length === 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: "#C0C0C0", fontFamily: "Roboto, sans-serif" }}>
          Aucune note
        </div>
      )}
      {saved.map((s, i) => (
        <div key={i} style={{
          marginTop: 8,
          padding: "8px 10px",
          background: "#F5F5F5",
          fontSize: 12,
          fontFamily: "Roboto, sans-serif",
          color: "#333",
          borderLeft: "3px solid #E8FF4C",
        }}>
          {s}
        </div>
      ))}
    </Widget>
  );
};

// ─── Widget: À faire aujourd'hui ─────────────────────────────────────────────

const TasksWidget = () => {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? TASKS : TASKS.slice(0, 5);
  const hidden = TASKS.length - 5;

  return (
    <Widget>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <SectionTitle style={{ margin: 0 } as React.CSSProperties}>À faire aujourd'hui</SectionTitle>
        <span style={{
          fontFamily: "'Instrument Sans', sans-serif",
          fontWeight: 700,
          fontSize: 11,
          background: "#E8FF4C",
          color: "#000",
          padding: "2px 7px",
        }}>
          {TASKS.length}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {visible.map((t, i) => {
          const ps = PRIORITY_STYLE[t.priority];
          return (
            <div
              key={t.id}
              style={{
                padding: "10px 0",
                borderBottom: i < visible.length - 1 ? "1px solid #F0F0F0" : "none",
              }}
            >
              {t.client && (
                <div style={{
                  fontFamily: "'Instrument Sans', sans-serif",
                  fontWeight: 700,
                  fontSize: 10,
                  letterSpacing: "0.05em",
                  color: "#9A9A9A",
                  marginBottom: 3,
                }}>
                  {t.client}
                </div>
              )}
              <div style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 8,
              }}>
                <span style={{
                  fontFamily: "'Instrument Sans', sans-serif",
                  fontWeight: 600,
                  fontSize: 13,
                  color: "#000",
                  letterSpacing: "-0.01em",
                  lineHeight: 1.3,
                  flex: 1,
                }}>
                  {t.title}
                </span>
                <span style={{
                  fontFamily: "'Instrument Sans', sans-serif",
                  fontWeight: 700,
                  fontSize: 10,
                  padding: "2px 6px",
                  background: ps.bg,
                  color: ps.color,
                  flexShrink: 0,
                  letterSpacing: "0.03em",
                  marginTop: 1,
                }}>
                  {t.priority}
                </span>
              </div>
              {t.project && (
                <div style={{ fontSize: 11, color: "#C0C0C0", fontFamily: "Roboto, sans-serif", marginTop: 3 }}>
                  {t.project}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!expanded && hidden > 0 && (
        <SeeMore count={hidden} onClick={() => setExpanded(true)} />
      )}
    </Widget>
  );
};

// ─── Widget: Programme de la semaine ─────────────────────────────────────────

const WeekWidget = () => (
  <Widget style={{ gridColumn: "span 1" }}>
    <SectionTitle>Mon programme de la semaine</SectionTitle>
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {WEEK.map((day, i) => (
        <div
          key={i}
          style={{
            padding: "10px 0",
            borderBottom: i < WEEK.length - 1 ? "1px solid #F0F0F0" : "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{
              fontFamily: "'Instrument Sans', sans-serif",
              fontWeight: 700,
              fontSize: 13,
              color: "#000",
              letterSpacing: "-0.01em",
            }}>
              {day.label} {day.date}
            </span>
            {day.isToday && (
              <span style={{
                fontFamily: "'Instrument Sans', sans-serif",
                fontWeight: 700,
                fontSize: 10,
                background: "#E8FF4C",
                color: "#000",
                padding: "2px 7px",
                letterSpacing: "0.04em",
              }}>
                Aujourd'hui
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: "#C0C0C0", fontFamily: "Roboto, sans-serif" }}>
            {day.tasks.length === 0 ? "Aucune tâche" : day.tasks.join(", ")}
          </div>
        </div>
      ))}
    </div>
  </Widget>
);

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#fff", fontFamily: "Roboto, sans-serif" }}>

      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>

        {/* Topbar */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 28px",
          borderBottom: "1px solid #E8E8E8",
          background: "#fff",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#9A9A9A" strokeWidth="1.5">
              <circle cx="7" cy="7" r="5"/><path d="M10.5 10.5L14 14" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 13, fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600, color: "#9A9A9A" }}>FR</span>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "#E8FF4C",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Instrument Sans', sans-serif",
              fontWeight: 700, fontSize: 12, color: "#000",
            }}>CB</div>
            <span style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600, fontSize: 13, color: "#000" }}>
              Charles Baulu
            </span>
          </div>
        </div>

        {/* Page body */}
        <div style={{ padding: "32px 28px", maxWidth: 1280 }}>

          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{
              fontFamily: "'Instrument Sans', sans-serif",
              fontWeight: 700,
              fontSize: 28,
              color: "#000",
              letterSpacing: "-0.03em",
              lineHeight: 1,
              marginBottom: 4,
            }}>
              Bonjour Charles
            </h1>
            <p style={{ fontSize: 13, color: "#9A9A9A", fontFamily: "Roboto, sans-serif" }}>
              Lundi 16 Mars 2026
            </p>
          </div>

          {/* Row 1: 3 cols */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 16,
            marginBottom: 16,
          }}>
            <LateProjectsWidget />
            <DeadlinesWidget />
            <FollowUpsWidget />
          </div>

          {/* Row 2: activité full width */}
          <div style={{ marginBottom: 16 }}>
            <ActivityWidget />
          </div>

          {/* Row 3: 4 cols */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            gap: 16,
          }}>
            <TodoWidget />
            <NotesWidget />
            <TasksWidget />
            <WeekWidget />
          </div>

        </div>
      </div>
    </div>
  );
}
