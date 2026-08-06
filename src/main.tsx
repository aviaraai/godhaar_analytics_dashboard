import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router";
import App from "./App.tsx";
import { ForbiddenError, UnauthorizedError } from "./lib/api.ts";
import { signOut } from "./lib/session.ts";
import "./index.css";

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      // Any request can be the one that discovers the token is no longer good.
      // The backend is the authority on that, so its verdict wins over whatever
      // the SDK still holds locally: dropping the session here turns a 401 into
      // a clean return to the login screen instead of a dead dashboard behind
      // an error dialog.
      if (error instanceof UnauthorizedError) {
        void signOut();
      }
    },
  }),
  defaultOptions: {
    queries: {
      // Admin-only tool with a small request budget. Results stay fresh long
      // enough to flip back and forth between filter combinations for free,
      // and stay in memory a while longer so returning to one is instant —
      // but neither lasts the whole session.
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      // Only an explicit button press should reach the backend. `refetchOnMount`
      // is left at its default so switching back to a filter set whose cache has
      // gone stale does re-fetch instead of showing indefinitely old numbers.
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      // One retry for the usual transient faults, but never for an auth
      // verdict — 401 and 403 will not change on a second attempt, and
      // retrying only delays the screen that explains what happened.
      retry: (failureCount, error) =>
        !(error instanceof UnauthorizedError) &&
        !(error instanceof ForbiddenError) &&
        failureCount < 1,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
