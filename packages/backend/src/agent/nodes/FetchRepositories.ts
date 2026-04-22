import { StateAnnotation, DbDirective } from "../state";
import { RunnableConfig } from "@langchain/core/runnables";
import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";

export async function FetchRepositories(
  state: typeof StateAnnotation.State,
  config?: RunnableConfig
) {
  if (state.repositories && state.repositories.length > 0) {
    return {}; // already fetched
  }

  if (state.githubHandle) {
    await dispatchCustomEvent("progress", { msg: `Fetching GitHub repos for ${state.githubHandle}` }, config);
    const fetchHeaders: any = {};
    if (process.env.GITHUB_TOKEN)
      fetchHeaders["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
    let repos: any[] = [];
    let page = 1;
    while (true) {
      const response = await fetch(
        `https://api.github.com/users/${state.githubHandle}/repos?type=owner&sort=updated&per_page=100&page=${page}`,
        { headers: fetchHeaders }
      );
      const batch = await response.json();
      if (!Array.isArray(batch) || batch.length === 0) break;
      repos = repos.concat(batch);
      page++;
    }
    const finalRepos = repos
      .filter((r: any) => !r.fork)
      .map((r: any) => ({
        name: r.name,
        url: r.html_url,
        description: r.description,
        updatedAt: r.updated_at,
      }));
      
    await dispatchCustomEvent("progress", { msg: `Found ${finalRepos.length} target repositories.` }, config);
    return { repositories: finalRepos };
  }

  return {};
}
