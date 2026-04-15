export function buildPrompt(values) {
  const tokens = {
    url: values.url?.trim() || '<string>',
    audience: values.audience?.trim() || '<string>',
    scope: values.scope?.trim() || '<string>',
    business_context: values.business_context?.trim() || '<string>',
    existing_data: values.existing_data?.trim() || '<string>',
    constraints: values.constraints?.trim() || '<string>',
    max_tasks: values.max_tasks?.trim() || '25'
  };

  return `# Top Task Research Prompt\n\nurl: ${tokens.url}\naudience: ${tokens.audience}\nscope: ${tokens.scope}\nbusiness_context: ${tokens.business_context}\nexisting_data: ${tokens.existing_data}\nconstraints: ${tokens.constraints}\nmax_tasks: ${tokens.max_tasks}`;
}
