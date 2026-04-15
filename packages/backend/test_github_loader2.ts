import { GithubRepoLoader } from "@langchain/community/document_loaders/web/github";

async function run() {
  const loader = new GithubRepoLoader("https://github.com/lguibr/daicer", { branch: "main", recursive: false });
  console.log("Branch configured as:", (loader as any).branch);
}
run();
