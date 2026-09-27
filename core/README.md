# Svara Core

The Python core owns Svara's plugin kernel, configuration, protocol, providers, voice pipeline,
agent, tools, and persistence. It must not depend on a particular desktop shell.

The complete v1 dependency baseline is locked for standard CPython 3.14 in `uv.lock`. Run
`make smoke-deps` from the repository root to import every runtime package and exercise the four
native dependency paths selected by the architecture.
