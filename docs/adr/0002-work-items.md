---
status: accepted
---

# Work Items as the central domain concept

The Factory will center on Work Items representing pull requests, tasks, features, and other matters, rather than restrict its domain to code review. A Work Item has its own identity, is a collection of Facts accumulated over time about a specific task, and may originate inside the Factory without an external source. Pull request review is the first process, with GitHub and Azure DevOps integration.

An external source's state change is recorded as a Fact; the Work Item's Factory State Transition happens afterward through an automated mechanism or manual authorization and is validated by the Factory. A Workflow is one way to update this state, rather than the sole authority over it. Facts are immutable and corrections are recorded as new Facts, preserving the history instead of rewriting earlier occurrences.

The Factory stores the current Work Item state and records every State Transition as a Fact; complete state reconstruction by replay is not an initial requirement. Each Work Item belongs to one Organization and one Project, with an optional Repository association. An external resource has at most one corresponding Work Item per Organization and Work Item Type; other Work Items may reference it, and repeated delivery of the same event must not duplicate Facts.
