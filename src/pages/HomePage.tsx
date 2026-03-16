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
    <div style={{ fontFamily: "Roboto, sans-serif", background: "#fff", minHeight: "100vh" }}>
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
  );
}
