# Model Profiles

Model profiles control which Codex model each GSD agent uses. This allows balancing quality vs token spend.

## Profile Definitions

| Agent | `quality` | `balanced` | `budget` |
|-------|-----------|------------|----------|
| gsd-planner | gpt-5.2-codex | gpt-5.2-codex | gpt-5.1-codex-mini |
| gsd-roadmapper | gpt-5.2-codex | gpt-5.1-codex | gpt-5.1-codex-mini |
| gsd-executor | gpt-5.2-codex | gpt-5.1-codex | gpt-5.1-codex-mini |
| gsd-phase-researcher | gpt-5.2-codex | gpt-5.1-codex-mini | gpt-5.1-codex-mini |
| gsd-project-researcher | gpt-5.2-codex | gpt-5.1-codex-mini | gpt-5.1-codex-mini |
| gsd-research-synthesizer | gpt-5.2-codex | gpt-5.1-codex | gpt-5.1-codex-mini |
| gsd-debugger | gpt-5.2-codex | gpt-5.1-codex | gpt-5.1-codex-mini |
| gsd-codebase-mapper | gpt-5.1-codex-mini | gpt-5.1-codex-mini | gpt-5.1-codex-mini |
| gsd-verifier | gpt-5.2-codex | gpt-5.1-codex | gpt-5.1-codex-mini |
| gsd-plan-checker | gpt-5.2-codex | gpt-5.1-codex | gpt-5.1-codex-mini |
| gsd-integration-checker | gpt-5.2-codex | gpt-5.1-codex | gpt-5.1-codex-mini |

## Profile Philosophy

**quality** - Maximum reasoning power
- gpt-5.2-codex for decision-making agents
- gpt-5.1-codex-mini for read-only mapping
- Use when: quota available, critical architecture work

**balanced** (default) - Smart allocation
- gpt-5.2-codex for planning (architecture decisions)
- gpt-5.1-codex for execution and verification
- gpt-5.1-codex-mini for research and mapping
- Use when: normal development, good balance of quality and cost

**budget** - Minimal spend
- gpt-5.1-codex-mini for most agents
- Use when: conserving quota, high-volume work, less critical phases

## Resolution Logic

Orchestrators resolve model before spawning:

```
1. Read .planning/config.json
2. Get model_profile (default: "balanced")
3. Look up agent in table above
4. Pass model parameter to Task call
```

## Switching Profiles

Runtime: `/gsd:set-profile <profile>`

Per-project default: Set in `.planning/config.json`:
```json
{
  "model_profile": "balanced"
}
```

## Design Rationale

**Why gpt-5.2-codex for gsd-planner?**
Planning involves architecture decisions, goal decomposition, and task design. This is where model quality has the highest impact.

**Why gpt-5.1-codex for gsd-executor?**
Executors follow explicit PLAN.md instructions. The plan already contains the reasoning; execution is implementation.

**Why gpt-5.1-codex (not mini) for verifiers in balanced?**
Verification requires goal-backward reasoning - checking if code *delivers* what the phase promised, not just pattern matching. The full model handles subtle gaps better than mini.

**Why gpt-5.1-codex-mini for gsd-codebase-mapper?**
Read-only exploration and pattern extraction. No reasoning required, just structured output from file contents.
