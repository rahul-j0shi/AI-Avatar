# 0016 — Distribute an Ubuntu deb without automatic updates
Status: Accepted

Context: v1 targets two Ubuntu LTS releases and needs a normal app-grid entry, declared native
dependencies, clean uninstall behavior, and an offline demo. Supporting several Linux package
systems or an updater would add release engineering and security scope before the application itself
is proven. The product boundary is defined in
[Feature F38](../revamp/12-feature-specification.md#f38--packaging--distribution).

Decision:
- Build one amd64 `.deb` on Ubuntu 24.04 and test it on clean Ubuntu 24.04 and 26.04 systems.
- Install the application, desktop entry, icon, licenses, notices, and declared system dependencies.
- Publish release artifacts and SHA-256 checksums through GitHub Releases.
- Preserve user data on ordinary uninstall; remove it only through purge or the explicit reset flow.
- Do not ship Snap, Flatpak, a PPA/APT repository, code signing, or automatic updates in v1.
- Treat any AppImage as unsupported if one is produced for convenience.

Consequences:
- Installation integrates naturally with the supported Ubuntu versions and remains straightforward to
  diagnose.
- Users download and install updates manually and must trust checksums from the release page.
- Other distributions and CPU architectures are unsupported.
- Release engineering remains narrow enough to test install, run, offline demo, uninstall, and purge
  end to end in clean VMs.

Evidence:
- T7.1–T7.3 build the package, generate notices and checksums, and run the clean-VM matrix.
- The F38 acceptance test requires no orphan process and a working offline demo after installation.
