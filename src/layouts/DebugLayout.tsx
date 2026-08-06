import { useRef, useState } from "react";
import DebugRegistrationsPanel from "./DebugRegistrationsPanel";
import DebugSearchesPanel from "./DebugSearchesPanel";
import NavTabs, { type NavTabItem } from "./NavTabs";

type DebugTab = "searches" | "registrations";

/**
 * A godhaar ID to jump the Searches screen to, with a token that changes on
 * every request even when the ID repeats — otherwise a second click on the
 * same animal from a different row would set identical state and never fire
 * the effect that applies it.
 */
export type AnimalJump = { animal: string; token: number };

/**
 * The two debug screens answer two different questions — why registrations
 * fail, and whether search returns the right animal — so they get separate
 * tabs rather than one screen with a mode switch. Held in state rather than
 * an address, same as everywhere else in this app.
 *
 * The one thing that crosses between them is "every other record touching
 * this animal": a registration card or a search card can name an animal that
 * appears elsewhere, and following that needs to switch tabs *and* set the
 * Searches filters. That round trip is owned here, one level above both.
 */
export default function DebugLayout() {
  const [tab, setTab] = useState<DebugTab>("searches");
  const [jump, setJump] = useState<AnimalJump | null>(null);
  const jumpToken = useRef(0);

  function jumpToAnimal(animal: string) {
    jumpToken.current += 1;
    setJump({ animal, token: jumpToken.current });
    setTab("searches");
  }

  const items: NavTabItem[] = [
    {
      key: "searches",
      label: "Searches",
      active: tab === "searches",
      onSelect: () => setTab("searches"),
    },
    {
      key: "registrations",
      label: "Registrations",
      active: tab === "registrations",
      onSelect: () => setTab("registrations"),
    },
  ];

  return (
    <>
      <div>
        <NavTabs items={items} />
      </div>
      {tab === "searches" ? (
        <DebugSearchesPanel
          jump={jump}
          onJumpHandled={() => setJump(null)}
          onNavigateToAnimal={jumpToAnimal}
        />
      ) : (
        <DebugRegistrationsPanel onNavigateToAnimal={jumpToAnimal} />
      )}
    </>
  );
}
