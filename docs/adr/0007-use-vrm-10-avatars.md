# 0007 — Use VRM 1.0 avatars with a CC0 default
Status: Accepted

Context: Svara needs a portable humanoid format with standardized expressions, look-at behavior, and
mouth blend shapes. Ready Player Me is no longer a viable platform dependency, and a proprietary
avatar service would make the product and portfolio demo fragile. The asset and renderer design is
in [Avatar §1](../revamp/03-avatar-and-lipsync.md#1-avatar-format-vrm-10-not-ready-player-me).

Decision:
- Use VRM 1.0 rendered by three.js and `@pixiv/three-vrm`.
- Ship one CC0 VRoid preset exported as VRM 1.0, with its source and license recorded.
- Load rendering through the framework-agnostic `@svara/avatar` package.
- Keep per-avatar appearance, framing, retargeting, and animation choices in `avatar.json` rather than
  forking model files.
- Track VRM and VRMA binaries with Git LFS and record all asset licenses.

Consequences:
- Avatars remain local, inspectable, replaceable, and reusable by the future extension or web demo.
- The renderer must handle VRM coordinate conventions and validate required humanoid and expression
  metadata.
- Models with different mouth shapes need explicit retarget profiles.
- Svara does not provide an avatar marketplace or depend on a hosted creator in v1.

Evidence:
- T0.12 exports the chosen default, commits it through LFS, and records its license.
- T2.4 verifies loading, framing, and live application of `avatar.json`.
