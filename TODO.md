# TODO

## Done

- Fixed ThemeProvider TDZ error (`handleSystemThemeChange` before initialization) and restored reliable light/dark/system selection (raw localStorage + system media listener).
- Implemented instant route transitions: Data Cache Service, Navigation Service state machine, high-fidelity skeletons (no spinners), SmartLink prefetch, shared workspace layout, route error boundary. Rollback via `INSTANT_NAV_ENABLED` / `NEXT_PUBLIC_INSTANT_NAV=0`.
