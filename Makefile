UV ?= uv
PNPM ?= corepack pnpm

PYTHON_PATHS := core/src core/tests

.PHONY: setup lint lint-python lint-typescript test test-python test-typescript gen dev demo

setup:
	$(UV) sync --project core --locked
	$(PNPM) install --frozen-lockfile

lint: lint-python lint-typescript

lint-python:
	$(UV) run --project core ruff check $(PYTHON_PATHS)
	$(UV) run --project core ruff format --check $(PYTHON_PATHS)
	$(UV) run --project core pyright --project core/pyproject.toml

lint-typescript:
	$(PNPM) lint

test: test-python test-typescript

test-python:
	$(UV) run --project core pytest -c core/pyproject.toml

test-typescript:
	$(PNPM) test

gen:
	@echo "No generated schemas yet; generators arrive with T1.2 and T1.6."

dev:
	@echo "The dev runtime is not available until the core and desktop shell are composed." >&2
	@exit 2

demo:
	@echo "Demo mode is implemented in T1.13." >&2
	@exit 2
