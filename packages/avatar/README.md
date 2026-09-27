# `@svara/avatar`

Framework-agnostic TypeScript for loading VRM avatars and playing visemes, expressions, gestures,
and idle behaviours. This package must not import React or desktop-shell APIs.

The T0.8 `PerformancePlayer` is pure clock-driven code: it interpolates the 15 internal viseme
channels, applies closure dominance and the amplitude envelope, and lets `AvatarRenderer` retarget
the result to standard VRM mouth expressions.
