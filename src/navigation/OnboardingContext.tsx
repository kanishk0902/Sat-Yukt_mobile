import { createContext } from "react";

/**
 * Lets a deeply-nested screen signal the top-level App.tsx to swap between
 * the Onboarding and Main stacks, without an awkward cross-navigator reset
 * call. completeOnboarding: LocationPermissionScreen (last onboarding step).
 * uncompleteOnboarding: Settings' "reset onboarding" testing option.
 */
export const OnboardingContext = createContext<{
  completeOnboarding: () => void;
  uncompleteOnboarding: () => void;
}>({
  completeOnboarding: () => {},
  uncompleteOnboarding: () => {},
});
