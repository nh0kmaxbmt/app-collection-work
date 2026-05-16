{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "FlightManualTemplate",
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "name": { "type": "string" },
    "tags": { "type": "array", "items": { "type": "string" } },
    "baseSteps": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "text": { "type": "string" },
          "isCompleted": { "type": "boolean" },
          "isLocked": { "type": "boolean" },
          "dependsOnStepId": { "type": "string" }
        },
        "required": ["id", "text", "isCompleted", "isLocked"]
      }
    },
    "branchingStep": {
      "type": "object",
      "properties": {
        "question": { "type": "string" },
        "options": {
          "type": "object",
          "additionalProperties": {
            "type": "array",
            "items": { "$ref": "#/properties/baseSteps/items" }
          }
        }
      },
      "required": ["question", "options"]
    }
  },
  "required": ["id", "name", "baseSteps"]
}