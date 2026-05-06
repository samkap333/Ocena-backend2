exports.runWorkflow = async (workflow, payload) => {
  if (!workflow.enabled) {
    return { skipped: true };
  }

  return { workflowId: workflow.id, payload, actions: workflow.actions };
};
