# Durable Event Catalog

Status: Phase 29 baseline contract for workflow consumers.

The durable event catalog describes events published through `event_outbox`.
Rows in `activity_events` are derived analytics/history projections and are
not the primary publication contract for workflows or integrations.

## Delivery Semantics

- Source of truth: `event_outbox`
- Delivery model: at-least-once publication with database-enforced durable identity
- Duplicate protection: unique `(tenant_id, event_id)` plus claim transitions from persisted status
- Retry behavior: bounded retry using `attempts`, `max_attempts`, `next_attempt_at`, and terminal `failed` status
- Envelope version: top-level `envelope_version = 1`
- Payload version: event-specific `payload_version`, starting at `1`
- Primary v1 consumer: workflow engine planned in Phase 30
- Derived read model: `activity_events` for analytics, history, KPI, and timeline reads

## Envelope v1

Every durable event row carries stable workflow-facing metadata:

| Field | Contract |
|-------|----------|
| `event_id` | Durable UUID identity, unique within a tenant |
| `event_name` | Dotted domain event name |
| `envelope_version` | Outer contract version, currently `1` |
| `tenant_id` | Required company/workspace scope |
| `actor_id` | User who caused the fact, or `NULL` for system events |
| `object_type` | Generic acted-on noun |
| `object_id` | UUID of the primary object |
| `project_id` | Optional project scope |
| `causation_id` | Optional upstream event/action id |
| `correlation_id` | Optional request/workflow correlation id |
| `payload_version` | Domain payload version |
| `payload` | Domain-owned JSON payload |

Consumers must branch on `event_name`, `envelope_version`, and
`payload_version`; they must not infer schema from incidental payload shape.

## Event: `records.collection.created`

| Property | Value |
|----------|-------|
| Event name | `records.collection.created` |
| Object type | `data_collection` |
| Envelope version | `1` |
| Payload version | `1` |
| Primary consumer | Phase 30 workflow engine |
| Derived projection | One `activity_events` row with the same verb/object metadata |

### Business Fact

A records collection was created together with its default table view as one
atomic business action.

### Payload v1

```json
{
  "collection": {
    "id": "uuid",
    "name": "Clients",
    "schema": []
  },
  "defaultView": {
    "id": "uuid",
    "name": "Table",
    "type": "table"
  }
}
```

The event is emitted from `createCollectionWithDefaultView` in the same
database transaction that inserts `data_collections` and `collection_views`.

### Deferred Scope

Phase 29 intentionally does not add a general outbox inspection API/UI, and it
does not migrate all legacy `recordEvent()` call sites. New durable events
should be added one domain fact at a time with an explicit catalog entry.
