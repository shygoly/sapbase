# Output schemas: definition-step API

Canonical JSON shapes returned by `POST /api/ai-modules/definition-step` per `stepId`. System prompts and parsers should align with these.

## Step 1: object-model

```json
{
  "entities": [
    {
      "identifier": "EntityName",
      "label": "Optional display name",
      "fields": [
        {
          "name": "fieldName",
          "label": "Optional label",
          "type": "string | number | boolean | date",
          "required": false
        }
      ]
    }
  ]
}
```

- `entities`: array of entity descriptors.
- Each entity: `identifier` (PascalCase), optional `label`, `fields` array.
- Each field: `name` (camelCase), optional `label`, `type`, optional `required`.

---

## Step 2: relationships

```json
{
  "relationships": [
    {
      "source": "SourceEntity",
      "target": "TargetEntity",
      "type": "one-to-one | one-to-many | many-to-many",
      "description": "optional"
    }
  ]
}
```

---

## Step 3: state-flow

```json
{
  "states": [
    {
      "name": "stateName",
      "initial": false,
      "transitions": ["targetState"]
    }
  ]
}
```

---

## Step 4: pages

```json
{
  "pages": [
    {
      "identifier": "PageId",
      "label": "Page title",
      "type": "list | form | detail",
      "entity": "EntityName"
    }
  ]
}
```

---

## Step 5: permissions

```json
{
  "rules": [
    {
      "role": "roleName",
      "scope": "own | team | all",
      "resources": ["EntityName"]
    }
  ]
}
```

---

## Step 6: reports

```json
{
  "reports": [
    {
      "identifier": "ReportId",
      "label": "Report title",
      "entities": ["EntityName"],
      "description": "optional"
    }
  ]
}
```
