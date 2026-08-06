import { Outlet } from "react-router";
import NavTabs from "./NavTabs";

/**
 * The two debug screens answer two different questions — why registrations
 * fail, and whether search returns the right animal — so they are separate
 * addresses under one section rather than one screen with a mode switch.
 */
export default function DebugLayout() {
  return (
    <>
      <div>
        <NavTabs
          items={[
            { to: "/debug/searches", label: "Searches" },
            { to: "/debug/registrations", label: "Registrations" },
          ]}
        />
      </div>
      <Outlet />
    </>
  );
}
