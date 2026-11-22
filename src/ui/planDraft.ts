// Session keys for the plan editor (kept apart so the Plan tab can use them without loading the editor's code)
/** The editor's unsaved draft of a plan */
export const draftKey = (id: string) => "bf-plan-draft-" + id;
/** Marks a plan made with "New plan" that hasn't been kept yet: Cancel deletes it (Nov 22 2026) */
export const newPlanKey = (id: string) => "bf-plan-new-" + id;
