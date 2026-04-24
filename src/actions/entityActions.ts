import { useEntityStore } from "../store/useEntityStore";
import { dbOps } from "../db/indexedDB";

export const fetchEntities = async () => {
  try {
    const skills = await dbOps.getSkills();
    const exps = await dbOps.getExperiences();
    const projs = await dbOps.getProjects();
    const edus = await dbOps.getEducations();
    useEntityStore
      .getState()
      .setEntityState({ entities: { skills, experiences: exps, projects: projs, educations: edus } });
  } catch (e) {
    console.error("Failed to fetch entities", e);
  }
};

export const deleteEntity = async (type: "skill" | "experience" | "education" | "project", id: string | number) => {
  try {
    if (type === "skill") await dbOps.deleteSkill(id as string);
    if (type === "experience") await dbOps.deleteExperience(id as string);
    if (type === "education") await dbOps.deleteEducation(id as string);
    if (type === "project") await dbOps.deleteProject(id as string);
    await fetchEntities();
  } catch (e) {
    console.error("Failed to delete entity", e);
  }
};
