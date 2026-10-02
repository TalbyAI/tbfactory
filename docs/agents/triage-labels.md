# Triage Labels

The five canonical triage roles map directly to the status strings used in this repo's local Markdown issue tracker.

| Canonical role | Tracker status | Meaning |
| --- | --- | --- |
| `needs-triage` | `needs-triage` | Maintainer needs to evaluate this issue |
| `needs-info` | `needs-info` | Waiting on reporter for more information |
| `ready-for-agent` | `ready-for-agent` | Fully specified, ready for an autonomous agent |
| `ready-for-human` | `ready-for-human` | Requires human implementation |
| `wontfix` | `wontfix` | Will not be actioned |

When a skill says to apply a triage label, set the issue file's `Status:` line to the corresponding tracker status.

Edit the tracker status column to change the vocabulary.
