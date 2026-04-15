import { GithubRepoLoader } from "@langchain/community/document_loaders/web/github";

async function run() {
  const loader = new GithubRepoLoader("https://github.com/langchain-ai/langchainjs", { branch: "main", recursive: false });
  // Just parsing the repo, dont actually load
  console.log("Looks fine!");
}
run();
