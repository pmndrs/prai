# Best Practices


1. **Schema Design**: Use descriptive schemas especially using `.describe("...")` to provide context for schema fields.
2. **Model Selection**: Choose appropriate models based on task complexity and speed requirements
3. **Parallel Processing**: Use subtasks for independent operations - see [History - Subtasks](../concepts/history.md#subtasks)
4. **Streaming**: Use streaming for long-running content generation tasks for a better UX
5. **Testing**: Test your workflows with mock providers during development
6. **Specialized Steps**: Use built-in functions for data processing - see [Special Step Types](./special-step-types.md)
7. **State Management**: Persist workflow state when needed - see [History - State Management](../concepts/history.md#state-management)
8. **Monitoring**: Implement proper logging and event handling - see [History - Event System](../concepts/history.md#event-system)